import {
  SearchProviderError,
  isSearchProviderError,
  mostActionableError,
} from "./errors";
import { tavilyProvider } from "./providers/tavily";
import {
  SEARCH_PROVIDER_NAMES,
  type SearchBatchResult,
  type SearchProvider,
  type SearchProviderName,
  type SearchQuery,
  type SearchResult,
  type SearchUsageSnapshot,
} from "./types";

// ---------------------------------------------------------------------------
// The search client. Application code calls ONLY `searchMany` (and reads
// the types/errors). Independent of the AI provider layer.
//
// Free-tier protections:
//   - Hard cap of MAX_SEARCHES_PER_OPERATION (3) requests per call; extra
//     queries are dropped, duplicate queries are never sent twice.
//   - Before any search, the provider's AUTHORITATIVE usage (Tavily GET
//     /usage) is checked against: the plan's included credits, any key
//     limit, and the app's own SEARCH_MONTHLY_CREDIT_BUDGET. If the planned
//     searches would exceed any of them — or pay-as-you-go usage is already
//     non-zero — nothing is sent. If usage cannot be verified, nothing is
//     sent either (fail closed), so a request can never silently become
//     paid usage.
//   - Tavily's /usage figure LAGS: verified 2026-11-14 that it still read 0
//     more than 10 minutes after 9 credits were charged. So the guard uses
//     reported usage PLUS credits this process spent within
//     SEARCH_USAGE_LAG_MS (default 6h). That local ledger is deliberately
//     conservative (it may double-count once Tavily catches up) and is NOT
//     an authoritative monthly tracker — it only ever makes the guard
//     stricter. The provider's own hard stop (HTTP 432 at the plan limit when
//     pay-as-you-go is disabled) remains the final backstop.
//   - Usage snapshots are cached for 2 minutes (Tavily allows 10 /usage
//     calls per 10 minutes).
//   - No retries. Concurrent requests, each with its own timeout.
// ---------------------------------------------------------------------------

export const MAX_SEARCHES_PER_OPERATION = 3;
const USAGE_CACHE_MS = 2 * 60 * 1000;

function usageLagMs(): number {
  const n = Number(process.env.SEARCH_USAGE_LAG_MS ?? 6 * 60 * 60 * 1000);
  return Number.isFinite(n) && n >= 0 ? n : 6 * 60 * 60 * 1000;
}

const PROVIDERS: Record<SearchProviderName, SearchProvider> = {
  tavily: tavilyProvider,
};

export function getConfiguredSearchProvider(): SearchProviderName {
  const raw = (process.env.SEARCH_PROVIDER ?? "tavily").trim().toLowerCase();
  if ((SEARCH_PROVIDER_NAMES as readonly string[]).includes(raw)) return raw as SearchProviderName;
  throw new SearchProviderError(
    "configuration",
    `Unknown SEARCH_PROVIDER "${raw}". Expected one of: ${SEARCH_PROVIDER_NAMES.join(", ")}.`,
    { provider: raw }
  );
}

function getSearchProvider(): SearchProvider {
  return PROVIDERS[getConfiguredSearchProvider()];
}

/** App-level monthly ceiling, below the free plan's 1,000 credits. */
export function monthlyCreditBudget(): number {
  const n = Number(process.env.SEARCH_MONTHLY_CREDIT_BUDGET ?? 900);
  return Number.isFinite(n) && n >= 0 ? n : 900;
}

function usageCheckRequired(): boolean {
  return (process.env.SEARCH_REQUIRE_USAGE_CHECK ?? "true").toLowerCase() !== "false";
}

// ---------------------------------------------------------------------------
// Usage guard
// ---------------------------------------------------------------------------

const usageCache: { snapshot: SearchUsageSnapshot | null } = { snapshot: null };
/** In-process record of recent spend — a conservative supplement to the
 * provider's lagging figure, never a source of truth. */
const recentSpend: { at: number; credits: number }[] = [];

/** Exposed for tests only. */
export function __resetSearchStateForTests(): void {
  usageCache.snapshot = null;
  recentSpend.length = 0;
}

function recordSpend(credits: number): void {
  if (credits <= 0) return;
  const now = Date.now();
  recentSpend.push({ at: now, credits });
  const cutoff = now - usageLagMs();
  while (recentSpend.length && recentSpend[0].at < cutoff) recentSpend.shift();
}

function locallyRecentSpend(): number {
  const cutoff = Date.now() - usageLagMs();
  return recentSpend.filter((s) => s.at >= cutoff).reduce((sum, s) => sum + s.credits, 0);
}

async function currentUsage(provider: SearchProvider): Promise<SearchUsageSnapshot | null> {
  if (!provider.getUsage) return null;
  let snapshot = usageCache.snapshot;
  if (!snapshot || Date.now() - snapshot.fetchedAt >= USAGE_CACHE_MS) {
    snapshot = await provider.getUsage();
    usageCache.snapshot = snapshot;
  }
  const local = locallyRecentSpend();
  return { ...snapshot, used: snapshot.used + local, keyUsage: snapshot.keyUsage + local };
}

/** Throws (sends nothing) unless `credits` more can be spent entirely
 * inside the free allowance and the app budget. Exported for tests. */
