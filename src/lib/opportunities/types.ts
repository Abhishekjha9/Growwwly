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
// Product + Growth Intelligence (see `search.ts`). Not a literal query
// string sent to an API: OpenAI's web_search tool chooses its
// own actual search queries, so these angles are prompt guidance the model
// is instructed to cover, not a controllable query list.
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
   * directly in the OpenAI prompt. */
  description: string;
}
