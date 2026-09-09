import type { AnalysisResult } from "@/types/analysis";
import { buildSearchIntents, discoverRawOpportunities } from "./search";
import { extractDomain, rankOpportunities } from "./rank";
import type { Opportunity } from "./schemas";

// ---------------------------------------------------------------------------
// The single entry point the API route calls.
//
//   AnalysisResult (existing Phase 1+2+3 output)
//                    │
//                    ▼
//         buildSearchIntents()            <- pure, deterministic
//                    │
//                    ▼
//   OpenAI + web_search grounding           <- search.ts
//                    │
//                    ▼
//        Zod-validated raw opportunities
//                    │
//                    ▼
//         rankOpportunities()             <- pure, deterministic scoring
//                    │
//                    ▼
//              Opportunity Feed
//
// Mirrors the Growth Intelligence Engine's split: OpenAI only ever supplies
// raw signals, and every score, filter, or ordering decision is plain
// TypeScript (see AGENTS.md Opportunity Feed §6).
// ---------------------------------------------------------------------------

export async function discoverOpportunities(analysis: AnalysisResult): Promise<Opportunity[]> {
  const intents = buildSearchIntents(analysis);
  const { opportunities: raw } = await discoverRawOpportunities(analysis, intents);

  const productDomain = extractProductDomain(analysis);

  console.log("[opportunities] ranking started");
  return rankOpportunities(raw, { productDomain });
}

function extractProductDomain(analysis: AnalysisResult): string | undefined {
  const crawl = analysis.websiteIntelligence?.crawl;
  const url = crawl?.finalUrl ?? crawl?.requestedUrl;
  return url ? extractDomain(url) : undefined;
}
