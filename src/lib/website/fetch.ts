import { FETCH_TIMEOUT_MS, MAX_HTML_BYTES, MAX_REDIRECTS } from "./constants";
import { assertSafeUrl, UnsafeUrlError } from "./url";
import type { CrawlEvidence } from "./types";

export interface FetchHtmlResult {
  crawl: CrawlEvidence;
  html: string | null;
}

const USER_AGENT = "GrowwwlyBot/1.0 (+website intelligence; contact via product)";

/** Reads a Response body as text, stopping once `maxBytes` is exceeded
 * rather than buffering an attacker-controlled response fully into memory. */
async function readBodyCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const decoder = new TextDecoder();
  let result = "";
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    result += decoder.decode(value, { stream: true });
    if (total >= maxBytes) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  return result;
}

function failure(
  status: CrawlEvidence["status"],
  requestedUrl: string,
  finalUrl: string | null,
  statusCode: number | null,
  startedAt: number,
  redirected: boolean,
  error: string
): FetchHtmlResult {
  return {
    crawl: {
      status,
      requestedUrl,
      finalUrl,
      statusCode,
      responseTimeMs: Date.now() - startedAt,
      redirected,
      error,
    },
    html: null,
  };
}

/**
 * Fetches raw HTML for Cheerio extraction. Every hop of every redirect is
 * re-validated against the SSRF gate in `url.ts` before being followed —
 * `redirect: "manual"` is what makes that possible.
 */
export async function fetchHtml(rawUrl: string): Promise<FetchHtmlResult> {
  const startedAt = Date.now();

  let currentUrl: string;
  try {
    currentUrl = (await assertSafeUrl(rawUrl)).toString();
  } catch (err) {
    return failure(
      "invalid_url",
      rawUrl,
      null,
      null,
      startedAt,
      false,
      err instanceof UnsafeUrlError ? err.message : "That URL could not be validated."
    );
  }

  let redirected = false;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
      });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "AbortError";
      return failure(
        timedOut ? "timeout" : "unreachable",
        rawUrl,
        currentUrl,
        null,
        startedAt,
        redirected,
        timedOut ? "The site took too long to respond." : "The site could not be reached."
      );
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return failure(
          "http_error",
          rawUrl,
          currentUrl,
          response.status,
          startedAt,
          redirected,
          "The site redirected without a destination."
        );
      }

      let nextUrl: URL;
      try {
        nextUrl = await assertSafeUrl(new URL(location, currentUrl).toString());
      } catch {
        return failure(
          "blocked",
          rawUrl,
          currentUrl,
          response.status,
          startedAt,
          true,
          "The site redirected to a host that cannot be inspected."
        );
      }

      currentUrl = nextUrl.toString();
      redirected = true;
      continue;
    }

    if (!response.ok) {
      return failure(
        "http_error",
        rawUrl,
        currentUrl,
        response.status,
        startedAt,
        redirected,
        `The site responded with HTTP ${response.status}.`
      );
    }

    const html = await readBodyCapped(response, MAX_HTML_BYTES);
    return {
      crawl: {
        status: "ok",
        requestedUrl: rawUrl,
        finalUrl: currentUrl,
        statusCode: response.status,
        responseTimeMs: Date.now() - startedAt,
        redirected,
        error: null,
      },
      html,
    };
  }

  return failure(
    "blocked",
    rawUrl,
    currentUrl,
    null,
    startedAt,
    redirected,
    "Too many redirects."
  );
}
