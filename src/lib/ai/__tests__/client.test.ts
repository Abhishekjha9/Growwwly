import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Provider selection is configuration-only: the adapters are mocked so the
// test only checks which one the client dispatches to.
const geminiGenerate = vi.fn().mockResolvedValue({ from: "gemini" });
const geminiSearch = vi.fn().mockResolvedValue({ text: "g", citations: [] });
const openaiGenerate = vi.fn().mockResolvedValue({ from: "openai" });
const openaiSearch = vi.fn().mockResolvedValue({ text: "o", citations: [] });

vi.mock("../providers/gemini", () => ({
  geminiAdapter: {
    name: "gemini",
    capabilities: () => ({ structuredOutput: true, imageInput: true, webSearch: true, toolCalling: true }),
    generateStructured: (...a: unknown[]) => geminiGenerate(...a),
    searchWeb: (...a: unknown[]) => geminiSearch(...a),
  },
}));
vi.mock("../providers/openai", () => ({
  openAiAdapter: {
    name: "openai",
    capabilities: () => ({ structuredOutput: true, imageInput: true, webSearch: true, toolCalling: true }),
    generateStructured: (...a: unknown[]) => openaiGenerate(...a),
    searchWeb: (...a: unknown[]) => openaiSearch(...a),
  },
}));

const client = await import("../client");
const ORIGINAL_ENV = { ...process.env };
const opts = { systemPrompt: "s", userPrompt: "u", responseSchema: z.object({}) };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
});

describe("AI provider selection", () => {
  it("defaults to gemini", async () => {
    delete process.env.AI_PROVIDER;
    expect(client.getConfiguredProvider()).toBe("gemini");
    expect(await client.generateStructuredResponse(opts)).toEqual({ from: "gemini" });
  });

  it("switches to openai via AI_PROVIDER only", async () => {
    process.env.AI_PROVIDER = "openai";
    expect(await client.generateStructuredResponse(opts)).toEqual({ from: "openai" });
    await client.searchWeb({ systemPrompt: "s", userPrompt: "u" });
    expect(openaiSearch).toHaveBeenCalledTimes(1);
    expect(geminiGenerate).not.toHaveBeenCalled();
    expect(geminiSearch).not.toHaveBeenCalled();
  });

  it("is case-insensitive and rejects unknown providers", () => {
    process.env.AI_PROVIDER = " Gemini ";
    expect(client.getConfiguredProvider()).toBe("gemini");
    process.env.AI_PROVIDER = "groq";
    expect(() => client.getConfiguredProvider()).toThrow(/Unknown AI_PROVIDER/);
  });
});

// ---------------------------------------------------------------------------
// Architecture guard: application code must not import provider SDKs or
// provider modules directly — only `@/lib/ai/client`, `types` and `errors`.
// ---------------------------------------------------------------------------

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : walk(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe("provider isolation", () => {
  it("no application module imports a provider SDK or provider adapter directly", () => {
    const srcRoot = join(__dirname, "..", "..", "..");
    const providersDir = join(srcRoot, "lib", "ai", "providers");
    const offenders: string[] = [];
    for (const file of walk(srcRoot)) {
      if (file.startsWith(providersDir)) continue;
      if (file === join(srcRoot, "lib", "ai", "client.ts")) continue;
      const code = readFileSync(file, "utf8");
      if (
        /from\s+["'](openai|@google\/genai|@google\/generative-ai|groq-sdk)["']/.test(code) ||
        /from\s+["'][^"']*ai\/providers\//.test(code)
      ) {
        offenders.push(relative(srcRoot, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
