import { toJSONSchema } from "zod/v4";
import type { z } from "zod";

import { AIProviderError, type AIErrorKind } from "../errors";
import type {
  AIOperation,
  AIProviderAdapter,
  StructuredGenerateOptions,
  WebSearchCitation,
  WebSearchOptions,
  WebSearchResult,
} from "../types";
import {
  hasFreeTierGrounding,
  isFreeTierModel,
  isGemini25,
  resolveGeminiModel,
} from "./gemini-models";

// ---------------------------------------------------------------------------
// Gemini adapter (Gemini API, generateContent REST endpoint) — FREE TIER ONLY.
//
// Implements the provider-agnostic contract in ../types. Nothing Gemini-
// specific (request format, response objects, groundingMetadata) leaves this
// file. Called with plain `fetch` — no SDK, so there are no hidden automatic
// retries and nothing we did not ask for is ever sent.
//
// Free-tier protections (see gemini-models.ts for the policy itself):
//   - Only allowlisted free-tier models are ever called.
//   - Google Search grounding only on models whose grounding is free.
//   - No automatic retries on HTTP failures; a 429 puts that model (or
//     grounding) into a local cooldown so repeated clicks do not hammer an
//     exhausted quota. Quotas are per PROJECT, not per key — the cooldown and
//     the soft daily grounding cap are per-process approximations of that.
//   - Conservative output-token limits.
//   - Logs: operation, model, latency, token usage. Never the API key,
//     prompts, screenshots, or user content.
// ---------------------------------------------------------------------------

const PROVIDER = "gemini";
const API_BASE =
  process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";

const STRUCTURED_TIMEOUT_MS = Number(process.env.GEMINI_STRUCTURED_TIMEOUT_MS ?? 90_000);
const SEARCH_TIMEOUT_MS = Number(process.env.GEMINI_SEARCH_TIMEOUT_MS ?? 90_000);
const REDIRECT_RESOLVE_TIMEOUT_MS = 5_000;
const MAX_CITATIONS_TO_RESOLVE = 30;
const DEFAULT_SEARCH_MAX_OUTPUT_TOKENS = 4096;

/** Soft per-process cap below the documented 500 RPD shared allowance. */
function groundingDailyLimit(): number {
  return Number(process.env.GEMINI_GROUNDING_DAILY_LIMIT ?? 400);
}

function groundingEnabled(): boolean {
  return (process.env.GEMINI_GROUNDING_ENABLED ?? "true").toLowerCase() !== "false";
}

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new AIProviderError(
      "configuration",
      "GEMINI_API_KEY is not set. Add it to .env.local and restart the server.",
      { provider: PROVIDER }
    );
  }
  return key;
}

function assertFreeTierModel(model: string, operation: AIOperation): void {
  if (!isFreeTierModel(model)) {
    throw new AIProviderError(
      "free_tier_unavailable",
      `Gemini model "${model}" (configured for ${operation}) is not on Growwwly's free-tier allowlist, so it was not called.`,
      { provider: PROVIDER }
    );
  }
}

// ---------------------------------------------------------------------------
// Quota cooldown — never re-send a request that just hit 429.
// ---------------------------------------------------------------------------

const cooldowns = new Map<string, { until: number; kind: AIErrorKind; message: string }>();

function checkCooldown(key: string): void {
  const entry = cooldowns.get(key);
  if (!entry) return;
  const remaining = entry.until - Date.now();
  if (remaining <= 0) {
    cooldowns.delete(key);
    return;
  }
  throw new AIProviderError(entry.kind, entry.message, {
    provider: PROVIDER,
    retryAfterSeconds: Math.ceil(remaining / 1000),
  });
}

function startCooldown(key: string, err: AIProviderError): void {
  if (err.kind !== "quota_exhausted" && err.kind !== "rate_limited" && err.kind !== "free_tier_unavailable") {
    return;
  }
  const fallbackSeconds = err.kind === "rate_limited" ? 60 : 15 * 60;
  const seconds = err.retryAfterSeconds ?? fallbackSeconds;
  cooldowns.set(key, { until: Date.now() + seconds * 1000, kind: err.kind, message: err.message });
}

/** Exposed for tests only. */
export function __resetGeminiStateForTests(): void {
  cooldowns.clear();
  groundingUsage.day = "";
  groundingUsage.count = 0;
}

