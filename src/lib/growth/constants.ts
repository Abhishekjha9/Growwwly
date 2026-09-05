import type { SignalBag } from "./signals";
import type {
  Channel,
  ChannelActionType,
  EffortLevel,
  WebsiteActionType,
} from "./types";

// ---------------------------------------------------------------------------
// Every tunable number in the Growth Intelligence Engine lives here. Nothing
// in scoring.ts or strategy.ts should hardcode a weight, a threshold or a
// piece of channel-specific copy — that all belongs in this file so the
// framework can be retuned without touching the algorithm.
// ---------------------------------------------------------------------------

/** One term in a channel's weighted-score formula. */
export interface SignalWeight {
  signal: keyof SignalBag;
  weight: number;
}

/**
 * Per-channel weighted formulas. Each channel's weights sum to 1 — verified
 * by a unit test, not just this comment — so `calculateChannelScore` always
 * returns a 0–100 value without needing its own re-normalization step.
 *
 * These are the starting frameworks described in the Phase 2 spec, not
 * permanent formulas: retune the numbers here as real outcomes come in.
 */
export const CHANNEL_WEIGHTS: Record<Channel, SignalWeight[]> = {
  seo: [
    { signal: "searchIntent", weight: 0.3 },
    { signal: "seoRelevance", weight: 0.25 },
    { signal: "searchDrivenProblem", weight: 0.25 },
    { signal: "buyerAccessibility", weight: 0.1 },
    { signal: "marketMaturity", weight: 0.1 },
  ],
  communities: [
    { signal: "communityPresence", weight: 0.3 },
    { signal: "communitiesRelevance", weight: 0.25 },
    { signal: "communityAudienceFit", weight: 0.25 },
    { signal: "frequency", weight: 0.1 },
    { signal: "urgency", weight: 0.05 },
    { signal: "buyerAccessibility", weight: 0.05 },
  ],
  content: [
    { signal: "searchIntent", weight: 0.25 },
    { signal: "contentRelevance", weight: 0.2 },
    { signal: "searchDrivenProblem", weight: 0.2 },
    { signal: "technicalAudienceFit", weight: 0.075 },
    { signal: "visualAudienceFit", weight: 0.075 },
    { signal: "frequency", weight: 0.1 },
    { signal: "marketMaturity", weight: 0.1 },
  ],
  social: [
    { signal: "visualContentPotential", weight: 0.3 },
    { signal: "socialRelevance", weight: 0.25 },
    { signal: "visualAudienceFit", weight: 0.25 },
    { signal: "wordOfMouthPotential", weight: 0.1 },
    { signal: "impulsePurchasePotential", weight: 0.1 },
  ],
  outbound: [
    { signal: "buyerAccessibility", weight: 0.3 },
    { signal: "salesLedPotential", weight: 0.25 },
    { signal: "urgency", weight: 0.15 },
    { signal: "willingnessToPay", weight: 0.15 },
    { signal: "outboundRelevance", weight: 0.15 },
  ],
  partnerships: [
    { signal: "buyerAccessibility", weight: 0.3 },
    { signal: "partnershipsRelevance", weight: 0.3 },
    { signal: "marketMaturity", weight: 0.2 },
    { signal: "overallProductFit", weight: 0.2 },
  ],
  paidAds: [
    { signal: "buyerAccessibility", weight: 0.25 },
    { signal: "willingnessToPay", weight: 0.25 },
    { signal: "impulsePurchasePotential", weight: 0.2 },
    { signal: "marketMaturity", weight: 0.15 },
    { signal: "paidAdsRelevance", weight: 0.15 },
  ],
  referrals: [
    { signal: "wordOfMouthPotential", weight: 0.4 },
    { signal: "frequency", weight: 0.2 },
    { signal: "overallProductFit", weight: 0.2 },
    { signal: "referralsRelevance", weight: 0.2 },
  ],
};

/**
 * Base execution effort per channel — a relative framework assumption
 * (1 = easiest to start, 5 = hardest/most resource-intensive), not a
 * measured time-to-execute. Paid Ads sits highest because it is the only
 * channel here with a direct, ongoing cash cost on top of the work.
 */
export const CHANNEL_BASE_EFFORT: Record<Channel, EffortLevel> = {
  communities: 2,
  referrals: 2,
  seo: 3,
  content: 3,
  social: 3,
  outbound: 4,
  partnerships: 4,
  paidAds: 5,
};

/** effort 1–2 reads as "low", 3 as "medium", 4–5 as "high". */
export function effortLabelFor(effort: EffortLevel): "low" | "medium" | "high" {
  if (effort <= 2) return "low";
  if (effort === 3) return "medium";
  return "high";
}

/**
 * Effort's drag on Opportunity Score. `opportunityScore` implements the
 * spec's "÷ Effort" as a bounded multiplier instead of a raw division —
 * division could send the score above 100 or toward zero depending on
 * scale, where this keeps every factor in a predictable, composable range.
 */
