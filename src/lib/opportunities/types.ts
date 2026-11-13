import { z } from "zod";
import type {
  IntentSignalTypeSchema,
  OpportunityDiscoveryRequest,
  Opportunity,
  RawOpportunity,
  SourceTypeSchema,
} from "./schemas";

export type SourceType = z.infer<typeof SourceTypeSchema>;
export type IntentSignalType = z.infer<typeof IntentSignalTypeSchema>;
export type { Opportunity, RawOpportunity, OpportunityDiscoveryRequest };

// ---------------------------------------------------------------------------
// SearchIntent — a single targeted search angle built deterministically from
// Product + Growth Intelligence (see `search.ts`). `buildDiscoveryQueries`
// turns at most three of these into the literal, deterministic queries sent
// to the search provider; the description is also shown to the AI as
// context for why each result was found.
// ---------------------------------------------------------------------------

export const SEARCH_ANGLES = [
  "problem_discussion",
  "category_alternatives",
  "pain_complaint",
  "seeking_recommendation",
  "comparison",
  "implementation_question",
] as const;

export type SearchAngle = (typeof SEARCH_ANGLES)[number];

export interface SearchIntent {
  angle: SearchAngle;
  /** A short, human-readable description of what to search for — embedded
   * directly in the AI prompt. */
  description: string;
}
