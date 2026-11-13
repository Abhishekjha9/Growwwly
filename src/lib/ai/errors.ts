// ---------------------------------------------------------------------------
// Provider-agnostic AI error. Every adapter maps its own failures onto one of
// these kinds so routes can respond correctly (e.g. 429 for quota exhaustion
// vs 504 for a timeout) without knowing which provider is active.
//
// `message` is always safe to show a user: it never includes an API key, a
// raw response body, screenshot data, or user-submitted content.
// ---------------------------------------------------------------------------

export type AIErrorKind =
  /** Daily / hard quota exhausted (e.g. Gemini RESOURCE_EXHAUSTED per-day). */
  | "quota_exhausted"
  /** Short-window rate limit (per-minute). Retry later, never in a loop. */
  | "rate_limited"
  /** The requested model/feature is not available within the free tier. */
  | "free_tier_unavailable"
  /** The active provider/model does not support this capability. */
  | "unsupported_capability"
  | "configuration"
  | "authentication"
  | "timeout"
  | "server_error"
  | "request_error"
  | "connection"
  | "invalid_output";

export class AIProviderError extends Error {
  readonly kind: AIErrorKind;
  readonly provider: string;
  /** Seconds until the provider says a retry may succeed, when known. */
  readonly retryAfterSeconds?: number;

  constructor(
    kind: AIErrorKind,
    message: string,
    opts: { provider: string; retryAfterSeconds?: number } = { provider: "unknown" }
  ) {
    super(message);
    this.name = "AIProviderError";
    this.kind = kind;
    this.provider = opts.provider;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }
}

export function isAIProviderError(err: unknown): err is AIProviderError {
  return err instanceof AIProviderError;
}

/** HTTP status a route should return for a provider failure. */
export function httpStatusForAIError(err: unknown): number {
  if (!isAIProviderError(err)) return 500;
  switch (err.kind) {
    case "quota_exhausted":
    case "rate_limited":
      return 429;
    case "timeout":
      return 504;
    case "free_tier_unavailable":
    case "unsupported_capability":
    case "configuration":
      return 503;
    case "authentication":
    case "server_error":
    case "connection":
    case "request_error":
    case "invalid_output":
      return 502;
  }
}
