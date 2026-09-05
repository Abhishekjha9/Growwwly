import { z } from "zod";

// ---------------------------------------------------------------------------
// Website Intelligence — objective evidence collected by inspecting a real
// SaaS website, plus Gemini's interpretation of that evidence.
//
// The type boundary below is deliberate and load-bearing: `*Evidence`
// schemas (crawl/seo/performance/visual) hold only facts our own code
// measured — nothing here is written by Gemini. `WebsiteInterpretationSchema`
// is the ONLY schema Gemini is asked to fill in, and it never contains a
// number our code could have measured directly. `WebsiteIntelligenceSchema`
// assembles both halves without blending them.
// ---------------------------------------------------------------------------

/** 0–100. Used only for AI-interpreted qualities, never for a measured fact. */
const Clarity = z
  .number()
  .int()
  .min(0)
  .max(100)
  .describe("Model estimate from 0 (very weak) to 100 (very strong).");

// ---------------------------------------------------------------------------
// FACTS — crawl
// ---------------------------------------------------------------------------

export const CrawlStatusSchema = z.enum([
  "ok",
  "blocked",
  "invalid_url",
  "unreachable",
  "timeout",
  "http_error",
]);
export type CrawlStatus = z.infer<typeof CrawlStatusSchema>;

export const CrawlEvidenceSchema = z.object({
  status: CrawlStatusSchema,
  requestedUrl: z.string(),
  /** Null unless a response was actually received (post-redirect). */
  finalUrl: z.string().nullable(),
  statusCode: z.number().int().nullable(),
  responseTimeMs: z.number().int().nullable(),
  redirected: z.boolean(),
  /** Safe, user-facing explanation only — never a raw stack trace or
   * internal network detail. */
  error: z.string().nullable(),
});
export type CrawlEvidence = z.infer<typeof CrawlEvidenceSchema>;

// ---------------------------------------------------------------------------
// FACTS — SEO / DOM (Cheerio)
// ---------------------------------------------------------------------------

export const HeadingEvidenceSchema = z.object({
  h1: z.array(z.string()),
  h2: z.array(z.string()),
  h3: z.array(z.string()),
});

export const ImageEvidenceSchema = z.object({
  total: z.number().int().min(0),
  missingAlt: z.number().int().min(0),
});

export const LinkEvidenceSchema = z.object({
  total: z.number().int().min(0),
  internal: z.number().int().min(0),
  external: z.number().int().min(0),
});

export const StructuredDataEvidenceSchema = z.object({
  present: z.boolean(),
  /** JSON-LD `@type` values found, e.g. "Organization", "Product". */
  types: z.array(z.string()),
});

export const SocialMetaEvidenceSchema = z.object({
  openGraphPresent: z.boolean(),
  twitterCardPresent: z.boolean(),
});

export const SeoEvidenceSchema = z.object({
  title: z.string().nullable(),
  titleLength: z.number().int().min(0),
  metaDescription: z.string().nullable(),
  metaDescriptionLength: z.number().int().min(0),
  canonical: z.string().nullable(),
  robotsMeta: z.string().nullable(),
  viewport: z.string().nullable(),
  lang: z.string().nullable(),
  faviconPresent: z.boolean(),
  headings: HeadingEvidenceSchema,
  h1Count: z.number().int().min(0),
  images: ImageEvidenceSchema,
  links: LinkEvidenceSchema,
  formCount: z.number().int().min(0),
  /** Buttons/links whose text reads like a call to action ("Get started",
   * "Sign up", "Book a demo", ...) — detected by pattern match, not implied
   * intent. */
  ctaCount: z.number().int().min(0),
  navItemCount: z.number().int().min(0),
  hasPricingLink: z.boolean(),
  hasSignupLink: z.boolean(),
  hasLoginLink: z.boolean(),
  structuredData: StructuredDataEvidenceSchema,
  socialMeta: SocialMetaEvidenceSchema,
  /** Visible text word count — a rough measure, not a linguistic analysis. */
  wordCount: z.number().int().min(0),
});
export type SeoEvidence = z.infer<typeof SeoEvidenceSchema>;

// ---------------------------------------------------------------------------
// FACTS — performance (Lighthouse)
// ---------------------------------------------------------------------------

export const PerformanceStatusSchema = z.enum(["measured", "unavailable"]);

export const PerformanceEvidenceSchema = z.object({
  status: PerformanceStatusSchema,
  /** 0–100 Lighthouse category scores. Null when status is "unavailable" —
   * never a guessed or invented value. */
  performance: z.number().int().min(0).max(100).nullable(),
  accessibility: z.number().int().min(0).max(100).nullable(),
  bestPractices: z.number().int().min(0).max(100).nullable(),
  seo: z.number().int().min(0).max(100).nullable(),
  /** Present only when status is "unavailable" — why Lighthouse didn't run. */
  reason: z.string().nullable(),
});
export type PerformanceEvidence = z.infer<typeof PerformanceEvidenceSchema>;

// ---------------------------------------------------------------------------
// FACTS — visual capture (Playwright)
// ---------------------------------------------------------------------------

