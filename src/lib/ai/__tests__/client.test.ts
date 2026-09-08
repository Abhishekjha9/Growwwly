import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const geminiMock = vi.fn().mockResolvedValue({ ok: "gemini" });
const openAiMock = vi.fn().mockResolvedValue({ ok: "openai" });

vi.mock("../gemini", () => ({
  generateStructuredResponse: (...args: unknown[]) => geminiMock(...args),
}));
vi.mock("../providers/openai", () => ({
  generateOpenAiStructuredResponse: (...args: unknown[]) => openAiMock(...args),
}));

const { generateStructuredResponse, getConfiguredProvider } = await import("../client");

const ORIGINAL_ENV = { ...process.env };
const SCHEMA = z.object({ x: z.number() });

beforeEach(() => {
  geminiMock.mockClear();
  openAiMock.mockClear();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getConfiguredProvider", () => {
  it("9. defaults to openai when AI_PROVIDER is unset", () => {
    delete process.env.AI_PROVIDER;
    expect(getConfiguredProvider()).toBe("openai");
  });

  it("9. respects an explicit openai value", () => {
    process.env.AI_PROVIDER = "openai";
    expect(getConfiguredProvider()).toBe("openai");
  });

  it("9. respects an explicit gemini value", () => {
    process.env.AI_PROVIDER = "gemini";
    expect(getConfiguredProvider()).toBe("gemini");
  });

  it("9. is case-insensitive", () => {
    process.env.AI_PROVIDER = "GEMINI";
    expect(getConfiguredProvider()).toBe("gemini");
  });

  it("9. throws a clean error for an invalid provider value", () => {
    process.env.AI_PROVIDER = "agentrouter";
    expect(() => getConfiguredProvider()).toThrow(/Invalid AI_PROVIDER/);
  });
});

describe("generateStructuredResponse dispatch", () => {
  it("1. routes to OpenAI by default", async () => {
    delete process.env.AI_PROVIDER;
    await generateStructuredResponse({ systemPrompt: "s", userPrompt: "u", responseSchema: SCHEMA });
    expect(openAiMock).toHaveBeenCalledTimes(1);
    expect(geminiMock).not.toHaveBeenCalled();
  });

  it("2. routes to Gemini when AI_PROVIDER=gemini", async () => {
    process.env.AI_PROVIDER = "gemini";
    await generateStructuredResponse({ systemPrompt: "s", userPrompt: "u", responseSchema: SCHEMA });
    expect(geminiMock).toHaveBeenCalledTimes(1);
    expect(openAiMock).not.toHaveBeenCalled();
  });

  it("always routes to Gemini when images are present, regardless of AI_PROVIDER", async () => {
    process.env.AI_PROVIDER = "openai";
    await generateStructuredResponse({
      systemPrompt: "s",
      userPrompt: "u",
      responseSchema: SCHEMA,
      images: [{ mimeType: "image/png", data: "abc" }],
    });
    expect(geminiMock).toHaveBeenCalledTimes(1);
    expect(openAiMock).not.toHaveBeenCalled();
  });

  it("never calls both providers for the same request", async () => {
    process.env.AI_PROVIDER = "openai";
    await generateStructuredResponse({ systemPrompt: "s", userPrompt: "u", responseSchema: SCHEMA });
    expect(geminiMock).toHaveBeenCalledTimes(0);
    expect(openAiMock).toHaveBeenCalledTimes(1);
  });
});