export function assertWithinBudget(usage: SearchUsageSnapshot, credits: number, provider: string): void {
  const quota = (detail: string) =>
    new SearchProviderError("quota_exhausted", detail, { provider });

  if (usage.paygoUsage > 0) {
    throw quota("Search provider reports pay-as-you-go usage this cycle — searches are blocked to avoid paid usage.");
  }
  if (usage.planLimit !== null && usage.used + credits > usage.planLimit) {
    throw quota(`Free search credits for this billing cycle are used up (${usage.used}/${usage.planLimit}).`);
  }
  if (usage.keyLimit !== null && usage.keyUsage + credits > usage.keyLimit) {
    throw quota(`The search API key's credit limit is reached (${usage.keyUsage}/${usage.keyLimit}).`);
  }
  const budget = monthlyCreditBudget();
  if (usage.used + credits > budget) {
    throw quota(`Growwwly's monthly search budget is reached (${usage.used}/${budget} credits).`);
  }
}

async function ensureBudget(provider: SearchProvider, credits: number): Promise<SearchUsageSnapshot | undefined> {
  let usage: SearchUsageSnapshot | null;
  try {
    usage = await currentUsage(provider);
  } catch (err) {
    if (isSearchProviderError(err) && (err.kind === "configuration" || err.kind === "authentication")) {
      throw err;
    }
    if (!usageCheckRequired()) {
      console.warn("[search] usage check failed; SEARCH_REQUIRE_USAGE_CHECK=false so continuing.");
      return undefined;
    }
    throw new SearchProviderError(
      "usage_check_failed",
      "Could not verify remaining free search credits, so no search was sent.",
      {
        provider: provider.name,
        retryAfterSeconds: isSearchProviderError(err) ? err.retryAfterSeconds : undefined,
      }
    );
  }
  if (!usage) {
    if (usageCheckRequired()) {
      throw new SearchProviderError(
        "usage_check_failed",
        `Search provider ${provider.name} exposes no usage endpoint, so its free allowance cannot be verified.`,
        { provider: provider.name }
      );
    }
    return undefined;
  }
  assertWithinBudget(usage, credits, provider.name);
  console.log(
    `[search] provider=${provider.name} usage≈${usage.used}/${usage.planLimit ?? "∞"} (reported + recent local) plan=${usage.plan ?? "?"} budget=${monthlyCreditBudget()} planned=${credits}`
  );
  return usage;
}

// ---------------------------------------------------------------------------
// Batch search
// ---------------------------------------------------------------------------

function queryKey(q: SearchQuery): string {
  return JSON.stringify([
    q.query.trim().toLowerCase().replace(/\s+/g, " "),
    [...(q.includeDomains ?? [])].sort(),
    [...(q.excludeDomains ?? [])].sort(),
    q.timeRange ?? null,
  ]);
}

/**
 * Run up to MAX_SEARCHES_PER_OPERATION targeted searches concurrently and
 * return de-duplicated, id-tagged results. Throws a SearchProviderError only
 * if EVERY search failed (or the budget check refused); partial failures are
 * reported in `failures`.
 */
export async function searchMany(queries: SearchQuery[]): Promise<SearchBatchResult> {
  const provider = getSearchProvider();

  const unique: SearchQuery[] = [];
  const seen = new Set<string>();
  for (const q of queries) {
    if (!q.query.trim()) continue;
    const key = queryKey(q);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(q);
  }
  if (unique.length > MAX_SEARCHES_PER_OPERATION) {
    console.warn(`[search] ${unique.length} queries requested; capped at ${MAX_SEARCHES_PER_OPERATION}.`);
  }
  const planned = unique.slice(0, MAX_SEARCHES_PER_OPERATION);
  if (planned.length === 0) {
    return { results: [], requests: 0, credits: 0, latencyMs: 0, failures: [] };
  }

  const usageBefore = await ensureBudget(provider, planned.length * provider.creditsPerSearch);

  const started = Date.now();
  const settled = await Promise.allSettled(planned.map((q) => provider.search(q)));
  const latencyMs = Date.now() - started;

  const errors: SearchProviderError[] = [];
  const failures: SearchBatchResult["failures"] = [];
  let credits = 0;
  const byCanonical = new Map<string, Omit<SearchResult, "id">>();

  settled.forEach((outcome, i) => {
    if (outcome.status === "rejected") {
      const err = isSearchProviderError(outcome.reason)
        ? outcome.reason
        : new SearchProviderError("invalid_response", "Search failed unexpectedly.", { provider: provider.name });
      errors.push(err);
      failures.push({ label: planned[i].label, kind: err.kind });
      return;
    }
    credits += outcome.value.credits;
    for (const r of outcome.value.results) {
      const existing = byCanonical.get(r.canonicalUrl);
      if (!existing || (r.providerScore ?? 0) > (existing.providerScore ?? 0)) {
        byCanonical.set(r.canonicalUrl, existing ? { ...r, url: existing.url } : r);
      }
    }
  });

  // Every request that reached the provider may have been billed.
  recordSpend(credits || (planned.length - errors.length) * provider.creditsPerSearch);

  if (errors.length === planned.length) {
    throw mostActionableError(errors);
  }

  const results: SearchResult[] = Array.from(byCanonical.values()).map((r, i) => ({
    ...r,
    id: `S${i + 1}`,
  }));

  console.log(
    `[search] provider=${provider.name} requests=${planned.length} failed=${errors.length} credits=${credits} results=${results.length} latency=${latencyMs}ms`
  );

  return { results, requests: planned.length, credits, latencyMs, failures, usageBefore };
}
