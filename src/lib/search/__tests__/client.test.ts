import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SearchProviderError } from "../errors";
import type { SearchUsageSnapshot } from "../types";

const searchMock = vi.fn();
const usageMock = vi.fn();

vi.mock("../providers/tavily", () => ({
  tavilyProvider: {
    name: "tavily",
    creditsPerSearch: 1,
    search: (...a: unknown[]) => searchMock(...a),
    getUsage: (...a: unknown[]) => usageMock(...a),
  },
}));

const { searchMany, assertWithinBudget, __resetSearchStateForTests, MAX_SEARCHES_PER_OPERATION } =
  await import("../client");

const ORIGINAL_ENV = { ...process.env };

function usage(overrides: Partial<SearchUsageSnapshot> = {}): SearchUsageSnapshot {
  return {
    used: 10,
    planLimit: 1000,
    keyLimit: null,
    keyUsage: 10,
    paygoUsage: 0,
    plan: "Researcher",
    fetchedAt: Date.now(),
    ...overrides,
  };
}

function result(url: string, score = 0.5, label = "q") {
  return {
    title: url,
    url,
    canonicalUrl: url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").toLowerCase(),
    domain: new URL(url).hostname.replace(/^www\./, ""),
    content: `content for ${url}`,
    providerScore: score,
    publishedDate: null,
    provider: "tavily" as const,
    queryLabel: label,
  };
}

