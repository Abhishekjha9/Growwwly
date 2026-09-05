import { describe, expect, it } from "vitest";
import { computeGrowthIntelligence } from "../engine";
import { developerApiFixture, uniformlyWeakAcquisitionFixture } from "./fixtures";
import {
  healthyWebsiteFixture,
  lowConfidenceWebsiteFixture,
  weakConversionWebsiteFixture,
  weakPositioningWebsiteFixture,
  weakTechnicalWebsiteFixture,
} from "./websiteFixtures";

// ---------------------------------------------------------------------------
// Phase 3 cross-cutting tests: Website Intelligence feeding the Growth
// Engine. Test items 13-20 of AGENTS.md Phase 3 §21 — the website module's
// own unit tests (items 1-12) live under src/lib/website/__tests__/.
// ---------------------------------------------------------------------------

describe("13. Phase 2 still works without website intelligence", () => {
  it("computes a full result when called with no website argument at all", () => {
    const result = computeGrowthIntelligence(developerApiFixture());
    expect(result.channels).toHaveLength(8);
    expect(result.bottleneck.type).toBe("unknown");
    expect(result.channels.every((c) => c.websiteAdjustment === null)).toBe(true);
  });

  it("computes an identical result whether website is omitted or explicitly null", () => {
    const withOmitted = computeGrowthIntelligence(developerApiFixture());
    const withNull = computeGrowthIntelligence(developerApiFixture(), null);
    expect(withOmitted).toEqual(withNull);
  });
});

describe("14. Phase 2 changes appropriately with website evidence", () => {
  it("lowers SEO's opportunity score when technical health is weak, vs. no website at all", () => {
    const pi = developerApiFixture();
    const withoutWebsite = computeGrowthIntelligence(pi);
    const withWeakTechnical = computeGrowthIntelligence(pi, weakTechnicalWebsiteFixture());

    const seoWithout = withoutWebsite.channels.find((c) => c.channel === "seo")!;
    const seoWithWeak = withWeakTechnical.channels.find((c) => c.channel === "seo")!;

    expect(seoWithWeak.opportunityScore).toBeLessThan(seoWithout.opportunityScore);
    expect(seoWithWeak.websiteAdjustment).not.toBeNull();
    expect(seoWithWeak.channelScore).toBe(seoWithout.channelScore); // fit itself is unchanged
  });

  it("raises SEO's opportunity score when technical health is strong, vs. no website at all", () => {
    const pi = developerApiFixture();
    const withoutWebsite = computeGrowthIntelligence(pi);
    const withHealthy = computeGrowthIntelligence(pi, healthyWebsiteFixture());

    const seoWithout = withoutWebsite.channels.find((c) => c.channel === "seo")!;
    const seoWithHealthy = withHealthy.channels.find((c) => c.channel === "seo")!;

    expect(seoWithHealthy.opportunityScore).toBeGreaterThanOrEqual(seoWithout.opportunityScore);
  });

  it("leaves channels other than SEO/content unaffected by website evidence", () => {
    const pi = developerApiFixture();
    const withoutWebsite = computeGrowthIntelligence(pi);
    const withWeakTechnical = computeGrowthIntelligence(pi, weakTechnicalWebsiteFixture());

    for (const channel of ["communities", "social", "outbound", "partnerships", "paidAds", "referrals"] as const) {
      const a = withoutWebsite.channels.find((c) => c.channel === channel)!;
      const b = withWeakTechnical.channels.find((c) => c.channel === channel)!;
      expect(b.opportunityScore).toBe(a.opportunityScore);
      expect(b.websiteAdjustment).toBeNull();
    }
  });
});

describe("15. Deterministic website-aware scoring", () => {
  it("returns identical output across repeated calls with the same website evidence", () => {
    const pi = developerApiFixture();
    const website = weakPositioningWebsiteFixture();
    const a = computeGrowthIntelligence(pi, website);
    const b = computeGrowthIntelligence(pi, website);
    expect(a).toEqual(b);
  });

  it("does not mutate the website evidence it's given", () => {
    const website = healthyWebsiteFixture();
    const snapshot = JSON.parse(JSON.stringify(website));
    computeGrowthIntelligence(developerApiFixture(), website);
    expect(website).toEqual(snapshot);
  });
});

describe("16. Conversion bottleneck detection", () => {
  it("selects a conversion-fix action when CTA/trust signals are weak", () => {
    const result = computeGrowthIntelligence(developerApiFixture(), weakConversionWebsiteFixture());
    expect(result.bottleneck.type).toBe("conversion");
    expect(["improve_cta", "improve_social_proof"]).toContain(result.highestLeverageAction.actionType);
    expect(result.highestLeverageAction.channel).toBeNull();
  });
});

describe("17. Acquisition bottleneck detection", () => {
  it("selects a channel-pursuit action (not a website fix) when acquisition fit itself is weak", () => {
    const result = computeGrowthIntelligence(uniformlyWeakAcquisitionFixture(), healthyWebsiteFixture());
    expect(result.bottleneck.type).toBe("acquisition");
    expect(result.highestLeverageAction.channel).not.toBeNull();
    expect(result.highestLeverageAction.actionType.startsWith("pursue_")).toBe(true);
  });
});

describe("18. Highest-leverage action selection", () => {
  it("overrides the channel action with a positioning fix when positioning is the bottleneck", () => {
    const result = computeGrowthIntelligence(developerApiFixture(), weakPositioningWebsiteFixture());
    expect(result.highestLeverageAction.actionType).toBe("improve_positioning");
    expect(result.highestLeverageAction.channel).toBeNull();
    expect(result.highestLeverageAction.decisionType).toBe("commit");
  });

  it("overrides the channel action with a technical fix when technical health is the bottleneck", () => {
    const result = computeGrowthIntelligence(developerApiFixture(), weakTechnicalWebsiteFixture());
    expect(["fix_seo", "improve_performance", "improve_mobile"]).toContain(
      result.highestLeverageAction.actionType
    );
    expect(result.highestLeverageAction.channel).toBeNull();
  });

  it("falls back to the best channel-pursuit action for a healthy, balanced website", () => {
    const result = computeGrowthIntelligence(developerApiFixture(), healthyWebsiteFixture());
    expect(result.highestLeverageAction.channel).not.toBeNull();
    expect(result.highestLeverageAction.actionType.startsWith("pursue_")).toBe(true);
  });
});

describe("19. Low-confidence website analysis", () => {
  it("does not crash and falls back to a channel-pursuit action rather than an unreliable website fix", () => {
    const result = computeGrowthIntelligence(developerApiFixture(), lowConfidenceWebsiteFixture());
    expect(result.bottleneck.type).toBe("unknown");
    expect(result.highestLeverageAction.channel).not.toBeNull();
  });
});

describe("20. Same inputs produce same decisions", () => {
  it("is deterministic across every website fixture", () => {
    for (const website of [
      null,
      healthyWebsiteFixture(),
      weakPositioningWebsiteFixture(),
      weakConversionWebsiteFixture(),
      weakTechnicalWebsiteFixture(),
      lowConfidenceWebsiteFixture(),
    ]) {
      const pi = developerApiFixture();
      const a = computeGrowthIntelligence(pi, website);
      const b = computeGrowthIntelligence(pi, website);
      expect(a).toEqual(b);
    }
  });
});
