import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import {
  CTA_TEXT_PATTERNS,
  LOGIN_TEXT_PATTERNS,
  MAX_HEADING_ITEMS,
  PRICING_TEXT_PATTERNS,
  SIGNUP_TEXT_PATTERNS,
} from "./constants";
import type { SeoEvidence } from "./types";

// ---------------------------------------------------------------------------
// Objective HTML/DOM facts, via Cheerio. Nothing in this file interprets
// anything — every value is a direct count, a direct string, or a direct
// presence check against the parsed DOM. Interpretation happens later, in
// Gemini's `WebsiteInterpretation`.
// ---------------------------------------------------------------------------

function text(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function matchesAny(haystack: string, patterns: string[]): boolean {
  const lower = haystack.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

function extractHeadings($: CheerioAPI) {
  const collect = (selector: string) =>
    $(selector)
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .slice(0, MAX_HEADING_ITEMS);

  return {
    h1: collect("h1"),
    h2: collect("h2"),
    h3: collect("h3"),
  };
}

function extractImages($: CheerioAPI) {
  const images = $("img");
  let missingAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr("alt");
    if (!alt || !alt.trim()) missingAlt += 1;
  });
  return { total: images.length, missingAlt };
}

/** Links this page actually navigates to — mailto/tel/javascript/anchor-only
 * hrefs are excluded since they aren't page-to-page navigation. */
function extractLinks($: CheerioAPI, baseUrl: string) {
  const base = new URL(baseUrl);
  let internal = 0;
  let external = 0;
  let total = 0;

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (!href) return;
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return;

    total += 1;
    try {
      const resolved = new URL(href, base);
      if (resolved.hostname === base.hostname) internal += 1;
      else external += 1;
    } catch {
      // Unresolvable href — don't count it either way.
    }
  });

  return { total, internal, external };
}

function extractCtaCount($: CheerioAPI): number {
  let count = 0;
  $("a, button").each((_, el) => {
    const label = `${$(el).text()} ${$(el).attr("aria-label") ?? ""}`.trim();
    if (label && matchesAny(label, CTA_TEXT_PATTERNS)) count += 1;
  });
  return count;
}

function hasLinkMatching($: CheerioAPI, patterns: string[]): boolean {
  let found = false;
  $("a").each((_, el) => {
    if (found) return;
    const label = `${$(el).text()} ${$(el).attr("href") ?? ""}`;
    if (matchesAny(label, patterns)) found = true;
  });
  return found;
}

function extractStructuredData($: CheerioAPI) {
  const types = new Set<string>();
  let present = false;

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw?.trim()) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      present = true;
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (node && typeof node === "object" && "@type" in node) {
          const t = (node as { "@type": unknown })["@type"];
          if (typeof t === "string") types.add(t);
          else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && types.add(x));
        }
      }
    } catch {
      // Malformed JSON-LD — not counted as present, and never crashes extraction.
    }
  });

  return { present, types: Array.from(types) };
}

function extractWordCount($: CheerioAPI): number {
  const clone = $("body").clone();
  clone.find("script, style, noscript, template").remove();
  const words = clone
    .text()
    .replace(/\s+/g, " ")
    .trim();
  return words ? words.split(" ").length : 0;
}

export function extractSeoEvidence(html: string, pageUrl: string): SeoEvidence {
  const $ = cheerio.load(html);

  return {
    title: text($("title").first().text()),
    titleLength: $("title").first().text().trim().length,
    metaDescription: text($('meta[name="description"]').attr("content")),
    metaDescriptionLength: ($('meta[name="description"]').attr("content") ?? "").trim().length,
    canonical: text($('link[rel="canonical"]').attr("href")),
    robotsMeta: text($('meta[name="robots"]').attr("content")),
    viewport: text($('meta[name="viewport"]').attr("content")),
    lang: text($("html").attr("lang")),
    faviconPresent:
      $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').length > 0,
    headings: extractHeadings($),
    h1Count: $("h1").length,
    images: extractImages($),
    links: extractLinks($, pageUrl),
    formCount: $("form").length,
    ctaCount: extractCtaCount($),
    navItemCount: $("nav a").length,
    hasPricingLink: hasLinkMatching($, PRICING_TEXT_PATTERNS),
    hasSignupLink: hasLinkMatching($, SIGNUP_TEXT_PATTERNS),
    hasLoginLink: hasLinkMatching($, LOGIN_TEXT_PATTERNS),
    structuredData: extractStructuredData($),
    socialMeta: {
      openGraphPresent: $('meta[property^="og:"]').length > 0,
      twitterCardPresent: $('meta[name^="twitter:"]').length > 0,
    },
    wordCount: extractWordCount($),
  };
}