const Q = (query: string, label = query) => ({ query, label });

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.SEARCH_MONTHLY_CREDIT_BUDGET;
  delete process.env.SEARCH_REQUIRE_USAGE_CHECK;
  searchMock.mockReset();
  usageMock.mockReset();
  usageMock.mockResolvedValue(usage());
  __resetSearchStateForTests();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("searchMany", () => {
  it("runs the searches, sums credits, and assigns S-ids", async () => {
    searchMock
      .mockResolvedValueOnce({ results: [result("https://reddit.com/r/a/1")], credits: 1, latencyMs: 5 })
      .mockResolvedValueOnce({ results: [result("https://example.com/b")], credits: 1, latencyMs: 5 });
    const batch = await searchMany([Q("one"), Q("two")]);
    expect(batch.requests).toBe(2);
    expect(batch.credits).toBe(2);
    expect(batch.results.map((r) => r.id)).toEqual(["S1", "S2"]);
  });

  it(`never sends more than ${MAX_SEARCHES_PER_OPERATION} searches`, async () => {
    searchMock.mockResolvedValue({ results: [], credits: 1, latencyMs: 1 });
    const batch = await searchMany([Q("1"), Q("2"), Q("3"), Q("4"), Q("5")]);
    expect(searchMock).toHaveBeenCalledTimes(3);
    expect(batch.requests).toBe(3);
  });

  it("never sends a duplicate query twice", async () => {
    searchMock.mockResolvedValue({ results: [], credits: 1, latencyMs: 1 });
    await searchMany([Q("Email API"), Q("  email   api "), Q("other")]);
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it("deduplicates results by canonical URL across searches, keeping the original URL", async () => {
    searchMock
      .mockResolvedValueOnce({
        results: [result("https://www.reddit.com/r/a/1/", 0.4), result("https://example.com/x")],
        credits: 1,
        latencyMs: 1,
      })
      .mockResolvedValueOnce({
        results: [result("https://reddit.com/r/a/1", 0.9)],
        credits: 1,
        latencyMs: 1,
      });
    const batch = await searchMany([Q("a"), Q("b")]);
    expect(batch.results).toHaveLength(2);
    const reddit = batch.results.find((r) => r.domain === "reddit.com")!;
    expect(reddit.url).toBe("https://www.reddit.com/r/a/1/");
    expect(reddit.providerScore).toBe(0.9);
  });

  it("returns partial results when some searches fail", async () => {
    searchMock
      .mockResolvedValueOnce({ results: [result("https://example.com/x")], credits: 1, latencyMs: 1 })
      .mockRejectedValueOnce(new SearchProviderError("timeout", "t", { provider: "tavily" }));
    const batch = await searchMany([Q("a"), Q("b")]);
    expect(batch.results).toHaveLength(1);
    expect(batch.failures).toEqual([{ label: "b", kind: "timeout" }]);
  });

  it("throws the most actionable error when every search fails", async () => {
    searchMock
      .mockRejectedValueOnce(new SearchProviderError("timeout", "t", { provider: "tavily" }))
      .mockRejectedValueOnce(new SearchProviderError("quota_exhausted", "q", { provider: "tavily" }));
    await expect(searchMany([Q("a"), Q("b")])).rejects.toMatchObject({ kind: "quota_exhausted" });
  });

  it("checks authoritative usage before searching and sends nothing when the plan is exhausted", async () => {
    usageMock.mockResolvedValue(usage({ used: 999, planLimit: 1000 }));
    await expect(searchMany([Q("a"), Q("b")])).rejects.toMatchObject({ kind: "quota_exhausted" });
    expect(searchMock).not.toHaveBeenCalled();
  });

  it("fails closed (sends nothing) when usage cannot be verified", async () => {
    usageMock.mockRejectedValue(new SearchProviderError("rate_limited", "r", { provider: "tavily" }));
    await expect(searchMany([Q("a")])).rejects.toMatchObject({ kind: "usage_check_failed" });
    expect(searchMock).not.toHaveBeenCalled();
  });

  it("surfaces an invalid key from the usage check as authentication", async () => {
    usageMock.mockRejectedValue(new SearchProviderError("authentication", "bad key", { provider: "tavily" }));
    await expect(searchMany([Q("a")])).rejects.toMatchObject({ kind: "authentication" });
    expect(searchMock).not.toHaveBeenCalled();
  });

  it("caches usage briefly and adds credits spent since, without re-querying", async () => {
    process.env.SEARCH_MONTHLY_CREDIT_BUDGET = "13";
    searchMock.mockResolvedValue({ results: [], credits: 1, latencyMs: 1 });
    usageMock.mockResolvedValue(usage({ used: 10 }));
    await searchMany([Q("a"), Q("b")]); // 10 + 2 = 12 ≤ 13
    await expect(searchMany([Q("c"), Q("d")])).rejects.toMatchObject({ kind: "quota_exhausted" }); // 12 + 2 > 13
    expect(usageMock).toHaveBeenCalledTimes(1);
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps counting recent local spend after the cache refreshes (provider usage lags)", async () => {
    process.env.SEARCH_MONTHLY_CREDIT_BUDGET = "13";
    searchMock.mockResolvedValue({ results: [], credits: 1, latencyMs: 1 });
    usageMock.mockResolvedValue(usage({ used: 10, fetchedAt: Date.now() - 10 * 60 * 1000 })); // always stale
    await searchMany([Q("a"), Q("b")]);
    // Provider still reports 10 (lagging) — the local ledger keeps the 2 spent.
    await expect(searchMany([Q("c"), Q("d")])).rejects.toMatchObject({ kind: "quota_exhausted" });
    expect(usageMock).toHaveBeenCalledTimes(2);
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it("sends nothing and spends nothing for an empty query list", async () => {
    const batch = await searchMany([Q("   ")]);
    expect(batch.requests).toBe(0);
    expect(usageMock).not.toHaveBeenCalled();
  });
});

describe("assertWithinBudget", () => {
  it("allows spending inside the plan and app budget", () => {
    expect(() => assertWithinBudget(usage({ used: 100 }), 3, "tavily")).not.toThrow();
  });

  it("blocks once pay-as-you-go usage is non-zero", () => {
    expect(() => assertWithinBudget(usage({ paygoUsage: 1 }), 1, "tavily")).toThrow(/pay-as-you-go/);
  });

  it("blocks when the key's own limit would be exceeded", () => {
    expect(() => assertWithinBudget(usage({ keyLimit: 50, keyUsage: 49 }), 3, "tavily")).toThrow(SearchProviderError);
  });

  it("enforces the configurable app budget (default 900)", () => {
    expect(() => assertWithinBudget(usage({ used: 899 }), 3, "tavily")).toThrow(/monthly search budget/);
    process.env.SEARCH_MONTHLY_CREDIT_BUDGET = "50";
    expect(() => assertWithinBudget(usage({ used: 48 }), 3, "tavily")).toThrow(/monthly search budget/);
  });
});
