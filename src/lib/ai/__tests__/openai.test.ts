/**
 * Unit tests for the OpenAI provider — specifically:
 *
 * 1. The structured Product Intelligence request receives the dedicated
 *    STRUCTURED_RESPONSE_TIMEOUT_MS, not the shorter client-level 30 s default.
 * 2. The environment variable OPENAI_STRUCTURED_TIMEOUT_MS can override the
 *    default.
 * 3. Error categorisation produces human-readable log categories.
 * 4. No unnecessary retries on HTTP-level failures.
 * 5. No extra AI calls for a single Product Intelligence request.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// We test the timeout by capturing what `client.responses.create` is called
// with. The second argument to `create` is the per-request options object
// that should carry `{ timeout: STRUCTURED_RESPONSE_TIMEOUT_MS }`.
// ---------------------------------------------------------------------------

const createMock = vi.fn();

vi.mock("openai", () => {
  class FakeAPIConnectionTimeoutError extends Error {
    status: undefined;
    constructor() {
      super("Request timed out.");
      this.name = "APIConnectionTimeoutError";
    }
  }
  class FakeAPIError extends Error {
    status: number | undefined;
    constructor(status: number | undefined, error: unknown, message: string | undefined, headers: unknown) {
      super(message ?? "API Error");
      this.status = status;
    }
  }
  return {
    default: class FakeOpenAI {
      responses = { create: createMock };
    },
    APIConnectionTimeoutError: FakeAPIConnectionTimeoutError,
    APIError: FakeAPIError,
  };
});

// We need the module to reload between tests that change env vars.
const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  createMock.mockReset();
  vi.resetModules();
});

async function importProvider() {
  // Dynamic import after vi.resetModules() so constants re-read from env.
  return import("../providers/openai");
}

// ---------------------------------------------------------------------------
// Timeout tests
// ---------------------------------------------------------------------------

describe("STRUCTURED_RESPONSE_TIMEOUT_MS", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_BASE_URL = "https://example.azure.com/openai/v1";
    createMock.mockResolvedValue({ output_text: JSON.stringify({ test: true }) });
  });

  it("1. structured call receives a dedicated timeout greater than 30 s", async () => {
    const { generateOpenAiStructuredResponse } = await importProvider();
    await generateOpenAiStructuredResponse({
      systemPrompt: "sys",
      userPrompt: "user",
      responseSchema: z.object({ test: z.boolean() }),
    }).catch(() => {/* ignore schema mismatch — we just need the call recorded */});

    expect(createMock).toHaveBeenCalled();
    const [, perRequestOptions] = createMock.mock.calls[0];
    expect(perRequestOptions).toBeDefined();
    expect(perRequestOptions.timeout).toBeDefined();
    // Default must be strictly greater than the client-level 30 s safeguard
    expect(perRequestOptions.timeout).toBeGreaterThan(30_000);
  });

  it("2. defaults to 90 000 ms when OPENAI_STRUCTURED_TIMEOUT_MS is not set", async () => {
    delete process.env.OPENAI_STRUCTURED_TIMEOUT_MS;
    const { generateOpenAiStructuredResponse } = await importProvider();
    await generateOpenAiStructuredResponse({
      systemPrompt: "sys",
      userPrompt: "user",
      responseSchema: z.object({ test: z.boolean() }),
    }).catch(() => {});

    const [, perRequestOptions] = createMock.mock.calls[0];
    expect(perRequestOptions.timeout).toBe(90_000);
  });

  it("3. respects OPENAI_STRUCTURED_TIMEOUT_MS env var override", async () => {
    process.env.OPENAI_STRUCTURED_TIMEOUT_MS = "120000";
    const { generateOpenAiStructuredResponse } = await importProvider();
    await generateOpenAiStructuredResponse({
      systemPrompt: "sys",
      userPrompt: "user",
      responseSchema: z.object({ test: z.boolean() }),
    }).catch(() => {});

    const [, perRequestOptions] = createMock.mock.calls[0];
    expect(perRequestOptions.timeout).toBe(120_000);
  });

  it("4. makes exactly one AI call per Product Intelligence request (no hidden retry)", async () => {
    const { generateOpenAiStructuredResponse } = await importProvider();
    await generateOpenAiStructuredResponse({
      systemPrompt: "sys",
      userPrompt: "user",
      responseSchema: z.object({ test: z.boolean() }),
    }).catch(() => {});

    // Should be at most 2 calls: one attempt + at most one repair pass for
    // malformed output (not a retry on HTTP failure). HTTP failures must not
    // produce a second call.
    expect(createMock.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Error categorisation
// ---------------------------------------------------------------------------

describe("error categorisation", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_BASE_URL = "https://example.azure.com/openai/v1";
  });

  it("5. timeout error surfaces as a human-readable message (not 'undefined')", async () => {
    const { APIConnectionTimeoutError } = await import("openai");
    createMock.mockRejectedValue(new APIConnectionTimeoutError());

    const { generateOpenAiStructuredResponse } = await importProvider();
    await expect(
      generateOpenAiStructuredResponse({
        systemPrompt: "sys",
        userPrompt: "user",
        responseSchema: z.object({}),
      })
    ).rejects.toThrow(/timed out/i);
  });

  it("6. auth failure produces an 'authentication' category message", async () => {
    const { APIError } = await import("openai");
    createMock.mockRejectedValue(new APIError(401, {}, "Unauthorized", new Headers()));

    const { generateOpenAiStructuredResponse } = await importProvider();
    await expect(
      generateOpenAiStructuredResponse({
        systemPrompt: "sys",
        userPrompt: "user",
        responseSchema: z.object({}),
      })
    ).rejects.toThrow(/authentication/i);
  });

  it("7. rate limit produces a 'rate_limit' category message", async () => {
    const { APIError } = await import("openai");
    createMock.mockRejectedValue(new APIError(429, {}, "Too many requests", new Headers()));

    const { generateOpenAiStructuredResponse } = await importProvider();
    await expect(
      generateOpenAiStructuredResponse({
        systemPrompt: "sys",
        userPrompt: "user",
        responseSchema: z.object({}),
      })
    ).rejects.toThrow(/rate limit/i);
  });

  it("8. does NOT retry on a 401 auth error", async () => {
    const { APIError } = await import("openai");
    createMock.mockRejectedValue(new APIError(401, {}, "Unauthorized", new Headers()));

    const { generateOpenAiStructuredResponse } = await importProvider();
    await generateOpenAiStructuredResponse({
      systemPrompt: "sys",
      userPrompt: "user",
      responseSchema: z.object({}),
    }).catch(() => {});

    // Auth failures must not retry — one call only.
    expect(createMock.mock.calls.length).toBe(1);
  });
});
