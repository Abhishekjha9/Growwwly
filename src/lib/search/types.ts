// ---------------------------------------------------------------------------
// Provider-agnostic SEARCH contract.
//
// Search providers (Tavily today) are deliberately independent of the AI
// provider layer in `@/lib/ai`: they return real, verifiable web results and
// never generate text. Application code depends only on these types and on
// `@/lib/search/client` — never on a provider module or its wire format.
// ---------------------------------------------------------------------------

export const SEARCH_PROVIDER_NAMES = ["tavily"] as const;
export type SearchProviderName = (typeof SEARCH_PROVIDER_NAMES)[number];

export type SearchTimeRange = "day" | "week" | "month" | "year";

/** One targeted search. Built deterministically by the caller — the search
 * provider never decides what (or how often) to search. */
export interface SearchQuery {
  query: string;
  /** Restrict results to these domains (e.g. reddit.com). */
  includeDomains?: string[];
  excludeDomains?: string[];
  timeRange?: SearchTimeRange;
  /** Caller label for logs/metadata (e.g. the search angle). Never sent. */
  label?: string;
}

/** A single real search result, normalized and validated. `url` is exactly
 * the URL the provider returned — never rewritten. */
export interface SearchResult {
  /** Stable per-batch id ("S1", "S2", …) used to reference this result from
   * AI output — the AI cites ids, the app resolves URLs. */
  id: string;
  title: string;
  url: string;
  /** Canonical form used only for de-duplication. */
  canonicalUrl: string;
  domain: string;
  content: string;
  /** Provider relevance score (0–1), kept as metadata only. */
  providerScore: number | null;
  /** As returned by the provider; null when the provider exposed none. */
  publishedDate: string | null;
  provider: SearchProviderName;
  /** Label of the query that produced it. */
  queryLabel?: string;
}

/** Result of one provider request, before batch-level de-duplication. */
export interface SingleSearchResponse {
  results: Omit<SearchResult, "id">[];
  /** Credits the provider charged for this request (actual when reported). */
  credits: number;
  latencyMs: number;
  requestId?: string;
}

/** Authoritative account usage, as reported by the provider itself. */
export interface SearchUsageSnapshot {
  /** Credits used this billing cycle (max of key- and account-level). */
  used: number;
  /** Plan's included credits; null if unknown/unlimited. */
  planLimit: number | null;
  /** Key-level cap; null if none. */
  keyLimit: number | null;
  keyUsage: number;
  /** Pay-as-you-go credits consumed this cycle (should be 0 for us). */
  paygoUsage: number;
  plan?: string;
  fetchedAt: number;
}

export interface SearchProvider {
  readonly name: SearchProviderName;
  /** Credits one `search()` call costs at the configuration we use. */
  readonly creditsPerSearch: number;
  search(query: SearchQuery): Promise<SingleSearchResponse>;
  /** Authoritative usage from the provider, if it exposes one. */
  getUsage?(): Promise<SearchUsageSnapshot>;
}

export interface SearchBatchResult {
  /** De-duplicated by canonical URL, ids assigned in order. */
  results: SearchResult[];
  requests: number;
  credits: number;
  latencyMs: number;
  /** Queries that failed while others succeeded (partial results). */
  failures: { label?: string; kind: string }[];
  usageBefore?: SearchUsageSnapshot;
}
