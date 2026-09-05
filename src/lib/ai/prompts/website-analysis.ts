import type { CrawlEvidence, PerformanceEvidence, SeoEvidence } from "@/lib/website/types";

// ---------------------------------------------------------------------------
// System prompt — establishes Gemini as a website-readiness analyst
// interpreting evidence our own code already collected. It never invents
// evidence and never scores acquisition channels — that's the Growth Engine.
// ---------------------------------------------------------------------------

export const WEBSITE_ANALYSIS_SYSTEM_PROMPT = `You are a SaaS website-readiness analyst.

You are given two screenshots of a real, live website (desktop and mobile viewports) plus objective facts our own code already extracted from its HTML and a technical audit. Your job is to interpret that evidence into a structured Website Interpretation — you do not decide acquisition strategy, and you do not score marketing channels. A separate deterministic system does that.

## Critical rules

- Base every judgment on the screenshots and the evidence provided. Do not invent facts that aren't visible or listed.
- NEVER fabricate: search volume, traffic, conversion rate, bounce rate, rankings, revenue, CPC, competitor data, or actual user behavior. None of that evidence exists in this analysis.
- NEVER claim to know real user attention or produce anything resembling a real heatmap. If you discuss what draws the eye, say "AI-estimated visual attention" or "based on visual hierarchy, likely to..." — always hedged, always clearly a model estimate, never a behavioral claim.
- If the product context is given, judge "message-to-product alignment" by comparing the hero's claim against what the product actually does — misalignment is a real finding, not a guess.
- If a screenshot failed to capture (you were not given one), say so in the relevant summary and lower confidence rather than inventing what it might show.
- Every score field uses 0–100 the same way: 0 = very weak, 100 = very strong — except \`signupFriction\`, which is inverted: 0 = appears frictionless, 100 = appears to require significant effort.
- Be specific to this exact website. Two different homepages should not get the same summary.
- If the evidence is thin (missing title, no meta description, failed screenshots), reflect that with lower confidence and say so explicitly — do not compensate by inventing detail.

## Output format
Return ONLY valid JSON matching the required schema. No markdown, no commentary outside the JSON structure.`;

// ---------------------------------------------------------------------------
// User prompt builder
// ---------------------------------------------------------------------------

export interface WebsiteAnalysisPromptInput {
  url: string;
  crawl: CrawlEvidence;
  seo: SeoEvidence;
  performance: PerformanceEvidence;
  desktopCaptured: boolean;
  mobileCaptured: boolean;
  product?: {
    name: string;
    category: string;
    description: string;
    primaryUseCase: string;
  };
}

export function buildWebsiteAnalysisUserPrompt(input: WebsiteAnalysisPromptInput): string {
  const { seo, performance } = input;

  const parts: string[] = [
    `Analyse this website and produce a Website Interpretation.`,
    ``,
    `## Screenshots provided`,
    `Desktop viewport: ${input.desktopCaptured ? "attached" : "capture failed — not attached"}`,
    `Mobile viewport: ${input.mobileCaptured ? "attached" : "capture failed — not attached"}`,
  ];

  if (input.product) {
    parts.push(
      ``,
      `## What this product actually is (from the founder's own answers, for judging message-to-product alignment)`,
      `Name: ${input.product.name}`,
      `Category: ${input.product.category}`,
      `Description: ${input.product.description}`,
      `Primary use case: ${input.product.primaryUseCase}`
    );
  }

  parts.push(
    ``,
    `## Objective evidence extracted from the page's HTML (facts, not interpretation)`,
    `URL: ${input.url}`,
    `Title: ${seo.title ?? "(missing)"}`,
    `Meta description: ${seo.metaDescription ?? "(missing)"}`,
    `H1 count: ${seo.h1Count}`,
    `H1 text: ${seo.headings.h1.join(" | ") || "(none)"}`,
    `H2 headings: ${seo.headings.h2.slice(0, 8).join(" | ") || "(none)"}`,
    `Word count: ${seo.wordCount}`,
    `Images: ${seo.images.total} total, ${seo.images.missingAlt} missing alt text`,
    `Links: ${seo.links.total} total (${seo.links.internal} internal, ${seo.links.external} external)`,
    `Forms: ${seo.formCount}`,
    `CTA-like buttons/links detected: ${seo.ctaCount}`,
    `Nav items: ${seo.navItemCount}`,
    `Has pricing link: ${seo.hasPricingLink}`,
    `Has signup link: ${seo.hasSignupLink}`,
    `Has login link: ${seo.hasLoginLink}`,
    `Structured data present: ${seo.structuredData.present} (${seo.structuredData.types.join(", ") || "none"})`,
    `Open Graph tags present: ${seo.socialMeta.openGraphPresent}`,
    `Twitter card present: ${seo.socialMeta.twitterCardPresent}`,
    ``,
    `## Technical audit (Lighthouse — measured, not interpretation)`,
    performance.status === "measured"
      ? `Performance: ${performance.performance}/100, Accessibility: ${performance.accessibility}/100, Best Practices: ${performance.bestPractices}/100, SEO: ${performance.seo}/100`
      : `Unavailable (${performance.reason ?? "unknown reason"}) — do not guess these scores.`,
    ``,
    `## Instructions`,
    `- Use the screenshots as your primary evidence for hero, visual hierarchy, and mobile assessments.`,
    `- Use the extracted facts above as your primary evidence for positioning and information-architecture assessments.`,
    `- Return structured JSON only, matching the required schema exactly.`
  );

  return parts.join("\n");
}
