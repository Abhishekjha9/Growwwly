import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const createMock = vi.fn();

vi.mock("openai", async () => {
  const actual = await vi.importActual<typeof import("openai")>("openai");
  class MockOpenAI {
    responses = { create: (...args: unknown[]) => createMock(...args) };
  }
  return { ...actual, default: MockOpenAI };
});

const { generateOpenAiStructuredResponse } = await import("../openai");
const { APIError } = await import("openai");

const SCHEMA = z.object({ name: z.string(), score: z.number().int().min(0).max(100) });
const ORIGINAL_ENV = { ...process.env };

function completion(output_text: string) {
  return { output_text };
}

function apiError(status: number) {
  return new APIError(status, { error: { message: "boom" } }, "boom", new Headers());
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-key";
  createMock.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

const baseOptions = { systemPrompt: "You are a test.", userPrompt: "Analyze this.", responseSchema: SCHEMA };

describe("generateOpenAiStructuredResponse", () => {
  it("3. parses valid JSON and returns the Zod-validated result", async () => {
    createMock.mockResolvedValue(completion(JSON.stringify({ name: "x", score: 80 })));

    const result = await generateOpenAiStructuredResponse(baseOptions);
    expect(result).toEqual({ name: "x", score: 80 });
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("4. strips markdown JSON fences before parsing", async () => {
    const fenced = "```json\n" + JSON.stringify({ name: "x", score: 55 }) + "\n```";
    createMock.mockResolvedValue(completion(fenced));

    const result = await generateOpenAiStructuredResponse(baseOptions);
    expect(result).toEqual({ name: "x", score: 55 });
  });

  it("5. attempts one repair pass on invalid JSON, then succeeds", async () => {
    createMock
      .mockResolvedValueOnce(completion("not json at all"))
      .mockResolvedValueOnce(completion(JSON.stringify({ name: "x", score: 40 })));

    const result = await generateOpenAiStructuredResponse(baseOptions);
    expect(result).toEqual({ name: "x", score: 40 });
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("5. throws a clean error if the repair pass also fails — never retries beyond one attempt", async () => {
    createMock
      .mockResolvedValueOnce(completion("still not json"))
      .mockResolvedValueOnce(completion("still not json either"));

    await expect(generateOpenAiStructuredResponse(baseOptions)).rejects.toThrow(
      /invalid structured output/i
    );
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("6. treats a schema-mismatched but valid JSON payload as malformed and repairs it", async () => {
    createMock
      .mockResolvedValueOnce(completion(JSON.stringify({ wrong: "shape" })))
      .mockResolvedValueOnce(completion(JSON.stringify({ name: "x", score: 10 })));

    const result = await generateOpenAiStructuredResponse(baseOptions);
    expect(result).toEqual({ name: "x", score: 10 });
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("7. throws immediately, without any network call, when the API key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    // The provider caches its client singleton (same pattern as the Gemini
    // provider) — force a fresh module instance so the earlier tests'
    // cached, already-configured client isn't reused here.
    vi.resetModules();
    const fresh = await import("../openai");

    await expect(fresh.generateOpenAiStructuredResponse(baseOptions)).rejects.toThrow(
      /OPENAI_API_KEY/
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it("8. surfaces a clean error on an HTTP failure without retrying", async () => {
    createMock.mockRejectedValue(apiError(500));

    await expect(generateOpenAiStructuredResponse(baseOptions)).rejects.toThrow(
      /server error/i
    );
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("8. gives a distinct message for a 429 rate limit, without retrying", async () => {
    createMock.mockRejectedValue(apiError(429));

    await expect(generateOpenAiStructuredResponse(baseOptions)).rejects.toThrow(/rate limit|quota/i);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("8. gives a distinct message for a 401 auth failure, without retrying", async () => {
    createMock.mockRejectedValue(apiError(401));

    await expect(generateOpenAiStructuredResponse(baseOptions)).rejects.toThrow(/authentication/i);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("never leaks the API key in a thrown error message", async () => {
    createMock.mockRejectedValue(apiError(401));

    try {
      await generateOpenAiStructuredResponse(baseOptions);
      expect.unreachable();
    } catch (err) {
      expect(String(err)).not.toContain("test-key");
    }
  });

  it("passes max_output_tokens through, but never sends temperature (unsupported by this reasoning model)", async () => {
    createMock.mockResolvedValue(completion(JSON.stringify({ name: "x", score: 1 })));

    await generateOpenAiStructuredResponse({ ...baseOptions, temperature: 0.1, maxOutputTokens: 500 });

    const [body] = createMock.mock.calls[0];
    expect(body.max_output_tokens).toBe(500);
    expect(body.model).toBe("gpt-5.6-sol");
    expect(body.input).toBe("Analyze this.");
    expect(body.temperature).toBeUndefined();
  });

  it("sends the schema instructions via `instructions`, not appended to input", async () => {
    createMock.mockResolvedValue(completion(JSON.stringify({ name: "x", score: 1 })));

    await generateOpenAiStructuredResponse(baseOptions);

    const [body] = createMock.mock.calls[0];
    expect(body.instructions).toContain("You are a test.");
    expect(body.instructions).toContain("JSON Schema");
  });

  it("sends the repair pass as a user/assistant/user input turn array", async () => {
    createMock
      .mockResolvedValueOnce(completion("not json"))
      .mockResolvedValueOnce(completion(JSON.stringify({ name: "x", score: 1 })));

    await generateOpenAiStructuredResponse(baseOptions);

    const [repairBody] = createMock.mock.calls[1];
    expect(Array.isArray(repairBody.input)).toBe(true);
    expect(repairBody.input).toHaveLength(3);
    expect(repairBody.input[0]).toEqual({ role: "user", content: "Analyze this." });
    expect(repairBody.input[1]).toEqual({ role: "assistant", content: "not json" });
    expect(repairBody.input[2].role).toBe("user");
  });
});
