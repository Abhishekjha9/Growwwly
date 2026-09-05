import {
  ACTION_TITLES,
  CHANNEL_ACTION_TYPE,
  CHANNEL_LABELS,
  CLOSE_CALL_MARGIN,
  IMPACT_THRESHOLDS,
  PRIORITY_THRESHOLDS,
  RECOMMENDATION_THRESHOLDS,
  SIGNAL_LABELS,
  WEBSITE_ACTION_EFFORT,
  WEBSITE_ACTION_TITLES,
  confidenceLabelFor,
  effortLabelFor,
  type SignalWeight,
} from "./constants";
import type { SignalBag } from "./signals";
import { extractWebsiteSignalBag, type WebsiteSignalBag } from "./website";
import type {
  Bottleneck,
  Channel,
  ChannelResult,
  DecisionType,
  GrowthSummary,
  HighestLeverageAction,
  Impact,
  Priority,
  Recommendation,
  WebsiteActionType,
} from "./types";
import type { WebsiteIntelligence } from "@/types/website";

// ---------------------------------------------------------------------------
// The decision layer. Scoring produces numbers; this module turns those
// numbers into the labels, ranking and single recommended action a founder
// actually reads. Still fully deterministic — no Gemini calls here either.
// ---------------------------------------------------------------------------

export function recommendationFor(opportunityScore: number): Recommendation {
  if (opportunityScore >= RECOMMENDATION_THRESHOLDS.recommended) return "recommended";
  if (opportunityScore >= RECOMMENDATION_THRESHOLDS.consider) return "consider";
  return "deprioritize";
}

export function impactFor(channelScore: number): Impact {
  if (channelScore >= IMPACT_THRESHOLDS.high) return "high";
  if (channelScore >= IMPACT_THRESHOLDS.medium) return "medium";
  return "low";
}

export function priorityFor(opportunityScore: number): Priority {
  if (opportunityScore >= PRIORITY_THRESHOLDS.now) return "now";
  if (opportunityScore >= PRIORITY_THRESHOLDS.next) return "next";
  return "later";
}

/** Every weighted term's actual contribution (signal × weight), sorted by
 * size — the basis for both rationale sentences and evidence bullets. */
function rankContributions(bag: SignalBag, weights: SignalWeight[]) {
  return weights
    .map((w) => ({
      signal: w.signal,
      value: bag[w.signal],
      contribution: bag[w.signal] * w.weight,
      label: SIGNAL_LABELS[w.signal] ?? String(w.signal),
    }))
    .sort((a, b) => b.contribution - a.contribution);
}

/** A deterministic sentence explaining why a channel scored the way it did,
 * built from its top contributing signals — never from Gemini's prose. */
export function buildChannelRationale(
  channel: Channel,
  bag: SignalBag,
  weights: SignalWeight[],
  channelScore: number,
  recommendation: Recommendation
): string {
  const ranked = rankContributions(bag, weights);
  const top = ranked.slice(0, 2);
  const weak = ranked[ranked.length - 1];

  const label = CHANNEL_LABELS[channel];

  if (recommendation === "deprioritize") {
    return `${label} scores low here mainly because of weak ${weak.label} (${weak.value}/100) and ${top[0].label} (${top[0].value}/100) — the framework doesn't see a strong basis for this channel yet.`;
  }

  const lead = top
    .map((t) => `${t.label} (${t.value}/100)`)
    .join(" and ");

  const tier = channelScore >= IMPACT_THRESHOLDS.high ? "a strong" : "a moderate";
  return `${lead} give ${label} ${tier} fit for this product.`;
}

/** Sort by opportunityScore desc; ties broken by channelScore desc, then by
 * channel name — so the ranking is fully deterministic even on exact ties. */
export function rankChannels(channels: ChannelResult[]): ChannelResult[] {
  return [...channels].sort((a, b) => {
    if (b.opportunityScore !== a.opportunityScore) {
      return b.opportunityScore - a.opportunityScore;
    }
    if (b.channelScore !== a.channelScore) {
      return b.channelScore - a.channelScore;
    }
    return a.channel.localeCompare(b.channel);
  });
}

function evidenceFor(
  channel: Channel,
  bag: SignalBag,
  weights: SignalWeight[]
): string[] {
  const ranked = rankContributions(bag, weights);
  const top = ranked.slice(0, 3);
  return top.map((t) => `${t.label[0].toUpperCase()}${t.label.slice(1)} is ${t.value}/100.`);
}

/**
 * The Phase 2 path: pick the best acquisition channel to pursue. Refuses to
 * manufacture certainty (§13 of Phase 2): if the top two opportunity scores
 * are within `CLOSE_CALL_MARGIN` points, or overall confidence is "low",
 * the action is still returned (the founder still needs somewhere to
 * start) but `decisionType` is "test" instead of "commit".
 */
