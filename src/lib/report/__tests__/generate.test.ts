import { describe, expect, it, vi } from "vitest";
import { computeGrowthIntelligence } from "@/lib/growth";
import { CHANNEL_LABELS } from "@/lib/growth/constants";
import {
  baseProductIntelligence,
  developerApiFixture,
  lowConfidenceGenericFixture,
  weddingInviteFixture,
} from "@/lib/growth/__tests__/fixtures";
import {
  healthyWebsiteFixture,
  unavailableWebsiteFixture,
} from "@/lib/growth/__tests__/websiteFixtures";
import type { AnalysisResult } from "@/types/analysis";

import { generateGrowthReport } from "../generate";
import { extractPdfText } from "./pdfText";

function buildAnalysis(
  productIntelligence = developerApiFixture(),
  websiteIntelligence: AnalysisResult["websiteIntelligence"] = null
): AnalysisResult {
  return {
    productIntelligence,
    websiteIntelligence,
    growthIntelligence: computeGrowthIntelligence(productIntelligence, websiteIntelligence),
  };
}

function expectValidPdf(buf: Buffer) {
  expect(buf.length).toBeGreaterThan(0);
  expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(buf.subarray(-64).toString("latin1")).toContain("%%EOF");
}

describe("generateGrowthReport", () => {
  it("1. renders a valid PDF for a product-only analysis (no website)", async () => {
    const analysis = buildAnalysis(developerApiFixture(), null);
    const buf = await generateGrowthReport(analysis);
    expectValidPdf(buf);
    const text = extractPdfText(buf);
    expect(text).toContain("Website analysis was not provided.");
  });

  it("2. renders the full website analysis section when website intelligence is present", async () => {
    const website = healthyWebsiteFixture();
    const analysis = buildAnalysis(developerApiFixture(), website);
    const buf = await generateGrowthReport(analysis);
    expectValidPdf(buf);
    const text = extractPdfText(buf);
    // Measured Lighthouse values from healthyWebsiteFixture().
    expect(text).toContain("88");
    expect(text).toContain("92");
    expect(text).toContain("90");
    expect(text).toContain("85");
    // AI-interpreted section content.
    expect(text).toContain(website.interpretation!.positioning.summary);
    expect(text).toContain(website.interpretation!.conversion.summary);
  });

  it("3. handles missing optional website data (unavailable crawl, null seo/interpretation) without crashing", async () => {
    const website = unavailableWebsiteFixture();
    const analysis = buildAnalysis(developerApiFixture(), website);
    const buf = await generateGrowthReport(analysis);
    expectValidPdf(buf);
    const text = extractPdfText(buf);
    expect(text).toContain("couldn");
    expect(text).toContain(website.error!);
  });

  it("4. includes the correct product name", async () => {
    const pi = weddingInviteFixture();
    const analysis = buildAnalysis(pi, null);
    const text = extractPdfText(await generateGrowthReport(analysis));
    expect(text).toContain(pi.product.name);
  });

  it("5. includes the correct highest-leverage action", async () => {
    const analysis = buildAnalysis(developerApiFixture(), null);
    const text = extractPdfText(await generateGrowthReport(analysis));
    expect(text).toContain(analysis.growthIntelligence.highestLeverageAction.title);
    expect(text).toContain(analysis.growthIntelligence.highestLeverageAction.reason);
  });

  it("6. preserves the existing channel ranking order (does not re-sort)", async () => {
    const analysis = buildAnalysis(developerApiFixture(), null);
    const text = extractPdfText(await generateGrowthReport(analysis));
    const positions = analysis.growthIntelligence.rankedChannels.map((c) =>
      text.indexOf(CHANNEL_LABELS[c.channel])
    );
    for (const pos of positions) expect(pos).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it("7. includes the correct Opportunity Score for every ranked channel", async () => {
    const analysis = buildAnalysis(developerApiFixture(), null);
    const text = extractPdfText(await generateGrowthReport(analysis));
    for (const c of analysis.growthIntelligence.rankedChannels) {
      expect(text).toContain(String(c.opportunityScore));
    }
  });

  it("8. includes the correct measured website Lighthouse values", async () => {
    const website = healthyWebsiteFixture();
    const analysis = buildAnalysis(developerApiFixture(), website);
    const text = extractPdfText(await generateGrowthReport(analysis));
    expect(text).toContain(String(website.performance.performance));
    expect(text).toContain(String(website.performance.accessibility));
    expect(text).toContain(String(website.performance.bestPractices));
    expect(text).toContain(String(website.performance.seo));
  });

  it("9. does not crash on null/low-signal values across the analysis", async () => {
    const analysis = buildAnalysis(lowConfidenceGenericFixture(), null);
    const buf = await generateGrowthReport(analysis);
    expectValidPdf(buf);
  });

  it("10. handles a very long product name without crashing", async () => {
    const pi = baseProductIntelligence({
      product: { name: "Super Growth Platform For Every Kind Of SaaS Team ".repeat(6).trim() },
    });
    const analysis = buildAnalysis(pi, null);
    const buf = await generateGrowthReport(analysis);
    expectValidPdf(buf);
  });

  it("11. handles special characters in the product name without crashing", async () => {
    const pi = baseProductIntelligence({
      product: { name: `Café Növa™ & <script>alert(1)</script> "quoted"` },
    });
    const analysis = buildAnalysis(pi, null);
    const buf = await generateGrowthReport(analysis);
    expectValidPdf(buf);
    const text = extractPdfText(buf);
    expect(text).toContain("quoted");
  });

  it("12. produces non-empty, valid PDF output", async () => {
    const analysis = buildAnalysis(developerApiFixture(), null);
    const buf = await generateGrowthReport(analysis);
    expectValidPdf(buf);
  });

  it("13. never calls OpenAI", async () => {
    vi.resetModules();
    vi.doMock("@/lib/ai/openai", () => ({
      generateStructuredResponse: () => {
        throw new Error("generateStructuredResponse must not be called by the report generator");
      },
    }));
    const { generateGrowthReport: freshGenerate } = await import("../generate");
    const analysis = buildAnalysis(developerApiFixture(), healthyWebsiteFixture());
    const buf = await freshGenerate(analysis);
    expectValidPdf(buf);
    vi.doUnmock("@/lib/ai/openai");
    vi.resetModules();
  });

  it("14. never invokes website analysis", async () => {
    vi.resetModules();
    vi.doMock("@/lib/website", () => ({
      analyzeWebsite: () => {
        throw new Error("analyzeWebsite must not be called by the report generator");
      },
    }));
    const { generateGrowthReport: freshGenerate } = await import("../generate");
    const analysis = buildAnalysis(developerApiFixture(), healthyWebsiteFixture());
    const buf = await freshGenerate(analysis);
    expectValidPdf(buf);
    vi.doUnmock("@/lib/website");
    vi.resetModules();
  });

  it("17. produces consistent report content for the same analysis input", async () => {
    const analysis = buildAnalysis(developerApiFixture(), healthyWebsiteFixture());
    const textA = extractPdfText(await generateGrowthReport(analysis));
    const textB = extractPdfText(await generateGrowthReport(analysis));
    expect(textA).toBe(textB);
  });
});
