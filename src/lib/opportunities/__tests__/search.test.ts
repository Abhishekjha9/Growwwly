import { describe, expect, it } from "vitest";
import { buildSearchIntents } from "../search";
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
