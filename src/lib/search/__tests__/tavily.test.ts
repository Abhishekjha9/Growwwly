import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SearchProviderError } from "../errors";
import {
  mapTavilyHttpError,
  normalizeTavilyResult,
  tavilySearch,
  tavilyUsage,
} from "../providers/tavily";

const fetchMock = vi.fn();
const ORIGINAL_ENV = { ...process.env };

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const VALID = {
  title: "Which email API do you use for transactional email?",
  url: "https://www.reddit.com/r/webdev/comments/abc123/which_email_api/",
  content: "We're moving off SendGrid and looking at alternatives with a decent React templating story.",
  score: 0.82,
  published_date: "2026-10-30T12:00:00Z",
};

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, TAVILY_API_KEY: "tvly-test-key" };
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("tavilySearch", () => {
  it("sends a basic, bounded, credit-safe request with Bearer auth", async () => {
    fetchMock.mockResolvedValue(json({ results: [VALID], usage: { credits: 1 } }));
    await tavilySearch({
      query: "transactional email api",
      includeDomains: ["reddit.com"],
      excludeDomains: ["resend.com"],
      timeRange: "year",
      label: "x",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.tavily.com/search");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tvly-test-key");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      query: "transactional email api",
      search_depth: "basic",
      topic: "general",
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
      include_usage: true,
      auto_parameters: false,
      include_domains: ["reddit.com"],
      exclude_domains: ["resend.com"],
      time_range: "year",
    });
    // The key never travels in the body or URL.
    expect(init.body).not.toContain("tvly-test-key");
    expect(String(url)).not.toContain("tvly-test-key");
  });

  it("returns normalized results with the original URL, score and date preserved", async () => {
    fetchMock.mockResolvedValue(json({ results: [VALID], usage: { credits: 1 }, request_id: "r1" }));
    const res = await tavilySearch({ query: "q", label: "problem_discussion" });
    expect(res.credits).toBe(1);
    expect(res.requestId).toBe("r1");
    expect(res.results).toHaveLength(1);
    expect(res.results[0]).toMatchObject({
      title: VALID.title,
      url: VALID.url,
      domain: "reddit.com",
      providerScore: 0.82,
      publishedDate: VALID.published_date,
      provider: "tavily",
      queryLabel: "problem_discussion",
    });
  });

  it("handles empty results", async () => {
    fetchMock.mockResolvedValue(json({ results: [], usage: { credits: 1 } }));
    const res = await tavilySearch({ query: "q" });
    expect(res.results).toEqual([]);
    expect(res.credits).toBe(1);
  });

  it("assumes 1 credit (basic search) when usage is not reported", async () => {
    fetchMock.mockResolvedValue(json({ results: [VALID] }));
    expect((await tavilySearch({ query: "q" })).credits).toBe(1);
  });

  it("drops results with invalid or missing URLs and tolerates missing optional fields", async () => {
    fetchMock.mockResolvedValue(
      json({
        results: [
          { ...VALID, url: "not a url" },
          { ...VALID, url: "javascript:alert(1)" },
          { ...VALID, url: "ftp://example.com/x" },
          { title: "no url", content: "x" },
          { url: "https://news.ycombinator.com/item?id=42", content: "Ask HN: email APIs?" },
          { url: "https://example.org/thread", title: "Only a title" },
          { url: "https://example.org/empty" },
          "garbage",
        ],
      })
    );
    const res = await tavilySearch({ query: "q" });
    expect(res.results.map((r) => r.url)).toEqual([
      "https://news.ycombinator.com/item?id=42",
      "https://example.org/thread",
    ]);
    const hn = res.results[0];
    expect(hn.title).toBe("news.ycombinator.com");
    expect(hn.providerScore).toBeNull();
    expect(hn.publishedDate).toBeNull();
  });

  it("rejects an unexpected response shape", async () => {
    fetchMock.mockResolvedValue(json({ results: "nope" }));
    await expect(tavilySearch({ query: "q" })).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("fails with a configuration error and sends nothing when TAVILY_API_KEY is missing", async () => {
    delete process.env.TAVILY_API_KEY;
    await expect(tavilySearch({ query: "q" })).rejects.toMatchObject({ kind: "configuration" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps 401 to authentication (invalid key)", async () => {
    fetchMock.mockResolvedValue(json({ detail: { error: "Unauthorized" } }, 401));
    await expect(tavilySearch({ query: "q" })).rejects.toMatchObject({ kind: "authentication" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps 429 to rate_limited with Retry-After, and does not retry", async () => {
    fetchMock.mockResolvedValue(json({ detail: { error: "slow down" } }, 429, { "Retry-After": "30" }));
    const err = (await tavilySearch({ query: "q" }).catch((e: unknown) => e)) as SearchProviderError;
    expect(err.kind).toBe("rate_limited");
    expect(err.retryAfterSeconds).toBe(30);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps 432 (plan limit) and 433 (pay-as-you-go limit) to quota_exhausted, never retried", async () => {
    fetchMock.mockResolvedValueOnce(json({ detail: { error: "plan limit" } }, 432));
    await expect(tavilySearch({ query: "q" })).rejects.toMatchObject({ kind: "quota_exhausted" });
    fetchMock.mockResolvedValueOnce(json({ detail: { error: "paygo limit" } }, 433));
    await expect(tavilySearch({ query: "q" })).rejects.toMatchObject({ kind: "quota_exhausted" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("maps 5xx and 434 to service_unavailable", async () => {
    expect(mapTavilyHttpError(500).kind).toBe("service_unavailable");
    expect(mapTavilyHttpError(503).kind).toBe("service_unavailable");
    expect(mapTavilyHttpError(434).kind).toBe("service_unavailable");
    expect(mapTavilyHttpError(400).kind).toBe("request_error");
  });

  it("maps a timeout distinctly", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error("aborted"), { name: "TimeoutError" }));
    await expect(tavilySearch({ query: "q" })).rejects.toMatchObject({ kind: "timeout" });
  });

  it("never includes the API key in an error message", async () => {
    fetchMock.mockResolvedValue(json({}, 401));
    const err = (await tavilySearch({ query: "q" }).catch((e: unknown) => e)) as Error;
    expect(err.message).not.toContain("tvly-test-key");
  });
});

describe("tavilyUsage", () => {
  it("reads authoritative account + key usage", async () => {
    fetchMock.mockResolvedValue(
      json({
        key: { usage: 12, limit: null },
        account: { current_plan: "Researcher", plan_usage: 15, plan_limit: 1000, paygo_usage: 0, paygo_limit: 0 },
      })
    );
    const usage = await tavilyUsage();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.tavily.com/usage");
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
    expect(usage).toMatchObject({ used: 15, planLimit: 1000, keyLimit: null, keyUsage: 12, paygoUsage: 0, plan: "Researcher" });
  });
});

describe("normalizeTavilyResult", () => {
  it("ignores an unparseable published_date rather than guessing one", () => {
    const r = normalizeTavilyResult({ ...VALID, published_date: "sometime last week" });
    expect(r?.publishedDate).toBeNull();
  });
});
