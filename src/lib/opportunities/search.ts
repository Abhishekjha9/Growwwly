import type { AnalysisResult } from "@/types/analysis";
import {
  generateOpenAiWebSearchResponse,
  type OpenAiWebSearchCitation,
} from "@/lib/ai/providers/openai";
import {
  OPPORTUNITY_DISCOVERY_SYSTEM_PROMPT,
  buildOpportunityDiscoveryUserPrompt,
} from "./prompts";
import { RawOpportunitySchema, type RawOpportunity } from "./schemas";
import { MAX_RAW_OPPORTUNITIES } from "./constants";
import { normalizeUrl } from "./rank";
import type { SearchIntent } from "./types";

// ---------------------------------------------------------------------------
// Search intent construction — pure, deterministic, no I/O. Builds the
// bounded set of targeted search angles from the product's own analysis
// rather than ever searching for the product name alone.
// ---------------------------------------------------------------------------

/**
 * Builds a fixed set of six targeted search angles from Product + Growth
 * Intelligence. The web search tool ultimately chooses its own literal
 * queries — these angles are the guidance it's instructed to cover, not a
 * controllable query list, so the count is fixed rather than dynamically
 * sized.
 */
export function buildSearchIntents(analysis: AnalysisResult): SearchIntent[] {
  const { product, customer, problem } = analysis.productIntelligence;

  return [
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
}

// ---------------------------------------------------------------------------
// Web search call (GPT-5.6 Sol + Azure Responses API `web_search` tool),
// validated per-item so one malformed entry never discards an otherwise-good
// batch — and cross-checked against the tool's own citations so an
// opportunity can only survive if a real search result actually backs its
// URL. Never trust the model's prose alone for "is this URL real".
// ---------------------------------------------------------------------------

export interface RawDiscoveryResult {
  opportunities: RawOpportunity[];
  citations: OpenAiWebSearchCitation[];
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

export async function discoverRawOpportunities(
  analysis: AnalysisResult,
  intents: SearchIntent[]
): Promise<RawDiscoveryResult> {
  const userPrompt = buildOpportunityDiscoveryUserPrompt(analysis, intents);

  const { text, citations } = await generateOpenAiWebSearchResponse({
    systemPrompt: OPPORTUNITY_DISCOVERY_SYSTEM_PROMPT,
    userPrompt,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(text));
  } catch {
    throw new Error("OpenAI returned invalid JSON for opportunity discovery.");
  }

  const candidateList =
    parsed && typeof parsed === "object" && Array.isArray((parsed as { opportunities?: unknown }).opportunities)
      ? (parsed as { opportunities: unknown[] }).opportunities
      : [];

  // Ground truth for "is this a real source": every URL the web_search tool
  // itself found or visited, not just what the model chose to cite inline.
  const knownUrls = new Set(citations.map((c) => normalizeUrl(c.url)));

  const opportunities: RawOpportunity[] = [];
  for (const candidate of candidateList.slice(0, MAX_RAW_OPPORTUNITIES)) {
    const validated = RawOpportunitySchema.safeParse(candidate);
    if (!validated.success) {
      console.warn(
        "[opportunities] Dropped an invalid opportunity from the model:",
        validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      );
      continue;
    }

    if (!knownUrls.has(normalizeUrl(validated.data.url))) {
      console.warn(
        "[opportunities] Dropped an opportunity whose URL wasn't confirmed by web search."
      );
      continue;
    }

    opportunities.push(validated.data);
  }

  return { opportunities, citations };
}
