import type { AnalysisResult } from "@/types/analysis";
import { discoverRawOpportunities, extractProductDomain } from "./search";
import { rankOpportunities } from "./rank";
import type { Opportunity } from "./schemas";

// ---------------------------------------------------------------------------
// The single entry point the API route calls.
//
//   AnalysisResult (existing Phase 1+2+3 output)
//                    │
//                    ▼
//      buildDiscoveryQueries()  (3 max)    <- pure, deterministic
//                    │
//                    ▼
//   Search provider (Tavily, @/lib/search) <- real results, budget-guarded
//                    │
//                    ▼
//   AI interpretation (@/lib/ai/client)    <- cites result ids only
//                    │
//                    ▼
//   URL resolution from search results     <- unmapped items discarded
//                    │
//                    ▼
//         rankOpportunities()             <- pure, deterministic scoring
//                    │
//                    ▼
//              Opportunity Feed
//
// The AI only ever supplies raw signals and prose; every URL comes from the
// search provider, and every score, filter, or ordering decision is plain
// TypeScript.
// ---------------------------------------------------------------------------

export async function discoverOpportunities(analysis: AnalysisResult): Promise<Opportunity[]> {
  const { opportunities: raw } = await discoverRawOpportunities(analysis);

  console.log("[opportunities] ranking started");
  const ranked = rankOpportunities(raw, { productDomain: extractProductDomain(analysis) });
  console.log(`[opportunities] ranked ${ranked.length} of ${raw.length} interpreted opportunities`);
  return ranked;
}
