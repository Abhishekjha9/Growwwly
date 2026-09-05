import type { WebsiteIntelligence } from "@/types/website";
import {
  BOTTLENECK_THRESHOLDS,
  CONTENT_FOUNDATION_WORDS_FOR_MAX_SCORE,
  CONTENT_WEBSITE_MODIFIER,
  SEO_WEBSITE_MODIFIER,
  TECHNICAL_HEALTH_WEIGHTS,
  WEBSITE_CONFIDENCE_LOW_THRESHOLD,
  WEBSITE_MODIFIER_BOUNDS,
} from "./constants";
import { clampScore, normalizeScore } from "./scoring";
import type { Bottleneck, Channel, ChannelResult } from "./types";

// ---------------------------------------------------------------------------
// The one-way bridge from Website Intelligence (Phase 3, external tools +
// Gemini interpretation) into the Growth Engine (Phase 2, deterministic
// TypeScript). The website module has no knowledge this file exists —
// dependencies only flow this direction.
//
// Every composite score below is computed here, by us, from facts and
// AI-interpretation fields Website Intelligence already produced. Nothing
// here calls Gemini, and nothing here is itself AI-generated.
// ---------------------------------------------------------------------------

export interface WebsiteSignalBag {
  /** 0–100. Blends Cheerio-measured on-page SEO facts with Lighthouse's SEO
   * category score when available. Never invents a Lighthouse-shaped value
   * when Lighthouse is unavailable — it just re-normalizes over what it has. */
  technicalHealthScore: number;
  /** 0–100. Mean of Gemini's positioning-clarity interpretation fields. */
  positioningScore: number;
  /** 0–100. Mean of Gemini's conversion-readiness interpretation fields
   * (signupFriction is inverted first, since it runs the opposite direction). */
  conversionScore: number;
  /** 0–100. Gemini's hero CTA-clarity estimate. */
  ctaScore: number;
  /** 0–100. Rough proxy from homepage word count — see AGENTS.md Phase 3 §14. */
  contentFoundationScore: number;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function scoreTitle(titleLength: number, hasTitle: boolean): number {
  if (!hasTitle) return 0;
  return titleLength >= 10 && titleLength <= 70 ? 100 : 50;
}

function scoreMetaDescription(length: number, hasMeta: boolean): number {
  if (!hasMeta) return 0;
  return length >= 50 && length <= 160 ? 100 : 50;
}

function scoreHeadingStructure(h1Count: number): number {
  if (h1Count === 1) return 100;
  if (h1Count === 0) return 0;
  return 40; // multiple H1s — usually a structure smell, not a hard failure
}

/** Weighted blend, re-normalized over whichever terms actually have data —
 * this is what lets Lighthouse being unavailable degrade gracefully instead
 * of silently zeroing out technical health. */
export function computeTechnicalHealthScore(website: WebsiteIntelligence): number {
  if (!website.seo) return 50; // no evidence at all — neutral, not a guess in either direction

  const { seo, performance } = website;
  const w = TECHNICAL_HEALTH_WEIGHTS;

  let weightedSum = 0;
  let weightUsed = 0;

  weightedSum += scoreTitle(seo.titleLength, !!seo.title) * w.title;
  weightUsed += w.title;

  weightedSum += scoreMetaDescription(seo.metaDescriptionLength, !!seo.metaDescription) * w.metaDescription;
  weightUsed += w.metaDescription;

  weightedSum += scoreHeadingStructure(seo.h1Count) * w.headingStructure;
  weightUsed += w.headingStructure;

  const altCoverage = seo.images.total > 0 ? 1 - seo.images.missingAlt / seo.images.total : 1;
  weightedSum += altCoverage * 100 * w.imageAltCoverage;
  weightUsed += w.imageAltCoverage;

  weightedSum += (seo.structuredData.present ? 100 : 0) * w.structuredData;
  weightUsed += w.structuredData;

  if (performance.status === "measured" && performance.seo !== null) {
    weightedSum += performance.seo * w.lighthouseSeo;
    weightUsed += w.lighthouseSeo;
  }

  return weightUsed > 0 ? normalizeScore(weightedSum / weightUsed) : 50;
}

export function extractWebsiteSignalBag(website: WebsiteIntelligence): WebsiteSignalBag | null {
  if (!website.interpretation) return null;
  const interp = website.interpretation;

  const positioningScore = normalizeScore(
    mean([
      interp.positioning.targetCustomerClarity,
      interp.positioning.problemClarity,
      interp.positioning.differentiationClarity,
    ])
  );

  const conversionScore = normalizeScore(
    mean([
      interp.conversion.valuePropositionClarity,
      interp.conversion.trustSignalStrength,
      interp.conversion.socialProofStrength,
      interp.conversion.pricingVisibility,
      100 - interp.conversion.signupFriction, // inverted — see types.ts
    ])
  );

  const contentFoundationScore = website.seo
    ? clampScore(
        normalizeScore(
          (website.seo.wordCount / CONTENT_FOUNDATION_WORDS_FOR_MAX_SCORE) * 100
        )
      )
    : 0;

  return {
    technicalHealthScore: computeTechnicalHealthScore(website),
    positioningScore,
    conversionScore,
    ctaScore: interp.hero.ctaClarity,
    contentFoundationScore,
  };
}

// ---------------------------------------------------------------------------
// Channel-score modifiers (§10) — currently defined for SEO and Content, the
// two channels the spec gives worked examples for. Everything else returns
// a no-op modifier; extend this table as more evidence-backed relationships
// are validated, rather than inventing a modifier for every channel.
// ---------------------------------------------------------------------------

export interface WebsiteModifier {
  multiplier: number;
  reason: string | null;
}

const NO_ADJUSTMENT: WebsiteModifier = { multiplier: 1, reason: null };

function seoWebsiteModifier(bag: WebsiteSignalBag): WebsiteModifier {
  const { technicalHealthScore } = bag;
  const cfg = SEO_WEBSITE_MODIFIER;
  if (technicalHealthScore >= cfg.strongTechnicalHealth) {
    return {
      multiplier: cfg.strongMultiplier,
      reason: `Website technical health is strong (${technicalHealthScore}/100), reinforcing this channel.`,
    };
  }
  if (technicalHealthScore < cfg.weakTechnicalHealth) {
    return {
      multiplier: cfg.weakMultiplier,
      reason: `Website technical health is weak (${technicalHealthScore}/100) — likely to undercut this channel until fixed.`,
    };
  }
  return NO_ADJUSTMENT;
}

function contentWebsiteModifier(bag: WebsiteSignalBag): WebsiteModifier {
  const { positioningScore, contentFoundationScore } = bag;
  const cfg = CONTENT_WEBSITE_MODIFIER;
  if (positioningScore < cfg.weakPositioning) {
    return {
      multiplier: cfg.weakMultiplier,
      reason: `Website positioning clarity is weak (${positioningScore}/100) — content built on unclear positioning compounds the problem.`,
    };
  }
  if (contentFoundationScore >= cfg.strongFoundationAndPositioning && positioningScore >= cfg.strongFoundationAndPositioning) {
    return {
      multiplier: cfg.strongMultiplier,
      reason: `The website already has a reasonable content foundation and clear positioning to build on.`,
    };
  }
  return NO_ADJUSTMENT;
}

const CHANNEL_MODIFIERS: Partial<Record<Channel, (bag: WebsiteSignalBag) => WebsiteModifier>> = {
  seo: seoWebsiteModifier,
  content: contentWebsiteModifier,
};

export function computeWebsiteChannelModifier(
  channel: Channel,
  bag: WebsiteSignalBag
): WebsiteModifier {
  const compute = CHANNEL_MODIFIERS[channel];
  if (!compute) return NO_ADJUSTMENT;
  const result = compute(bag);
  return {
    multiplier: Math.min(
      WEBSITE_MODIFIER_BOUNDS.max,
      Math.max(WEBSITE_MODIFIER_BOUNDS.min, result.multiplier)
    ),
    reason: result.reason,
  };
}

// ---------------------------------------------------------------------------
// Bottleneck detection (§11) — a website-readiness diagnosis, not a claim
// about real funnel data. Evaluated in a fixed, documented priority order so
// the same inputs always produce the same diagnosis.
// ---------------------------------------------------------------------------

export function detectBottleneck(
  rankedChannels: ChannelResult[],
  website: WebsiteIntelligence | null
): Bottleneck {
  if (!website || website.status === "unavailable") {
    return {
      type: "unknown",
      reason: "No website was inspected, so a website-based bottleneck cannot be assessed.",
    };
  }

  const bag = extractWebsiteSignalBag(website);
  if (!bag) {
    return {
      type: "unknown",
      reason: "The website was reached, but the AI interpretation of it did not complete.",
    };
  }

  const topScore = rankedChannels[0].channelScore;
  const t = BOTTLENECK_THRESHOLDS;

  if (topScore < t.weakAcquisition) {
    return {
      type: "acquisition",
      reason: `No channel shows strong fit yet (best is ${topScore}/100) — the current positioning doesn't point clearly at a channel to pursue, independent of the website itself.`,
    };
  }

  const websiteConfidence = website.interpretation?.confidence.overall ?? 0;
  if (websiteConfidence < WEBSITE_CONFIDENCE_LOW_THRESHOLD) {
    return {
      type: "unknown",
      reason: `The website interpretation's own confidence is low (${websiteConfidence}/100) — not reliable enough to diagnose a specific website bottleneck yet.`,
    };
  }

  if (topScore >= t.strongAcquisition && bag.technicalHealthScore < t.weakTechnical) {
    return {
      type: "technical",
      reason: `Acquisition potential is strong (${topScore}/100), but the site's technical health (${bag.technicalHealthScore}/100) is weak enough to undermine it.`,
    };
  }

  if (topScore >= t.strongAcquisition && bag.positioningScore < t.weakPositioning) {
    return {
      type: "positioning",
      reason: `Acquisition potential appears stronger (${topScore}/100) than the current homepage's clarity about who this is for and what problem it solves (${bag.positioningScore}/100).`,
    };
  }

  if (
    topScore >= t.strongAcquisition &&
    (bag.ctaScore < t.weakConversion || bag.conversionScore < t.weakConversion)
  ) {
    return {
      type: "conversion",
      reason: `Acquisition potential appears stronger (${topScore}/100) than the current landing-page conversion readiness (CTA clarity ${bag.ctaScore}/100, conversion signals ${bag.conversionScore}/100).`,
    };
  }

  return {
    type: "unknown",
    reason: "Acquisition fit and website readiness appear reasonably balanced — no single bottleneck stands out.",
  };
}
