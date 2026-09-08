import { describe, expect, it } from "vitest";
import { buildSearchIntents } from "../search";
import { SEARCH_ANGLES } from "../types";
import { buildAnalysis } from "./fixtures";
import { developerApiFixture, weddingInviteFixture } from "@/lib/growth/__tests__/fixtures";

describe("buildSearchIntents", () => {
  it("1. produces a bounded set of search intents covering every angle", () => {
    const intents = buildSearchIntents(buildAnalysis(developerApiFixture()));
    expect(intents.length).toBe(SEARCH_ANGLES.length);
    expect(new Set(intents.map((i) => i.angle)).size).toBe(SEARCH_ANGLES.length);
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
