import { z } from "zod";

import { ProductIntelligenceSchema } from "@/lib/ai/schemas/product-analysis";
import { GrowthIntelligenceSchema } from "@/lib/growth/types";
import { WebsiteIntelligenceSchema } from "@/lib/website/types";

// ---------------------------------------------------------------------------
// The canonical `AnalysisResult` shape, assembled from the three existing
// Phase 1/2/3 schemas. Opportunity Discovery consumes the exact same
// analysis object the rest of the app does — this is not a second analysis
// type, just the Zod validator the API route needs to trust an incoming
// request body.
// ---------------------------------------------------------------------------

export const AnalysisResultSchema = z.object({
  productIntelligence: ProductIntelligenceSchema,
  websiteIntelligence: WebsiteIntelligenceSchema.nullable(),
  growthIntelligence: GrowthIntelligenceSchema,
});

export const OpportunityDiscoveryRequestSchema = z.object({
  analysis: AnalysisResultSchema,
});
export type OpportunityDiscoveryRequest = z.infer<
  typeof OpportunityDiscoveryRequestSchema
>;

// ---------------------------------------------------------------------------
// Source classification
// ---------------------------------------------------------------------------

export const SourceTypeSchema = z.enum([
  "reddit",
  "hacker_news",
  "forum",
  "article",
  "discussion",
  "other",
]);

export const IntentSignalTypeSchema = z.enum([
  "seeking_solution",
  "evaluating_alternatives",
  "describing_pain",
  "seeking_recommendation",
  "comparing_tools",
  "asking_implementation_question",
]);

/** 0–100 raw signal OpenAI estimates from the search result — never a final
 * score. Same "analyst estimate" framing as Phase 1's SignalScore. */
const RawSignalScore = z
  .number()
  .int()
  .min(0)
  .max(100)
  .describe("Analyst estimate from 0 (none) to 100 (very strong)");

// ---------------------------------------------------------------------------
// RawOpportunity — exactly what OpenAI returns per discussion, before any
// deterministic scoring is applied. Every field here is either a fact
// extracted from a real grounded search result (title, url, source, snippet,
// publishedAt, commentCount) or a raw analyst signal (the *Signal fields).
// `url` is the only field that gates whether an opportunity can ever be
// displayed — see AGENTS.md Opportunity Feed §5/§14/§21.
// ---------------------------------------------------------------------------

export const RawOpportunitySchema = z.object({
  title: z.string().min(1).max(300),
  url: z
    .string()
    .url("Invalid URL format")
    .refine((value) => /^https?:\/\//i.test(value), {
      message: "URL must start with http:// or https://",
    }),
  source: z
    .string()
    .min(1)
    .max(120)
    .describe('Human-readable venue, e.g. "r/ExperiencedDevs" or "Hacker News"'),
  sourceType: SourceTypeSchema,
  snippet: z.string().min(1).max(800),
  /** Free-text as returned by the search result — "2 days ago", a date, a
   * quarter. Never fabricated: omitted entirely when not visible in the
   * source. */
  publishedAt: z.string().max(60).optional(),
  /** A numeric estimate of the discussion's age in days, only when the
   * search result actually exposed a date OpenAI could compute this from.
   * Feeds the deterministic freshness score in `rank.ts` — OpenAI estimates
   * the age, code decides what that age is worth. */
  estimatedDaysAgo: z.number().int().min(0).max(3650).optional(),
  commentCount: z.number().int().min(0).max(1_000_000).optional(),

  relevanceSignal: RawSignalScore.describe(
    "How relevant this discussion is to the product's problem and category"
  ),
  audienceMatchSignal: RawSignalScore.describe(
    "How closely the people in this discussion match the target customer"
  ),
  intentSignal: RawSignalScore.describe(
    "How strong the solution-seeking / buying intent is in this discussion"
  ),
  productAlignmentSignal: RawSignalScore.describe(
    "How naturally the product could provide genuine value here, considering the highest-leverage channel"
  ),

  intentTypes: z.array(IntentSignalTypeSchema).max(6).default([]),

  reason: z
    .string()
    .min(1)
    .max(600)
    .describe("Why this discussion is a genuine opportunity for this product"),

  responseDraft: z
    .string()
    .min(1)
    .max(1500)
    .describe(
      "A contextual, non-spammy draft reply that provides value first and only mentions the product when genuinely relevant"
    ),
});
export type RawOpportunity = z.infer<typeof RawOpportunitySchema>;

/** Local safety cap kept separate from `constants.ts` to avoid a circular
 * import (constants.ts imports types derived from this file). Must stay
 * greater than or equal to `MAX_RAW_OPPORTUNITIES` in `constants.ts`. */
const MAX_RAW_SAFETY_CAP = 60;

export const OpportunitySearchResponseShapeSchema = z.object({
  opportunities: z.array(z.unknown()).max(MAX_RAW_SAFETY_CAP),
});

// ---------------------------------------------------------------------------
// Opportunity — the final, code-scored object the UI renders. Everything
// under `relevanceScore`/`opportunityScore`/`confidence` is computed in
// `rank.ts`; nothing here is written by OpenAI directly.
// ---------------------------------------------------------------------------

export const OpportunitySchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  domain: z.string(),
  source: z.string(),
  sourceType: SourceTypeSchema,
  snippet: z.string(),
  publishedAt: z.string().optional(),
  commentCount: z.number().int().min(0).optional(),

  /** OpenAI's own raw relevance signal, passed through unchanged — the
   * "search relevance" figure kept separate from the framework score. */
  relevanceScore: z.number().int().min(0).max(100),
  /** The "Growwwly Opportunity Score" — never called a probability of
   * conversion or a guaranteed lead. */
  opportunityScore: z.number().int().min(0).max(100),
  confidence: z.number().int().min(0).max(100),

  reason: z.string(),
  matchingSignals: z.array(z.string()),
  suggestedAction: z.string(),
  responseDraft: z.string(),
});
export type Opportunity = z.infer<typeof OpportunitySchema>;

export const OpportunityDiscoveryResponseSchema = z.object({
  opportunities: z.array(OpportunitySchema),
});
