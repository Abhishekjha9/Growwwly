import { describe, expect, it } from "vitest";
import {
  computeTechnicalHealthScore,
  computeWebsiteChannelModifier,
  detectBottleneck,
  extractWebsiteSignalBag,
} from "../website";
import { computeGrowthIntelligence } from "../engine";
import { developerApiFixture, uniformlyWeakAcquisitionFixture } from "./fixtures";
import {
  healthyWebsiteFixture,
  lowConfidenceWebsiteFixture,
  unavailableWebsiteFixture,
  weakConversionWebsiteFixture,
  weakPositioningWebsiteFixture,
  weakTechnicalWebsiteFixture,
} from "./websiteFixtures";

describe("computeTechnicalHealthScore", () => {
  it("scores a well-formed page highly", () => {
    const score = computeTechnicalHealthScore(healthyWebsiteFixture());
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it("scores a page missing title/meta/h1/alt text poorly", () => {
    const score = computeTechnicalHealthScore(weakTechnicalWebsiteFixture());
    expect(score).toBeLessThan(50);
  });

  it("degrades gracefully when Lighthouse is unavailable, using only Cheerio facts", () => {
    const withLighthouse = healthyWebsiteFixture();
    const withoutLighthouse = {
      ...withLighthouse,
      performance: { status: "unavailable" as const, performance: null, accessibility: null, bestPractices: null, seo: null, reason: "timed out" },
    };
    // Should still compute a defined score purely from the SEO facts, not throw or return 0.
    const score = computeTechnicalHealthScore(withoutLighthouse);
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThan(0);
  });

  it("is neutral (50) when there is no SEO evidence at all", () => {
    const score = computeTechnicalHealthScore(unavailableWebsiteFixture());
    expect(score).toBe(50);
  });
});

describe("extractWebsiteSignalBag", () => {
  it("returns null when there is no AI interpretation", () => {
    expect(extractWebsiteSignalBag(unavailableWebsiteFixture())).toBeNull();
  });

  it("inverts signupFriction into the conversion composite correctly", () => {
    const bag = extractWebsiteSignalBag(healthyWebsiteFixture());
    expect(bag).not.toBeNull();
    // signupFriction 30 -> ease 70, averaged with four other ~60-70 fields.
    expect(bag!.conversionScore).toBeGreaterThan(50);
  });
});

describe("computeWebsiteChannelModifier", () => {
  it("only adjusts seo and content — every other channel is a no-op", () => {
    const bag = extractWebsiteSignalBag(weakTechnicalWebsiteFixture())!;
    for (const channel of ["communities", "social", "outbound", "partnerships", "paidAds", "referrals"] as const) {
      expect(computeWebsiteChannelModifier(channel, bag)).toEqual({ multiplier: 1, reason: null });
    }
  });

  it("penalizes SEO opportunity when technical health is weak", () => {
    const bag = extractWebsiteSignalBag(weakTechnicalWebsiteFixture())!;
    const result = computeWebsiteChannelModifier("seo", bag);
    expect(result.multiplier).toBeLessThan(1);
    expect(result.reason).toBeTruthy();
  });

  it("boosts SEO opportunity when technical health is strong", () => {
    const bag = extractWebsiteSignalBag(healthyWebsiteFixture())!;
    const result = computeWebsiteChannelModifier("seo", bag);
    expect(result.multiplier).toBeGreaterThanOrEqual(1);
  });
});

describe("detectBottleneck", () => {
  const pi = developerApiFixture(); // strong acquisition fit across the board

  it("returns 'unknown' when no website was inspected", () => {
    const result = computeGrowthIntelligence(pi, null);
    expect(result.bottleneck.type).toBe("unknown");
  });

  it("returns 'acquisition' when even the best channel fit is weak, regardless of website quality", () => {
    const result = computeGrowthIntelligence(uniformlyWeakAcquisitionFixture(), healthyWebsiteFixture());
    expect(result.bottleneck.type).toBe("acquisition");
  });

  it("returns 'technical' when acquisition fit is strong but technical health is weak", () => {
    const bottleneck = detectBottleneck(
      computeGrowthIntelligence(pi, weakTechnicalWebsiteFixture()).rankedChannels,
      weakTechnicalWebsiteFixture()
    );
    expect(bottleneck.type).toBe("technical");
  });

  it("returns 'positioning' when acquisition fit is strong but positioning clarity is weak", () => {
    const website = weakPositioningWebsiteFixture();
    const bottleneck = detectBottleneck(computeGrowthIntelligence(pi, website).rankedChannels, website);
    expect(bottleneck.type).toBe("positioning");
  });

  it("returns 'conversion' when acquisition fit is strong but CTA/conversion signals are weak", () => {
    const website = weakConversionWebsiteFixture();
    const bottleneck = detectBottleneck(computeGrowthIntelligence(pi, website).rankedChannels, website);
    expect(bottleneck.type).toBe("conversion");
  });

  it("returns 'unknown' when the website's own interpretation confidence is low, even with weak-looking signals", () => {
    const website = lowConfidenceWebsiteFixture();
    const bottleneck = detectBottleneck(computeGrowthIntelligence(pi, website).rankedChannels, website);
    expect(bottleneck.type).toBe("unknown");
    expect(bottleneck.reason).toMatch(/confidence/i);
  });

  it("returns 'unknown' for a generally healthy, balanced website", () => {
    const website = healthyWebsiteFixture();
    const bottleneck = detectBottleneck(computeGrowthIntelligence(pi, website).rankedChannels, website);
    expect(bottleneck.type).toBe("unknown");
  });
});
