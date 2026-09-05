import { describe, expect, it } from "vitest";
import { computeGrowthIntelligence } from "../engine";
import { CHANNELS } from "../types";
import {
  developerApiFixture,
  lowConfidenceGenericFixture,
  weddingInviteFixture,
} from "./fixtures";

function find(
  result: ReturnType<typeof computeGrowthIntelligence>,
  channel: (typeof CHANNELS)[number]
) {
  const hit = result.channels.find((c) => c.channel === channel);
  if (!hit) throw new Error(`channel ${channel} missing from result`);
  return hit;
}

describe("1. Developer API/product", () => {
  const result = computeGrowthIntelligence(developerApiFixture());

  it("scores SEO and communities strongly relative to visual/outbound channels", () => {
    const seo = find(result, "seo");
    const communities = find(result, "communities");
    const social = find(result, "social");
    const outbound = find(result, "outbound");

    expect(seo.channelScore).toBeGreaterThan(social.channelScore);
    expect(communities.channelScore).toBeGreaterThan(social.channelScore);
    expect(seo.channelScore).toBeGreaterThan(outbound.channelScore);
  });

  it("ranks SEO or communities within the top three channels", () => {
    const topThree = result.rankedChannels.slice(0, 3).map((c) => c.channel);
    expect(topThree.some((c) => c === "seo" || c === "communities")).toBe(true);
  });
});

describe("2. Wedding invitation SaaS", () => {
  const result = computeGrowthIntelligence(weddingInviteFixture());

  it("scores social strongly relative to technical/search-driven channels", () => {
    const social = find(result, "social");
    const seo = find(result, "seo");
    const outbound = find(result, "outbound");

    expect(social.channelScore).toBeGreaterThan(seo.channelScore);
    expect(social.channelScore).toBeGreaterThan(outbound.channelScore);
  });

  it("ranks social within the top two channels", () => {
    const topTwo = result.rankedChannels.slice(0, 2).map((c) => c.channel);
    expect(topTwo).toContain("social");
  });
});

describe("3. Low-confidence generic SaaS", () => {
  const pi = lowConfidenceGenericFixture();
  const result = computeGrowthIntelligence(pi);

  it("still computes a score for every channel", () => {
    expect(result.channels).toHaveLength(CHANNELS.length);
    for (const c of result.channels) {
      expect(Number.isFinite(c.channelScore)).toBe(true);
      expect(Number.isFinite(c.opportunityScore)).toBe(true);
    }
  });

  it("reflects the low confidence in the summary and every channel", () => {
    expect(result.summary.confidenceLabel).toBe("low");
    for (const c of result.channels) {
      expect(c.confidence).toBe(pi.confidence.overall);
      expect(c.confidenceLabel).toBe("low");
    }
  });

  it("tempers opportunity score below channel score rather than zeroing it (§6)", () => {
    for (const c of result.channels) {
      expect(c.opportunityScore).toBeLessThan(c.channelScore);
      expect(c.opportunityScore).toBeGreaterThan(0);
    }
  });

  it("avoids manufacturing certainty — the highest-leverage action is a test, not a commit", () => {
    expect(result.highestLeverageAction.decisionType).toBe("test");
    expect(result.summary.decisionType).toBe("test");
  });
});

describe("4. Determinism", () => {
  it("returns identical output for identical input, across fixtures", () => {
    for (const fixture of [developerApiFixture, weddingInviteFixture, lowConfidenceGenericFixture]) {
      const a = computeGrowthIntelligence(fixture());
      const b = computeGrowthIntelligence(fixture());
      expect(a).toEqual(b);
    }
  });

  it("does not mutate its input", () => {
    const pi = developerApiFixture();
    const snapshot = JSON.parse(JSON.stringify(pi));
    computeGrowthIntelligence(pi);
    expect(pi).toEqual(snapshot);
  });
});

describe("5. Ranking", () => {
  it("sorts rankedChannels by opportunityScore, descending", () => {
    for (const fixture of [developerApiFixture, weddingInviteFixture, lowConfidenceGenericFixture]) {
      const result = computeGrowthIntelligence(fixture());
      for (let i = 0; i < result.rankedChannels.length - 1; i++) {
        expect(result.rankedChannels[i].opportunityScore).toBeGreaterThanOrEqual(
          result.rankedChannels[i + 1].opportunityScore
        );
      }
    }
  });

  it("ranks the same eight channels present in `channels`", () => {
    const result = computeGrowthIntelligence(developerApiFixture());
    const a = result.channels.map((c) => c.channel).sort();
    const b = result.rankedChannels.map((c) => c.channel).sort();
    expect(b).toEqual(a);
  });

  it("summary.topChannel matches the top of rankedChannels", () => {
    const result = computeGrowthIntelligence(developerApiFixture());
    expect(result.summary.topChannel).toBe(result.rankedChannels[0].channel);
    expect(result.summary.topOpportunityScore).toBe(result.rankedChannels[0].opportunityScore);
  });
});

describe("6. Constraints", () => {
  it("lowers resource-heavy channels' opportunity score under a tight budget, relative to a well-funded, experienced, patient founder", () => {
    const pi = developerApiFixture();

    const tight = computeGrowthIntelligence({
      ...pi,
      constraints: {
        budgetLevel: "very low, bootstrapped, no marketing budget",
        timeToResultsRequired: "urgent, need results within 30 days",
        marketingExperience: "no experience, first-time founder",
      },
    });

    const funded = computeGrowthIntelligence({
      ...pi,
      constraints: {
        budgetLevel: "well-funded, venture-backed",
        timeToResultsRequired: "patient, willing to wait 6 months",
        marketingExperience: "experienced growth marketer with years of experience",
      },
    });

    for (const channel of ["outbound", "partnerships", "paidAds"] as const) {
      const tightScore = find(tight, channel).opportunityScore;
      const fundedScore = find(funded, channel).opportunityScore;
      expect(fundedScore).toBeGreaterThan(tightScore);
    }
  });

  it("does not change channelScore, only opportunityScore", () => {
    const pi = developerApiFixture();
    const lowBudget = computeGrowthIntelligence({
      ...pi,
      constraints: { ...pi.constraints, budgetLevel: "very low, bootstrapped" },
    });
    const highBudget = computeGrowthIntelligence({
      ...pi,
      constraints: { ...pi.constraints, budgetLevel: "well-funded" },
    });

    for (const channel of CHANNELS) {
      expect(find(lowBudget, channel).channelScore).toBe(find(highBudget, channel).channelScore);
    }
  });
});

describe("7. Negative recommendation", () => {
  it("marks a channel with weak signals across the board as deprioritize", () => {
    const pi = developerApiFixture();
    const result = computeGrowthIntelligence({
      ...pi,
      marketSignals: { ...pi.marketSignals, visualContentPotential: 5 },
      channelSignals: {
        ...pi.channelSignals,
        social: { relevance: 8, reasoning: "Not a visual product at all." },
      },
      productFitSignals: {
        ...pi.productFitSignals,
        visualAudienceFit: 5,
        impulsePurchasePotential: 10,
      },
    });

    const social = find(result, "social");
    expect(social.recommendation).toBe("deprioritize");
  });

  it("does not force every channel to be positive", () => {
    const result = computeGrowthIntelligence(developerApiFixture());
    const recommendations = new Set(result.channels.map((c) => c.recommendation));
    // At least one non-"recommended" tier should exist for a product this
    // specialised — not every channel can be a strong fit at once.
    expect(recommendations.size).toBeGreaterThan(1);
  });
});
