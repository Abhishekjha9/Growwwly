import {
  generateStructuredResponse as generateGeminiStructuredResponse,
  type GeminiGenerateOptions,
} from "./gemini";
import { generateOpenAiStructuredResponse } from "./providers/openai";

// ---------------------------------------------------------------------------
// The AI provider abstraction. The rest of the app calls
// `generateStructuredResponse` from here and never cares which provider is
// actually configured.
//
// Provider selection:
//   AI_PROVIDER=openai (default) -> direct OpenAI API / gpt-5.6-sol
//   AI_PROVIDER=gemini           -> Gemini
//
// Vision is the one exception: Website Intelligence's screenshot
// interpretation always needs a multimodal model, so any request carrying
// `images` always goes to Gemini regardless of AI_PROVIDER.
// ---------------------------------------------------------------------------

export type AIProvider = "openai" | "gemini";

const VALID_PROVIDERS: readonly AIProvider[] = ["openai", "gemini"];

export function getConfiguredProvider(): AIProvider {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (!raw) return "openai";
  if (!isValidProvider(raw)) {
    throw new Error(
      `Invalid AI_PROVIDER "${raw}". Expected "openai" or "gemini".`
    );
  }
  return raw;
}

function isValidProvider(value: string): value is AIProvider {
  return (VALID_PROVIDERS as readonly string[]).includes(value);
}

export type GenerateStructuredOptions = GeminiGenerateOptions;

export async function generateStructuredResponse(
  options: GenerateStructuredOptions
): Promise<unknown> {
  if (options.images && options.images.length > 0) {
    return generateGeminiStructuredResponse(options);
  }

  const provider = getConfiguredProvider();
  if (provider === "gemini") {
    return generateGeminiStructuredResponse(options);
  }
  return generateOpenAiStructuredResponse(options);
}
