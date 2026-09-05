/**
 * Re-export all Website Intelligence (Phase 3) types from the canonical Zod
 * schemas in `@/lib/website`. Other modules should import types from here
 * rather than reaching directly into the website module — same convention
 * as `@/types/product` and `@/types/growth`.
 */
export type {
  CrawlEvidence,
  CrawlStatus,
  PerformanceEvidence,
  SeoEvidence,
  ViewportCapture,
  VisualEvidence,
  WebsiteInterpretation,
  WebsiteIntelligence,
  WebsiteIntelligenceStatus,
} from "@/lib/website/types";
