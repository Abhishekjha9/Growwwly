import { z } from "zod";

import { SearchProviderError, type SearchErrorKind } from "../errors";
import type {
  SearchProvider,
  SearchQuery,
  SearchResult,
  SearchUsageSnapshot,
  SingleSearchResponse,
} from "../types";
import { canonicalizeUrl, domainOf, parseHttpUrl } from "../url";

// ---------------------------------------------------------------------------
// Tavily Search adapter — POST https://api.tavily.com/search only.
//
// Credit-conscious by construction (docs read 2026-11-14,
// docs.tavily.com/documentation/api-credits):
//   - search_depth "basic"       → 1 credit / request ("advanced" = 2)
//   - auto_parameters NOT sent   → it costs 2 credits and may upgrade depth
//   - no answer / raw content / images
//   - Research, Extract, Crawl, Map endpoints are never called
//   - no automatic retries, ever (432/433 = plan / pay-as-you-go limit)
// Free "Researcher" plan: 1,000 credits / month, 100 RPM.
//
// Nothing Tavily-specific (wire format, status codes) leaves this file.
// ---------------------------------------------------------------------------

const PROVIDER = "tavily";
const API_BASE = process.env.TAVILY_API_BASE_URL || "https://api.tavily.com";
export const TAVILY_MAX_RESULTS = 5;
const MAX_CONTENT_CHARS = 1200;
const MAX_TITLE_CHARS = 300;

function searchTimeoutMs(): number {
  return Number(process.env.TAVILY_TIMEOUT_MS ?? 15_000);
}

function getApiKey(): string {
  const key = process.env.TAVILY_API_KEY;
  if (!key || !key.trim()) {
    throw new SearchProviderError(
      "configuration",
      "TAVILY_API_KEY is not set. Add it to .env.local (server-side only) and restart the server.",
      { provider: PROVIDER }
    );
  }
  return key.trim();
}

// ---------------------------------------------------------------------------
// Response validation — the API is never trusted blindly.
// ---------------------------------------------------------------------------

const TavilyResultSchema = z
  .object({
    title: z.string().nullish(),
    url: z.string().nullish(),
    content: z.string().nullish(),
    score: z.number().nullish(),
    published_date: z.string().nullish(),
  })
  .passthrough();

const TavilySearchResponseSchema = z
  .object({
    results: z.array(z.unknown()).default([]),
    response_time: z.union([z.number(), z.string()]).nullish(),
    usage: z.object({ credits: z.number().nullish() }).passthrough().nullish(),
    request_id: z.string().nullish(),
  })
  .passthrough();

