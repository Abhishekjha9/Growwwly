import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAnalysis } from "./fixtures";

// ---------------------------------------------------------------------------
// Mock OpenAI's generateOpenAiWebSearchResponse. The mock must match the
// OpenAiWebSearchResult shape: { text, citations }.
// ---------------------------------------------------------------------------

const generateOpenAiWebSearchResponseMock = vi.fn();
vi.mock("@/lib/ai/providers/openai", () => ({
  generateOpenAiWebSearchResponse: (...args: unknown[]) =>
    generateOpenAiWebSearchResponseMock(...args),
}));

const { discoverOpportunities } = await import("../engine");

const VALID_RAW = {
  title: "How are you managing engineering project visibility across teams?",
  url: "https://www.reddit.com/r/ExperiencedDevs/comments/abc123/visibility/",
  source: "r/ExperiencedDevs",
  sourceType: "reddit",
  snippet: "We have five teams and no idea what anyone is actually working on.",
  estimatedDaysAgo: 2,
  relevanceSignal: 85,
  audienceMatchSignal: 80,
  intentSignal: 75,
  productAlignmentSignal: 78,
  intentTypes: ["seeking_recommendation"],
  reason: "Strong match with the target customer and core problem.",
  responseDraft: "We ran into this too — sharing one view instead of another status meeting helped.",
};

const HN_RAW = {
  ...VALID_RAW,
  title: "Ask HN: What do you use for engineering project tracking?",
  url: "https://news.ycombinator.com/item?id=99999",
  source: "Hacker News",
  sourceType: "hacker_news",
};

const FORUM_RAW = {
  ...VALID_RAW,
  title: "Best tools for cross-team project visibility?",
  url: "https://stackoverflow.com/questions/1234/best-tools",
  source: "Stack Overflow",
  sourceType: "forum",
};

const ARTICLE_RAW = {
  ...VALID_RAW,
  title: "How top engineering teams share project status",
  url: "https://example-blog.com/engineering-visibility",
  source: "example-blog.com",
  sourceType: "article",
};

/** A grounded result where every candidate URL is backed by a real
 * grounding source — the normal, successful case. */
function groundedResult(opportunities: unknown[], extraSources: string[] = []) {
  const allUrls = [
    ...opportunities
      .filter((o): o is { url: string } => typeof o === "object" && o !== null && "url" in o)
      .map((o) => (o as { url: string }).url),
    ...extraSources,
  ];
  return {
    text: JSON.stringify({ opportunities }),
    citations: allUrls.map((url) => ({ url, title: undefined })),
    webSearchQueries: ["test query"],
  };
}