// ---------------------------------------------------------------------------
// Soft daily grounding counter (resets at midnight Pacific, like Google's RPD).
// ---------------------------------------------------------------------------

const groundingUsage = { day: "", count: 0 };

function pacificDay(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}

function reserveGroundingRequest(): void {
  const day = pacificDay();
  if (groundingUsage.day !== day) {
    groundingUsage.day = day;
    groundingUsage.count = 0;
  }
  if (groundingUsage.count >= groundingDailyLimit()) {
    throw new AIProviderError(
      "quota_exhausted",
      "Opportunity discovery has reached today's free Google Search grounding limit. It resets at midnight Pacific time.",
      { provider: PROVIDER }
    );
  }
  groundingUsage.count += 1;
}

// ---------------------------------------------------------------------------
// HTTP + error mapping
// ---------------------------------------------------------------------------

interface GeminiPart {
  text?: string;
  thought?: boolean;
  inline_data?: { mime_type: string; data: string };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
    groundingMetadata?: {
      webSearchQueries?: string[];
      groundingChunks?: { web?: { uri?: string; title?: string } }[];
    };
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    toolUsePromptTokenCount?: number;
    totalTokenCount?: number;
  };
  modelVersion?: string;
}

interface GeminiErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: Array<{
      "@type"?: string;
      retryDelay?: string;
      violations?: { quotaId?: string; quotaMetric?: string; quotaValue?: string }[];
    }>;
  };
}

function parseRetryDelay(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const m = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
  return m ? Math.ceil(Number(m[1])) : undefined;
}

/** Exported for unit tests. Maps a Gemini HTTP error to a safe AIProviderError. */
export function mapGeminiHttpError(
  httpStatus: number,
  body: GeminiErrorBody | null,
  context: { model: string; operation: AIOperation; grounding?: boolean }
): AIProviderError {
  const err = body?.error;
  const status = err?.status ?? "";
  const message = err?.message ?? "";
  const details = err?.details ?? [];
  const retryAfterSeconds = parseRetryDelay(
    details.find((d) => d["@type"]?.endsWith("RetryInfo"))?.retryDelay
  );
  const violations = details.find((d) => d["@type"]?.endsWith("QuotaFailure"))?.violations ?? [];
  const quotaIds = violations.map((v) => `${v.quotaId ?? ""} ${v.quotaMetric ?? ""}`).join(" ");
  const feature = context.grounding ? "Google Search grounding" : `model ${context.model}`;
  const opts = { provider: PROVIDER, retryAfterSeconds };

  if (httpStatus === 429 || status === "RESOURCE_EXHAUSTED") {
    // "limit: 0" / quotaValue "0" = the free tier gives this project no quota
    // at all for this model/feature — it is not something that resets.
    // A 429 with no quota violation and no retry hint that points at "plan
    // and billing" is the same thing: verified 2026-11-14 — a grounding
    // request on gemini-3.5-flash-lite from a no-billing project fails this
    // way on its very first call.
    const zeroLimit =
      /limit:\s*0\b/.test(message) ||
      violations.some((v) => v.quotaValue === "0") ||
      (violations.length === 0 &&
        retryAfterSeconds === undefined &&
        /plan and billing/i.test(message));
    if (zeroLimit) {
      return new AIProviderError(
        "free_tier_unavailable",
        `Gemini free tier has no quota for ${feature} on this project.`,
        { provider: PROVIDER }
      );
    }
    if (/per\s*day|PerDay/i.test(`${quotaIds} ${message}`)) {
      return new AIProviderError(
        "quota_exhausted",
        `Gemini free-tier daily quota exhausted for ${feature}. It resets at midnight Pacific time.`,
        opts
      );
    }
    return new AIProviderError(
      "rate_limited",
      `Gemini free-tier rate limit reached for ${feature}${retryAfterSeconds ? `; retry in ~${retryAfterSeconds}s` : ""}.`,
      opts
    );
  }
  if (httpStatus === 401 || httpStatus === 403 || /API key not valid/i.test(message)) {
    return new AIProviderError(
      "authentication",
      httpStatus === 403
        ? `Gemini denied access to ${feature} for this API key/project.`
        : "Gemini authentication failed — check GEMINI_API_KEY.",
      opts
    );
  }
  if (status === "FAILED_PRECONDITION") {
    return new AIProviderError(
      "free_tier_unavailable",
      `Gemini free tier is not available for ${feature} on this project (FAILED_PRECONDITION).`,
      opts
    );
  }
  if (httpStatus === 404) {
    return new AIProviderError(
      "configuration",
      `Gemini model "${context.model}" was not found or is not accessible to this API key.`,
      opts
    );
  }
  if (httpStatus >= 500) {
    return new AIProviderError("server_error", `Gemini server error (${httpStatus}).`, opts);
  }
  return new AIProviderError("request_error", `Gemini request failed (${httpStatus}).`, opts);
}

