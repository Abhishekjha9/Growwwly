import { chromium, devices, type Browser } from "playwright";
import {
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
  NAVIGATION_TIMEOUT_MS,
  SCREENSHOT_JPEG_QUALITY,
  SCREENSHOT_TIMEOUT_MS,
} from "./constants";
import { assertSafeUrl } from "./url";
import type { ViewportCapture, VisualEvidence } from "./types";

// ---------------------------------------------------------------------------
// Renders the page in a real, headless browser and captures a desktop and a
// mobile screenshot — the evidence Gemini's visual analysis is grounded in.
// A failure here (broken site, JS-heavy timeout, browser crash) degrades to
// an uncaptured viewport, never a thrown error that aborts the whole
// analysis.
// ---------------------------------------------------------------------------

function emptyCapture(width: number, height: number): ViewportCapture {
  return { captured: false, width, height, screenshotDataUrl: null };
}

async function captureViewport(
  browser: Browser,
  url: string,
  kind: "desktop" | "mobile"
): Promise<ViewportCapture> {
  const deviceConfig = kind === "mobile" ? devices["iPhone 13"] : undefined;
  const viewport = kind === "mobile" ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT;

  let context: Awaited<ReturnType<Browser["newContext"]>> | null = null;
  try {
    context = await browser.newContext(
      deviceConfig ?? { viewport, deviceScaleFactor: 1 }
    );
    context.setDefaultTimeout(NAVIGATION_TIMEOUT_MS);

    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load", timeout: NAVIGATION_TIMEOUT_MS });

    // Many marketing homepages fade/slide their hero content in on-scroll or
    // post-load (IntersectionObserver reveals, entrance animations) — the
    // `load` event alone can fire before any of that has painted, producing
    // a blank-looking capture. Nudge the page and give it a moment to settle
    // before the shot; all best-effort, never fails the capture.
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    await page
      .evaluate(() => {
        window.scrollBy(0, 200);
        window.scrollTo(0, 0);
      })
      .catch(() => {});
    await page.waitForTimeout(600);

    const buffer = await page.screenshot({
      type: "jpeg",
      quality: SCREENSHOT_JPEG_QUALITY,
      timeout: SCREENSHOT_TIMEOUT_MS,
    });

    return {
      captured: true,
      width: viewport.width,
      height: viewport.height,
      screenshotDataUrl: `data:image/jpeg;base64,${buffer.toString("base64")}`,
    };
  } catch {
    return emptyCapture(viewport.width, viewport.height);
  } finally {
    await context?.close().catch(() => {});
  }
}

export async function captureScreenshots(url: string): Promise<VisualEvidence> {
  // Defense in depth — fetch.ts already validated this URL, but a browser
  // making arbitrary requests (following JS redirects, loading iframes) is a
  // stronger SSRF vector than a plain fetch, so it gets its own gate.
  try {
    await assertSafeUrl(url);
  } catch {
    return {
      desktop: emptyCapture(DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height),
      mobile: emptyCapture(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height),
    };
  }

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ args: ["--no-sandbox"] });
  } catch {
    return {
      desktop: emptyCapture(DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height),
      mobile: emptyCapture(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height),
    };
  }

  try {
    const [desktop, mobile] = await Promise.all([
      captureViewport(browser, url, "desktop"),
      captureViewport(browser, url, "mobile"),
    ]);
    return { desktop, mobile };
  } finally {
    await browser.close().catch(() => {});
  }
}
