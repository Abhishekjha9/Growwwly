import { captureScreenshots } from "./browser";
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from "./constants";
import { extractSeoEvidence } from "./extract";
import { fetchHtml } from "./fetch";
import { interpretWebsite } from "./gemini";
import { runLighthouseAudit } from "./lighthouse";
import { WebsiteIntelligenceSchema } from "./types";
import type { VisualEvidence, WebsiteIntelligence } from "./types";

// ---------------------------------------------------------------------------
//                    SaaS URL
//                       │
//          ┌────────────┴────────────┐
//          ↓                         ↓
//   HTML / DOM extraction       Browser render
//      (Cheerio)                 (Playwright)
//          │                         │
//          │                    Screenshots
//          │                         │
//          ↓                         ↓
//   Technical evidence        Visual evidence
//          │                         │
//          └────────────┬────────────┘
//                       ↓
//                  Lighthouse
//                       │
//             objective evidence
//                       ↓
//              Gemini 2.5 Flash
//                       │
//                       ↓
//             Website Intelligence
//
// This module is the only place that wires those pieces together. Every
// sub-step degrades independently — one failing never throws out of this
// function, it just narrows `status` to "partial" or "unavailable" and
// records why.
// ---------------------------------------------------------------------------

export interface AnalyzeWebsiteProductContext {
  name: string;
  category: string;
  description: string;
  primaryUseCase: string;
}

function emptyVisual(): VisualEvidence {
  return {
    desktop: {
      captured: false,
      width: DESKTOP_VIEWPORT.width,
      height: DESKTOP_VIEWPORT.height,
      screenshotDataUrl: null,
    },
    mobile: {
      captured: false,
      width: MOBILE_VIEWPORT.width,
      height: MOBILE_VIEWPORT.height,
      screenshotDataUrl: null,
    },
  };
}

export async function analyzeWebsite(
  url: string,
  product?: AnalyzeWebsiteProductContext
): Promise<WebsiteIntelligence> {
  const { crawl, html } = await fetchHtml(url);

  if (crawl.status !== "ok" || html === null || !crawl.finalUrl) {
    return WebsiteIntelligenceSchema.parse({
      status: "unavailable",
      url,
      crawl,
      seo: null,
      performance: {
        status: "unavailable",
        performance: null,
        accessibility: null,
        bestPractices: null,
        seo: null,
        reason: "The site could not be crawled.",
      },
      visual: emptyVisual(),
      interpretation: null,
      error: crawl.error ?? "The website could not be inspected.",
    });
  }

  const finalUrl = crawl.finalUrl;
  const seo = extractSeoEvidence(html, finalUrl);

  const [visual, performance] = await Promise.all([
    captureScreenshots(finalUrl).catch(() => emptyVisual()),
    runLighthouseAudit(finalUrl).catch(() => ({
      status: "unavailable" as const,
      performance: null,
      accessibility: null,
      bestPractices: null,
      seo: null,
      reason: "The technical audit failed unexpectedly.",
    })),
  ]);

  const interpretation = await interpretWebsite({
    url: finalUrl,
    crawl,
    seo,
    performance,
    visual,
    product,
  });

  const somethingDegraded =
    performance.status === "unavailable" ||
    !visual.desktop.captured ||
    !visual.mobile.captured ||
    interpretation === null;

  return WebsiteIntelligenceSchema.parse({
    status: somethingDegraded ? "partial" : "complete",
    url,
    crawl,
    seo,
    performance,
    visual,
    interpretation,
    error: somethingDegraded
      ? "Some parts of the website inspection were unavailable — showing what could be gathered."
      : null,
  });
}
