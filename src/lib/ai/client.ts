import { AIProviderError } from "./errors";
import { geminiAdapter } from "./providers/gemini";
import { openAiAdapter } from "./providers/openai";
import {
  AI_PROVIDER_NAMES,
  type AIOperation,
  type AIProviderAdapter,
  type AIProviderCapabilities,
  type AIProviderName,
  type StructuredGenerateOptions,
  type WebSearchOptions,
  type WebSearchResult,
} from "./types";

// ---------------------------------------------------------------------------
// The AI provider abstraction. Application code calls ONLY the functions in
// this file (and the types in ./types / ./errors) — never a provider module
// or SDK directly.
//
// Provider selection: AI_PROVIDER=gemini | openai (default: gemini).
// Switching provider is configuration-only; Product Intelligence, Website
// Intelligence, the Opportunity Feed, the Growth Engine and the frontend do
// not change.
// ---------------------------------------------------------------------------

export type { AIProviderName as AIProvider } from "./types";
export type { StructuredGenerateOptions, WebSearchOptions, WebSearchResult } from "./types";

const ADAPTERS: Record<AIProviderName, AIProviderAdapter> = {
  openai: openAiAdapter,
  gemini: geminiAdapter,
};

const DEFAULT_PROVIDER: AIProviderName = "gemini";

export function getConfiguredProvider(): AIProviderName {
  const raw = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (!raw) return DEFAULT_PROVIDER;
  if ((AI_PROVIDER_NAMES as readonly string[]).includes(raw)) return raw as AIProviderName;
  throw new AIProviderError(
    "configuration",
    `Unknown AI_PROVIDER "${raw}". Expected one of: ${AI_PROVIDER_NAMES.join(", ")}.`,
    { provider: raw }
  );
}

export function getProvider(): AIProviderAdapter {
  return ADAPTERS[getConfiguredProvider()];
}

export function getProviderCapabilities(operation?: AIOperation): AIProviderCapabilities {
  return getProvider().capabilities(operation);
}

/** Back-compat alias of the original options type. */
export type GenerateStructuredOptions = StructuredGenerateOptions;

export async function generateStructuredResponse(
  options: StructuredGenerateOptions
): Promise<unknown> {
  const provider = getProvider();
  if (options.images?.length && !provider.capabilities(options.operation).imageInput) {
    throw new AIProviderError(
      "unsupported_capability",
      `The active AI provider (${provider.name}) does not support image input.`,
      { provider: provider.name }
    );
  }
  return provider.generateStructured(options);
}

/** Live web search with real source URLs (Opportunity Feed). Fails with a
 * clear `unsupported_capability` / `free_tier_unavailable` error — never a
 * fabricated result — when the active provider cannot search. */
export async function searchWeb(options: WebSearchOptions): Promise<WebSearchResult> {
  const provider = getProvider();
  if (!provider.searchWeb) {
    throw new AIProviderError(
      "unsupported_capability",
      `The active AI provider (${provider.name}) does not support web search.`,
      { provider: provider.name }
    );
  }
  return provider.searchWeb(options);
}
