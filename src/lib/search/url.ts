// URL helpers for search results. Canonical form is for de-duplication only;
// the original URL is always what gets stored and displayed.

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "igshid",
  "fbclid",
  "gclid",
];

/** Only absolute http(s) URLs with a hostname are accepted. */
export function parseHttpUrl(raw: unknown): URL | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname || !url.hostname.includes(".")) return null;
    return url;
  } catch {
    return null;
  }
}

export function domainOf(url: string): string {
  const parsed = parseHttpUrl(url);
  return parsed ? parsed.hostname.replace(/^www\./i, "").toLowerCase() : "";
}

/** Lower-cased host (no www, no old.), no tracking params, no fragment, no
 * trailing slash. Keeps identity params like Hacker News' `?id=`. */
export function canonicalizeUrl(raw: string): string {
  const parsed = parseHttpUrl(raw);
  if (!parsed) return raw.trim().toLowerCase();
  for (const p of TRACKING_PARAMS) parsed.searchParams.delete(p);
  const host = parsed.hostname.toLowerCase().replace(/^(www|old|m)\./, "");
  let path = parsed.pathname.replace(/\/+$/, "");
  if (!path) path = "";
  const search = parsed.searchParams.toString();
  return `${host}${path.toLowerCase()}${search ? `?${search}` : ""}`;
}