const TavilyUsageSchema = z
  .object({
    key: z
      .object({ usage: z.number().nullish(), limit: z.number().nullish() })
      .passthrough()
      .nullish(),
    account: z
      .object({
        current_plan: z.string().nullish(),
        plan_usage: z.number().nullish(),
        plan_limit: z.number().nullish(),
        paygo_usage: z.number().nullish(),
        paygo_limit: z.number().nullish(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Validates + normalizes one raw result. Exported for tests. Returns null
 * for anything without a usable http(s) URL or any text content. */
export function normalizeTavilyResult(
  raw: unknown,
  queryLabel?: string
): Omit<SearchResult, "id"> | null {
  const parsed = TavilyResultSchema.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;
  const url = parseHttpUrl(r.url);
  if (!url) return null;
  const originalUrl = r.url!.trim();
  const content = clip(r.content ?? "", MAX_CONTENT_CHARS);
  const domain = domainOf(originalUrl);
  const title = clip(r.title ?? "", MAX_TITLE_CHARS) || domain;
  if (!content && !r.title) return null;

  const score = typeof r.score === "number" && Number.isFinite(r.score) ? r.score : null;
  const published =
    r.published_date && !Number.isNaN(Date.parse(r.published_date)) ? r.published_date : null;

  return {
    title,
    url: originalUrl,
    canonicalUrl: canonicalizeUrl(originalUrl),
    domain,
    content: content || title,
    providerScore: score,
    publishedDate: published,
    provider: PROVIDER,
    queryLabel,
  };
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

function retryAfter(res: Response): number | undefined {
  const v = res.headers.get("retry-after");
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.ceil(n) : undefined;
}

/** Exported for tests. */
export function mapTavilyHttpError(status: number, retryAfterSeconds?: number): SearchProviderError {
  const make = (kind: SearchErrorKind, message: string) =>
    new SearchProviderError(kind, message, { provider: PROVIDER, retryAfterSeconds });
  if (status === 401 || status === 403)
    return make("authentication", "Tavily rejected the API key (invalid or revoked TAVILY_API_KEY).");
  if (status === 429)
    return make(
      "rate_limited",
      `Tavily rate limit reached${retryAfterSeconds ? `; retry in ~${retryAfterSeconds}s` : ""}.`
    );
  if (status === 432)
    return make("quota_exhausted", "Tavily plan credit limit reached for this billing cycle.");
  if (status === 433)
    return make("quota_exhausted", "Tavily pay-as-you-go limit reached.");
  if (status === 434 || status >= 500)
    return make("service_unavailable", `Tavily is temporarily unavailable (${status}).`);
  return make("request_error", `Tavily rejected the search request (${status}).`);
}

async function tavilyFetch(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; timeoutMs: number }
): Promise<{ data: unknown; latencyMs: number }> {
  const apiKey = getApiKey();
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(init.timeoutMs),
    });
  } catch (err) {
    const isTimeout =
      err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new SearchProviderError(
      isTimeout ? "timeout" : "connection",
      isTimeout
        ? `Tavily search timed out after ${init.timeoutMs}ms.`
        : "Could not reach the Tavily API.",
      { provider: PROVIDER }
    );
  }
  const latencyMs = Date.now() - started;
  if (!res.ok) {
    res.body?.cancel().catch(() => {});
    const mapped = mapTavilyHttpError(res.status, retryAfter(res));
    console.error(`[search] provider=tavily ${init.method} ${path} http=${res.status} kind=${mapped.kind} latency=${latencyMs}ms`);
    throw mapped;
  }
  try {
    return { data: await res.json(), latencyMs };
  } catch {
    throw new SearchProviderError("invalid_response", "Tavily returned a non-JSON response.", {
      provider: PROVIDER,
    });
  }
}

// ---------------------------------------------------------------------------
// Public adapter
// ---------------------------------------------------------------------------

export async function tavilySearch(query: SearchQuery): Promise<SingleSearchResponse> {
  const body: Record<string, unknown> = {
    query: query.query,
    search_depth: "basic",
    topic: "general",
    max_results: TAVILY_MAX_RESULTS,
    include_answer: false,
    include_raw_content: false,
    include_images: false,
    include_favicon: false,
    include_usage: true,
    include_published_date: true,
    auto_parameters: false,
  };
  if (query.includeDomains?.length) body.include_domains = query.includeDomains;
  if (query.excludeDomains?.length) body.exclude_domains = query.excludeDomains;
  if (query.timeRange) body.time_range = query.timeRange;

  const { data, latencyMs } = await tavilyFetch("/search", {
    method: "POST",
    body,
    timeoutMs: searchTimeoutMs(),
  });

  const parsed = TavilySearchResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new SearchProviderError("invalid_response", "Tavily returned an unexpected response shape.", {
      provider: PROVIDER,
    });
  }

  const results = parsed.data.results
    .map((r) => normalizeTavilyResult(r, query.label))
    .filter((r): r is Omit<SearchResult, "id"> => r !== null);
  // Basic search is 1 credit; trust the provider's own figure when given.
  const credits = parsed.data.usage?.credits ?? 1;

  console.log(
    `[search] provider=tavily label=${query.label ?? "-"} results=${results.length}/${parsed.data.results.length} credits=${credits} latency=${latencyMs}ms`
  );
  return {
    results,
    credits,
    latencyMs,
    requestId: parsed.data.request_id ?? undefined,
  };
}

/** GET /usage — authoritative billing-cycle usage straight from Tavily.
 * Rate-limited by Tavily to 10 requests / 10 minutes; callers cache it. */
export async function tavilyUsage(): Promise<SearchUsageSnapshot> {
  const { data } = await tavilyFetch("/usage", { method: "GET", timeoutMs: 10_000 });
  const parsed = TavilyUsageSchema.safeParse(data);
  if (!parsed.success) {
    throw new SearchProviderError("invalid_response", "Tavily usage response had an unexpected shape.", {
      provider: PROVIDER,
    });
  }
  const key = parsed.data.key ?? {};
  const account = parsed.data.account ?? {};
  const keyUsage = key.usage ?? 0;
  return {
    used: Math.max(account.plan_usage ?? 0, keyUsage),
    planLimit: account.plan_limit ?? null,
    keyLimit: key.limit ?? null,
    keyUsage,
    paygoUsage: account.paygo_usage ?? 0,
    plan: account.current_plan ?? undefined,
    fetchedAt: Date.now(),
  };
}

export const tavilyProvider: SearchProvider = {
  name: "tavily",
  creditsPerSearch: 1,
  search: tavilySearch,
  getUsage: tavilyUsage,
};
