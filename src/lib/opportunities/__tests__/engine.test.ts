import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAnalysis } from "./fixtures";

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

/** A response where every candidate opportunity's URL is backed by a real
 * citation — the normal, successful case. */
function webSearchResult(opportunities: unknown[], extraCitations: string[] = []) {
  return {
    text: JSON.stringify({ opportunities }),
    citations: [
      ...opportunities
        .filter((o): o is { url: string } => typeof o === "object" && o !== null && "url" in o)
        .map((o) => ({ url: (o as { url: string }).url, title: undefined })),
      ...extraCitations.map((url) => ({ url, title: undefined })),
    ],
  };
}

describe("discoverOpportunities", () => {
  beforeEach(() => {
    generateOpenAiWebSearchResponseMock.mockReset();
  });

  it("1. returns validated, ranked opportunities from a well-formed web search response", async () => {
    generateOpenAiWebSearchResponseMock.mockResolvedValue(webSearchResult([VALID_RAW]));
    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe(VALID_RAW.url);
    expect(result[0].opportunityScore).toBeGreaterThan(0);
  });

  it("drops an individual malformed opportunity without discarding the rest", async () => {
    generateOpenAiWebSearchResponseMock.mockResolvedValue(
      webSearchResult([VALID_RAW, { ...VALID_RAW, url: "not-a-url", title: "Bad one" }])
    );
    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe(VALID_RAW.title);
  });

  it("6. & 10. discards an opportunity whose URL is not confirmed by any web search citation (no fabricated URLs)", async () => {
    // The model's JSON claims this URL, but the web_search tool never
    // actually returned or visited it — must never be trusted on the
    // model's word alone.
    generateOpenAiWebSearchResponseMock.mockResolvedValue({
      text: JSON.stringify({ opportunities: [VALID_RAW] }),
      citations: [{ url: "https://www.reddit.com/r/completely/unrelated/thread", title: undefined }],
    });
    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toEqual([]);
  });

  it("keeps an opportunity whose URL matches a citation after normalization (trailing slash / tracking params)", async () => {
    generateOpenAiWebSearchResponseMock.mockResolvedValue({
      text: JSON.stringify({ opportunities: [VALID_RAW] }),
      citations: [{ url: `${VALID_RAW.url}?utm_source=share`, title: undefined }],
    });
    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toHaveLength(1);
  });

  it("9. never fabricates a fallback opportunity when the search finds nothing", async () => {
    generateOpenAiWebSearchResponseMock.mockResolvedValue(webSearchResult([]));
    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toEqual([]);
  });

  it("8. propagates a provider failure rather than returning fake data", async () => {
    generateOpenAiWebSearchResponseMock.mockRejectedValue(new Error("OpenAI API error"));
    await expect(discoverOpportunities(buildAnalysis())).rejects.toThrow();
  });

  it("handles a non-JSON / garbage model response without fabricating results", async () => {
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

  it("4. handles a response with no citations at all — every candidate is discarded, never trusted blindly", async () => {
    generateOpenAiWebSearchResponseMock.mockResolvedValue({
      text: JSON.stringify({ opportunities: [VALID_RAW] }),
      citations: [],
    });
    const result = await discoverOpportunities(buildAnalysis());
    expect(result).toEqual([]);
  });
});
