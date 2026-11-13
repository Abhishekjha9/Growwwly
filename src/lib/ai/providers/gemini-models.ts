import type { AIOperation } from "../types";

// ---------------------------------------------------------------------------
// Gemini model routing + FREE-TIER POLICY.
//
// Growwwly runs Gemini on the free tier only. This module is the guard that
// keeps it there: a model is only ever called if it is on the free-tier
// allowlist below, and Google Search grounding is only ever requested on a
// model whose grounding is documented as free on the free tier.
//
// Source: https://aistudio.google.com/docs/pricing (Standard tab), read
// 2026-11-14. Re-verify before changing these lists.
//
//   Free-of-charge input + output on the free tier:
//     gemini-3.8-flash, gemini-3.6-flash, gemini-3.5-flash-lite,
//     gemini-3.1-flash-lite, gemini-2.5-flash-lite, gemini-4-hydrogen,
//     gemini-2.5-flash (DEPRECATED — from 2026-12-01 every request to it is
//     silently routed to gemini-3.5-flash-lite).
//   Paid-only (NOT allowed): gemini-4-carbon, gemini-4-argon,
//     gemini-3.1-pro-preview, image models, …
//
//   Grounding with Google Search, Free Tier column:
//     gemini-2.5-flash / gemini-2.5-flash-lite:
//       "Free of charge, up to 500 RPD (limit shared with Flash[-Lite] RPD)"
//       — ONE shared 500/day allowance, not 500 per model.
//     All Gemini 3+ models: "Not available" (paid tier only).
//
//   gemini-2.5-flash is excluded from the grounding allowlist on purpose:
//   after 2026-12-01 it routes to gemini-3.5-flash-lite, whose free tier has
//   no grounding.
// ---------------------------------------------------------------------------

export const DEFAULT_FREE_TIER_MODELS: readonly string[] = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-4-hydrogen",
];

export const DEFAULT_FREE_GROUNDING_MODELS: readonly string[] = ["gemini-2.5-flash-lite"];

/** Defaults — chosen from models verified with a real request against the
 * project's API key (see the migration report). Override per operation. */
//
// Verified with real requests on 2026-11-14 (no-billing project):
//   gemini-3.6-flash       OK — text, image input, responseJsonSchema
//   gemini-3.5-flash-lite  OK — text, image input, responseJsonSchema
//   gemini-3.8-flash       listed, but HTTP 503 "high demand" on every try
//   gemini-2.5-flash(-lite) HTTP 404 "no longer available to new users"
//   google_search on gemini-3.5-flash-lite → HTTP 429 on the first request
//     ("check your plan and billing") — grounding is not free on Gemini 3+.
// So on a new project NO accessible model has free grounding; the
// opportunity default below is deliberately a model whose grounding is NOT
// allowlisted, which makes the Opportunity Feed fail fast with a clear
// "not available on the free tier" error instead of sending a request.
export const DEFAULT_MODELS: Record<AIOperation, string> = {
  product: "gemini-3.6-flash",
  website: "gemini-3.6-flash",
  opportunity: "gemini-3.5-flash-lite",
  fast: "gemini-3.5-flash-lite",
};

const MODEL_ENV: Record<AIOperation, string> = {
  product: "GEMINI_PRODUCT_MODEL",
  website: "GEMINI_WEBSITE_MODEL",
  opportunity: "GEMINI_OPPORTUNITY_MODEL",
  fast: "GEMINI_FAST_MODEL",
};

function listFromEnv(name: string, fallback: readonly string[]): string[] {
  const raw = process.env[name];
  if (!raw || !raw.trim()) return [...fallback];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Strip an optional `models/` prefix so "models/gemini-x" == "gemini-x". */
function bareModelId(model: string): string {
  return model.replace(/^models\//, "").trim();
}

export function resolveGeminiModel(operation: AIOperation = "product"): string {
  return bareModelId(process.env[MODEL_ENV[operation]] || DEFAULT_MODELS[operation]);
}

export function freeTierModels(): string[] {
  return listFromEnv("GEMINI_FREE_TIER_MODELS", DEFAULT_FREE_TIER_MODELS).map(bareModelId);
}

export function freeGroundingModels(): string[] {
  return listFromEnv("GEMINI_FREE_GROUNDING_MODELS", DEFAULT_FREE_GROUNDING_MODELS).map(
    bareModelId
  );
}

export function isFreeTierModel(model: string): boolean {
  return freeTierModels().includes(bareModelId(model));
}

export function hasFreeTierGrounding(model: string): boolean {
  return isFreeTierModel(model) && freeGroundingModels().includes(bareModelId(model));
}

/** Gemini 2.5 models take `thinkingBudget`; Gemini 3+ take `thinkingLevel`. */
export function isGemini25(model: string): boolean {
  return /^gemini-2\.5-/.test(bareModelId(model));
}
