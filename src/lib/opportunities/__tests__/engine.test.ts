import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAnalysis } from "./fixtures";
import { AIProviderError } from "@/lib/ai/errors";
import { SearchProviderError, canonicalizeUrl, type SearchResult } from "@/lib/search";
import { computeOpportunityScore, computeFreshnessScore } from "../rank";

// ---------------------------------------------------------------------------
// Pipeline under test: searchMany (Tavily, mocked) → generateStructuredResponse
// (Gemini, mocked) → URL resolution → deterministic ranking (real).
// ---------------------------------------------------------------------------

const searchManyMock = vi.fn();
const generateMock = vi.fn();

vi.mock("@/lib/search", async () => {
  const actual = await vi.importActual<typeof import("@/lib/search")>("@/lib/search");
  return { ...actual, searchMany: (...a: unknown[]) => searchManyMock(...a) };
});
vi.mock("@/lib/ai/client", () => ({
  generateStructuredResponse: (...a: unknown[]) => generateMock(...a),
}));

const { discoverOpportunities } = await import("../engine");
const { mapInterpretationToRawOpportunities } = await import("../search");

function sr(id: string, url: string, extra: Partial<SearchResult> = {}): SearchResult {
  return {
    id,
    title: `Title ${id}`,
    url,
    canonicalUrl: canonicalizeUrl(url),
    domain: new URL(url).hostname.replace(/^www\./, ""),
    content: `Real excerpt for ${id}: we are looking for a better tool for this exact problem.`,
    providerScore: 0.7,
    publishedDate: null,
    provider: "tavily",
    ...extra,
  };
}

const RESULTS: SearchResult[] = [
  sr("S1", "https://www.reddit.com/r/ExperiencedDevs/comments/abc123/visibility/", {
    publishedDate: "2026-11-12T00:00:00Z",
  }),
  sr("S2", "https://news.ycombinator.com/item?id=99999"),
  sr("S3", "https://stackoverflow.com/questions/1234/best-tools"),
];

function batch(results = RESULTS) {
  return { results, requests: 3, credits: 3, latencyMs: 10, failures: [] };
}

function item(sourceId: string | undefined, extra: Record<string, unknown> = {}) {
  return {
    ...(sourceId ? { sourceId } : {}),
    sourceType: "forum",
    relevanceSignal: 85,
    audienceMatchSignal: 80,
    intentSignal: 75,
    productAlignmentSignal: 78,
    intentTypes: ["seeking_recommendation"],
    reason: "Strong match with the target customer and core problem.",
    responseDraft: "We ran into this too — sharing one view instead of another status meeting helped.",
    ...extra,
  };
}

