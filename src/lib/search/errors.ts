// ---------------------------------------------------------------------------
// Search-provider errors — independent of AI provider errors so routes can
// tell "search quota exhausted" apart from "Gemini failed to interpret".
// `message` is always safe to show a user: never the API key or a raw body.
// ---------------------------------------------------------------------------

export type SearchErrorKind =
  /** Missing API key / unknown provider. */
  | "configuration"
  /** Invalid or revoked API key. */
  | "authentication"
  /** Free credits (or the app's own monthly budget) used up. Not retried. */
  | "quota_exhausted"
  /** Short-window rate limit. Not retried automatically. */
  | "rate_limited"
  /** Provider 5xx / overloaded. */
  | "service_unavailable"
  /** The authoritative usage check could not be completed, so no paid-risk
   * search was attempted (fail closed). */
  | "usage_check_failed"
  | "timeout"
  | "connection"
  | "request_error"
  | "invalid_response";

export class SearchProviderError extends Error {
  readonly kind: SearchErrorKind;
  readonly provider: string;
  readonly retryAfterSeconds?: number;

  constructor(
    kind: SearchErrorKind,
    message: string,
    opts: { provider: string; retryAfterSeconds?: number }
  ) {
    super(message);
    this.name = "SearchProviderError";
    this.kind = kind;
    this.provider = opts.provider;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }
}

export function isSearchProviderError(err: unknown): err is SearchProviderError {
  return err instanceof SearchProviderError;
}

export function httpStatusForSearchError(err: SearchProviderError): number {
  switch (err.kind) {
    case "quota_exhausted":
    case "rate_limited":
      return 429;
    case "timeout":
      return 504;
    case "configuration":
    case "service_unavailable":
    case "usage_check_failed":
      return 503;
    case "authentication":
    case "connection":
    case "request_error":
    case "invalid_response":
      return 502;
  }
}

/** When several concurrent searches fail, surface the most actionable one. */
const KIND_PRIORITY: SearchErrorKind[] = [
  "configuration",
  "authentication",
  "quota_exhausted",
  "usage_check_failed",
  "rate_limited",
  "timeout",
  "service_unavailable",
  "connection",
  "request_error",
  "invalid_response",
];

export function mostActionableError(errors: SearchProviderError[]): SearchProviderError {
  return [...errors].sort(
    (a, b) => KIND_PRIORITY.indexOf(a.kind) - KIND_PRIORITY.indexOf(b.kind)
  )[0];
}
