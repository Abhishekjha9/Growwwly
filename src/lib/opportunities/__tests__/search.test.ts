import { describe, expect, it } from "vitest";
import { buildDiscoveryQueries, buildSearchIntents, COMMUNITY_DOMAINS } from "../search";
import { SEARCH_ANGLES } from "../types";
import { buildAnalysis } from "./fixtures";
import { developerApiFixture, weddingInviteFixture } from "@/lib/growth/__tests__/fixtures";

describe("buildSearchIntents", () => {
  it("1. produces a bounded set of search intents covering every base angle", () => {
    // developerApiFixture has 'outbound' as top channel, so it gets only the base angles
    const intents = buildSearchIntents(buildAnalysis(developerApiFixture()));
    expect(intents.length).toBe(SEARCH_ANGLES.length);
    expect(new Set(intents.map((i) => i.angle)).size).toBe(SEARCH_ANGLES.length);
  });

  it("adds ecosystem-specific angles for community-oriented channels", () => {
    // Modify the fixture to have 'communities' as top channel
    const analysis = buildAnalysis(developerApiFixture());
    analysis.growthIntelligence.summary.topChannel = "communities";
    
    const intents = buildSearchIntents(analysis);
    expect(intents.length).toBeGreaterThan(SEARCH_ANGLES.length);
    
    // Check that we specifically added Reddit and HN targeting
    const intentDescriptions = intents.map(i => i.description.toLowerCase());
    expect(intentDescriptions.some(d => d.includes("site:reddit.com"))).toBe(true);
    expect(intentDescriptions.some(d => d.includes("site:news.ycombinator.com"))).toBe(true);
  });

  it("is product-specific, not generic — reflects the product's own category/problem", () => {
    const dev = buildSearchIntents(buildAnalysis(developerApiFixture()));
    const wedding = buildSearchIntents(buildAnalysis(weddingInviteFixture()));

    const devText = dev.map((i) => i.description).join(" ");
    const weddingText = wedding.map((i) => i.description).join(" ");

    expect(devText).not.toBe(weddingText);
    expect(devText.toLowerCase()).toContain(
      developerApiFixture().product.category.toLowerCase()
    );
    expect(weddingText.toLowerCase()).toContain(
      weddingInviteFixture().product.category.toLowerCase()
    );
  });

  it("never searches for the product name alone", () => {
    const analysis = buildAnalysis(developerApiFixture());
    const intents = buildSearchIntents(analysis);
    for (const intent of intents) {
      expect(intent.description.trim()).not.toBe(analysis.productIntelligence.product.name);
    }
  });
});

describe("buildDiscoveryQueries", () => {
  it("builds exactly three targeted searches", () => {
    expect(buildDiscoveryQueries(buildAnalysis(developerApiFixture()))).toHaveLength(3);
    expect(buildDiscoveryQueries(buildAnalysis(weddingInviteFixture()))).toHaveLength(3);
  });

  it("targets communities in two searches and keeps one open to any public source", () => {
    const queries = buildDiscoveryQueries(buildAnalysis(developerApiFixture()));
    const restricted = queries.filter((q) => q.includeDomains?.length);
    expect(restricted).toHaveLength(2);
    expect(queries.filter((q) => !q.includeDomains?.length)).toHaveLength(1);
    expect(restricted[0].includeDomains).toEqual(COMMUNITY_DOMAINS);
    expect(restricted[0].includeDomains).toContain("reddit.com");
    expect(restricted[0].includeDomains).toContain("news.ycombinator.com");
  });

  it("is deterministic, distinct, and product-specific", () => {
    const a = buildDiscoveryQueries(buildAnalysis(developerApiFixture()));
    const b = buildDiscoveryQueries(buildAnalysis(developerApiFixture()));
    expect(a).toEqual(b);
    expect(new Set(a.map((q) => q.query)).size).toBe(3);
    const wedding = buildDiscoveryQueries(buildAnalysis(weddingInviteFixture()));
    expect(wedding.map((q) => q.query)).not.toEqual(a.map((q) => q.query));
    for (const q of a) {
      expect(q.query.trim()).not.toBe(developerApiFixture().product.name);
      expect(q.query.length).toBeLessThan(300);
    }
  });

  it("picks the third angle from the highest-leverage channel", () => {
    const analysis = buildAnalysis(developerApiFixture());
    analysis.growthIntelligence.summary.topChannel = "communities";
    expect(buildDiscoveryQueries(analysis)[2].label).toBe("comparison");
    analysis.growthIntelligence.summary.topChannel = "seo";
    expect(buildDiscoveryQueries(analysis)[2].label).toBe("pain_complaint");
  });
});