interface CallResult {
  response: GeminiResponse;
  latencyMs: number;
}

async function callGenerateContent(
  model: string,
  body: Record<string, unknown>,
  ctx: { operation: AIOperation; timeoutMs: number; grounding?: boolean }
): Promise<CallResult> {
  const apiKey = getApiKey();
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ctx.timeoutMs),
    });
  } catch (err) {
    const latencyMs = Date.now() - started;
    const isTimeout =
      err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    console.error(
      `[gemini] op=${ctx.operation} model=${model} failed=${isTimeout ? "timeout" : "connection"} latency=${latencyMs}ms`
    );
    throw isTimeout
      ? new AIProviderError("timeout", `Gemini request timed out after ${ctx.timeoutMs}ms.`, {
          provider: PROVIDER,
        })
      : new AIProviderError("connection", "Could not reach the Gemini API.", {
          provider: PROVIDER,
        });
  }

  const latencyMs = Date.now() - started;
  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as GeminiErrorBody | null;
    const mapped = mapGeminiHttpError(res.status, errBody, {
      model,
      operation: ctx.operation,
      grounding: ctx.grounding,
    });
    // Google's error message never contains the key; truncate defensively.
    const detail = (errBody?.error?.message ?? "").slice(0, 300).replace(/\s+/g, " ");
    console.error(
      `[gemini] op=${ctx.operation} model=${model} http=${res.status} kind=${mapped.kind} latency=${latencyMs}ms detail="${detail}"`
    );
    throw mapped;
  }

  const response = (await res.json()) as GeminiResponse;
  const u = response.usageMetadata ?? {};
  console.log(
    `[gemini] op=${ctx.operation} model=${response.modelVersion ?? model} latency=${latencyMs}ms ` +
      `tokens: prompt=${u.promptTokenCount ?? "?"} output=${u.candidatesTokenCount ?? "?"} ` +
      `thinking=${u.thoughtsTokenCount ?? 0} toolPrompt=${u.toolUsePromptTokenCount ?? 0} total=${u.totalTokenCount ?? "?"} ` +
      `finish=${response.candidates?.[0]?.finishReason ?? "none"}`
  );
  return { response, latencyMs };
}

function extractText(response: GeminiResponse): string {
  if (response.promptFeedback?.blockReason) {
    throw new AIProviderError(
      "invalid_output",
      `Gemini blocked the request (${response.promptFeedback.blockReason}).`,
      { provider: PROVIDER }
    );
  }
  const candidate = response.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  if (!text) {
    const reason = candidate?.finishReason;
    throw new AIProviderError(
      "invalid_output",
      reason && reason !== "STOP"
        ? `Gemini returned no content (finish reason: ${reason}).`
        : "Gemini returned an empty response.",
      { provider: PROVIDER }
    );
  }
  return text;
}

function thinkingConfig(model: string, operation: AIOperation): Record<string, unknown> {
  if (isGemini25(model)) {
    // Flash-Lite does not think by default; Flash gets a small bounded budget.
    const fallback = operation === "fast" || operation === "opportunity" || /lite/.test(model) ? 0 : 1024;
    return { thinkingBudget: Number(process.env.GEMINI_THINKING_BUDGET ?? fallback) };
  }
  return { thinkingLevel: process.env.GEMINI_THINKING_LEVEL || "low" };
}

/** Thinking tokens count against maxOutputTokens on Gemini, so the answer
 * budget the caller asked for is kept intact by adding explicit headroom. */
function thinkingHeadroom(config: Record<string, unknown>): number {
  if (typeof config.thinkingBudget === "number") return Math.max(0, config.thinkingBudget);
  return Number(process.env.GEMINI_THINKING_HEADROOM_TOKENS ?? 4096);
}

