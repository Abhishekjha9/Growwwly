import { z } from "zod";

import type { AnalysisResult } from "@/types/analysis";
import { generateStructuredResponse } from "@/lib/ai/client";
import {
  canonicalizeUrl as canonicalizeForLookup,
  searchMany,
  type SearchQuery,
  type SearchResult,
} from "@/lib/search";
import {
  OPPORTUNITY_INTERPRETATION_SYSTEM_PROMPT,
  buildOpportunityInterpretationUserPrompt,
} from "./prompts";
import {
  IntentSignalTypeSchema,
  RawOpportunitySchema,
  SourceTypeSchema,
  type RawOpportunity,
} from "./schemas";
import { MAX_RAW_OPPORTUNITIES } from "./constants";
import { extractDomain } from "./rank";
import type { SearchAngle, SearchIntent } from "./types";

// ---------------------------------------------------------------------------
// Search intent construction — pure, deterministic, no I/O. Builds the
// bounded set of targeted search angles from the product's own analysis
// rather than ever searching for the product name alone.
// ---------------------------------------------------------------------------

export function buildSearchIntents(analysis: AnalysisResult): SearchIntent[] {
  const { product, customer, problem } = analysis.productIntelligence;
  const { topChannel } = analysis.growthIntelligence.summary;

  const base: SearchIntent[] = [
    {
      angle: "problem_discussion",
      description: `People discussing "${problem.primaryProblem}" as a real, current problem for ${customer.primaryCustomer}.`,
    },
    {
      angle: "category_alternatives",
      description: `People discussing alternatives to ${product.category} tools, or asking what others use for ${product.primaryUseCase}.`,
    },
    {
      angle: "pain_complaint",
      description: `People complaining about friction, limitations, or frustration related to ${problem.primaryProblem} or existing ${product.category} tools.`,
    },
    {
      angle: "seeking_recommendation",
      description: `People explicitly "looking for" or asking for a recommendation for a tool that helps with ${product.primaryUseCase}.`,
    },
    {
      angle: "comparison",
      description: `People comparing tools or approaches for ${product.primaryUseCase}, e.g. "X vs Y" discussions relevant to ${product.category}.`,
    },
    {
      angle: "implementation_question",
      description: `People asking practical "how do you..." or implementation questions related to ${problem.primaryProblem}.`,
    },
  ];

  if (topChannel === "communities" || topChannel === "referrals") {
    base.push(
      {
        angle: "problem_discussion",
        description: `site:reddit.com — ${customer.primaryCustomer} discussing "${problem.primaryProblem}" or looking for ${product.category} solutions.`,
      },
      {
        angle: "seeking_recommendation",
        description: `site:news.ycombinator.com — discussions where ${customer.primaryCustomer} asks about or evaluates ${product.category} tools for ${product.primaryUseCase}.`,
      }
    );
  }

  return base;
}

// ---------------------------------------------------------------------------
// Discovery queries — exactly THREE targeted searches per discovery, built
// deterministically from Product + Growth Intelligence. The AI never decides
// what or how often to search.
//
//   1. problem_discussion      → public communities (Reddit, HN, Q&A forums)
//   2. seeking_recommendation  → public communities
//   3. channel-dependent angle → OPEN web, so other public sources stay
//      discoverable: comparisons for community/referral-led products,
//      pain/complaints otherwise.
// Verified 2026-11-14 with a real run: open-web queries for a developer
// product return mostly vendor "X alternatives" pages, so only one of the
// three searches is open; the other two target where conversations live.
// ---------------------------------------------------------------------------

export const MAX_DISCOVERY_SEARCHES = 3;

export const COMMUNITY_DOMAINS = [
  "reddit.com",
  "news.ycombinator.com",
  "indiehackers.com",
  "stackoverflow.com",
  "stackexchange.com",
  "lobste.rs",
];

/** Vendor review / listicle aggregators — not conversations to join. */
const NON_CONVERSATION_DOMAINS = [
  "g2.com",
  "capterra.com",
  "getapp.com",
  "softwareadvice.com",
  "trustradius.com",
  "alternativeto.net",
  "saasworthy.com",
];

export interface DiscoveryQuery extends SearchQuery {
  intent: SearchIntent;
}

const TRAILING_STOPWORDS = new Set([
  "a", "an", "and", "or", "the", "to", "of", "for", "via", "with", "in", "on", "by", "using", "is", "are",
]);

/** First clause (up to `,;.:` or an em dash), at most `maxWords` words, with
 * dangling stop-words trimmed. Analysis text is written like marketing copy;
 * searches work far better with the short phrase people actually type. */
