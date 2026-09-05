import { describe, expect, it } from "vitest";
import {
  calculateChannelScore,
  calculateOpportunityScore,
  calculateWeightedScore,
  clampScore,
  computeConstraintModifier,
  normalizeScore,
} from "../scoring";
import { extractSignalBag } from "../signals";
import { baseProductIntelligence } from "./fixtures";

describe("clampScore / normalizeScore", () => {
  it("clamps below 0 and above 100", () => {
    expect(clampScore(-20)).toBe(0);
    expect(clampScore(150)).toBe(100);
    expect(clampScore(42.4)).toBe(42.4);
  });

  it("rounds to the nearest integer after clamping", () => {
    expect(normalizeScore(42.6)).toBe(43);
    expect(normalizeScore(-5)).toBe(0);
    expect(normalizeScore(142)).toBe(100);
  });
});

describe("calculateWeightedScore", () => {
  it("computes a plain weighted sum", () => {
    const bag = extractSignalBag(baseProductIntelligence());
    const score = calculateWeightedScore(bag, [
      { signal: "searchIntent", weight: 0.5 },
      { signal: "communityPresence", weight: 0.5 },
    ]);
    // Both signals are 50 in the base fixture.
    expect(score).toBe(50);
  });
});

describe("calculateChannelScore", () => {
  it("is deterministic for the same input", () => {
    const bag = extractSignalBag(baseProductIntelligence());
    expect(calculateChannelScore(bag, "seo")).toBe(calculateChannelScore(bag, "seo"));
  });

  it("responds to its own weighted signals moving", () => {
    const flat = extractSignalBag(baseProductIntelligence());
    const boosted = extractSignalBag(
      baseProductIntelligence({
        marketSignals: { searchIntent: 100 },
        channelSignals: { seo: { relevance: 100, reasoning: "x" } },
        productFitSignals: { searchDrivenProblem: 100 },
      })
    );
    expect(calculateChannelScore(boosted, "seo")).toBeGreaterThan(
      calculateChannelScore(flat, "seo")
    );
  });

  it("always returns a value within 0-100", () => {
    const bag = extractSignalBag(baseProductIntelligence());
    for (const channel of [
      "seo",
      "communities",
      "content",
      "social",
      "outbound",
      "partnerships",
      "paidAds",
      "referrals",
    ] as const) {
      const score = calculateChannelScore(bag, channel);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

describe("calculateOpportunityScore", () => {
  it("increases with confidence, all else equal", () => {
    const low = calculateOpportunityScore(70, 20, 3, 1);
    const high = calculateOpportunityScore(70, 90, 3, 1);
    expect(high).toBeGreaterThan(low);
  });

  it("never destroys the score even at zero confidence (§6)", () => {
    const score = calculateOpportunityScore(80, 0, 3, 1);
    expect(score).toBeGreaterThan(0);
  });

  it("decreases with higher effort, all else equal", () => {
    const easy = calculateOpportunityScore(70, 80, 2, 1);
    const hard = calculateOpportunityScore(70, 80, 5, 1);
    expect(easy).toBeGreaterThan(hard);
  });

  it("stays within 0-100 even at the most favourable inputs", () => {
    const score = calculateOpportunityScore(100, 100, 1, 1.15);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("computeConstraintModifier", () => {
  it("returns 1 (no adjustment) when constraints are unclassifiable", () => {
    const pi = baseProductIntelligence();
    const modifier = computeConstraintModifier("outbound", 4, pi.constraints);
    expect(modifier).toBe(1);
  });

  it("penalizes a resource-heavy channel under a low budget", () => {
    const modifier = computeConstraintModifier("outbound", 4, {
      budgetLevel: "very low, bootstrapped",
      timeToResultsRequired: "not specified",
      marketingExperience: "not specified",
    });
    expect(modifier).toBeLessThan(1);
  });

  it("does not penalize a low-effort channel for a low budget", () => {
    const modifier = computeConstraintModifier("communities", 2, {
      budgetLevel: "very low, bootstrapped",
      timeToResultsRequired: "not specified",
      marketingExperience: "not specified",
    });
    expect(modifier).toBe(1);
  });

  it("rewards outbound experience on sales-craft channels", () => {
    const modifier = computeConstraintModifier("outbound", 4, {
      budgetLevel: "not specified",
      timeToResultsRequired: "not specified",
      marketingExperience: "experienced growth marketer",
    });
    expect(modifier).toBeGreaterThan(1);
  });

  it("stays within the configured bounds", () => {
    const modifier = computeConstraintModifier("paidAds", 5, {
      budgetLevel: "very low, bootstrapped, no budget",
      timeToResultsRequired: "urgent, need results asap",
      marketingExperience: "no experience, first-time founder",
    });
    expect(modifier).toBeGreaterThanOrEqual(0.7);
    expect(modifier).toBeLessThanOrEqual(1.15);
  });
});
