import { generateOpenAiStructuredResponse, type OpenAiGenerateOptions } from "./providers/openai";

// ---------------------------------------------------------------------------
// The AI provider abstraction. The rest of the app calls
// `generateStructuredResponse` from here.
//
// Provider selection:
//   OpenAI (via Azure) is the only provider used across the app.
// ---------------------------------------------------------------------------

export type AIProvider = "openai";

export function getConfiguredProvider(): AIProvider {
  return "openai";
}

export type GenerateStructuredOptions = OpenAiGenerateOptions;

export async function generateStructuredResponse(
  options: GenerateStructuredOptions
): Promise<unknown> {
  return generateOpenAiStructuredResponse(options);
}
