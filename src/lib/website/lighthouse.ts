import * as chromeLauncher from "chrome-launcher";
import type { Flags, Result } from "lighthouse";
import { LIGHTHOUSE_TIMEOUT_MS } from "./constants";
import { assertSafeUrl } from "./url";
import type { PerformanceEvidence } from "./types";
// NOTE: playwright is NOT imported statically here — see browser.ts for the
// full explanation. `chromium.executablePath()` is used to locate the
// Chromium binary for chrome-launcher. On Vercel there is no binary, so the
// dynamic import() below will throw and we return unavailable() gracefully.

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

  // Dynamic import — defers playwright module resolution to call time so the
  // module can be loaded even when no Chromium binary exists (Vercel). If the
  // import fails, we return unavailable() immediately.
  let chromiumExecPath: string;
  try {

    const { chromium } = (await import("playwright")) as { chromium: { executablePath: () => string } };
    chromiumExecPath = chromium.executablePath();
  } catch {
    return unavailable("Browser binary not available in this environment.");
  }

  // Dynamic import for lighthouse — defers module resolution.
  // Lighthouse attempts to load static template files (standalone-flow-template.html)
  // at import time, which crashes the route handler on Vercel because those
  // files aren't included in the serverless bundle. We dynamically import it here
  // so the route can still load and gracefully return an unavailable state if needed.
  let lh: typeof import("lighthouse") | typeof import("lighthouse").default;
  try {
    const imported = await import("lighthouse");
    lh = imported.default || imported;
  } catch {
    return unavailable("Audit engine not available in this environment.");
  }

  let chrome: chromeLauncher.LaunchedChrome | null = null;
  try {
    chrome = await chromeLauncher.launch({
      chromePath: chromiumExecPath,
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
    const runPromise = (lh as typeof import("lighthouse").default)(url, flags);
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