describe("discoverOpportunities", () => {
  beforeEach(() => {
    generateOpenAiWebSearchResponseMock.mockReset();
  });

  it("1. returns validated, ranked opportunities from a well-formed grounded response", async () => {
    generateOpenAiWebSearchResponseMock.mockResolvedValue(groundedResult([VALID_RAW]));
    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe(VALID_RAW.url);
    expect(result[0].opportunityScore).toBeGreaterThan(0);
  });

  it("drops an individual malformed opportunity without discarding the rest", async () => {
    generateOpenAiWebSearchResponseMock.mockResolvedValue(
      groundedResult([VALID_RAW, { ...VALID_RAW, url: "not-a-url", title: "Bad one" }])
    );
    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe(VALID_RAW.title);
  });

  it("2. multi-source response: all valid source types survive and URLs are preserved", async () => {
    generateOpenAiWebSearchResponseMock.mockResolvedValue(
      groundedResult([VALID_RAW, HN_RAW, FORUM_RAW, ARTICLE_RAW])
    );
    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toHaveLength(4);

    const sourceTypes = result.map((r) => r.sourceType);
    expect(sourceTypes).toContain("reddit");
    expect(sourceTypes).toContain("hacker_news");
    expect(sourceTypes).toContain("forum");
    expect(sourceTypes).toContain("article");

    // URLs preserved exactly
    expect(result.find((r) => r.sourceType === "reddit")?.url).toBe(VALID_RAW.url);
    expect(result.find((r) => r.sourceType === "hacker_news")?.url).toBe(HN_RAW.url);
  });

  it("3. source type override: reddit.com URL is always classified as reddit regardless of declared sourceType", async () => {
    const wrongType = { ...VALID_RAW, sourceType: "article" };
    generateOpenAiWebSearchResponseMock.mockResolvedValue(groundedResult([wrongType]));
    const result = await discoverOpportunities(buildAnalysis());
    expect(result[0].sourceType).toBe("reddit");
  });

  it("3b. HN URL is always classified as hacker_news regardless of declared sourceType", async () => {
    const wrongType = { ...HN_RAW, sourceType: "article" };
    generateOpenAiWebSearchResponseMock.mockResolvedValue(groundedResult([wrongType]));
    const result = await discoverOpportunities(buildAnalysis());
    expect(result[0].sourceType).toBe("hacker_news");
  });

  it("4. deduplicates by URL but does NOT collapse different URLs from the same domain", async () => {
    const hn1 = { ...HN_RAW, url: "https://news.ycombinator.com/item?id=11111" };
    const hn2 = { ...HN_RAW, url: "https://news.ycombinator.com/item?id=22222", title: "Different HN thread" };
    generateOpenAiWebSearchResponseMock.mockResolvedValue(groundedResult([hn1, hn2]));
    const result = await discoverOpportunities(buildAnalysis());
    // Both should survive — same domain, different URLs
    expect(result).toHaveLength(2);
  });

  it("6. discards an opportunity whose URL/domain is not confirmed by any grounding source", async () => {
    generateOpenAiWebSearchResponseMock.mockResolvedValue({
      text: JSON.stringify({ opportunities: [VALID_RAW] }),
      citations: [{ uri: "https://totally-unrelated.example.com/page", title: undefined, domain: undefined }],
      
    });
    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toEqual([]);
  });

  it("keeps an opportunity whose URL matches a grounding source after normalization", async () => {
    generateOpenAiWebSearchResponseMock.mockResolvedValue({
      text: JSON.stringify({ opportunities: [VALID_RAW] }),
      citations: [{ url: `${VALID_RAW.url}?utm_source=share`, title: undefined }],
      
    });
    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toHaveLength(1);
  });

  it("accepts an opportunity when its domain appears in grounding sources even if exact URL differs", async () => {
    // This covers the common case where Google returns a reddit.com domain
    // but the exact thread URL differs slightly in the grounding metadata.
    generateOpenAiWebSearchResponseMock.mockResolvedValue({
      text: JSON.stringify({ opportunities: [VALID_RAW] }),
      citations: [{ url: "https://reddit.com/r/ExperiencedDevs/", title: undefined }],
      
    });
    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toHaveLength(1);
  });

  it("9. never fabricates a fallback when search finds nothing", async () => {
    generateOpenAiWebSearchResponseMock.mockResolvedValue(groundedResult([]));
    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toEqual([]);
  });

  it("YC/HN-only response: valid HN opportunities are kept, no Reddit fabricated", async () => {
    generateOpenAiWebSearchResponseMock.mockResolvedValue(groundedResult([HN_RAW]));
    const result = await discoverOpportunities(buildAnalysis());
    // The single valid HN opportunity should survive
    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe("hacker_news");
    // And no Reddit results were conjured up
    expect(result.every((r) => r.sourceType !== "reddit")).toBe(true);
  });

  it("8. propagates a provider failure rather than returning fake data", async () => {
    generateOpenAiWebSearchResponseMock.mockRejectedValue(new Error("OpenAI API error"));
    await expect(discoverOpportunities(buildAnalysis())).rejects.toThrow();
  });

  it("handles a non-JSON model response without fabricating results", async () => {
    generateOpenAiWebSearchResponseMock.mockResolvedValue({
      text: "I couldn't find anything relevant.",
      citations: [],
      
    });
    await expect(discoverOpportunities(buildAnalysis())).rejects.toThrow();
  });

  it("strips markdown fences the model sometimes wraps JSON in", async () => {
    generateOpenAiWebSearchResponseMock.mockResolvedValue({
      text: "```json\n" + JSON.stringify({ opportunities: [VALID_RAW] }) + "\n```",
      citations: [{ url: VALID_RAW.url, title: undefined }],
      
    });
    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toHaveLength(1);
  });

  it("accepts all candidates when grounding returns no sources (fallback mode)", async () => {
    // If grounding metadata is absent (e.g., API tier limit), we accept
    // candidates rather than discarding all results.
    generateOpenAiWebSearchResponseMock.mockResolvedValue({
      text: JSON.stringify({ opportunities: [VALID_RAW] }),
      citations: [],
      
    });
    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toHaveLength(1);
  });
});
