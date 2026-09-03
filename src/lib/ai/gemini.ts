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

export interface GeminiGenerateOptions {
  /** System-level instruction */
  systemPrompt: string;
  /** User-facing prompt */
  userPrompt: string;
  /** Zod schema the response must conform to */
  responseSchema: z.ZodTypeAny;
  /** Optional temperature override (default: model default) */
  temperature?: number;
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

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: options.userPrompt,
    config: {
      systemInstruction: options.systemPrompt,
      responseMimeType: "application/json",
      responseSchema: geminiSchema,
      temperature: options.temperature,
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
