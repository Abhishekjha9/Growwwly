import { describe, expect, it } from "vitest";
import {
  computeConfidence,
  computeFreshnessScore,
  computeOpportunityScore,
  extractDomain,
  normalizeUrl,
  rankOpportunities,
  scoreOpportunity,
} from "../rank";
import { OPPORTUNITY_SCORE_WEIGHTS } from "../constants";
import { baseRawOpportunity } from "./fixtures";

describe("OPPORTUNITY_SCORE_WEIGHTS", () => {
  it("sums to 1", () => {
    const total = Object.values(OPPORTUNITY_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("computeFreshnessScore", () => {
  it("scores a very recent discussion highly", () => {
    expect(computeFreshnessScore(1)).toBe(100);
  });

  it("scores an old discussion low", () => {
    expect(computeFreshnessScore(400)).toBe(20);
  });

  it("scores an unknown date as low, not fabricated", () => {
    expect(computeFreshnessScore(undefined)).toBe(20);
  });
});

describe("computeOpportunityScore / computeConfidence", () => {
  it("5. is deterministic — same input always produces the same score", () => {
    const raw = baseRawOpportunity();
    const freshness = computeFreshnessScore(raw.estimatedDaysAgo);
    const a = computeOpportunityScore(raw, freshness);
    const b = computeOpportunityScore(raw, freshness);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(100);
  });

  it("9. ranks a high-relevance opportunity above a low-relevance one", () => {
    const strong = baseRawOpportunity({
      relevanceSignal: 95,
      audienceMatchSignal: 90,
      intentSignal: 90,
      productAlignmentSignal: 90,
      estimatedDaysAgo: 1,
    });
    const weak = baseRawOpportunity({
      url: "https://forum.example.com/thread/2",
      relevanceSignal: 20,
      audienceMatchSignal: 15,
      intentSignal: 10,
      productAlignmentSignal: 15,
      estimatedDaysAgo: 300,
    });

    const strongScore = computeOpportunityScore(strong, computeFreshnessScore(strong.estimatedDaysAgo));
    const weakScore = computeOpportunityScore(weak, computeFreshnessScore(weak.estimatedDaysAgo));

    expect(strongScore).toBeGreaterThan(weakScore);
  });

  it("confidence is deterministic and bounded", () => {
    const raw = baseRawOpportunity();
    expect(computeConfidence(raw)).toBe(computeConfidence(raw));
    expect(computeConfidence(raw)).toBeGreaterThanOrEqual(0);
    expect(computeConfidence(raw)).toBeLessThanOrEqual(100);
  });
});

describe("normalizeUrl / extractDomain", () => {
  it("strips tracking params and trailing slashes for de-duplication", () => {
    const a = normalizeUrl("https://www.reddit.com/r/foo/comments/1/?utm_source=share");
    const b = normalizeUrl("https://www.reddit.com/r/foo/comments/1/");
    expect(a).toBe(b);
  });

  it("preserves params a source depends on for identity (e.g. Hacker News' ?id=)", () => {
    const a = normalizeUrl("https://news.ycombinator.com/item?id=111");
    const b = normalizeUrl("https://news.ycombinator.com/item?id=222");
    expect(a).not.toBe(b);
  });

  it("extracts a bare hostname without www", () => {
    expect(extractDomain("https://www.reddit.com/r/foo")).toBe("reddit.com");
  });
});

describe("scoreOpportunity", () => {
  it("overrides sourceType for known domains regardless of what Gemini declared", () => {
    const raw = baseRawOpportunity({
      url: "https://news.ycombinator.com/item?id=12345",
      sourceType: "article",
    });
    const scored = scoreOpportunity(raw);
    expect(scored.sourceType).toBe("hacker_news");
  });

  it("passes relevanceSignal through unchanged as relevanceScore", () => {
    const raw = baseRawOpportunity({ relevanceSignal: 63 });
    expect(scoreOpportunity(raw).relevanceScore).toBe(63);
  });
});

describe("rankOpportunities", () => {
  it("4. removes duplicate URLs (after normalization)", () => {
    const raws = [
      baseRawOpportunity({ url: "https://www.reddit.com/r/foo/comments/1/" }),
      baseRawOpportunity({ url: "https://www.reddit.com/r/foo/comments/1/?utm_source=share" }),
    ];
    const ranked = rankOpportunities(raws);
    expect(ranked).toHaveLength(1);
  });

  it("6. sorts deterministically by Opportunity Score, descending", () => {
    const raws = [
      baseRawOpportunity({
        url: "https://forum.example.com/1",
        relevanceSignal: 40,
        audienceMatchSignal: 40,
        intentSignal: 40,
        productAlignmentSignal: 40,
      }),
      baseRawOpportunity({
        url: "https://forum.example.com/2",
        relevanceSignal: 90,
        audienceMatchSignal: 90,
        intentSignal: 90,
        productAlignmentSignal: 90,
      }),
    ];
    const ranked = rankOpportunities(raws);
    expect(ranked[0].url).toBe("https://forum.example.com/2");
    expect(ranked[0].opportunityScore).toBeGreaterThanOrEqual(ranked[1].opportunityScore);
  });

  it("caps the feed at the configured maximum", () => {
    const raws = Array.from({ length: 20 }, (_, i) =>
      baseRawOpportunity({ url: `https://forum.example.com/thread-${i}` })
    );
    const ranked = rankOpportunities(raws);
    expect(ranked.length).toBeLessThanOrEqual(10);
  });

  it("excludes the product's own domain", () => {
    const raws = [baseRawOpportunity({ url: "https://myproduct.com/blog/post" })];
    const ranked = rankOpportunities(raws, { productDomain: "myproduct.com" });
    expect(ranked).toHaveLength(0);
  });

  it("8. never fabricates a fallback opportunity when given an empty list", () => {
    expect(rankOpportunities([])).toEqual([]);
  });
});
