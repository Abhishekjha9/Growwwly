import { z } from "zod";

import { ProductIntelligenceSchema } from "@/lib/ai/schemas/product-analysis";
import { GrowthIntelligenceSchema } from "@/lib/growth/types";
import { WebsiteIntelligenceSchema } from "@/lib/website/types";

// ---------------------------------------------------------------------------
// The report generator is an export layer only — it never recomputes an
// analysis, so its input is validated against the exact same schemas that
// produced `AnalysisResult` in the first place (`@/types/analysis`). This is
// deliberately the same shape, not a second one, so there is only ever one
// source of truth for what a valid analysis result looks like.
// ---------------------------------------------------------------------------

export const AnalysisResultSchema = z.object({
  productIntelligence: ProductIntelligenceSchema,
  websiteIntelligence: WebsiteIntelligenceSchema.nullable(),
  growthIntelligence: GrowthIntelligenceSchema,
});

/** Only ever changes visual tokens (see `theme.ts`) — never a lever for
 * re-running or re-shaping the analysis. Defaults to light when omitted. */
export const ReportThemeNameSchema = z.enum(["light", "dark"]).default("light");

export const GenerateReportRequestSchema = z.object({
  analysis: AnalysisResultSchema,
  theme: ReportThemeNameSchema.optional(),
});

export type GenerateReportRequest = z.infer<typeof GenerateReportRequestSchema>;
