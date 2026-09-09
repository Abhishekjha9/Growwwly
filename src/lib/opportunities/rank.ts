import {
  FRESHNESS_THRESHOLDS,
  FRESHNESS_UNKNOWN_SCORE,
  HIGH_OPPORTUNITY_THRESHOLD,
  INTENT_SIGNAL_LABELS,
  MAX_OPPORTUNITIES_RETURNED,
  OPPORTUNITY_SCORE_WEIGHTS,
  SUGGESTED_ACTION_BY_SOURCE_TYPE,
} from "./constants";
import type { Opportunity, RawOpportunity } from "./schemas";
import { OpportunitySchema } from "./schemas";
import type { SourceType } from "./types";

// ---------------------------------------------------------------------------
// Pure, deterministic ranking math. No randomness, no I/O, no OpenAI
// involvement — same contract as `@/lib/growth/scoring`. OpenAI supplies raw
// per-opportunity signals only; every number and ordering decision below is
// plain TypeScript.
// ---------------------------------------------------------------------------

export function clampScore(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Known, unambiguous domains override OpenAI's own `sourceType`
 * classification — a structural fact code can verify beats a model guess. */
const DOMAIN_SOURCE_TYPE_OVERRIDES: Array<{ pattern: RegExp; sourceType: SourceType }> = [
  { pattern: /(^|\.)reddit\.com$/i, sourceType: "reddit" },
  { pattern: /(^|\.)news\.ycombinator\.com$/i, sourceType: "hacker_news" },
];

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function resolveSourceType(url: string, declared: SourceType): SourceType {
  const domain = extractDomain(url);
  const override = DOMAIN_SOURCE_TYPE_OVERRIDES.find((o) => o.pattern.test(domain));
  return override?.sourceType ?? declared;
}

/** Tracking parameters stripped for de-duplication and display — never
 * touches params a source depends on for identity (e.g. Hacker News'
 * `?id=`). */
const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "igshid",
];

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const param of TRACKING_PARAMS) parsed.searchParams.delete(param);
    parsed.hash = "";
    let normalized = `${parsed.origin}${parsed.pathname}${parsed.search}`.toLowerCase();
    if (normalized.endsWith("/") && normalized.length > parsed.origin.length + 1) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Stable, non-cryptographic hash — same normalized URL always yields the
 * same id, which is all deduplication and React keys need. */
export function hashId(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `opp_${(hash >>> 0).toString(16)}`;
}

export function computeFreshnessScore(estimatedDaysAgo?: number): number {
  if (estimatedDaysAgo === undefined) return FRESHNESS_UNKNOWN_SCORE;
  const tier = FRESHNESS_THRESHOLDS.find((t) => estimatedDaysAgo <= t.withinDays);
  return tier ? tier.score : FRESHNESS_UNKNOWN_SCORE;
}

export function computeOpportunityScore(raw: RawOpportunity, freshness: number): number {
  const w = OPPORTUNITY_SCORE_WEIGHTS;
  return clampScore(
    raw.relevanceSignal * w.relevance +
      raw.audienceMatchSignal * w.audienceMatch +
      raw.intentSignal * w.problemIntent +
      freshness * w.freshness +
      raw.productAlignmentSignal * w.productAlignment
  );
}

export function computeConfidence(raw: RawOpportunity): number {
  return clampScore(
    (raw.relevanceSignal + raw.audienceMatchSignal + raw.intentSignal + raw.productAlignmentSignal) / 4
  );
}

export function buildMatchingSignals(raw: RawOpportunity, freshness: number): string[] {
  const signals: string[] = raw.intentTypes.map((t) => INTENT_SIGNAL_LABELS[t]);
  if (raw.audienceMatchSignal >= 70) signals.push("Strong match with your target customer");
  if (freshness >= 85) signals.push("Recent, active discussion");
  return signals.slice(0, 5);
}

/** Scores one already Zod-validated raw opportunity into the final, ranked
 * shape. Does not filter or deduplicate — that happens across the whole
 * batch in `rankOpportunities`. */
export function scoreOpportunity(raw: RawOpportunity): Opportunity {
  const freshness = computeFreshnessScore(raw.estimatedDaysAgo);
  const sourceType = resolveSourceType(raw.url, raw.sourceType);

  return OpportunitySchema.parse({
    id: hashId(normalizeUrl(raw.url)),
    title: raw.title.trim(),
    url: raw.url,
    domain: extractDomain(raw.url),
    source: raw.source.trim(),
    sourceType,
    snippet: raw.snippet.trim(),
    publishedAt: raw.publishedAt,
    commentCount: raw.commentCount,
    relevanceScore: raw.relevanceSignal,
    opportunityScore: computeOpportunityScore(raw, freshness),
    confidence: computeConfidence(raw),
    reason: raw.reason.trim(),
    matchingSignals: buildMatchingSignals(raw, freshness),
    suggestedAction: SUGGESTED_ACTION_BY_SOURCE_TYPE[sourceType],
    responseDraft: raw.responseDraft.trim(),
  });
}

export interface RankContext {
  /** The product's own domain, if known — excluded from results since it's
   * not a conversation to join. */
  productDomain?: string;
}

/**
 * Deduplicates by normalized URL, drops the product's own domain, sorts
 * deterministically by Opportunity Score (ties broken alphabetically by
 * title for a stable order), and caps the feed to the top N.
 */
export function rankOpportunities(raws: RawOpportunity[], context: RankContext = {}): Opportunity[] {
  const byUrl = new Map<string, Opportunity>();

  for (const raw of raws) {
    const domain = extractDomain(raw.url);
    if (!domain) continue;
    if (context.productDomain && domain === context.productDomain) continue;

    const scored = scoreOpportunity(raw);
    const key = normalizeUrl(raw.url);
    const existing = byUrl.get(key);
    if (!existing || scored.opportunityScore > existing.opportunityScore) {
      byUrl.set(key, scored);
    }
  }

  const ranked = Array.from(byUrl.values())
    .sort((a, b) => b.opportunityScore - a.opportunityScore || a.title.localeCompare(b.title));

  // Apply a gentle diversity penalty to prevent a single domain from completely
  // dominating the feed, while still allowing exceptionally strong results to
  // punch through.
  const domainCounts = new Map<string, number>();
  for (const opp of ranked) {
    const count = domainCounts.get(opp.domain) || 0;
    domainCounts.set(opp.domain, count + 1);
    if (count >= 2) {
      // Gentle 5-point penalty for the 3rd result, 10 for the 4th, etc.
      opp.opportunityScore = Math.max(0, opp.opportunityScore - (count - 1) * 5);
    }
  }

  return ranked
    .sort((a, b) => b.opportunityScore - a.opportunityScore || a.title.localeCompare(b.title))
    .slice(0, MAX_OPPORTUNITIES_RETURNED);
}

export function isHighOpportunity(opportunity: Opportunity): boolean {
  return opportunity.opportunityScore >= HIGH_OPPORTUNITY_THRESHOLD;
}
