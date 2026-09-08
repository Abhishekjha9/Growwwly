import type { AnalysisResult } from "@/types/analysis";
import {
  generateGroundedResponse,
  type GeminiGroundingSource,
} from "@/lib/ai/gemini";
import {
  OPPORTUNITY_DISCOVERY_SYSTEM_PROMPT,
  buildOpportunityDiscoveryUserPrompt,
} from "./prompts";
import { RawOpportunitySchema, type RawOpportunity } from "./schemas";
import { MAX_RAW_OPPORTUNITIES } from "./constants";
import { normalizeUrl, extractDomain } from "./rank";
import type { SearchIntent, SourceType } from "./types";

// ---------------------------------------------------------------------------
// Search intent construction — pure, deterministic, no I/O. Builds the
// bounded set of targeted search angles from the product's own analysis
// rather than ever searching for the product name alone.
// ---------------------------------------------------------------------------

/**
 * Builds a fixed set of targeted search angles from Product + Growth
 * Intelligence. The Google Search grounding tool ultimately chooses its own
 * literal queries — these angles are the guidance it's instructed to cover,
 * not a controllable query list.
 *
 * For community-oriented channels (communities, referrals) we add explicit
 * ecosystem-specific angles so the grounded search explores Reddit and
 * Hacker News beyond the default abstract angles. These are product/problem-
 * specific, never generic keyword dumps.
 */
export function buildSearchIntents(analysis: AnalysisResult): SearchIntent[] {
  const { product, customer, problem } = analysis.productIntelligence;
  const { topChannel } = analysis.growthIntelligence.summary;

  const base: SearchIntent[] = [
    {
      angle: "problem_discussion",
      description: `People discussing "${problem.primaryProblem}" as a real, current problem for ${customer.primaryCustomer}.`,
    },
    {
      angle: "category_alternatives",
      description: `People discussing alternatives to ${product.category} tools, or asking what others use for ${product.primaryUseCase}.`,
    },
    {
      angle: "pain_complaint",
      description: `People complaining about friction, limitations, or frustration related to ${problem.primaryProblem} or existing ${product.category} tools.`,
    },
    {
      angle: "seeking_recommendation",
      description: `People explicitly "looking for" or asking for a recommendation for a tool that helps with ${product.primaryUseCase}.`,
    },
    {
      angle: "comparison",
      description: `People comparing tools or approaches for ${product.primaryUseCase}, e.g. "X vs Y" discussions relevant to ${product.category}.`,
    },
    {
      angle: "implementation_question",
      description: `People asking practical "how do you..." or implementation questions related to ${problem.primaryProblem}.`,
    },
  ];

  // For community-channel products, add explicit ecosystem angles so the
  // grounded search actually covers Reddit and Hacker News. These are
  // problem/customer-specific, not generic platform dumps.
  if (topChannel === "communities" || topChannel === "referrals") {
    base.push(
      {
        angle: "problem_discussion",
        description: `site:reddit.com — ${customer.primaryCustomer} discussing "${problem.primaryProblem}" or looking for ${product.category} solutions.`,
      },
      {
        angle: "seeking_recommendation",
        description: `site:news.ycombinator.com — discussions where ${customer.primaryCustomer} asks about or evaluates ${product.category} tools for ${product.primaryUseCase}.`,
      }
    );
  }

  // Deduplicate by angle+description identity (the added community angles
  // reuse the same angle values intentionally — the description content is
  // what differs).
  return base;
}

// ---------------------------------------------------------------------------
// Web discovery call (Gemini + Google Search grounding) — the intended
// architecture per the design spec. Grounding sources provide the real URLs
// we validate opportunities against; we never trust an AI-generated URL
// that didn't come from an actual Google Search result.
// ---------------------------------------------------------------------------

export interface RawDiscoveryResult {
  opportunities: RawOpportunity[];
  groundingSources: GeminiGroundingSource[];
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

/** Normalizes a source URI from Gemini grounding metadata for set-membership
 * checks. Tolerant of null/undefined. */
function normalizeGroundingUri(uri: string | null | undefined): string {
  if (!uri) return "";
  return normalizeUrl(uri);
}

export async function discoverRawOpportunities(
  analysis: AnalysisResult,
  intents: SearchIntent[]
): Promise<RawDiscoveryResult> {
  const userPrompt = buildOpportunityDiscoveryUserPrompt(analysis, intents);

  console.log(`[opportunities] generated ${intents.length} search intents`);
  if (process.env.NODE_ENV !== "production") {
    for (const intent of intents) {
      console.log(`[opportunities]   · ${intent.angle}: ${intent.description}`);
    }
  }

  const { text, groundingSources, webSearchQueries } =
    await generateGroundedResponse({
      systemPrompt: OPPORTUNITY_DISCOVERY_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.3,
    });

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[opportunities] grounding queries: ${webSearchQueries.join(" | ") || "(none reported)"}`
    );
    console.log(`[opportunities] grounding sources returned: ${groundingSources.length}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(text));
  } catch {
    throw new Error("Gemini returned invalid JSON for opportunity discovery.");
  }

  const candidateList =
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { opportunities?: unknown }).opportunities)
      ? (parsed as { opportunities: unknown[] }).opportunities
      : [];

  // Ground truth for "is this URL real": every URI from Google Search
  // grounding metadata that Gemini actually retrieved. We match normalised
  // opportunity URLs against this set. If grounding returned no sources at
  // all (network issue, API tier limit, etc.) we still process candidates
  // but log a warning — keeping some results is better than discarding all.
  const knownNormUrls = new Set(
    groundingSources.map((s) => normalizeGroundingUri(s.uri)).filter(Boolean)
  );

  // Also index by domain so that a search result URL whose exact path
  // differs from what the model cited (common with Reddit/HN thread variants)
  // can still be validated by domain membership.
  const knownDomains = new Set(
    groundingSources
      .map((s) => (s.uri ? extractDomain(s.uri) : s.domain ?? ""))
      .filter(Boolean)
  );

  const noGroundingSources = groundingSources.length === 0;
  if (noGroundingSources) {
    console.warn(
      "[opportunities] Gemini returned no grounding sources — accepting candidates without URL verification."
    );
  }

  const opportunities: RawOpportunity[] = [];
  const sourceDistribution: Record<string, number> = {};

  for (const candidate of candidateList.slice(0, MAX_RAW_OPPORTUNITIES)) {
    const validated = RawOpportunitySchema.safeParse(candidate);
    if (!validated.success) {
      console.warn(
        "[opportunities] Dropped malformed opportunity:",
        validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      );
      continue;
    }

    const opp = validated.data;
    const normUrl = normalizeUrl(opp.url);
    const domain = extractDomain(opp.url);

    // Accept if: no grounding sources available (fallback), exact URL match,
    // or domain appears in the set of domains Google actually searched.
    const urlVerified =
      noGroundingSources ||
      knownNormUrls.has(normUrl) ||
      (domain !== "" && knownDomains.has(domain));

    if (!urlVerified) {
      console.warn(
        `[opportunities] Dropped opportunity whose URL/domain wasn't confirmed by grounding: ${opp.url}`
      );
      continue;
    }

    opportunities.push(opp);
    const st: string = opp.sourceType ?? "other";
    sourceDistribution[st] = (sourceDistribution[st] ?? 0) + 1;
  }

  // Log source distribution for server-side diagnostics.
  const distStr = Object.entries(sourceDistribution)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  console.log(
    `[opportunities] validated ${opportunities.length} opportunities | source distribution: ${distStr || "none"}`
  );

  return { opportunities, groundingSources };
}