// ---------------------------------------------------------------------------
// Structured output
// ---------------------------------------------------------------------------

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

type ParseResult = { success: true; data: unknown } | { success: false; error: string };

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

/** JSON Schema for `responseJsonSchema`. `$schema` is dropped — the API
 * does not need the dialect marker — and array `maxItems`/`minItems` are
 * removed: verified 2026-11-14 that gemini-3.5-flash-lite rejects the
 * opportunity schema with HTTP 400 "invalid argument" when they are present
 * (and accepts it without them). The Zod schema still enforces every limit
 * when the response is validated, so nothing is loosened app-side. */
export function toGeminiJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const json = toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return stripArrayBounds(json) as Record<string, unknown>;
}

function stripArrayBounds(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripArrayBounds);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "maxItems" || key === "minItems") continue;
    out[key] = stripArrayBounds(value);
  }
  return out;
}

function nativeSchemaEnabled(): boolean {
  return (process.env.GEMINI_NATIVE_SCHEMA ?? "true").toLowerCase() !== "false";
}

/**
 * Same contract as the OpenAI adapter: returns parsed, Zod-validated data;
 * at most one repair pass on malformed output; HTTP failures never retried.
 */
export async function generateGeminiStructuredResponse(
  options: StructuredGenerateOptions
): Promise<unknown> {
  const operation = options.operation ?? "product";
  const model = resolveGeminiModel(operation);
  assertFreeTierModel(model, operation);
  checkCooldown(`model:${model}`);

  const native = nativeSchemaEnabled();
  const jsonSchema = toGeminiJsonSchema(options.responseSchema);
  const systemPrompt = native
    ? options.systemPrompt
    : `${options.systemPrompt}\n\nRespond with ONLY a single JSON object matching this JSON Schema exactly. No markdown code fences, no commentary before or after it.\n\nJSON Schema:\n${JSON.stringify(jsonSchema)}`;

  const userParts: GeminiPart[] = [{ text: options.userPrompt }];
  for (const img of options.images ?? []) {
    userParts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
  }

  const thinking = thinkingConfig(model, operation);
  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    maxOutputTokens: (options.maxOutputTokens ?? 2000) + thinkingHeadroom(thinking),
    thinkingConfig: thinking,
  };
  if (native) generationConfig.responseJsonSchema = jsonSchema;
  if (typeof options.temperature === "number") generationConfig.temperature = options.temperature;

  const send = async (contents: GeminiContent[]): Promise<string> => {
    try {
      const { response } = await callGenerateContent(
        model,
        { systemInstruction: { parts: [{ text: systemPrompt }] }, contents, generationConfig },
        { operation, timeoutMs: STRUCTURED_TIMEOUT_MS }
      );
      return extractText(response);
    } catch (err) {
      if (err instanceof AIProviderError) startCooldown(`model:${model}`, err);
      throw err;
    }
  };

  const raw = await send([{ role: "user", parts: userParts }]);
  const attempt = tryParseAndValidate(raw, options.responseSchema);
  if (attempt.success) return attempt.data;

  console.warn(`[gemini] op=${operation} malformed structured output (${attempt.error}) — one repair attempt.`);

  // Repair pass carries text only — screenshots are not re-sent.
  const repaired = await send([
    { role: "user", parts: [{ text: options.userPrompt }] },
    { role: "model", parts: [{ text: raw }] },
    {
      role: "user",
      parts: [
        {
          text: `That was not valid — ${attempt.error}. Return ONLY the corrected JSON object, nothing else.`,
        },
      ],
    },
  ]);
  const repairedAttempt = tryParseAndValidate(repaired, options.responseSchema);
  if (repairedAttempt.success) return repairedAttempt.data;

  throw new AIProviderError(
    "invalid_output",
    "Gemini returned invalid structured output after one repair attempt.",
    { provider: PROVIDER }
  );
}

// ---------------------------------------------------------------------------
// Web search — Google Search grounding. One bounded grounded request per
// discovery; the model may run a few searches inside it, but it is billed /
// counted as one grounded prompt. Gemini 2.5 cannot combine grounding with
// responseJsonSchema, so JSON is requested in the prompt (exactly as the
// existing opportunity prompt already does) and validated by the caller.
// ---------------------------------------------------------------------------

const GROUNDING_REDIRECT_HOST = "vertexaisearch.cloud.google.com";

