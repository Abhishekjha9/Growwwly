import type { Channel } from "@/lib/growth/types";
import type { IntentSignalType, SourceType } from "./types";

// ---------------------------------------------------------------------------
// Every tunable number and piece of copy for Growth Opportunity Discovery
// lives here — same convention as `@/lib/growth/constants`. OpenAI supplies
// raw per-opportunity signals only; everything that turns those signals into
// a final score, a label, or a ranking decision reads its numbers from this
// file, never from an inline magic number.
// ---------------------------------------------------------------------------

/** How many targeted search angles we build from Product + Growth
 * Intelligence. Fixed at 6 — "approximately 4-6 targeted searches", never a
 * runaway number of OpenAI-driven web searches per angle. */
export const SEARCH_ANGLES_COUNT = 6;

/** Upper bound on how many raw opportunities we'll even attempt to validate
 * from a single OpenAI response — a guardrail against a runaway generation,
 * not a target. */
export const MAX_RAW_OPPORTUNITIES = 30;

/** The feed never shows more than this many opportunities. */
export const MAX_OPPORTUNITIES_RETURNED = 10;

// ---------------------------------------------------------------------------
// Growwwly Opportunity Score — computed entirely in code (`rank.ts`).
// OpenAI never produces this number, only the five raw signals it's built
// from. Weights sum to 1 — verified by a unit test, not just this comment.
// ---------------------------------------------------------------------------

export const OPPORTUNITY_SCORE_WEIGHTS = {
  relevance: 0.3,
  audienceMatch: 0.2,
  problemIntent: 0.2,
  freshness: 0.1,
  productAlignment: 0.2,
} as const;

/** `opportunityScore` at or above this is surfaced as "HIGH OPPORTUNITY" in
 * the UI and matches the "High Opportunity" filter. */
export const HIGH_OPPORTUNITY_THRESHOLD = 75;

/** A discussion this many days old or newer matches the "Recent" filter. */
export const RECENT_WITHIN_DAYS = 14;

// ---------------------------------------------------------------------------
// Freshness — the only signal computed from a fact (how old the discussion
// is) rather than passed through from OpenAI's own estimate. OpenAI may
// supply `estimatedDaysAgo` when a search result exposes a date; when it
// doesn't, freshness reads as unknown/low rather than guessed.
// ---------------------------------------------------------------------------

export const FRESHNESS_THRESHOLDS: ReadonlyArray<{ withinDays: number; score: number }> = [
  { withinDays: 3, score: 100 },
  { withinDays: 14, score: 85 },
  { withinDays: 60, score: 60 },
  { withinDays: 180, score: 35 },
];

/** Used when OpenAI could not estimate an age for the discussion at all. */
export const FRESHNESS_UNKNOWN_SCORE = 20;

// ---------------------------------------------------------------------------
// Copy — source types, intent signals, suggested actions. Deterministic
// labels only; the narrative "reason" text stays OpenAI's own, same as
// `aiSignal.reasoning` in Growth Intelligence.
// ---------------------------------------------------------------------------

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  reddit: "Reddit",
  hacker_news: "Hacker News",
  forum: "Forum",
  article: "Article",
  discussion: "Discussion",
  other: "Other",
};

export const INTENT_SIGNAL_LABELS: Record<IntentSignalType, string> = {
  seeking_solution: "Actively seeking a solution",
  evaluating_alternatives: "Evaluating alternatives",
  describing_pain: "Describing this exact pain point",
  seeking_recommendation: "Asking for a recommendation",
  comparing_tools: "Comparing tools",
  asking_implementation_question: "Asking an implementation question",
};

/** A short, deterministic next step per source type — never "auto reply". */
export const SUGGESTED_ACTION_BY_SOURCE_TYPE: Record<SourceType, string> = {
  reddit: "Reply with a helpful, contextual comment",
  hacker_news: "Reply with a helpful, contextual comment",
  forum: "Reply with a helpful, contextual comment",
  discussion: "Join the conversation with a useful reply",
  article: "Consider a thoughtful comment, or reach out transparently",
  other: "Review the source and consider a genuine, useful reply",
};

/** Preferred source types per highest-leverage channel — used only to bias
 * the search prompt toward the right kind of venue, never as a scoring
 * factor (the Opportunity Score formula above is the only ranking math). */
export const CHANNEL_SOURCE_TYPE_HINTS: Record<Channel, SourceType[]> = {
  communities: ["reddit", "hacker_news", "forum", "discussion"],
  content: ["article", "forum", "discussion"],
  seo: ["article", "forum", "discussion"],
  social: ["discussion", "forum", "article"],
  outbound: ["discussion", "forum", "article"],
  partnerships: ["article", "discussion"],
  paidAds: ["discussion", "forum", "article"],
  referrals: ["discussion", "forum", "reddit"],
};
