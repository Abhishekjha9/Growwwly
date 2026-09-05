// ---------------------------------------------------------------------------
// Every tunable value for the website-inspection pipeline. Nothing here is
// AI-derived — these are our own operational limits and pattern-matching
// heuristics for the Cheerio extraction step.
// ---------------------------------------------------------------------------

export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_REDIRECTS = 5;
export const MAX_HTML_BYTES = 5_000_000;

export const SCREENSHOT_TIMEOUT_MS = 15_000;
export const NAVIGATION_TIMEOUT_MS = 15_000;
export const LIGHTHOUSE_TIMEOUT_MS = 45_000;

/** Screenshots are JPEG at this quality to keep the response payload (and
 * sessionStorage footprint on the client) reasonable. */
export const SCREENSHOT_JPEG_QUALITY = 60;

export const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
export const MOBILE_VIEWPORT = { width: 390, height: 844 };

/** Capped so a very long homepage doesn't produce an unbounded screenshot or
 * an unbounded word count. */
export const MAX_SCREENSHOT_HEIGHT = 4000;
export const MAX_HEADING_ITEMS = 20;
export const MAX_LINK_SAMPLE = 500;

/** Case-insensitive substrings that mark a link/button as CTA-like. Pattern
 * matching only — presence of text, not an assessment of actual intent. */
export const CTA_TEXT_PATTERNS = [
  "get started",
  "start free",
  "start your",
  "sign up",
  "signup",
  "try free",
  "try for free",
  "book a demo",
  "request a demo",
  "request demo",
  "schedule a demo",
  "contact sales",
  "get a quote",
  "buy now",
  "subscribe",
  "join now",
  "create account",
  "create your account",
  "start trial",
  "free trial",
];

export const SIGNUP_TEXT_PATTERNS = ["sign up", "signup", "register", "create account", "get started"];
export const LOGIN_TEXT_PATTERNS = ["log in", "login", "sign in", "signin"];
export const PRICING_TEXT_PATTERNS = ["pricing", "plans", "price"];

/** Only these protocols are ever fetched or navigated to. */
export const ALLOWED_PROTOCOLS = ["http:", "https:"];

/** Hostnames that always resolve to "don't fetch this," independent of DNS. */
export const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "metadata.google.internal",
]);

/** Suffixes that indicate an internal/non-routable hostname. */
export const BLOCKED_HOSTNAME_SUFFIXES = [".local", ".internal", ".localhost"];