/** Grounding chunk URIs are Google redirect links; resolve each to the real
 * publisher URL by reading the redirect's Location header (never following
 * it, never fetching the target). Unresolvable links are dropped rather than
 * guessed. Exported for tests. */
export async function resolveGroundingUri(uri: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (parsed.hostname !== GROUNDING_REDIRECT_HOST) return parsed.toString();

  for (const method of ["HEAD", "GET"] as const) {
    try {
      const res = await fetch(parsed.toString(), {
        method,
        redirect: "manual",
        signal: AbortSignal.timeout(REDIRECT_RESOLVE_TIMEOUT_MS),
      });
      const location = res.headers.get("location");
      res.body?.cancel().catch(() => {});
      if (location && /^https?:\/\//i.test(location)) return location;
    } catch {
      // try the next method / give up
    }
  }
  return null;
}

export async function generateGeminiWebSearchResponse(
  options: WebSearchOptions
): Promise<WebSearchResult> {
  const operation = options.operation ?? "opportunity";
  const model = resolveGeminiModel(operation);

  if (!groundingEnabled()) {
    throw new AIProviderError(
      "unsupported_capability",
      "Google Search grounding is disabled (GEMINI_GROUNDING_ENABLED=false).",
      { provider: PROVIDER }
    );
  }
  assertFreeTierModel(model, operation);
  if (!hasFreeTierGrounding(model)) {
    throw new AIProviderError(
      "free_tier_unavailable",
      `Google Search grounding is not free on the Gemini free tier for "${model}" (Gemini 3+ grounding is paid-only). Free grounding exists only on gemini-2.5-flash-lite / gemini-2.5-flash, which new projects can no longer access.`,
      { provider: PROVIDER }
    );
  }
  checkCooldown("grounding");
  checkCooldown(`model:${model}`);
  reserveGroundingRequest();

  const thinking = thinkingConfig(model, operation);
  let response: GeminiResponse;
  try {
    ({ response } = await callGenerateContent(
      model,
      {
        systemInstruction: { parts: [{ text: options.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: options.userPrompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens:
            (options.maxOutputTokens ?? DEFAULT_SEARCH_MAX_OUTPUT_TOKENS) + thinkingHeadroom(thinking),
          thinkingConfig: thinking,
        },
      },
      { operation, timeoutMs: SEARCH_TIMEOUT_MS, grounding: true }
    ));
  } catch (err) {
    if (err instanceof AIProviderError) startCooldown("grounding", err);
    throw err;
  }

  let text = extractText(response);
  const metadata = response.candidates?.[0]?.groundingMetadata;
  const chunks = (metadata?.groundingChunks ?? [])
    .map((c) => c.web)
    .filter((w): w is { uri: string; title?: string } => typeof w?.uri === "string")
    .slice(0, MAX_CITATIONS_TO_RESOLVE);

  console.log(
    `[gemini] op=${operation} grounding: queries=${metadata?.webSearchQueries?.length ?? 0} chunks=${chunks.length}`
  );

  const resolved = await Promise.all(chunks.map((c) => resolveGroundingUri(c.uri)));

  const citations: WebSearchCitation[] = [];
  const seen = new Set<string>();
  resolved.forEach((url, i) => {
    if (!url) return;
    // If the model echoed a redirect link in its JSON, swap in the real URL
    // Google resolved it to — still a URL the search actually returned.
    if (chunks[i].uri !== url) text = text.split(chunks[i].uri).join(url);
    if (seen.has(url)) return;
    seen.add(url);
    citations.push({ url, title: chunks[i].title });
  });

  console.log(
    `[gemini] op=${operation} grounding: resolved ${citations.length}/${chunks.length} source URLs`
  );

  return { text, citations };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const geminiAdapter: AIProviderAdapter = {
  name: "gemini",
  capabilities: (operation?: AIOperation) => {
    const model = resolveGeminiModel(operation ?? "product");
    const searchModel = resolveGeminiModel("opportunity");
    return {
      structuredOutput: true,
      imageInput: true,
      webSearch: groundingEnabled() && hasFreeTierGrounding(searchModel),
      toolCalling: isFreeTierModel(model),
    };
  },
  generateStructured: generateGeminiStructuredResponse,
  searchWeb: generateGeminiWebSearchResponse,
};
