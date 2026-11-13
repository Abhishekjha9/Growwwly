export { searchMany, MAX_SEARCHES_PER_OPERATION, getConfiguredSearchProvider } from "./client";
export {
  SearchProviderError,
  isSearchProviderError,
  httpStatusForSearchError,
  type SearchErrorKind,
} from "./errors";
export type {
  SearchBatchResult,
  SearchQuery,
  SearchResult,
  SearchTimeRange,
  SearchUsageSnapshot,
} from "./types";
export { canonicalizeUrl, domainOf } from "./url";
