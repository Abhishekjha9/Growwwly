import { GoogleGenAI } from "@google/genai";
import { toJSONSchema } from "zod/v4";
import type { z } from "zod";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Centralised model name — change here to switch globally. */
const GEMINI_MODEL = "gemini-3.5-flash";

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (_client) return _client;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local and restart the server."
    );
  }

  _client = new GoogleGenAI({ apiKey });
  return _client;
}

// ---------------------------------------------------------------------------
// JSON Schema → Gemini-compatible schema
// ---------------------------------------------------------------------------

/**
 * Strips fields that Gemini's structured-output API does not support
 * ($schema, additionalProperties) from a standard JSON Schema object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cleanSchemaForGemini(schema: Record<string, any>): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cleaned: Record<string, any> = {};

  for (const [key, value] of Object.entries(schema)) {
    // Skip fields Gemini doesn't understand
    if (key === "$schema" || key === "additionalProperties") continue;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      cleaned[key] = cleanSchemaForGemini(value);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GeminiImagePart {
  /** e.g. "image/jpeg" */
  mimeType: string;
  /** base64-encoded image bytes (no `data:` prefix). */
  data: string;
}

export interface GeminiGenerateOptions {
  /** System-level instruction */
  systemPrompt: string;
  /** User-facing prompt */
  userPrompt: string;
  /** Zod schema the response must conform to */
  responseSchema: z.ZodTypeAny;
  /** Optional temperature override (default: model default) */
  temperature?: number;
  /** Optional images for multimodal input (e.g. website screenshots) — still
   * the same Gemini model and client, just additional content parts. */
  images?: GeminiImagePart[];
  /** Optional output-token cap — every AI task should set one explicitly
   * rather than paying for an unbounded response (see `@/lib/ai/client`). */
  maxOutputTokens?: number;
}

/**
 * Send a structured-output request to Gemini and return the parsed JSON.
 *
 * Uses Zod v4's toJSONSchema() to convert the Zod schema into standard
 * JSON Schema, strips unsupported fields, then passes it to Gemini.
 *
 * The caller is responsible for further Zod validation of the returned object
 * (Gemini's structural guarantee is best-effort, so we always double-check).
 */
export async function generateStructuredResponse(
  options: GeminiGenerateOptions
): Promise<unknown> {
  const client = getClient();

  // Convert Zod → JSON Schema → Gemini-safe schema
  const rawJsonSchema = toJSONSchema(options.responseSchema);
  const geminiSchema = cleanSchemaForGemini(
    rawJsonSchema as Record<string, unknown>
  );

  const contents =
    options.images && options.images.length > 0
      ? [
          options.userPrompt,
          ...options.images.map((image) => ({
            inlineData: { mimeType: image.mimeType, data: image.data },
          })),
        ]
      : options.userPrompt;

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: options.systemPrompt,
      responseMimeType: "application/json",
      responseSchema: geminiSchema,
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Gemini returned invalid JSON.");
  }
}

// ---------------------------------------------------------------------------
// Grounded generation (Google Search) — Growth Opportunity Discovery only
// ---------------------------------------------------------------------------
//
// Gemini's API does not allow combining a Google Search tool with structured
// output (`responseSchema`/`responseMimeType: "application/json"`) in the
// same request — the two are mutually exclusive. `generateStructuredResponse`
// above stays untouched for Phase 1/3; this is a separate path used only by
// the Opportunity Discovery engine, which asks for JSON in the prompt itself
// and validates the result with Zod afterward (see `@/lib/opportunities`).

/** A single web source Gemini's Google Search grounding actually retrieved.
 * Used to confirm opportunities are backed by a real search result rather
 * than invented by the model — never trust the model's prose alone. */
export interface GeminiGroundingSource {
  title?: string;
  uri?: string;
  domain?: string;
}

export interface GeminiGroundedResult {
  /** Raw text response — the caller extracts/validates JSON from this. */
  text: string;
  /** Actual grounded sources returned by Google Search, if any. */
  groundingSources: GeminiGroundingSource[];
  /** The search queries Gemini actually issued, if reported. */
  webSearchQueries: string[];
}

export interface GeminiGroundedGenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

/**
 * Send a Google Search-grounded request to Gemini. Unlike
 * `generateStructuredResponse`, this does not (and cannot) enforce a JSON
 * schema server-side — the prompt must ask for JSON explicitly, and the
 * caller must parse and Zod-validate `text` itself.
 */
export async function generateGroundedResponse(
  options: GeminiGroundedGenerateOptions
): Promise<GeminiGroundedResult> {
  const client = getClient();

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: options.userPrompt,
    config: {
      systemInstruction: options.systemPrompt,
      temperature: options.temperature,
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
  const groundingSources: GeminiGroundingSource[] = (
    groundingMetadata?.groundingChunks ?? []
  )
    .map((chunk) => chunk.web)
    .filter((web): web is NonNullable<typeof web> => Boolean(web?.uri))
    .map((web) => ({ title: web.title, uri: web.uri, domain: web.domain }));

  return {
    text,
    groundingSources,
    webSearchQueries: groundingMetadata?.webSearchQueries ?? [],
  };
}
