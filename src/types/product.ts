/**
 * Re-export all product-related types from the canonical Zod schemas.
 *
 * Other modules should import types from here rather than reaching
 * directly into the schema file — this keeps the boundary clean if
 * we later add hand-written types or utility helpers.
 */
export type {
  ProductAnalysisRequest,
  ProductIntelligence,
} from "@/lib/ai/schemas/product-analysis";
