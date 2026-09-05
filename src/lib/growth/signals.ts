import type { ProductIntelligence } from "@/types/product";
import type { Channel } from "./types";
import { CHANNELS } from "./types";

// ---------------------------------------------------------------------------
// SignalBag — every Phase 1 number the scoring engine is allowed to read,
// flattened into one flat, named bag. Centralizing extraction here means
// `scoring.ts` never reaches back into the raw ProductIntelligence shape —
// if that shape changes, only this file needs to change with it.
// ---------------------------------------------------------------------------

export interface SignalBag {
  // -- marketSignals --
  searchIntent: number;
  communityPresence: number;
  visualContentPotential: number;
  wordOfMouthPotential: number;
  buyerAccessibility: number;
  marketMaturity: number;

  // -- productFitSignals --
  technicalAudienceFit: number;
  visualAudienceFit: number;
  communityAudienceFit: number;
  searchDrivenProblem: number;
  impulsePurchasePotential: number;
  salesLedPotential: number;
  /** Mean of every productFitSignals value — a generic "how well understood
   * is this product's fit" proxy, used by channels (partnerships, referrals)
   * whose framing doesn't map to one specific fit signal. */
  overallProductFit: number;

  // -- problem --
  painSeverity: number;
  urgency: number;
  frequency: number;
  willingnessToPay: number;

  // -- channelSignals[channel].relevance, keyed by channel --
  seoRelevance: number;
  communitiesRelevance: number;
  contentRelevance: number;
  socialRelevance: number;
  outboundRelevance: number;
  partnershipsRelevance: number;
  paidAdsRelevance: number;
  referralsRelevance: number;
}

export function extractSignalBag(pi: ProductIntelligence): SignalBag {
  const { marketSignals, productFitSignals, problem, channelSignals } = pi;

  const fitValues = [
    productFitSignals.technicalAudienceFit,
    productFitSignals.visualAudienceFit,
    productFitSignals.communityAudienceFit,
    productFitSignals.searchDrivenProblem,
    productFitSignals.impulsePurchasePotential,
    productFitSignals.salesLedPotential,
  ];
  const overallProductFit = mean(fitValues);

  return {
    searchIntent: marketSignals.searchIntent,
    communityPresence: marketSignals.communityPresence,
    visualContentPotential: marketSignals.visualContentPotential,
    wordOfMouthPotential: marketSignals.wordOfMouthPotential,
    buyerAccessibility: marketSignals.buyerAccessibility,
    marketMaturity: marketSignals.marketMaturity,

    technicalAudienceFit: productFitSignals.technicalAudienceFit,
    visualAudienceFit: productFitSignals.visualAudienceFit,
    communityAudienceFit: productFitSignals.communityAudienceFit,
    searchDrivenProblem: productFitSignals.searchDrivenProblem,
    impulsePurchasePotential: productFitSignals.impulsePurchasePotential,
    salesLedPotential: productFitSignals.salesLedPotential,
    overallProductFit,

    painSeverity: problem.painSeverity,
    urgency: problem.urgency,
    frequency: problem.frequency,
    willingnessToPay: problem.willingnessToPay,

    seoRelevance: channelSignals.seo.relevance,
    communitiesRelevance: channelSignals.communities.relevance,
    contentRelevance: channelSignals.content.relevance,
    socialRelevance: channelSignals.social.relevance,
    outboundRelevance: channelSignals.outbound.relevance,
    partnershipsRelevance: channelSignals.partnerships.relevance,
    paidAdsRelevance: channelSignals.paidAds.relevance,
    referralsRelevance: channelSignals.referrals.relevance,
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** channelSignals[channel].{relevance,reasoning} — kept separate from the
 * SignalBag because it's carried through to the output verbatim (as
 * `aiSignal`), not folded into a weighted formula. */
export function getChannelAiSignal(pi: ProductIntelligence, channel: Channel) {
  return pi.channelSignals[channel];
}

/** Every channel key, in the canonical order the Phase 1 schema declares
 * them — everything downstream (scoring, ranking, tests) iterates in this
 * order so output is stable and deterministic. */
export function channelKeys(): readonly Channel[] {
  return CHANNELS;
}

// ---------------------------------------------------------------------------
// Constraint classification
//
// growthContext/constraints are free-text strings from Gemini (the schema
// only hints at a vocabulary, it doesn't enforce one), so we classify them
// with plain keyword matching rather than assuming a fixed enum. Anything
// that doesn't clearly match a bucket is "unknown" — the scoring layer must
// treat unknown as neutral, never guess a direction. This is the boundary
// that keeps §9 honest: we only act on constraints the model actually gave.
// ---------------------------------------------------------------------------

export type BudgetLevel = "low" | "medium" | "high" | "unknown";
export type ExperienceLevel = "none" | "some" | "experienced" | "unknown";
export type UrgencyLevel = "urgent" | "moderate" | "patient" | "unknown";

const LOW_BUDGET_WORDS = [
  "no budget",
  "zero budget",
  "bootstrap",
  "shoestring",
  "very low",
  "minimal",
  "tight",
  "low budget",
  "$0",
  "none",
];
const HIGH_BUDGET_WORDS = [
  "well-funded",
  "well funded",
  "large budget",
  "significant budget",
  "substantial",
  "venture",
  "vc-backed",
  "vc backed",
  "high budget",
  "unlimited",
];

export function classifyBudgetLevel(text: string | undefined): BudgetLevel {
  const t = (text ?? "").toLowerCase();
  if (!t) return "unknown";
  if (matchesAny(t, HIGH_BUDGET_WORDS)) return "high";
  if (matchesAny(t, LOW_BUDGET_WORDS)) return "low";
  if (/\blow\b/.test(t)) return "low";
  if (/\bhigh\b/.test(t)) return "high";
  if (/\bmedium\b|\bmoderate\b/.test(t)) return "medium";
  return "unknown";
}

const NO_EXPERIENCE_WORDS = [
  "no experience",
  "none",
  "beginner",
  "first-time",
  "first time",
  "new to marketing",
  "solo founder",
  "never done marketing",
];
const EXPERIENCED_WORDS = [
  "expert",
  "experienced",
  "seasoned",
  "years of experience",
  "professional marketer",
  "advanced",
];

export function classifyMarketingExperience(
  text: string | undefined
): ExperienceLevel {
  const t = (text ?? "").toLowerCase();
  if (!t) return "unknown";
  if (matchesAny(t, EXPERIENCED_WORDS)) return "experienced";
  if (matchesAny(t, NO_EXPERIENCE_WORDS)) return "none";
  if (/\bintermediate\b|\bsome\b|\bmoderate\b/.test(t)) return "some";
  return "unknown";
}

const URGENT_WORDS = [
  "asap",
  "immediately",
  "urgent",
  "as soon as possible",
  "right away",
  "quickly",
  "days",
  "weeks",
  "30 days",
  "this month",
];
const PATIENT_WORDS = [
  "no rush",
  "long-term",
  "long term",
  "patient",
  "months",
  "quarters",
  "a year",
  "6 months",
  "12 months",
];

export function classifyTimeToResults(text: string | undefined): UrgencyLevel {
  const t = (text ?? "").toLowerCase();
  if (!t) return "unknown";
  if (matchesAny(t, URGENT_WORDS)) return "urgent";
  if (matchesAny(t, PATIENT_WORDS)) return "patient";
  return "unknown";
}

function matchesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}
