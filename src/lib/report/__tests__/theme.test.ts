import { describe, expect, it, vi } from "vitest";
import { computeGrowthIntelligence } from "@/lib/growth";
import {
  baseProductIntelligence,
  developerApiFixture,
} from "@/lib/growth/__tests__/fixtures";
import {
  healthyWebsiteFixture,
  unavailableWebsiteFixture,
} from "@/lib/growth/__tests__/websiteFixtures";
import type { AnalysisResult } from "@/types/analysis";

import { generateGrowthReport } from "../generate";
import { DARK_THEME, LIGHT_THEME, resolveReportTheme } from "../theme";
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

describe("resolveReportTheme", () => {
  it("resolves 'light' and 'dark' to their theme objects, and defaults to light", () => {
    expect(resolveReportTheme("light")).toBe(LIGHT_THEME);
    expect(resolveReportTheme("dark")).toBe(DARK_THEME);
    expect(resolveReportTheme(undefined)).toBe(LIGHT_THEME);
  });
});

describe("generateGrowthReport theming", () => {
  it("1. renders a valid PDF with the light theme", async () => {
    const buf = await generateGrowthReport(buildAnalysis(), LIGHT_THEME);
    expectValidPdf(buf);
  });

  it("2. renders a valid PDF with the dark theme", async () => {
    const buf = await generateGrowthReport(buildAnalysis(), DARK_THEME);
    expectValidPdf(buf);
  });

  it("3. both themes contain identical analysis data (text content is theme-independent)", async () => {
    const analysis = buildAnalysis(developerApiFixture(), healthyWebsiteFixture());
    const lightText = extractPdfText(await generateGrowthReport(analysis, LIGHT_THEME));
    const darkText = extractPdfText(await generateGrowthReport(analysis, DARK_THEME));
    // Only visual tokens (color) should differ between themes — every word
    // and number rendered is identical either way.
    expect(lightText).toBe(darkText);
  });

  it("4. theme selection does not modify the analysis object passed in", async () => {
    const analysis = buildAnalysis(developerApiFixture(), healthyWebsiteFixture());
    const snapshot = JSON.parse(JSON.stringify(analysis));
    await generateGrowthReport(analysis, LIGHT_THEME);
    await generateGrowthReport(analysis, DARK_THEME);
    expect(analysis).toEqual(snapshot);
  });

  it("5. product-only analysis (no website) works in both themes", async () => {
    const analysis = buildAnalysis(developerApiFixture(), null);
    for (const theme of [LIGHT_THEME, DARK_THEME]) {
      const buf = await generateGrowthReport(analysis, theme);
      expectValidPdf(buf);
      const text = extractPdfText(buf);
      expect(text).toContain("Website analysis was not provided.");
    }
  });

  it("6. a full website analysis works in both themes", async () => {
    const website = healthyWebsiteFixture();
    const analysis = buildAnalysis(developerApiFixture(), website);
    for (const theme of [LIGHT_THEME, DARK_THEME]) {
      const buf = await generateGrowthReport(analysis, theme);
      expectValidPdf(buf);
      const text = extractPdfText(buf);
      expect(text).toContain(String(website.performance.performance));
    }
  });

  it("7. unavailable/missing website data works in both themes", async () => {
    const website = unavailableWebsiteFixture();
    const analysis = buildAnalysis(developerApiFixture(), website);
    for (const theme of [LIGHT_THEME, DARK_THEME]) {
      const buf = await generateGrowthReport(analysis, theme);
      expectValidPdf(buf);
      const text = extractPdfText(buf);
      expect(text).toContain("couldn");
    }
  });

  it("8. a long, wrapping product name renders without crashing in both themes", async () => {
    const pi = baseProductIntelligence({
      product: {
        name: "Navigara Engineering Operations Intelligence Platform For Growth Teams",
      },
    });
    const analysis = buildAnalysis(pi, null);
    for (const theme of [LIGHT_THEME, DARK_THEME]) {
      const buf = await generateGrowthReport(analysis, theme);
      expectValidPdf(buf);
    }
  });

  it("9. a long subtitle/category renders without crashing in both themes", async () => {
    const pi = baseProductIntelligence({
      product: {
        category:
          "A comprehensive engineering management, delivery intelligence, and workflow orchestration platform for distributed teams",
      },
    });
    const analysis = buildAnalysis(pi, null);
    for (const theme of [LIGHT_THEME, DARK_THEME]) {
      const buf = await generateGrowthReport(analysis, theme);
      expectValidPdf(buf);
    }
  });

  it("12. produces valid, non-empty PDF output for both themes", async () => {
    const analysis = buildAnalysis();
    for (const theme of [LIGHT_THEME, DARK_THEME]) {
      expectValidPdf(await generateGrowthReport(analysis, theme));
    }
  });

  it("13. never calls Gemini, in either theme", async () => {
    vi.resetModules();
    vi.doMock("@/lib/ai/gemini", () => ({
      generateStructuredResponse: () => {
        throw new Error("generateStructuredResponse must not be called by the report generator");
      },
    }));
    const { generateGrowthReport: freshGenerate } = await import("../generate");
    const { LIGHT_THEME: light, DARK_THEME: dark } = await import("../theme");
    const analysis = buildAnalysis(developerApiFixture(), healthyWebsiteFixture());
    expectValidPdf(await freshGenerate(analysis, light));
    expectValidPdf(await freshGenerate(analysis, dark));
    vi.doUnmock("@/lib/ai/gemini");
    vi.resetModules();
  });

  it("14. never re-executes the scoring engine — consumes growthIntelligence as-is", async () => {
    vi.resetModules();
    vi.doMock("@/lib/growth", () => ({
      computeGrowthIntelligence: () => {
        throw new Error("computeGrowthIntelligence must not be called by the report generator");
      },
    }));
    const { generateGrowthReport: freshGenerate } = await import("../generate");
    const analysis = buildAnalysis(developerApiFixture(), healthyWebsiteFixture());
    expectValidPdf(await freshGenerate(analysis, LIGHT_THEME));
    expectValidPdf(await freshGenerate(analysis, DARK_THEME));
    vi.doUnmock("@/lib/growth");
    vi.resetModules();
  });

  it("15. the background grain never causes generation to fail, across repeated renders", async () => {
    const analysis = buildAnalysis();
    for (let i = 0; i < 3; i++) {
      expectValidPdf(await generateGrowthReport(analysis, LIGHT_THEME));
      expectValidPdf(await generateGrowthReport(analysis, DARK_THEME));
    }
  });

  it("defaults to the light theme when no theme is passed", async () => {
    const analysis = buildAnalysis();
    const defaultText = extractPdfText(await generateGrowthReport(analysis));
    const lightText = extractPdfText(await generateGrowthReport(analysis, LIGHT_THEME));
    expect(defaultText).toBe(lightText);
  });
});
