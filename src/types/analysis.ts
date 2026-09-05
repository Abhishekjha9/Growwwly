import type { ProductIntelligence } from "./product";
import type { GrowthIntelligence } from "./growth";
import type { WebsiteIntelligence } from "./website";

/**
 * The full `/api/analyze-product` payload: Phase 1's Product Intelligence,
 * Phase 3's Website Intelligence, and Phase 2's Growth Intelligence, kept as
 * clearly separated sub-objects rather than merged into one — see AGENTS.md
 * Phase 2 §15 / Phase 3 §20. `websiteIntelligence` is `null` whenever no URL
 * was supplied — it never blocks or fails the rest of the analysis.
 */
export interface AnalysisResult {
  productIntelligence: ProductIntelligence;
  websiteIntelligence: WebsiteIntelligence | null;
  growthIntelligence: GrowthIntelligence;
}
