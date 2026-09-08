import OpenAI, { APIConnectionTimeoutError, APIError } from "openai";
import { toJSONSchema } from "zod/v4";
import type { z } from "zod";

// ---------------------------------------------------------------------------
// OpenAI (via Azure AI Foundry's OpenAI-compatible v1 endpoint) — the default
// text provider for Product Intelligence. Uses the Responses API
// (`client.responses.create`), not Chat Completions — this endpoint is
// addressed as `.../openai/v1/responses`.
//
// No native structured-output enforcement is relied on here: the schema is
// embedded in the prompt as JSON Schema text, and the response is parsed and
// Zod-validated after the fact, exactly like every other provider in this
// app — never trust raw model output.
// ---------------------------------------------------------------------------

const OPENAI_MODEL = "gpt-5.6-sol";
const DEFAULT_BASE_URL = "https://epiaus2.services.ai.azure.com/openai/v1";
const REQUEST_TIMEOUT_MS = 30_000;
/** Web search runs a multi-round agentic tool loop (several searches, often
 * a page open) before answering — even at low reasoning effort this
 * regularly takes well past 30s, verified manually against the real
 * endpoint. Product Intelligence's plain structured calls keep the shorter
 * client-level default above; this is a per-request override for search
 * only. */
const WEB_SEARCH_TIMEOUT_MS = 180_000;

export interface OpenAiGenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  responseSchema: z.ZodTypeAny;
  temperature?: number;
  maxOutputTokens?: number;
}

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (_client) return _client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local and restart the server."
    );
  }

  // No automatic retries: rate-limit/auth/config failures should surface
  // immediately rather than silently re-billing the same request.
  _client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL,
    maxRetries: 0,
    timeout: REQUEST_TIMEOUT_MS,
  });
  return _client;
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

type ParseResult =
  | { success: true; data: unknown }
  | { success: false; error: string };

function tryParseAndValidate(text: string, schema: z.ZodTypeAny): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(text));
  } catch {
    return { success: false, error: "response was not valid JSON" };
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    return { success: false, error: "response did not match the required schema" };
  }
  return { success: true, data: result.data };
}

/** A safe, user-facing message — never the raw response body and never the
 * API key. Timeout is checked first: `APIConnectionTimeoutError` is itself a
 * subclass of `APIError` (status `undefined`, and — unlike most custom Error
 * subclasses — it does not override `.name`, so string-matching `.name`
 * silently never matches), so it would otherwise be swallowed by the generic
 * branch below. */
function messageForError(err: unknown): string {
  if (err instanceof APIConnectionTimeoutError) {
    return "OpenAI request timed out.";
  }
  if (err instanceof APIError) {
    if (err.status === 401 || err.status === 403) return "OpenAI authentication failed.";
    if (err.status === 429) return "OpenAI rate limit or quota exceeded.";
    return `OpenAI request failed (${err.status ?? "unknown status"}).`;
  }
  return "Could not reach OpenAI.";
}

interface InputTurn {
  role: "user" | "assistant";
  content: string;
}

async function createResponse(
  client: OpenAI,
  systemPrompt: string,
  input: string | InputTurn[],
  options: { temperature?: number; maxOutputTokens?: number }
): Promise<string> {
  let outputText: string | null | undefined;
  try {
    const response = await client.responses.create({
      model: OPENAI_MODEL,
      instructions: systemPrompt,
      input,
      // gpt-5.6-sol is a reasoning-class model on this deployment — it
      // rejects `temperature` outright ("Unsupported parameter") rather than
      // ignoring it, and always reasons at its own fixed sampling settings.
      // `options.temperature` is accepted for interface parity with the
      // other providers but intentionally not forwarded here.
      max_output_tokens: options.maxOutputTokens ?? 2000,
    });
    outputText = response.output_text;
  } catch (err) {
    // Concise diagnostic only — never the full error object, which can carry
    // request headers.
    console.error(
      `[openai] request failed${err instanceof APIError ? ` (${err.status})` : ""}`
    );
    throw new Error(messageForError(err));
  }

  if (!outputText) {
    throw new Error("OpenAI returned an empty response.");
  }
  return outputText;
}

/**
 * Send a structured-output request to OpenAI (gpt-5.6-sol via the Responses
 * API by default) and return the parsed, Zod-validated result.
 *
 * Same contract as the other providers: ask for JSON in the prompt, parse,
 * strip markdown fences if present, JSON.parse, validate against the
 * existing Zod schema, and — on malformed output only — attempt exactly one
 * short repair pass before giving up. HTTP-level failures (auth, rate limit,
 * timeout) are never retried.
 */
