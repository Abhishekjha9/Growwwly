/**
 * Re-export all Growth Intelligence (Phase 2) types from the canonical Zod
 * schemas in `@/lib/growth`. Other modules should import types from here
 * rather than reaching directly into the engine — same convention as
 * `@/types/product` for Phase 1.
 */
export type {
  Channel,
  ChannelResult,
  ConfidenceLabel,
  DecisionType,
  EffortLabel,
  EffortLevel,
  GrowthIntelligence,
  GrowthSummary,
  HighestLeverageAction,
  Impact,
  Priority,
  Recommendation,
} from "@/lib/growth/types";

export { CHANNELS } from "@/lib/growth/types";
