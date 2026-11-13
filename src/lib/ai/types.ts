import type { z } from "zod";

// ---------------------------------------------------------------------------
// Provider-agnostic AI contract.
//
// This is the ONLY shape application code (Product Intelligence, Website
// Intelligence, Opportunity Feed) depends on. Provider adapters
// (`providers/openai.ts`, `providers/gemini.ts`, a future Groq adapter)
// translate it into their own request/response formats. No provider SDK
// type, request format, or response object ever crosses this boundary.
//
// The structured-output options are the original OpenAI-compatible options
// (`systemPrompt`, `userPrompt`, `responseSchema`, `temperature`,
// `maxOutputTokens`, `images`) — kept as the stable foundation — plus an
// optional `operation` used for per-operation model routing and logging.
// ---------------------------------------------------------------------------

/** Which application feature a request belongs to. Adapters use it to pick
 * a model (e.g. GEMINI_PRODUCT_MODEL vs GEMINI_WEBSITE_MODEL) and to label
 * logs. Never affects prompts, schemas, or validation. */
export type AIOperation = "product" | "website" | "opportunity" | "fast";

export interface AIImageInput {
  mimeType: string;
  /** Base64-encoded bytes (no `data:` prefix). Never logged. */
  data: string;
}

export interface StructuredGenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  responseSchema: z.ZodTypeAny;
  temperature?: number;
  maxOutputTokens?: number;
  images?: AIImageInput[];
  operation?: AIOperation;
}

export interface WebSearchCitation {
  url: string;
  title?: string;
}

export interface WebSearchOptions {
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens?: number;
  operation?: AIOperation;
}

export interface WebSearchResult {
  /** Raw text response — the caller extracts/validates JSON from this. */
  text: string;
  /** Every real URL the provider's search tool actually returned — the
   * ground truth for "is this a real source". Never model-written text. */
  citations: WebSearchCitation[];
}

/** What a provider can actually do. Capabilities differ between providers
 * (and between models of one provider); callers check these instead of
 * assuming every provider is identical. */
export interface AIProviderCapabilities {
  structuredOutput: boolean;
  imageInput: boolean;
  /** Live web search / grounding with real source URLs. */
  webSearch: boolean;
  toolCalling: boolean;
}

export interface AIProviderAdapter {
  readonly name: AIProviderName;
  capabilities(operation?: AIOperation): AIProviderCapabilities;
  generateStructured(options: StructuredGenerateOptions): Promise<unknown>;
  /** Present only when the provider implements web search at all; use
   * `capabilities().webSearch` to know whether it is usable right now. */
  searchWeb?(options: WebSearchOptions): Promise<WebSearchResult>;
}

export const AI_PROVIDER_NAMES = ["openai", "gemini"] as const;
export type AIProviderName = (typeof AI_PROVIDER_NAMES)[number];
