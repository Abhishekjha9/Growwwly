import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AIProviderError } from "../../errors";
import {
  __resetGeminiStateForTests,
  generateGeminiStructuredResponse,
  generateGeminiWebSearchResponse,
  mapGeminiHttpError,
  resolveGroundingUri,
} from "../gemini";

const fetchMock = vi.fn();
const ORIGINAL_ENV = { ...process.env };

const schema = z.object({ ok: z.boolean(), name: z.string() });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textCandidate(text: string, extra: Record<string, unknown> = {}) {
  return {
    candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP", ...extra }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
  };
}

function quota429(kind: "day" | "minute" | "zero") {
  return jsonResponse(
    {
      error: {
        code: 429,
        status: "RESOURCE_EXHAUSTED",
        message:
          kind === "zero"
            ? "Quota exceeded for metric: generate_content_free_tier_requests, limit: 0"
            : "You exceeded your current quota.",
        details: [
          {
            "@type": "type.googleapis.com/google.rpc.QuotaFailure",
            violations: [
              {
                quotaId:
                  kind === "day"
                    ? "GenerateRequestsPerDayPerProjectPerModel-FreeTier"
                    : "GenerateRequestsPerMinutePerProjectPerModel-FreeTier",
              },
            ],
          },
          { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "17s" },
        ],
      },
    },
    429
  );
}