function buildChannelAction(
  ranked: ChannelResult[],
  channelWeights: Record<Channel, SignalWeight[]>,
  bag: SignalBag
): HighestLeverageAction {
  const top = ranked[0];
  const runnerUp = ranked[1];

  const isCloseCall =
    runnerUp !== undefined &&
    top.opportunityScore - runnerUp.opportunityScore <= CLOSE_CALL_MARGIN;
  const isLowConfidence = top.confidenceLabel === "low";
  const decisionType: DecisionType = isCloseCall || isLowConfidence ? "test" : "commit";

  const evidence = evidenceFor(top.channel, bag, channelWeights[top.channel]);
  if (top.websiteAdjustment) evidence.push(top.websiteAdjustment.reason);

  let reason = `${CHANNEL_LABELS[top.channel]} currently has the highest opportunity score (${top.opportunityScore}/100) of the eight channels evaluated.`;
  if (isCloseCall) {
    reason += ` ${CHANNEL_LABELS[runnerUp.channel]} is close behind (${runnerUp.opportunityScore}/100), so this is worth testing rather than committing to fully.`;
  } else if (isLowConfidence) {
    reason += ` Confidence in this analysis is low, so treat this as a starting hypothesis to validate, not a settled decision.`;
  } else {
    reason += ` It is the current highest-leverage option based on the signals available.`;
  }
  if (top.websiteAdjustment) {
    reason += ` ${top.websiteAdjustment.reason}`;
  }

  return {
    actionType: CHANNEL_ACTION_TYPE[top.channel],
    channel: top.channel,
    title: ACTION_TITLES[top.channel],
    reason,
    evidence,
    expectedImpact: impactFor(top.channelScore),
    effort: top.effort,
    effortLabel: effortLabelFor(top.effort),
    opportunityScore: top.opportunityScore,
    priority: priorityFor(top.opportunityScore),
    decisionType,
  };
}

/**
 * The Phase 3 override: when Website Intelligence shows the site itself is
 * the limiting factor, the highest-leverage action becomes fixing that,
 * not pursuing more of a channel the site can't yet convert. Which specific
 * website-fix action is picked is itself deterministic — based on which
 * evidenced sub-signal is weakest — never chosen by Gemini.
 */
function buildWebsiteFixAction(
  bottleneck: Bottleneck,
  websiteBag: WebsiteSignalBag,
  website: WebsiteIntelligence,
  topChannel: ChannelResult
): HighestLeverageAction {
  const interp = website.interpretation;
  let actionType: WebsiteActionType;
  let evidence: string[];

  if (bottleneck.type === "positioning" && interp) {
    actionType = "improve_positioning";
    evidence = [
      `Target-customer clarity is ${interp.positioning.targetCustomerClarity}/100.`,
      `Problem clarity is ${interp.positioning.problemClarity}/100.`,
      `${CHANNEL_LABELS[topChannel.channel]} opportunity score is ${topChannel.opportunityScore}/100 — acquisition potential currently exceeds what the homepage can convert.`,
    ];
  } else if (bottleneck.type === "conversion" && interp) {
    actionType = websiteBag.ctaScore <= interp.conversion.trustSignalStrength ? "improve_cta" : "improve_social_proof";
    evidence = [
      `CTA clarity is ${websiteBag.ctaScore}/100.`,
      `Trust-signal strength is ${interp.conversion.trustSignalStrength}/100.`,
      `Social-proof strength is ${interp.conversion.socialProofStrength}/100.`,
    ];
  } else {
    // technical
    const lighthouseSeo = website.performance.status === "measured" ? website.performance.seo : null;
    const lighthousePerf = website.performance.status === "measured" ? website.performance.performance : null;
    const mobileClarity = interp?.mobile.mobileHierarchyClarity ?? null;

    const candidates: Array<{ type: WebsiteActionType; score: number | null }> = [
      { type: "fix_seo", score: lighthouseSeo },
      { type: "improve_performance", score: lighthousePerf },
      { type: "improve_mobile", score: mobileClarity },
    ];
    const scored = candidates.filter((c): c is { type: WebsiteActionType; score: number } => c.score !== null);
    actionType = scored.length > 0
      ? scored.sort((a, b) => a.score - b.score)[0].type
      : "fix_seo";

    evidence = [
      `Website technical health is ${websiteBag.technicalHealthScore}/100.`,
      lighthouseSeo !== null ? `Lighthouse SEO score is ${lighthouseSeo}/100.` : `Lighthouse could not run for this site.`,
      `${CHANNEL_LABELS[topChannel.channel]} opportunity score is ${topChannel.opportunityScore}/100 — worth protecting with a healthier site.`,
    ];
  }

  return {
    actionType,
    channel: null,
    title: WEBSITE_ACTION_TITLES[actionType],
    reason: bottleneck.reason,
    evidence,
    expectedImpact: "high",
    effort: WEBSITE_ACTION_EFFORT[actionType],
    effortLabel: effortLabelFor(WEBSITE_ACTION_EFFORT[actionType]),
    opportunityScore: topChannel.opportunityScore,
    priority: "now",
    decisionType: "commit",
  };
}

/**
 * Picks the single highest-leverage action (§12). When Website Intelligence
 * shows a positioning/conversion/technical bottleneck sitting in front of a
 * genuinely strong acquisition opportunity, the action becomes fixing the
 * website; otherwise it falls back to the Phase 2 channel-pursuit logic.
 * Gemini never makes this decision — it only supplies the interpretation
 * `detectBottleneck` and this function read.
 */
export function selectHighestLeverageAction(
  ranked: ChannelResult[],
  channelWeights: Record<Channel, SignalWeight[]>,
  bag: SignalBag,
  bottleneck: Bottleneck,
  website: WebsiteIntelligence | null
): HighestLeverageAction {
  const websiteBag = website ? extractWebsiteSignalBag(website) : null;

  if (
    website &&
    websiteBag &&
    (bottleneck.type === "positioning" || bottleneck.type === "conversion" || bottleneck.type === "technical")
  ) {
    return buildWebsiteFixAction(bottleneck, websiteBag, website, ranked[0]);
  }

  return buildChannelAction(ranked, channelWeights, bag);
}

export function buildSummary(
  ranked: ChannelResult[],
  action: HighestLeverageAction,
  bottleneck: Bottleneck
): GrowthSummary {
  const top = ranked[0];
  return {
    topChannel: top.channel,
    topOpportunityScore: top.opportunityScore,
    confidence: top.confidence,
    confidenceLabel: confidenceLabelFor(top.confidence),
    decisionType: action.decisionType,
    bottleneck: bottleneck.type,
  };
}
