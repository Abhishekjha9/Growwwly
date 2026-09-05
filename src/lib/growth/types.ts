import { z } from "zod";

// ---------------------------------------------------------------------------
// Growth Intelligence — the deterministic layer on top of Gemini's Product
// Intelligence. Nothing in this module is produced by the model: every value
// here is computed by plain TypeScript from the Phase 1 signals.
// ---------------------------------------------------------------------------

/** The eight channels Phase 1 already produces raw signals for. */
export const CHANNELS = [
  "seo",
  "communities",
  "content",
  "social",
  "outbound",
  "partnerships",
  "paidAds",
  "referrals",
] as const;

export const ChannelSchema = z.enum(CHANNELS);
export type Channel = z.infer<typeof ChannelSchema>;

export const ConfidenceLabelSchema = z.enum(["low", "moderate", "high"]);
export type ConfidenceLabel = z.infer<typeof ConfidenceLabelSchema>;

export const EffortLabelSchema = z.enum(["low", "medium", "high"]);
export type EffortLabel = z.infer<typeof EffortLabelSchema>;

/** 1 (easiest) – 5 (hardest). A relative execution-difficulty framework
 * assumption, not a measured time estimate. */
export const EffortLevelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export type EffortLevel = z.infer<typeof EffortLevelSchema>;

export const RecommendationSchema = z.enum([
  "recommended",
  "consider",
  "deprioritize",
]);
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const ImpactSchema = z.enum(["low", "medium", "high"]);
export type Impact = z.infer<typeof ImpactSchema>;

export const PrioritySchema = z.enum(["now", "next", "later"]);
export type Priority = z.infer<typeof PrioritySchema>;

/** "commit" — one channel clearly leads. "test" — the top options are close
 * enough, or the underlying analysis is uncertain enough, that committing to
 * one would manufacture false certainty. */
export const DecisionTypeSchema = z.enum(["commit", "test"]);
export type DecisionType = z.infer<typeof DecisionTypeSchema>;

// ---------------------------------------------------------------------------
// Per-channel result
// ---------------------------------------------------------------------------

export const ChannelResultSchema = z.object({
  channel: ChannelSchema,

  /** 0–100. Pure signal fit for this channel — market signals, product-fit
   * signals, problem signals and Gemini's own channel relevance, weighted
   * and blended by our framework. Independent of effort or confidence. */
  channelScore: z.number().int().min(0).max(100),

  /** 0–100. "How attractive is this channel for this product right now?"
   * channelScore tempered by confidence, effort and the founder's stated
   * constraints. This is the number the ranking is sorted by. */
  opportunityScore: z.number().int().min(0).max(100),

  /** Passed through from Phase 1's overall confidence — the reliability of
   * the analysis this score is built on, not a per-channel measurement. */
  confidence: z.number().int().min(0).max(100),
  confidenceLabel: ConfidenceLabelSchema,

  effort: EffortLevelSchema,
  effortLabel: EffortLabelSchema,

  recommendation: RecommendationSchema,

  /** Deterministically generated from the signals that drove channelScore —
   * never written by Gemini. */
  rationale: z.string(),

  /** Gemini's own raw signal for this channel, kept alongside the framework
   * score so the two are never confused with each other in the UI. */
  aiSignal: z.object({
    relevance: z.number().int().min(0).max(100),
    reasoning: z.string(),
  }),

  /** Set only when Website Intelligence was available and actually moved
   * this channel's opportunityScore (§10) — null otherwise. Never hidden:
   * this is exactly how much website evidence changed the number and why. */
  websiteAdjustment: z
    .object({
      delta: z.number().int(),
      reason: z.string(),
    })
    .nullable(),
});
export type ChannelResult = z.infer<typeof ChannelResultSchema>;

// ---------------------------------------------------------------------------
// Growth bottleneck (§11) — a website-based diagnosis, never a claim about
// actual funnel data we don't have.
// ---------------------------------------------------------------------------

export const BottleneckTypeSchema = z.enum([
  "acquisition",
  "positioning",
  "conversion",
  "technical",
  "unknown",
]);
export type BottleneckType = z.infer<typeof BottleneckTypeSchema>;

export const BottleneckSchema = z.object({
  type: BottleneckTypeSchema,
  reason: z.string(),
});
export type Bottleneck = z.infer<typeof BottleneckSchema>;

// ---------------------------------------------------------------------------
// Highest-leverage action (§12/§13)
//
// Two families of action share one shape: "pursue_<channel>" actions (the
// Phase 2 behavior — go run this acquisition channel) and website-fix
// actions ("improve_positioning", "fix_seo", ...) that the engine reaches
// for when Website Intelligence shows the site isn't ready to capitalize on
// an acquisition opportunity yet. `channel` is only set for the former.
// ---------------------------------------------------------------------------

export const CHANNEL_ACTION_TYPES = [
  "pursue_seo",
  "pursue_communities",
  "pursue_content",
  "pursue_social",
  "pursue_outbound",
  "pursue_partnerships",
  "pursue_paidAds",
  "pursue_referrals",
] as const;

export const WEBSITE_ACTION_TYPES = [
  "improve_positioning",
  "improve_cta",
  "improve_social_proof",
  "fix_seo",
  "improve_mobile",
  "improve_performance",
  "create_content",
] as const;

export const ActionTypeSchema = z.enum([
  ...CHANNEL_ACTION_TYPES,
  ...WEBSITE_ACTION_TYPES,
  "validate_channel",
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;
export type ChannelActionType = (typeof CHANNEL_ACTION_TYPES)[number];
export type WebsiteActionType = (typeof WEBSITE_ACTION_TYPES)[number];

export const HighestLeverageActionSchema = z.object({
  actionType: ActionTypeSchema,
  /** Set only when actionType is a "pursue_<channel>" action. */
  channel: ChannelSchema.nullable(),
  title: z.string(),
  reason: z.string(),
  /** Short, deterministic bullets — the evidence behind `reason`. */
  evidence: z.array(z.string()),
  expectedImpact: ImpactSchema,
  effort: EffortLevelSchema,
  effortLabel: EffortLabelSchema,
  opportunityScore: z.number().int().min(0).max(100),
  priority: PrioritySchema,
  decisionType: DecisionTypeSchema,
});
export type HighestLeverageAction = z.infer<typeof HighestLeverageActionSchema>;

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export const GrowthSummarySchema = z.object({
  topChannel: ChannelSchema,
  topOpportunityScore: z.number().int().min(0).max(100),
  confidence: z.number().int().min(0).max(100),
  confidenceLabel: ConfidenceLabelSchema,
  decisionType: DecisionTypeSchema,
  bottleneck: BottleneckTypeSchema,
});
export type GrowthSummary = z.infer<typeof GrowthSummarySchema>;

// ---------------------------------------------------------------------------
// Full Growth Intelligence result
// ---------------------------------------------------------------------------

export const GrowthIntelligenceSchema = z.object({
  /** Canonical order — matches Phase 1's channelSignals key order. */
  channels: z.array(ChannelResultSchema).length(CHANNELS.length),
  /** Same eight entries, sorted by opportunityScore descending. */
  rankedChannels: z.array(ChannelResultSchema).length(CHANNELS.length),
  bottleneck: BottleneckSchema,
  highestLeverageAction: HighestLeverageActionSchema,
  summary: GrowthSummarySchema,
});
export type GrowthIntelligence = z.infer<typeof GrowthIntelligenceSchema>;