const baseOptions = {
  systemPrompt: "You are a test.",
  userPrompt: "Return the object.",
  responseSchema: schema,
};

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, GEMINI_API_KEY: "test-key" };
  delete process.env.GEMINI_PRODUCT_MODEL;
  delete process.env.GEMINI_WEBSITE_MODEL;
  delete process.env.GEMINI_OPPORTUNITY_MODEL;
  delete process.env.GEMINI_FREE_TIER_MODELS;
  delete process.env.GEMINI_FREE_GROUNDING_MODELS;
  delete process.env.GEMINI_GROUNDING_ENABLED;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  __resetGeminiStateForTests();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("generateGeminiStructuredResponse", () => {
  it("returns Zod-validated data and sends a native JSON schema", async () => {
    fetchMock.mockResolvedValue(jsonResponse(textCandidate('{"ok":true,"name":"x"}')));
    const result = await generateGeminiStructuredResponse({ ...baseOptions, operation: "product" });
    expect(result).toEqual({ ok: true, name: "x" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/models/gemini-3.6-flash:generateContent");
    expect(init.headers["x-goog-api-key"]).toBe("test-key");
    expect(String(url)).not.toContain("test-key");
    const body = JSON.parse(init.body);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema.type).toBe("object");
    expect(body.generationConfig.responseJsonSchema.$schema).toBeUndefined();
    expect(body.tools).toBeUndefined();
  });

  it("routes each operation to its configured model", async () => {
    process.env.GEMINI_WEBSITE_MODEL = "gemini-2.5-flash-lite";
    fetchMock.mockResolvedValue(jsonResponse(textCandidate('{"ok":true,"name":"x"}')));
    await generateGeminiStructuredResponse({ ...baseOptions, operation: "website" });
    expect(fetchMock.mock.calls[0][0]).toContain("/models/gemini-2.5-flash-lite:generateContent");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it("sends screenshots as inline image parts", async () => {
    fetchMock.mockResolvedValue(jsonResponse(textCandidate('{"ok":true,"name":"x"}')));
    await generateGeminiStructuredResponse({
      ...baseOptions,
      operation: "website",
      images: [
        { mimeType: "image/png", data: "AAAA" },
        { mimeType: "image/jpeg", data: "BBBB" },
      ],
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const parts = body.contents[0].parts;
    expect(parts[0].text).toBe(baseOptions.userPrompt);
    expect(parts[1]).toEqual({ inline_data: { mime_type: "image/png", data: "AAAA" } });
    expect(parts[2]).toEqual({ inline_data: { mime_type: "image/jpeg", data: "BBBB" } });
  });

  it("ignores thought parts when reading the answer", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        candidates: [
          {
            content: { parts: [{ text: "thinking...", thought: true }, { text: '{"ok":true,"name":"y"}' }] },
            finishReason: "STOP",
          },
        ],
      })
    );
    expect(await generateGeminiStructuredResponse(baseOptions)).toEqual({ ok: true, name: "y" });
  });

  it("makes exactly one repair attempt on malformed output, without re-sending images", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(textCandidate('{"ok":"nope"}')))
      .mockResolvedValueOnce(jsonResponse(textCandidate('{"ok":true,"name":"fixed"}')));
    const result = await generateGeminiStructuredResponse({
      ...baseOptions,
      images: [{ mimeType: "image/png", data: "AAAA" }],
    });
    expect(result).toEqual({ ok: true, name: "fixed" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const repairBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(JSON.stringify(repairBody)).not.toContain("inline_data");
  });

  it("throws invalid_output after the single repair attempt also fails", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(textCandidate("not json")));
    await expect(generateGeminiStructuredResponse(baseOptions)).rejects.toMatchObject({
      kind: "invalid_output",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refuses a model that is not on the free-tier allowlist without calling the API", async () => {
    process.env.GEMINI_PRODUCT_MODEL = "gemini-4-carbon";
    await expect(generateGeminiStructuredResponse(baseOptions)).rejects.toMatchObject({
      kind: "free_tier_unavailable",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails with a configuration error when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(generateGeminiStructuredResponse(baseOptions)).rejects.toMatchObject({
      kind: "configuration",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps a per-day 429 to quota_exhausted, never retries, and cools down", async () => {
    fetchMock.mockResolvedValue(quota429("day"));
    await expect(generateGeminiStructuredResponse(baseOptions)).rejects.toMatchObject({
      kind: "quota_exhausted",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A second click does not re-send the request while cooling down.
    await expect(generateGeminiStructuredResponse(baseOptions)).rejects.toMatchObject({
      kind: "quota_exhausted",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps a per-minute 429 to rate_limited with the provider's retry delay", async () => {
    fetchMock.mockResolvedValue(quota429("minute"));
    const err = (await generateGeminiStructuredResponse(baseOptions).catch((e: unknown) => e)) as AIProviderError;
    expect(err).toBeInstanceOf(AIProviderError);
    expect(err.kind).toBe("rate_limited");
    expect(err.retryAfterSeconds).toBe(17);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps a timeout distinctly from quota and API errors", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error("aborted"), { name: "TimeoutError" }));
    await expect(generateGeminiStructuredResponse(baseOptions)).rejects.toMatchObject({
      kind: "timeout",
    });
  });

  it("never puts the API key in a thrown error message", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { code: 400, message: "bad", status: "INVALID_ARGUMENT" } }, 400));
    const err = (await generateGeminiStructuredResponse(baseOptions).catch((e: unknown) => e)) as AIProviderError;
    expect(err.kind).toBe("request_error");
    expect(err.message).not.toContain("test-key");
  });
});

describe("toGeminiJsonSchema", () => {
  it("removes array maxItems/minItems (rejected by Gemini) but keeps other constraints", async () => {
    const { toGeminiJsonSchema } = await import("../gemini");
    const json = JSON.stringify(
      toGeminiJsonSchema(z.object({ list: z.array(z.object({ n: z.number().int().max(100) })).min(1).max(8) }))
    );
    expect(json).not.toContain("maxItems");
    expect(json).not.toContain("minItems");
    expect(json).toContain('"maximum":100');
  });
});

describe("mapGeminiHttpError", () => {
  const ctx = { model: "gemini-2.5-flash-lite", operation: "opportunity" as const, grounding: true };

  it("treats 'limit: 0' as the free tier not offering this feature", async () => {
    const body = await quota429("zero").json();
    expect(mapGeminiHttpError(429, body, ctx).kind).toBe("free_tier_unavailable");
  });

  it("treats a bare 'check your plan and billing' 429 as free-tier unavailable, not a resettable quota", () => {
    const body = {
      error: {
        code: 429,
        status: "RESOURCE_EXHAUSTED",
        message: "You exceeded your current quota, please check your plan and billing details.",
        details: [{ "@type": "type.googleapis.com/google.rpc.Help" }],
      },
    };
    expect(mapGeminiHttpError(429, body, ctx).kind).toBe("free_tier_unavailable");
  });

  it("maps auth and server errors", () => {
    expect(mapGeminiHttpError(403, null, ctx).kind).toBe("authentication");
    expect(mapGeminiHttpError(503, null, ctx).kind).toBe("server_error");
    expect(mapGeminiHttpError(404, null, ctx).kind).toBe("configuration");
  });
});

describe("generateGeminiWebSearchResponse (Google Search grounding)", () => {
  const searchOptions = { systemPrompt: "s", userPrompt: "u", operation: "opportunity" as const };

  it("by default refuses grounding without any request (no accessible model has free grounding)", async () => {
    await expect(generateGeminiWebSearchResponse(searchOptions)).rejects.toMatchObject({
      kind: "free_tier_unavailable",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends one grounded request with the google_search tool and resolves real source URLs", async () => {
    process.env.GEMINI_OPPORTUNITY_MODEL = "gemini-2.5-flash-lite";
    const redirect = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc";
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.includes(":generateContent")) {
        return jsonResponse(
          textCandidate(`{"opportunities":[{"url":"${redirect}"}]}`, {
            groundingMetadata: {
              webSearchQueries: ["q1", "q2"],
              groundingChunks: [{ web: { uri: redirect, title: "reddit.com" } }],
            },
          })
        );
      }
      expect(init.redirect).toBe("manual");
      return new Response(null, {
        status: 302,
        headers: { location: "https://www.reddit.com/r/SaaS/comments/xyz/thread/" },
      });
    });

    const result = await generateGeminiWebSearchResponse(searchOptions);

    const genCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes(":generateContent"));
    expect(genCalls).toHaveLength(1);
    expect(genCalls[0][0]).toContain("/models/gemini-2.5-flash-lite:generateContent");
    const body = JSON.parse(genCalls[0][1].body);
    expect(body.tools).toEqual([{ google_search: {} }]);
    expect(body.generationConfig.responseJsonSchema).toBeUndefined();

    expect(result.citations).toEqual([
      { url: "https://www.reddit.com/r/SaaS/comments/xyz/thread/", title: "reddit.com" },
    ]);
    // A redirect link the model echoed is swapped for the URL Google resolved it to.
    expect(result.text).toContain("https://www.reddit.com/r/SaaS/comments/xyz/thread/");
    expect(result.text).not.toContain(redirect);
  });

  it("refuses grounding on a model whose grounding is not free, without calling the API", async () => {
    process.env.GEMINI_OPPORTUNITY_MODEL = "gemini-3.8-flash";
    await expect(generateGeminiWebSearchResponse(searchOptions)).rejects.toMatchObject({
      kind: "free_tier_unavailable",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses deprecated gemini-2.5-flash for grounding (routes to a paid-grounding model on 2026-12-01)", async () => {
    process.env.GEMINI_OPPORTUNITY_MODEL = "gemini-2.5-flash";
    await expect(generateGeminiWebSearchResponse(searchOptions)).rejects.toMatchObject({
      kind: "free_tier_unavailable",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("can be disabled entirely via GEMINI_GROUNDING_ENABLED=false", async () => {
    process.env.GEMINI_GROUNDING_ENABLED = "false";
    await expect(generateGeminiWebSearchResponse(searchOptions)).rejects.toMatchObject({
      kind: "unsupported_capability",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enforces the soft daily grounding cap locally", async () => {
    process.env.GEMINI_OPPORTUNITY_MODEL = "gemini-2.5-flash-lite";
    process.env.GEMINI_GROUNDING_DAILY_LIMIT = "1";
    fetchMock.mockResolvedValue(jsonResponse(textCandidate('{"opportunities":[]}')));
    await generateGeminiWebSearchResponse(searchOptions);
    await expect(generateGeminiWebSearchResponse(searchOptions)).rejects.toMatchObject({
      kind: "quota_exhausted",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not re-send a grounded request after a quota 429", async () => {
    process.env.GEMINI_OPPORTUNITY_MODEL = "gemini-2.5-flash-lite";
    fetchMock.mockResolvedValue(quota429("day"));
    await expect(generateGeminiWebSearchResponse(searchOptions)).rejects.toMatchObject({
      kind: "quota_exhausted",
    });
    await expect(generateGeminiWebSearchResponse(searchOptions)).rejects.toMatchObject({
      kind: "quota_exhausted",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("resolveGroundingUri", () => {
  it("returns direct (non-redirect) URLs unchanged without fetching", async () => {
    expect(await resolveGroundingUri("https://news.ycombinator.com/item?id=1")).toBe(
      "https://news.ycombinator.com/item?id=1"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("drops unresolvable redirects instead of guessing", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    expect(
      await resolveGroundingUri("https://vertexaisearch.cloud.google.com/grounding-api-redirect/x")
    ).toBeNull();
  });

  it("rejects non-http URLs", async () => {
    expect(await resolveGroundingUri("javascript:alert(1)")).toBeNull();
  });
});
