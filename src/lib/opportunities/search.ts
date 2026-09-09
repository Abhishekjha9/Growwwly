import type { AnalysisResult } from "@/types/analysis";
import {
  generateOpenAiWebSearchResponse,
} from "@/lib/ai/providers/openai";
import {
  OPPORTUNITY_DISCOVERY_SYSTEM_PROMPT,
  buildOpportunityDiscoveryUserPrompt,
} from "./prompts";
import { RawOpportunitySchema, type RawOpportunity } from "./schemas";
import { MAX_RAW_OPPORTUNITIES } from "./constants";
import { normalizeUrl, extractDomain } from "./rank";
import type { SearchIntent } from "./types";

// ---------------------------------------------------------------------------
// Search intent construction — pure, deterministic, no I/O. Builds the
// bounded set of targeted search angles from the product's own analysis
// rather than ever searching for the product name alone.
// ---------------------------------------------------------------------------

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

  return base;
}

// ---------------------------------------------------------------------------
// Web discovery call (OpenAI web_search) — grounded in real URLs.
// ---------------------------------------------------------------------------

export interface RawDiscoveryResult {
  opportunities: RawOpportunity[];
  groundingSources: { url: string; title?: string }[];
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

function normalizeGroundingUri(uri: string | null | undefined): string {
  if (!uri) return "";
  return normalizeUrl(uri);
}

export async function discoverRawOpportunities(
  analysis: AnalysisResult,
  intents: SearchIntent[]
): Promise<RawDiscoveryResult> {
  const topIntents = intents.slice(0, 3);
  const userPrompt = buildOpportunityDiscoveryUserPrompt(analysis, topIntents);

  console.log(`[opportunities] generated ${intents.length} search intents`);
  if (process.env.NODE_ENV !== "production") {
    for (const intent of intents) {
      console.log(`[opportunities]   · ${intent.angle}: ${intent.description}`);
    }
  }

  console.log("[opportunities] search intents generated");
  console.log("[opportunities] OpenAI web_search started");
  const webSearchStart = Date.now();

  const { text, citations: groundingSources } =
    await generateOpenAiWebSearchResponse({
      systemPrompt: OPPORTUNITY_DISCOVERY_SYSTEM_PROMPT,
      userPrompt,
    });

  console.log(`[opportunities] OpenAI web_search finished: ${Date.now() - webSearchStart}ms`);

  if (process.env.NODE_ENV !== "production") {
    console.log(`[opportunities] grounding sources returned: ${groundingSources.length}`);
  }

  console.log("[opportunities] response parsing started");
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(text));
  } catch {
    throw new Error("OpenAI returned invalid JSON for opportunity discovery.");
  }

  const candidateList =
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { opportunities?: unknown }).opportunities)
      ? (parsed as { opportunities: unknown[] }).opportunities
      : [];

  console.log("[opportunities] URL verification started");
  const knownNormUrls = new Set(
    groundingSources.map((s) => normalizeGroundingUri(s.url)).filter(Boolean)
  );

  const knownDomains = new Set(
    groundingSources
      .map((s) => (s.url ? extractDomain(s.url) : ""))
      .filter(Boolean)
  );

  const noGroundingSources = groundingSources.length === 0;
  if (noGroundingSources) {
    console.warn(
      "[opportunities] OpenAI returned no grounding sources — accepting candidates without URL verification."
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

  const distStr = Object.entries(sourceDistribution)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  console.log(
    `[opportunities] validated ${opportunities.length} opportunities | source distribution: ${distStr || "none"}`
  );

  return { opportunities, groundingSources };
}