function shorten(text: string, maxWords: number): string {
  const clause = text.split(/[,;.:—–]|\s-\s/)[0] ?? text;
  const words = clause
    .replace(/[“”"()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, maxWords);
  while (words.length > 1 && TRAILING_STOPWORDS.has(words[words.length - 1].toLowerCase())) words.pop();
  return words.join(" ").replace(/[.,;:!?-]+$/, "");
}

/** "Developer Infrastructure / Email API" → "Email API". */
function coreCategory(category: string): string {
  const parts = category.split(/[/|>]/).map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? category;
}

function intentFor(intents: SearchIntent[], angle: SearchAngle): SearchIntent {
  return intents.find((i) => i.angle === angle) ?? { angle, description: angle };
}

export function buildDiscoveryQueries(analysis: AnalysisResult): DiscoveryQuery[] {
  const { product, problem } = analysis.productIntelligence;
  const { topChannel } = analysis.growthIntelligence.summary;
  const intents = buildSearchIntents(analysis);
  const productDomain = extractProductDomain(analysis);

  const category = shorten(coreCategory(product.category), 5);
  const problemText = shorten(problem.primaryProblem, 10);
  const useCase = shorten(product.primaryUseCase, 8);
  const exclude = [...(productDomain ? [productDomain] : [])];
  const communityLed = topChannel === "communities" || topChannel === "referrals";

  const queries: DiscoveryQuery[] = [
    {
      intent: intentFor(intents, "problem_discussion"),
      label: "problem_discussion",
      query: problemText,
      includeDomains: COMMUNITY_DOMAINS,
      excludeDomains: exclude.length ? exclude : undefined,
      timeRange: "year",
    },
    {
      intent: intentFor(intents, "seeking_recommendation"),
      label: "seeking_recommendation",
      query: `what ${category} do you recommend for ${useCase}`,
      includeDomains: COMMUNITY_DOMAINS,
      excludeDomains: exclude.length ? exclude : undefined,
      timeRange: "year",
    },
    communityLed
      ? {
          intent: intentFor(intents, "comparison"),
          label: "comparison",
          query: `${category} alternatives which one do you use and why`,
          excludeDomains: [...exclude, ...NON_CONVERSATION_DOMAINS],
          timeRange: "year",
        }
      : {
          intent: intentFor(intents, "pain_complaint"),
          label: "pain_complaint",
          query: `frustrated with my ${category} ${shorten(problem.primaryProblem, 6)}`,
          excludeDomains: [...exclude, ...NON_CONVERSATION_DOMAINS],
          timeRange: "year",
        },
  ];

  return queries.slice(0, MAX_DISCOVERY_SEARCHES);
}

// ---------------------------------------------------------------------------
// AI interpretation of real search results. The model only ever sees result
// ids — its schema has no URL field — and every fact shown to the user
// (title, URL, excerpt, date) comes from the search result itself.
// ---------------------------------------------------------------------------

const SignalSchema = z.number().int().min(0).max(100);

function interpretationSchemaFor(ids: string[]) {
  return z.object({
    opportunities: z
      .array(
        z.object({
          sourceId: z.enum(ids as [string, ...string[]]),
          sourceType: SourceTypeSchema,
          relevanceSignal: SignalSchema,
          audienceMatchSignal: SignalSchema,
          intentSignal: SignalSchema,
          productAlignmentSignal: SignalSchema,
          intentTypes: z.array(IntentSignalTypeSchema).max(6),
          reason: z.string().min(1).max(600),
          responseDraft: z.string().min(1).max(1500),
        })
      ),
  });
}

const MAX_INTERPRETED_OPPORTUNITIES = 8;

/** Lenient per-item parse used when mapping — tolerates a provider that
 * returns a `url` instead of (or as well as) a `sourceId`. */
const InterpretedItemSchema = z.object({
  sourceId: z.string().optional(),
  url: z.string().optional(),
  sourceType: SourceTypeSchema,
  relevanceSignal: SignalSchema,
  audienceMatchSignal: SignalSchema,
  intentSignal: SignalSchema,
  productAlignmentSignal: SignalSchema,
  intentTypes: z.array(IntentSignalTypeSchema).max(6).default([]),
  reason: z.string().min(1).max(600),
  responseDraft: z.string().min(1).max(1500),
});

/** Human-readable venue derived from the URL — never from model text. */
export function sourceLabel(url: string): string {
  const domain = extractDomain(url);
  if (/(^|\.)reddit\.com$/.test(domain)) {
    const sub = /\/r\/([^/]+)/i.exec(new URL(url).pathname)?.[1];
    return sub ? `r/${sub}` : "Reddit";
  }
  if (domain === "news.ycombinator.com") return "Hacker News";
  return domain || "Web";
}

function ageInDays(published: string | null, now: number): number | undefined {
  if (!published) return undefined;
  const t = Date.parse(published);
  if (Number.isNaN(t)) return undefined;
  return Math.min(3650, Math.max(0, Math.floor((now - t) / 86_400_000)));
}

export interface MappingStats {
  received: number;
  unknownSource: number;
  duplicate: number;
  invalid: number;
}

/**
 * Turns interpreted items into RawOpportunity objects. Each item must map to
 * a real search result by `sourceId` (or, failing that, by canonical URL);
 * the final URL/title/snippet/date are ALWAYS the search result's own. Items
 * that cannot be mapped are discarded, as are repeat references to a result
 * already used. Exported for tests.
 */
export function mapInterpretationToRawOpportunities(
  items: unknown[],
  results: SearchResult[],
  now: number = Date.now()
): { opportunities: RawOpportunity[]; stats: MappingStats } {
  const byId = new Map(results.map((r) => [r.id, r]));
  const byCanonical = new Map(results.map((r) => [r.canonicalUrl, r]));
  const used = new Set<string>();
  const stats: MappingStats = { received: items.length, unknownSource: 0, duplicate: 0, invalid: 0 };
  const opportunities: RawOpportunity[] = [];

  for (const item of items.slice(0, MAX_RAW_OPPORTUNITIES)) {
    const parsed = InterpretedItemSchema.safeParse(item);
    if (!parsed.success) {
      stats.invalid += 1;
      continue;
    }
    const it = parsed.data;
    let source = it.sourceId ? byId.get(it.sourceId.trim()) : undefined;
    if (!source && it.url) source = byCanonical.get(canonicalizeForLookup(it.url));
    if (!source) {
      stats.unknownSource += 1;
      continue;
    }
    if (used.has(source.id)) {
      stats.duplicate += 1;
      continue;
    }

    const days = ageInDays(source.publishedDate, now);
    const candidate = RawOpportunitySchema.safeParse({
      title: source.title,
      url: source.url,
      source: sourceLabel(source.url),
      sourceType: it.sourceType,
      snippet: source.content.slice(0, 800),
      publishedAt: source.publishedDate ? source.publishedDate.slice(0, 60) : undefined,
      estimatedDaysAgo: days,
      relevanceSignal: it.relevanceSignal,
      audienceMatchSignal: it.audienceMatchSignal,
      intentSignal: it.intentSignal,
      productAlignmentSignal: it.productAlignmentSignal,
      intentTypes: it.intentTypes,
      reason: it.reason,
      responseDraft: it.responseDraft,
    });
    if (!candidate.success) {
      stats.invalid += 1;
      continue;
    }
    used.add(source.id);
    opportunities.push(candidate.data);
  }
  return { opportunities, stats };
}

export interface RawDiscoveryResult {
  opportunities: RawOpportunity[];
  search: {
    requests: number;
    credits: number;
    latencyMs: number;
    results: number;
    failures: { label?: string; kind: string }[];
  };
  interpretation: {
    latencyMs: number;
    stats: MappingStats | null;
  };
}

export async function discoverRawOpportunities(analysis: AnalysisResult): Promise<RawDiscoveryResult> {
  const queries = buildDiscoveryQueries(analysis);
  console.log(`[opportunities] ${queries.length} discovery searches: ${queries.map((q) => q.label).join(", ")}`);

  const batch = await searchMany(queries);
  const searchInfo = {
    requests: batch.requests,
    credits: batch.credits,
    latencyMs: batch.latencyMs,
    results: batch.results.length,
    failures: batch.failures,
  };

  if (batch.results.length === 0) {
    console.log("[opportunities] search returned no results — nothing to interpret.");
    return { opportunities: [], search: searchInfo, interpretation: { latencyMs: 0, stats: null } };
  }

  const userPrompt = buildOpportunityInterpretationUserPrompt(
    analysis,
    queries.map((q) => q.intent),
    batch.results.map((r) => ({
      id: r.id,
      title: r.title,
      domain: r.domain,
      publishedDate: r.publishedDate,
      content: r.content,
    }))
  );

  const started = Date.now();
  const interpreted = (await generateStructuredResponse({
    systemPrompt: OPPORTUNITY_INTERPRETATION_SYSTEM_PROMPT,
    userPrompt,
    responseSchema: interpretationSchemaFor(batch.results.map((r) => r.id)),
    temperature: 0.4,
    maxOutputTokens: 6000,
    operation: "opportunity",
  })) as { opportunities?: unknown };
  const interpretationLatency = Date.now() - started;

  // Cap enforced in code (not in the schema) so one extra item can't fail
  // the whole response; the prompt already asks for at most 8.
  const items = Array.isArray(interpreted?.opportunities)
    ? interpreted.opportunities.slice(0, MAX_INTERPRETED_OPPORTUNITIES)
    : [];
  const { opportunities, stats } = mapInterpretationToRawOpportunities(items, batch.results);

  if (process.env.NODE_ENV !== "production") {
    const picked = new Set(opportunities.map((o) => o.url));
    for (const r of batch.results) {
      console.log(`[opportunities]   ${picked.has(r.url) ? "✓" : "·"} ${r.id} [${r.queryLabel}] ${r.domain} — ${r.title.slice(0, 90)}`);
    }
  }
  console.log(
    `[opportunities] interpretation: ${stats.received} proposed, ${opportunities.length} mapped to real results ` +
      `(unknown=${stats.unknownSource} duplicate=${stats.duplicate} invalid=${stats.invalid}) in ${interpretationLatency}ms`
  );

  return {
    opportunities,
    search: searchInfo,
    interpretation: { latencyMs: interpretationLatency, stats },
  };
}

export function extractProductDomain(analysis: AnalysisResult): string | undefined {
  const crawl = analysis.websiteIntelligence?.crawl;
  const url = crawl?.finalUrl ?? crawl?.requestedUrl;
  return url ? extractDomain(url) : undefined;
}