export const ViewportCaptureSchema = z.object({
  captured: z.boolean(),
  width: z.number().int(),
  height: z.number().int(),
  /** base64 `data:` URI, or null if capture failed. Kept out of Zod's size
   * validation intentionally — length varies with page content. */
  screenshotDataUrl: z.string().nullable(),
});
export type ViewportCapture = z.infer<typeof ViewportCaptureSchema>;

export const VisualEvidenceSchema = z.object({
  desktop: ViewportCaptureSchema,
  mobile: ViewportCaptureSchema,
});
export type VisualEvidence = z.infer<typeof VisualEvidenceSchema>;

// ---------------------------------------------------------------------------
// AI INTERPRETATION — the only part Gemini is asked to produce.
// Every field here is a judgment call about evidence already collected
// above, never a fact our own code could measure directly.
// ---------------------------------------------------------------------------

export const PositioningInterpretationSchema = z.object({
  targetCustomerClarity: Clarity.describe(
    "How clearly the page indicates who this product is for."
  ),
  problemClarity: Clarity.describe(
    "How clearly the page states the problem being solved."
  ),
  differentiationClarity: Clarity.describe(
    "How clearly the page explains why this product over alternatives."
  ),
  summary: z.string(),
});

export const HeroInterpretationSchema = z.object({
  headlineClarity: Clarity,
  ctaClarity: Clarity.describe("How obvious the primary next step is."),
  visualHierarchyClarity: Clarity,
  messageProductAlignment: Clarity.describe(
    "How well the headline's promise matches what the product evidently does."
  ),
  summary: z.string(),
});

export const ConversionInterpretationSchema = z.object({
  valuePropositionClarity: Clarity,
  ctaProminence: Clarity,
  trustSignalStrength: Clarity,
  socialProofStrength: Clarity,
  pricingVisibility: Clarity,
  /** NOTE: inverted from the rest of this file's convention — 0 = frictionless
   * signup, 100 = high friction — kept this direction to match the plain
   * English of "friction" rather than force an awkward "signup ease" label. */
  signupFriction: Clarity.describe(
    "0 = appears frictionless, 100 = appears to require significant effort/commitment."
  ),
  summary: z.string(),
});

export const InformationArchitectureInterpretationSchema = z.object({
  navigationClarity: Clarity,
  contentOrganization: Clarity,
  keyPageDiscoverability: Clarity.describe(
    "How easy pricing/docs/signup appear to be to find from the homepage."
  ),
  summary: z.string(),
});

export const VisualHierarchyInterpretationSchema = z.object({
  hierarchyClarity: Clarity.describe(
    "How clearly one element reads as most important."
  ),
  density: z.enum(["low", "balanced", "high"]),
  readability: Clarity,
  ctaCompetesWithOtherElements: z.boolean(),
  /** AI-estimated visual attention, not measured behavioral data — see
   * AGENTS.md Phase 3 §7. Never call this a heatmap. */
  attentionSummary: z.string().describe(
    "AI-estimated visual attention based on layout and contrast — not real user behavior."
  ),
  summary: z.string(),
});

export const MobileInterpretationSchema = z.object({
  mobileHierarchyClarity: Clarity,
  ctaVisibility: Clarity,
  navigationUsability: Clarity,
  layoutIssues: z.array(z.string()),
  summary: z.string(),
});

export const WebsiteConfidenceSchema = z.object({
  overall: Clarity,
  reasoning: z.string(),
});

/**
 * The exact object Gemini is asked to produce (via the existing
 * `generateStructuredResponse`, multimodal — screenshots + evidence).
 * Nothing outside this schema comes from Gemini.
 */
export const WebsiteInterpretationSchema = z.object({
  positioning: PositioningInterpretationSchema,
  hero: HeroInterpretationSchema,
  conversion: ConversionInterpretationSchema,
  informationArchitecture: InformationArchitectureInterpretationSchema,
  visualHierarchy: VisualHierarchyInterpretationSchema,
  mobile: MobileInterpretationSchema,
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  opportunities: z.array(z.string()),
  confidence: WebsiteConfidenceSchema,
});
export type WebsiteInterpretation = z.infer<typeof WebsiteInterpretationSchema>;

// ---------------------------------------------------------------------------
// The full, assembled result
// ---------------------------------------------------------------------------

export const WebsiteIntelligenceStatusSchema = z.enum([
  /** Crawl, evidence extraction and AI interpretation all succeeded. */
  "complete",
  /** Crawl succeeded but at least one sub-step (Lighthouse, a screenshot,
   * or the Gemini interpretation) did not. */
  "partial",
  /** No usable evidence at all — invalid/blocked URL, unreachable site, or
   * the crawl itself failed. */
  "unavailable",
]);
export type WebsiteIntelligenceStatus = z.infer<
  typeof WebsiteIntelligenceStatusSchema
>;

export const WebsiteIntelligenceSchema = z.object({
  status: WebsiteIntelligenceStatusSchema,
  url: z.string(),
  crawl: CrawlEvidenceSchema,
  seo: SeoEvidenceSchema.nullable(),
  performance: PerformanceEvidenceSchema,
  visual: VisualEvidenceSchema,
  interpretation: WebsiteInterpretationSchema.nullable(),
  /** Set when status is "unavailable" or "partial" — a safe, user-facing
   * summary of what didn't work. */
  error: z.string().nullable(),
});
export type WebsiteIntelligence = z.infer<typeof WebsiteIntelligenceSchema>;