export const EFFORT_MULTIPLIER: Record<EffortLevel, number> = {
  1: 1.15,
  2: 1.08,
  3: 1.0,
  4: 0.9,
  5: 0.8,
};

/** confidence >= HIGH -> "high"; >= MODERATE -> "moderate"; else "low". */
export const CONFIDENCE_THRESHOLDS = {
  high: 70,
  moderate: 40,
};

export function confidenceLabelFor(
  confidence: number
): "low" | "moderate" | "high" {
  if (confidence >= CONFIDENCE_THRESHOLDS.high) return "high";
  if (confidence >= CONFIDENCE_THRESHOLDS.moderate) return "moderate";
  return "low";
}

/**
 * Confidence's drag on Opportunity Score. Low confidence tempers the score —
 * per §6 it must never destroy it, so the floor is 0.6, not 0. A confidence
 * of 0 still keeps 60% of the channel's fit-based score; a confidence of 100
 * keeps all of it.
 */
export const CONFIDENCE_FACTOR_FLOOR = 0.6;
export const CONFIDENCE_FACTOR_RANGE = 1 - CONFIDENCE_FACTOR_FLOOR;

export function confidenceFactorFor(confidence: number): number {
  return CONFIDENCE_FACTOR_FLOOR + CONFIDENCE_FACTOR_RANGE * (confidence / 100);
}

/**
 * Recommendation tier thresholds, applied to opportunityScore.
 * >= recommended -> "recommended"; >= consider -> "consider"; else
 * "deprioritize".
 */
export const RECOMMENDATION_THRESHOLDS = {
  recommended: 60,
  consider: 35,
};

/** expectedImpact thresholds, applied to channelScore. */
export const IMPACT_THRESHOLDS = {
  high: 70,
  medium: 40,
};

/** priority thresholds, applied to opportunityScore. */
export const PRIORITY_THRESHOLDS = {
  now: 70,
  next: 40,
};

/**
 * If the top two opportunityScores are within this many points of each
 * other, the engine refuses to manufacture a confident single winner and
 * returns `decisionType: "test"` instead (§13).
 */
export const CLOSE_CALL_MARGIN = 5;

// ---------------------------------------------------------------------------
// Constraint modifiers (§9) — small, bounded nudges to opportunityScore
// based on the founder's own stated budget, experience and urgency. Only
// applied when the constraint text actually classifies to a direction;
// "unknown" always means "no adjustment" (see signals.ts).
// ---------------------------------------------------------------------------

export const CONSTRAINT_MODIFIER_BOUNDS = { min: 0.7, max: 1.15 };

/** Channels this low a base effort are treated as "resource-heavy" by the
 * constraint rules below (outbound, partnerships, paidAds). */
export const RESOURCE_HEAVY_EFFORT = 4;

export const BUDGET_MODIFIER = {
  lowBudgetHeavyChannel: 0.75,
  highBudgetHeavyChannel: 1.08,
};

export const EXPERIENCE_MODIFIER = {
  /** Channels that lean on marketing/sales craft — outbound and paid ads. */
  noExperiencePenalty: 0.8,
  experiencedBonus: 1.1,
};

export const URGENCY_MODIFIER = {
  urgentHeavyChannelPenalty: 0.85,
};

// ---------------------------------------------------------------------------
// Highest-leverage action copy — a short, deterministic title per channel.
// The `reason` text is still generated from the actual signals (strategy.ts);
// this is only the headline action statement.
// ---------------------------------------------------------------------------

export const ACTION_TITLES: Record<Channel, string> = {
  seo: "Build search-driven landing pages",
  communities: "Show up where your buyers already discuss this problem",
  content: "Publish comparison and how-to content for search discovery",
  social: "Create visual, shareable content around the product",
  outbound: "Directly reach your most accessible buyers",
  partnerships: "Explore partnerships with adjacent tools your buyers use",
  paidAds: "Test paid acquisition against a narrow, high-intent audience",
  referrals: "Build a lightweight referral loop to capture word of mouth",
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  seo: "SEO",
  communities: "Communities",
  content: "Content",
  social: "Social",
  outbound: "Outbound",
  partnerships: "Partnerships",
  paidAds: "Paid ads",
  referrals: "Referrals",
};

/** "SEO" for a pursue_seo action, "Website" for a website-fix action. Used
 * anywhere the UI needs one label for either family of action. */
export function actionSubjectLabel(channel: Channel | null): string {
  return channel ? CHANNEL_LABELS[channel] : "Website";
}

export const CHANNEL_ACTION_TYPE: Record<Channel, ChannelActionType> = {
  seo: "pursue_seo",
  communities: "pursue_communities",
  content: "pursue_content",
  social: "pursue_social",
  outbound: "pursue_outbound",
  partnerships: "pursue_partnerships",
  paidAds: "pursue_paidAds",
  referrals: "pursue_referrals",
};