beforeEach(() => {
  searchManyMock.mockReset();
  generateMock.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("discoverOpportunities (Tavily + AI interpretation)", () => {
  it("returns ranked opportunities whose URL, title and snippet come from the search result", async () => {
    searchManyMock.mockResolvedValue(batch());
    generateMock.mockResolvedValue({ opportunities: [item("S1"), item("S2")] });

    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toHaveLength(2);
    const reddit = result.find((o) => o.sourceType === "reddit")!;
    expect(reddit.url).toBe(RESULTS[0].url);
    expect(reddit.title).toBe("Title S1");
    expect(reddit.snippet).toBe(RESULTS[0].content);
    expect(reddit.source).toBe("r/ExperiencedDevs");
    const hn = result.find((o) => o.sourceType === "hacker_news")!;
    expect(hn.source).toBe("Hacker News");
  });

  it("sends at most three searches and passes only result ids (no URLs) in the AI schema", async () => {
    searchManyMock.mockResolvedValue(batch());
    generateMock.mockResolvedValue({ opportunities: [] });
    await discoverOpportunities(buildAnalysis());

    const [queries] = searchManyMock.mock.calls[0];
    expect(queries.length).toBeLessThanOrEqual(3);

    const [opts] = generateMock.mock.calls[0];
    expect(opts.operation).toBe("opportunity");
    expect(generateMock).toHaveBeenCalledTimes(1);
    const schemaShape = Object.keys(opts.responseSchema.shape.opportunities.element.shape);
    expect(schemaShape).not.toContain("url");
    // Unknown ids are rejected by the schema itself.
    expect(opts.responseSchema.safeParse({ opportunities: [item("S99")] }).success).toBe(false);
    expect(opts.userPrompt).toContain("[S1]");
  });

  it("discards an opportunity referencing an unknown source id", async () => {
    searchManyMock.mockResolvedValue(batch());
    generateMock.mockResolvedValue({ opportunities: [item("S1"), item("S42")] });
    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe(RESULTS[0].url);
  });

  it("discards fabricated URLs that do not match any search result", async () => {
    searchManyMock.mockResolvedValue(batch());
    generateMock.mockResolvedValue({
      opportunities: [
        item(undefined, { url: "https://www.reddit.com/r/ExperiencedDevs/comments/fake999/made_up/" }),
        item(undefined, { url: "https://totally-invented.example/thread" }),
      ],
    });
    expect(await discoverOpportunities(buildAnalysis())).toEqual([]);
  });

  it("never uses a model-written URL even when it carries a valid source id", async () => {
    searchManyMock.mockResolvedValue(batch());
    generateMock.mockResolvedValue({
      opportunities: [item("S2", { url: "https://evil.example/phish" })],
    });
    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://news.ycombinator.com/item?id=99999");
  });

  it("maps a model URL that matches a search result to the ORIGINAL search URL", async () => {
    searchManyMock.mockResolvedValue(batch());
    generateMock.mockResolvedValue({
      opportunities: [item(undefined, { url: "https://stackoverflow.com/questions/1234/best-tools/?utm_source=x" })],
    });
    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://stackoverflow.com/questions/1234/best-tools");
  });

  it("drops duplicate opportunities that reference the same result", async () => {
    searchManyMock.mockResolvedValue(batch());
    generateMock.mockResolvedValue({
      opportunities: [item("S3"), item("S3", { relevanceSignal: 99 }), item(undefined, { url: RESULTS[2].url })],
    });
    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toHaveLength(1);
    expect(result[0].relevanceScore).toBe(85);
  });

  it("drops a malformed AI item without discarding the rest", async () => {
    searchManyMock.mockResolvedValue(batch());
    generateMock.mockResolvedValue({ opportunities: [item("S1", { relevanceSignal: "high" }), item("S2")] });
    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toHaveLength(1);
  });

  it("does not call the AI at all when search returns nothing", async () => {
    searchManyMock.mockResolvedValue(batch([]));
    expect(await discoverOpportunities(buildAnalysis())).toEqual([]);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("returns an empty feed (never a fabricated fallback) when the AI finds nothing relevant", async () => {
    searchManyMock.mockResolvedValue(batch());
    generateMock.mockResolvedValue({ opportunities: [] });
    expect(await discoverOpportunities(buildAnalysis())).toEqual([]);
  });

  it("propagates search provider failures without calling the AI", async () => {
    searchManyMock.mockRejectedValue(new SearchProviderError("quota_exhausted", "q", { provider: "tavily" }));
    await expect(discoverOpportunities(buildAnalysis())).rejects.toBeInstanceOf(SearchProviderError);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("propagates AI interpretation failures", async () => {
    searchManyMock.mockResolvedValue(batch());
    generateMock.mockRejectedValue(new AIProviderError("timeout", "t", { provider: "gemini" }));
    await expect(discoverOpportunities(buildAnalysis())).rejects.toBeInstanceOf(AIProviderError);
  });

  it("keeps the deterministic Opportunity Score formula (date from search, not AI)", async () => {
    searchManyMock.mockResolvedValue(batch());
    generateMock.mockResolvedValue({ opportunities: [item("S1")] });
    const [opp] = await discoverOpportunities(buildAnalysis());
    const { opportunities: raws } = mapInterpretationToRawOpportunities([item("S1")], RESULTS);
    const raw = raws[0];
    expect(raw.publishedAt).toBe("2026-11-12T00:00:00Z");
    expect(raw.commentCount).toBeUndefined();
    expect(opp.opportunityScore).toBe(
      computeOpportunityScore(raw, computeFreshnessScore(raw.estimatedDaysAgo))
    );
  });
});

describe("mapInterpretationToRawOpportunities", () => {
  it("computes age only from the search result's date, ignoring AI-supplied dates/engagement", () => {
    const now = Date.parse("2026-11-14T00:00:00Z");
    const { opportunities } = mapInterpretationToRawOpportunities(
      [item("S1", { estimatedDaysAgo: 0, commentCount: 999, publishedAt: "today" })],
      RESULTS,
      now
    );
    expect(opportunities[0].estimatedDaysAgo).toBe(2);
    expect(opportunities[0].commentCount).toBeUndefined();
    expect(opportunities[0].publishedAt).toBe("2026-11-12T00:00:00Z");
  });

  it("reports mapping stats", () => {
    const { stats } = mapInterpretationToRawOpportunities(
      [item("S1"), item("S1"), item("S9"), { nope: true }],
      RESULTS
    );
    expect(stats).toEqual({ received: 4, unknownSource: 1, duplicate: 1, invalid: 1 });
  });
});
