import type { ProductIntelligence } from "@/types/product";
import type { WebsiteIntelligence } from "@/types/website";
import { CHANNEL_WEIGHTS, confidenceLabelFor, effortLabelFor } from "./constants";
import {
  baseEffortFor,
  calculateChannelScore,
  calculateOpportunityScore,
  computeConstraintModifier,
  normalizeScore,
} from "./scoring";
import { channelKeys, extractSignalBag, getChannelAiSignal } from "./signals";
import {
  buildChannelRationale,
  buildSummary,
  rankChannels,
  recommendationFor,
  selectHighestLeverageAction,
} from "./strategy";
import { GrowthIntelligenceSchema, type ChannelResult, type GrowthIntelligence } from "./types";
import { computeWebsiteChannelModifier, detectBottleneck, extractWebsiteSignalBag } from "./website";

// ---------------------------------------------------------------------------
// The single entry point the API route calls.
//
//   Gemini → Product Intelligence (Phase 1, untouched)
//                    │
//                    ▼
//   Website evidence + Gemini interpretation (Phase 3, optional)
//                    │
//                    ▼
//        computeGrowthIntelligence()      <- this file
//                    │
//                    ▼
//         Growth Intelligence (Phase 2 + 3)
//
// Pure function: same inputs in, same output out, every time. No network
// calls, no randomness, no Gemini involvement — `websiteIntelligence` is
// already-computed evidence + interpretation by the time it reaches here.
// ---------------------------------------------------------------------------

export function computeGrowthIntelligence(
  productIntelligence: ProductIntelligence,
  websiteIntelligence: WebsiteIntelligence | null = null
): GrowthIntelligence {
  const bag = extractSignalBag(productIntelligence);
  const confidence = productIntelligence.confidence.overall;
  const confidenceLabel = confidenceLabelFor(confidence);
  const websiteBag = websiteIntelligence ? extractWebsiteSignalBag(websiteIntelligence) : null;

  const channels: ChannelResult[] = channelKeys().map((channel) => {
    const channelScore = calculateChannelScore(bag, channel);
    const effort = baseEffortFor(channel);
    const constraintModifier = computeConstraintModifier(
      channel,
      effort,
      productIntelligence.constraints
    );

    let opportunityScore = calculateOpportunityScore(
      channelScore,
      confidence,
      effort,
      constraintModifier
    );

    let websiteAdjustment: ChannelResult["websiteAdjustment"] = null;
    if (websiteBag) {
      const { multiplier, reason } = computeWebsiteChannelModifier(channel, websiteBag);
      if (multiplier !== 1 && reason) {
        const adjusted = normalizeScore(opportunityScore * multiplier);
        websiteAdjustment = { delta: adjusted - opportunityScore, reason };
        opportunityScore = adjusted;
      }
    }

    const recommendation = recommendationFor(opportunityScore);
    const rationale = buildChannelRationale(
      channel,
      bag,
      CHANNEL_WEIGHTS[channel],
      channelScore,
      recommendation
    );

    return {
      channel,
      channelScore,
      opportunityScore,
      confidence,
      confidenceLabel,
      effort,
      effortLabel: effortLabelFor(effort),
      recommendation,
      rationale,
      aiSignal: getChannelAiSignal(productIntelligence, channel),
      websiteAdjustment,
    };
  });

  const rankedChannels = rankChannels(channels);
  const bottleneck = detectBottleneck(rankedChannels, websiteIntelligence);
  const highestLeverageAction = selectHighestLeverageAction(
    rankedChannels,
    CHANNEL_WEIGHTS,
    bag,
    bottleneck,
    websiteIntelligence
  );
  const summary = buildSummary(rankedChannels, highestLeverageAction, bottleneck);

  const result: GrowthIntelligence = {
    channels,
    rankedChannels,
    bottleneck,
    highestLeverageAction,
    summary,
  };

  // Our own deterministic output, not an LLM response — but validating it
  // against the same schema the frontend types are derived from turns any
  // future regression (a dropped clamp, a bad rounding) into an immediate
  // thrown error instead of a silently malformed API response.
  return GrowthIntelligenceSchema.parse(result);
}