export async function generateOpenAiStructuredResponse(
  options: OpenAiGenerateOptions
): Promise<unknown> {
  const client = getClient();
  const schemaJson = JSON.stringify(toJSONSchema(options.responseSchema));

  const systemPrompt = `${options.systemPrompt}\n\nRespond with ONLY a single JSON object matching this JSON Schema exactly. No markdown code fences, no commentary before or after it.\n\nJSON Schema:\n${schemaJson}`;

  const raw = await createResponse(client, systemPrompt, options.userPrompt, options);
  const attempt = tryParseAndValidate(raw, options.responseSchema);
  if (attempt.success) return attempt.data;

  console.warn(`[openai] Malformed structured output (${attempt.error}) — one repair attempt.`);

  const repairInput: InputTurn[] = [
    { role: "user", content: options.userPrompt },
    { role: "assistant", content: raw },
    {
      role: "user",
      content: `That was not valid — ${attempt.error}. Return ONLY the corrected JSON object, nothing else.`,
    },
  ];

  const repaired = await createResponse(client, systemPrompt, repairInput, options);
  const repairedAttempt = tryParseAndValidate(repaired, options.responseSchema);
  if (repairedAttempt.success) return repairedAttempt.data;

  throw new Error("OpenAI returned invalid structured output after one repair attempt.");
}

// ---------------------------------------------------------------------------
// Web search (Responses API `web_search` tool) — Growth Opportunity
// Discovery only. Separate from `generateOpenAiStructuredResponse` above:
// this needs the `web_search` tool and citation extraction, neither of which
// Product Intelligence uses.
//
// Cost note: gpt-5.6-sol is a reasoning model, and reasoning + tool-call
// tokens count against `max_output_tokens`. At the default reasoning effort
// it can spiral into 10+ search rounds before answering (empirically ~40k
// input / ~2k output tokens for one request); `reasoning: { effort: "low" }`
// keeps it to a couple of focused search rounds (~6k input / ~350 output)
// while still finding relevant results — verified manually against the real
// endpoint before wiring this in.
// ---------------------------------------------------------------------------

export interface OpenAiWebSearchCitation {
  url: string;
  title?: string;
}

export interface OpenAiWebSearchOptions {
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens?: number;
}

export interface OpenAiWebSearchResult {
  /** Raw text response — the caller extracts/validates JSON from this. */
  text: string;
  /** Every URL the web search tool actually found or visited (search result
   * sources, opened pages, and any inline citations on the final message) —
   * the ground truth for "is this a real source", independent of whether the
   * model bothered to cite it inline. */
  citations: OpenAiWebSearchCitation[];
}

export async function generateOpenAiWebSearchResponse(
  options: OpenAiWebSearchOptions
): Promise<OpenAiWebSearchResult> {
  const client = getClient();

  let response;
  try {
    response = await client.responses.create(
      {
        model: OPENAI_MODEL,
        instructions: options.systemPrompt,
        input: options.userPrompt,
        tools: [{ type: "web_search", search_context_size: "low" }],
        include: ["web_search_call.action.sources"],
        reasoning: { effort: "low" },
        max_output_tokens: options.maxOutputTokens ?? 6000,
      },
      { timeout: WEB_SEARCH_TIMEOUT_MS }
    );
  } catch (err) {
    // Concise diagnostic only — never the full error object.
    console.error(`[openai] web search request failed: ${messageForError(err)}`);
    throw new Error(messageForError(err));
  }

  const text = response.output_text;
  if (!text) {
    throw new Error("OpenAI returned an empty response.");
  }

  const citations: OpenAiWebSearchCitation[] = [];
  const seen = new Set<string>();
  const addCitation = (url: string | null | undefined, title?: string) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    citations.push({ url, title });
  };

  for (const item of response.output ?? []) {
    if (item.type === "message") {
      for (const part of item.content) {
        if (part.type === "output_text") {
          for (const annotation of part.annotations) {
            if (annotation.type === "url_citation") {
              addCitation(annotation.url, annotation.title);
            }
          }
        }
      }
    } else if (item.type === "web_search_call") {
      const { action } = item;
      if (action.type === "search") {
        for (const source of action.sources ?? []) addCitation(source.url);
      } else if (action.type === "open_page" || action.type === "find_in_page") {
        addCitation(action.url);
      }
    }
  }

  return { text, citations };
}
