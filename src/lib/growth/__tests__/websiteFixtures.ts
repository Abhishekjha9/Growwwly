import type { WebsiteIntelligence, WebsiteInterpretation } from "@/types/website";

function baseInterpretation(overrides: Partial<WebsiteInterpretation> = {}): WebsiteInterpretation {
  const base: WebsiteInterpretation = {
    positioning: {
      targetCustomerClarity: 70,
      problemClarity: 70,
      differentiationClarity: 65,
      summary: "Reasonably clear positioning.",
    },
    hero: {
      headlineClarity: 70,
      ctaClarity: 70,
      visualHierarchyClarity: 70,
      messageProductAlignment: 70,
      summary: "The hero matches the product.",
    },
    conversion: {
      valuePropositionClarity: 70,
      ctaProminence: 70,
      trustSignalStrength: 65,
      socialProofStrength: 60,
      pricingVisibility: 60,
      signupFriction: 30,
      summary: "Reasonably convincing.",
    },
    informationArchitecture: {
      navigationClarity: 70,
      contentOrganization: 65,
      keyPageDiscoverability: 65,
      summary: "Easy enough to navigate.",
    },
    visualHierarchy: {
      hierarchyClarity: 70,
      density: "balanced",
      readability: 75,
      ctaCompetesWithOtherElements: false,
      attentionSummary: "AI-estimated visual attention centers on the hero headline and CTA.",
      summary: "Clear visual hierarchy.",
    },
    mobile: {
      mobileHierarchyClarity: 70,
      ctaVisibility: 70,
      navigationUsability: 70,
      layoutIssues: [],
      summary: "Mobile layout holds up reasonably well.",
    },
    strengths: ["Clean visual design", "Clear primary CTA"],
    weaknesses: ["Limited social proof"],
    opportunities: ["Add customer logos near the hero"],
    confidence: { overall: 75, reasoning: "Screenshots and evidence were both available and consistent." },
  };
  return { ...base, ...overrides };
}

function baseWebsite(overrides: Partial<WebsiteIntelligence> = {}): WebsiteIntelligence {
  const base: WebsiteIntelligence = {
    status: "complete",
    url: "https://example.com",
    crawl: {
      status: "ok",
      requestedUrl: "https://example.com",
      finalUrl: "https://example.com/",
      statusCode: 200,
      responseTimeMs: 120,
      redirected: false,
      error: null,
    },
    seo: {
      title: "Example — Ship faster",
      titleLength: 20,
      metaDescription: "Example helps teams ship faster with less overhead, every single day.",
      metaDescriptionLength: 68,
      canonical: "https://example.com/",
      robotsMeta: null,
      viewport: "width=device-width, initial-scale=1",
      lang: "en",
      faviconPresent: true,
      headings: { h1: ["Ship faster with Example"], h2: ["Features", "Pricing"], h3: [] },
      h1Count: 1,
      images: { total: 10, missingAlt: 1 },
      links: { total: 40, internal: 30, external: 10 },
      formCount: 1,
      ctaCount: 3,
      navItemCount: 5,
      hasPricingLink: true,
      hasSignupLink: true,
      hasLoginLink: true,
      structuredData: { present: true, types: ["Organization"] },
      socialMeta: { openGraphPresent: true, twitterCardPresent: true },
      wordCount: 650,
    },
    performance: {
      status: "measured",
      performance: 88,
      accessibility: 92,
      bestPractices: 90,
      seo: 85,
      reason: null,
    },
    visual: {
      desktop: { captured: true, width: 1280, height: 800, screenshotDataUrl: "data:image/jpeg;base64,AAAA" },
      mobile: { captured: true, width: 390, height: 844, screenshotDataUrl: "data:image/jpeg;base64,BBBB" },
    },
    interpretation: baseInterpretation(),
    error: null,
  };
  return { ...base, ...overrides };
}

/** A generally healthy website — strong technical health, clear positioning
 * and conversion signals. Should not trigger any bottleneck override. */
export function healthyWebsiteFixture(): WebsiteIntelligence {
  return baseWebsite();
}

/** Strong technical facts but Gemini reads the positioning as unclear. */
export function weakPositioningWebsiteFixture(): WebsiteIntelligence {
  return baseWebsite({
    interpretation: baseInterpretation({
      positioning: {
        targetCustomerClarity: 30,
        problemClarity: 25,
        differentiationClarity: 20,
        summary: "The homepage describes the product category but not who it's for or what problem it solves.",
      },
    }),
  });
}

/** Clear positioning, but a weak call-to-action and thin trust signals. */
export function weakConversionWebsiteFixture(): WebsiteIntelligence {
  return baseWebsite({
    interpretation: baseInterpretation({
      hero: {
        headlineClarity: 70,
        ctaClarity: 25,
        visualHierarchyClarity: 60,
        messageProductAlignment: 70,
        summary: "The CTA is present but visually buried below competing links.",
      },
      conversion: {
        valuePropositionClarity: 65,
        ctaProminence: 30,
        trustSignalStrength: 20,
        socialProofStrength: 15,
        pricingVisibility: 50,
        signupFriction: 60,
        summary: "Little evidence of trust or social proof near the CTA.",
      },
    }),
  });
}

/** Weak on-page SEO fundamentals and a poor Lighthouse SEO score. */
export function weakTechnicalWebsiteFixture(): WebsiteIntelligence {
  return baseWebsite({
    seo: {
      title: null,
      titleLength: 0,
      metaDescription: null,
      metaDescriptionLength: 0,
      canonical: null,
      robotsMeta: null,
      viewport: null,
      lang: null,
      faviconPresent: false,
      headings: { h1: [], h2: [], h3: [] },
      h1Count: 0,
      images: { total: 20, missingAlt: 18 },
      links: { total: 10, internal: 6, external: 4 },
      formCount: 1,
      ctaCount: 1,
      navItemCount: 3,
      hasPricingLink: false,
      hasSignupLink: true,
      hasLoginLink: false,
      structuredData: { present: false, types: [] },
      socialMeta: { openGraphPresent: false, twitterCardPresent: false },
      wordCount: 90,
    },
    performance: {
      status: "measured",
      performance: 40,
      accessibility: 55,
      bestPractices: 50,
      seo: 30,
      reason: null,
    },
  });
}

/** Gemini's own confidence in its interpretation is low — the diagnosis
 * shouldn't be trusted enough to override a channel-pursuit action. */
export function lowConfidenceWebsiteFixture(): WebsiteIntelligence {
  return baseWebsite({
    interpretation: baseInterpretation({
      positioning: {
        targetCustomerClarity: 20,
        problemClarity: 20,
        differentiationClarity: 20,
        summary: "Hard to tell — very little content was visible.",
      },
      confidence: { overall: 25, reasoning: "Screenshots barely rendered any content; low confidence overall." },
    }),
  });
}

/** No website was inspected. */
export function noWebsite(): null {
  return null;
}

/** The site could not be reached at all. */
export function unavailableWebsiteFixture(): WebsiteIntelligence {
  return baseWebsite({
    status: "unavailable",
    seo: null,
    performance: { status: "unavailable", performance: null, accessibility: null, bestPractices: null, seo: null, reason: "DNS resolution failed." },
    visual: {
      desktop: { captured: false, width: 1280, height: 800, screenshotDataUrl: null },
      mobile: { captured: false, width: 390, height: 844, screenshotDataUrl: null },
    },
    interpretation: null,
    error: "Could not resolve this domain.",
  });
}
