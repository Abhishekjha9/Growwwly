/**
 * Re-export all Growth Opportunity Feed types from the canonical Zod schemas
 * in `@/lib/opportunities`. Other modules should import types from here
 * rather than reaching directly into the opportunities module — same
 * convention as `@/types/product`, `@/types/growth`, and `@/types/website`.
 */
export type {
  IntentSignalType,
  Opportunity,
  RawOpportunity,
  SearchAngle,
  SearchIntent,
  SourceType,
} from "@/lib/opportunities/types";
