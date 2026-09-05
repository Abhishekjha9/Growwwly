import * as chromeLauncher from "chrome-launcher";
import lighthouse, { type Flags, type Result } from "lighthouse";
import { chromium } from "playwright";
import { LIGHTHOUSE_TIMEOUT_MS } from "./constants";
import { assertSafeUrl } from "./url";
import type { PerformanceEvidence } from "./types";

// ---------------------------------------------------------------------------
// Objective performance/accessibility/best-practices/SEO measurement via
// Lighthouse. Reuses Playwright's already-downloaded Chromium binary
// (chrome-launcher otherwise expects a system Chrome install, which this
// environment doesn't have) rather than bundling a second browser.
//
// Lighthouse is slow and occasionally flaky in a constrained environment —
// this always degrades to `{status: "unavailable", reason}` on failure or
// timeout rather than throwing, per §5/§15.
// ---------------------------------------------------------------------------

function unavailable(reason: string): PerformanceEvidence {
  return {
    status: "unavailable",
    performance: null,
    accessibility: null,
    bestPractices: null,
    seo: null,
    reason,
  };
}

function scoreOf(category: Result.Category | undefined): number | null {
  if (!category || typeof category.score !== "number") return null;
  return Math.round(category.score * 100);
}

export async function runLighthouseAudit(url: string): Promise<PerformanceEvidence> {
  try {
    await assertSafeUrl(url);
  } catch {
    return unavailable("This host cannot be inspected.");
  }

  let chrome: chromeLauncher.LaunchedChrome | null = null;
  try {
    chrome = await chromeLauncher.launch({
      chromePath: chromium.executablePath(),
      chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
    });
  } catch {
    return unavailable("Could not launch a browser for the technical audit.");
  }

  try {
    const flags: Flags = {
      port: chrome.port,
      output: "json",
      logLevel: "silent",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    };
    const runPromise = lighthouse(url, flags);
    // Swallow a late rejection/resolution after we've already timed out —
    // otherwise this becomes an unhandled rejection once `chrome.kill()`
    // below tears down the connection it was using.
    runPromise.catch(() => {});

    const timeout = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), LIGHTHOUSE_TIMEOUT_MS)
    );

    const result = await Promise.race([runPromise, timeout]);

    if (result === "timeout" || !result) {
      return unavailable("The technical audit took too long and was skipped.");
    }

    const { categories } = result.lhr;
    return {
      status: "measured",
      performance: scoreOf(categories.performance),
      accessibility: scoreOf(categories.accessibility),
      bestPractices: scoreOf(categories["best-practices"]),
      seo: scoreOf(categories.seo),
      reason: null,
    };
  } catch {
    return unavailable("The technical audit failed to run for this site.");
  } finally {
    try {
      chrome.kill();
    } catch {
      /* Already exited. */
    }
  }
}
