import type { ProductIntelligence } from "@/types/product";
import {
  BUDGET_MODIFIER,
  CHANNEL_BASE_EFFORT,
  CHANNEL_WEIGHTS,
  CONSTRAINT_MODIFIER_BOUNDS,
  EFFORT_MULTIPLIER,
  EXPERIENCE_MODIFIER,
  RESOURCE_HEAVY_EFFORT,
  URGENCY_MODIFIER,
  confidenceFactorFor,
  type SignalWeight,
} from "./constants";
import {
  classifyBudgetLevel,
  classifyMarketingExperience,
  classifyTimeToResults,
  type SignalBag,
} from "./signals";
import type { Channel, EffortLevel } from "./types";

// ---------------------------------------------------------------------------
// Pure, deterministic scoring math. No randomness, no I/O, no Gemini calls —
// every function here returns the same output for the same input, every
// time. That determinism is what makes the engine trustworthy: the model
// only ever supplies signals, this file turns signals into numbers.
// ---------------------------------------------------------------------------

export function clampScore(n: number): number {
  return Math.min(100, Math.max(0, n));
}

/** Round to an integer and clamp to 0–100 — the shape every score in the
 * Phase 2 output is normalized to. */
export function normalizeScore(n: number): number {
  return Math.round(clampScore(n));
}

/** Sum of `signal * weight` across a weight table. Callers are responsible
 * for supplying weights that sum to 1 if they want a 0–100-scaled result —
 * `CHANNEL_WEIGHTS` is verified to do so by a unit test. */
export function calculateWeightedScore(
  bag: SignalBag,
  weights: SignalWeight[]
): number {
  return weights.reduce((total, { signal, weight }) => {
    return total + bag[signal] * weight;
  }, 0);
}

/** The channel's pure signal-fit score (0–100) — market signals, product-fit
 * signals, problem signals and Gemini's own channel relevance, blended by
 * the weighted framework in `CHANNEL_WEIGHTS`. Independent of confidence,
 * effort and constraints; those apply at the opportunity-score layer. */
export function calculateChannelScore(bag: SignalBag, channel: Channel): number {
  const weights = CHANNEL_WEIGHTS[channel];
  return normalizeScore(calculateWeightedScore(bag, weights));
}

// ---------------------------------------------------------------------------
// Constraints (§9) — nudge opportunity, never fabricate a direction the
// model didn't actually give us.
// ---------------------------------------------------------------------------

export function computeConstraintModifier(
  channel: Channel,
  effort: EffortLevel,
  constraints: ProductIntelligence["constraints"]
): number {
  let modifier = 1;
  const isResourceHeavy = effort >= RESOURCE_HEAVY_EFFORT;
  const isSalesCraftChannel = channel === "outbound" || channel === "paidAds";

  const budget = classifyBudgetLevel(constraints.budgetLevel);
  if (isResourceHeavy) {
    if (budget === "low") modifier *= BUDGET_MODIFIER.lowBudgetHeavyChannel;
    else if (budget === "high") modifier *= BUDGET_MODIFIER.highBudgetHeavyChannel;
  }

  if (isSalesCraftChannel) {
    const experience = classifyMarketingExperience(constraints.marketingExperience);
    if (experience === "none") modifier *= EXPERIENCE_MODIFIER.noExperiencePenalty;
    else if (experience === "experienced") modifier *= EXPERIENCE_MODIFIER.experiencedBonus;
  }

  const urgency = classifyTimeToResults(constraints.timeToResultsRequired);
  if (urgency === "urgent" && isResourceHeavy) {
    modifier *= URGENCY_MODIFIER.urgentHeavyChannelPenalty;
  }

  return Math.min(
    CONSTRAINT_MODIFIER_BOUNDS.max,
    Math.max(CONSTRAINT_MODIFIER_BOUNDS.min, modifier)
  );
}

// ---------------------------------------------------------------------------
// Opportunity score (§8) — "how attractive is this channel for this product
// right now?" Conceptually Impact × Confidence × Fit ÷ Effort: `channelScore`
// already carries the product/market fit signals (Impact × Fit), so this
// layers confidence, effort and constraints on top of it rather than
// re-multiplying the same fit signals in a second term.
// ---------------------------------------------------------------------------

export function calculateOpportunityScore(
  channelScore: number,
  confidence: number,
  effort: EffortLevel,
  constraintModifier: number
): number {
  const raw =
    channelScore *
    confidenceFactorFor(confidence) *
    EFFORT_MULTIPLIER[effort] *
    constraintModifier;
  return normalizeScore(raw);
}

export function baseEffortFor(channel: Channel): EffortLevel {
  return CHANNEL_BASE_EFFORT[channel];
}