// ---------------------------------------------------------------------------
// Phase 3 — Website Intelligence feeding the Growth Engine (§10/§11/§12).
//
// Nothing below asks Gemini for a score. `technicalHealthScore`,
// `positioningScore`, `conversionScore` and `contentFoundationScore` are all
// computed deterministically in `growth/website.ts` from Website
// Intelligence's own facts and AI-interpretation fields (which are
// themselves 0–100 model estimates, not measurements — see
// `src/lib/website/types.ts`). These constants only govern how those
// composite scores translate into bottleneck decisions and channel-score
// modifiers.
// ---------------------------------------------------------------------------

/** Thresholds `detectBottleneck` compares composite website scores against.
 * Framework assumptions, tuned for a first pass — not derived from data. */
export const BOTTLENECK_THRESHOLDS = {
  /** A channelScore at or above this is "strong enough that a website
   * problem would actually be wasting the opportunity." */
  strongAcquisition: 65,
  /** Below this, acquisition itself — not the website — is the limiting
   * factor, regardless of website quality. */
  weakAcquisition: 40,
  weakTechnical: 50,
  weakPositioning: 45,
  weakConversion: 45,
};

/** Below this, Gemini's own confidence in its website interpretation is too
 * low to justify overriding a channel-pursuit action with a website-fix one
 * — the diagnosis itself might be wrong, not just the website. */
export const WEBSITE_CONFIDENCE_LOW_THRESHOLD = 40;

/** Weights for the deterministic `technicalHealthScore` blend in
 * growth/website.ts. Lighthouse's measured SEO score dominates when
 * available; the rest are our own Cheerio-measured facts, re-normalized
 * over whatever subset is actually available if Lighthouse is not. */
export const TECHNICAL_HEALTH_WEIGHTS = {
  title: 0.15,
  metaDescription: 0.15,
  headingStructure: 0.15,
  imageAltCoverage: 0.1,
  structuredData: 0.1,
  lighthouseSeo: 0.35,
};

/** `contentFoundationScore` proxy: homepage word count, capped and scaled.
 * A single-page word count is a weak signal for "content marketing
 * foundation" — this is explicitly a rough heuristic, not a content audit. */
export const CONTENT_FOUNDATION_WORDS_FOR_MAX_SCORE = 800;

/** Multiplier bounds for website-driven channel-score adjustments — kept in
 * the same range as the Phase 2 constraint modifier for consistency. */
export const WEBSITE_MODIFIER_BOUNDS = { min: 0.7, max: 1.15 };

export const SEO_WEBSITE_MODIFIER = {
  strongTechnicalHealth: 75,
  weakTechnicalHealth: 45,
  strongMultiplier: 1.08,
  weakMultiplier: 0.75,
};

export const CONTENT_WEBSITE_MODIFIER = {
  weakPositioning: 45,
  strongFoundationAndPositioning: 60,
  weakMultiplier: 0.8,
  strongMultiplier: 1.05,
};

/** Effort for website-fix actions — same 1–5 framework as channel effort. */
export const WEBSITE_ACTION_EFFORT: Record<WebsiteActionType, EffortLevel> = {
  improve_positioning: 2,
  improve_cta: 1,
  improve_social_proof: 2,
  fix_seo: 2,
  improve_mobile: 3,
  improve_performance: 3,
  create_content: 3,
};

export const WEBSITE_ACTION_TITLES: Record<WebsiteActionType, string> = {
  improve_positioning: "Clarify your homepage value proposition",
  improve_cta: "Make your primary call-to-action unmistakable",
  improve_social_proof: "Add credible trust signals and social proof",
  fix_seo: "Fix on-page technical SEO fundamentals",
  improve_mobile: "Fix mobile layout and navigation issues",
  improve_performance: "Improve page load performance",
  create_content: "Build out supporting content on your site",
};

/** Human-readable label for the signals used in rationale generation. */
export const SIGNAL_LABELS: Partial<Record<keyof SignalBag, string>> = {
  searchIntent: "search intent",
  communityPresence: "community presence",
  visualContentPotential: "visual content potential",
  wordOfMouthPotential: "word-of-mouth potential",
  buyerAccessibility: "buyer accessibility",
  marketMaturity: "market maturity",
  technicalAudienceFit: "technical audience fit",
  visualAudienceFit: "visual audience fit",
  communityAudienceFit: "community audience fit",
  searchDrivenProblem: "search-driven problem fit",
  impulsePurchasePotential: "impulse-purchase potential",
  salesLedPotential: "sales-led potential",
  overallProductFit: "overall product fit",
  painSeverity: "pain severity",
  urgency: "urgency",
  frequency: "problem frequency",
  willingnessToPay: "willingness to pay",
  seoRelevance: "SEO channel relevance",
  communitiesRelevance: "communities channel relevance",
  contentRelevance: "content channel relevance",
  socialRelevance: "social channel relevance",
  outboundRelevance: "outbound channel relevance",
  partnershipsRelevance: "partnerships channel relevance",
  paidAdsRelevance: "paid ads channel relevance",
  referralsRelevance: "referrals channel relevance",
};
