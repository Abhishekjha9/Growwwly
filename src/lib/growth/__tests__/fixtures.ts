import type { ProductIntelligence } from "@/types/product";

/** A structurally-complete, mid-range Product Intelligence profile. Tests
 * override only the fields relevant to what they're checking. */
export function baseProductIntelligence(
  overrides: DeepPartial<ProductIntelligence> = {}
): ProductIntelligence {
  const base: ProductIntelligence = {
    product: {
      name: "TestCo",
      category: "Generic SaaS",
      description: "A generic software product used for testing.",
      primaryUseCase: "Doing the thing it does.",
      secondaryUseCases: ["A secondary use", "Another secondary use"],
    },
    customer: {
      primaryCustomer: "Small business owners",
      buyer: "Owner",
      user: "Owner",
      idealCustomerProfile: "Small teams that need this.",
      painPoints: ["Pain point one", "Pain point two"],
      jobsToBeDone: ["Job one", "Job two"],
    },
    problem: {
      primaryProblem: "The core problem this solves.",
      painSeverity: 50,
      urgency: 50,
      frequency: 50,
      willingnessToPay: 50,
    },
    marketSignals: {
      searchIntent: 50,
      communityPresence: 50,
      visualContentPotential: 50,
      wordOfMouthPotential: 50,
      buyerAccessibility: 50,
      marketMaturity: 50,
    },
    channelSignals: {
      seo: { relevance: 50, reasoning: "Neutral SEO relevance." },
      outbound: { relevance: 50, reasoning: "Neutral outbound relevance." },
      communities: { relevance: 50, reasoning: "Neutral community relevance." },
      content: { relevance: 50, reasoning: "Neutral content relevance." },
      social: { relevance: 50, reasoning: "Neutral social relevance." },
      partnerships: { relevance: 50, reasoning: "Neutral partnerships relevance." },
      paidAds: { relevance: 50, reasoning: "Neutral paid ads relevance." },
      referrals: { relevance: 50, reasoning: "Neutral referrals relevance." },
    },
    productFitSignals: {
      technicalAudienceFit: 50,
      visualAudienceFit: 50,
      communityAudienceFit: 50,
      searchDrivenProblem: 50,
      impulsePurchasePotential: 50,
      salesLedPotential: 50,
    },
    growthContext: {
      currentStage: "early traction",
      likelyAcquisitionMotion: "product-led",
      expectedSalesCycle: "days",
      estimatedCustomerValue: "medium",
    },
    constraints: {
      budgetLevel: "not specified",
      timeToResultsRequired: "not specified",
      marketingExperience: "not specified",
    },
    confidence: {
      overall: 70,
      reasoning: "Moderate confidence based on a reasonably clear description.",
    },
  };

  return mergeDeep(base, overrides);
}

/** A developer-tooling product: strong search intent and technical fit,
 * weak visual signals — SEO/communities/content should read strongly. */
export function developerApiFixture(): ProductIntelligence {
  return baseProductIntelligence({
    product: { name: "PDFParse", category: "Developer Tools & APIs" },
    marketSignals: {
      searchIntent: 85,
      communityPresence: 75,
      visualContentPotential: 25,
      wordOfMouthPotential: 55,
      buyerAccessibility: 70,
      marketMaturity: 60,
    },
    channelSignals: {
      seo: { relevance: 90, reasoning: "Developers search for this directly." },
      communities: { relevance: 80, reasoning: "Active in dev communities." },
      content: { relevance: 85, reasoning: "Tutorials rank well." },
      social: { relevance: 35, reasoning: "Not a visual product." },
      outbound: { relevance: 45, reasoning: "Some fit for outbound." },
      partnerships: { relevance: 65, reasoning: "Fits developer ecosystems." },
      paidAds: { relevance: 55, reasoning: "Competitive keywords." },
      referrals: { relevance: 50, reasoning: "Developers share tools." },
    },
    productFitSignals: {
      technicalAudienceFit: 95,
      visualAudienceFit: 20,
      communityAudienceFit: 70,
      searchDrivenProblem: 90,
      impulsePurchasePotential: 45,
      salesLedPotential: 60,
    },
    problem: {
      primaryProblem: "Parsing PDFs reliably is hard to build in-house.",
      painSeverity: 80,
      urgency: 75,
      frequency: 85,
      willingnessToPay: 80,
    },
    growthContext: {
      currentStage: "early traction",
      likelyAcquisitionMotion: "product-led",
      expectedSalesCycle: "days",
      estimatedCustomerValue: "medium",
    },
    constraints: {
      budgetLevel: "low",
      timeToResultsRequired: "fast",
      marketingExperience: "some technical marketing experience",
    },
    confidence: { overall: 85, reasoning: "Clear, specific product description." },
  });
}

/** A visual, consumer, one-time-purchase product — social/visual channels
 * should read strongly, technical/search-driven channels should not. */
export function weddingInviteFixture(): ProductIntelligence {
  return baseProductIntelligence({
    product: { name: "WedInvite AI", category: "B2C / Creator SaaS" },
    marketSignals: {
      searchIntent: 45,
      communityPresence: 40,
      visualContentPotential: 92,
      wordOfMouthPotential: 80,
      buyerAccessibility: 55,
      marketMaturity: 50,
    },
    channelSignals: {
      seo: { relevance: 40, reasoning: "Some search demand." },
      communities: { relevance: 35, reasoning: "Wedding forums exist but niche." },
      content: { relevance: 45, reasoning: "Inspiration content helps somewhat." },
      social: { relevance: 92, reasoning: "Highly visual, shareable output." },
      outbound: { relevance: 15, reasoning: "No sales-led motion here." },
      partnerships: { relevance: 50, reasoning: "Wedding planners as partners." },
      paidAds: { relevance: 60, reasoning: "Visual ads convert well." },
      referrals: { relevance: 75, reasoning: "Guests see the invitations." },
    },
    productFitSignals: {
      technicalAudienceFit: 15,
      visualAudienceFit: 95,
      communityAudienceFit: 40,
      searchDrivenProblem: 35,
      impulsePurchasePotential: 80,
      salesLedPotential: 10,
    },
    problem: {
      primaryProblem: "Designing unique wedding invitations is time-consuming.",
      painSeverity: 55,
      urgency: 60,
      frequency: 25,
      willingnessToPay: 55,
    },
    growthContext: {
      currentStage: "pre-launch",
      likelyAcquisitionMotion: "product-led",
      expectedSalesCycle: "instant",
      estimatedCustomerValue: "low",
    },
    constraints: {
      budgetLevel: "low",
      timeToResultsRequired: "not specified",
      marketingExperience: "not specified",
    },
    confidence: { overall: 65, reasoning: "Clear concept, few operational details." },
  });
}

/** A deliberately vague generic-SaaS description — low confidence, mid-range
 * signals across the board. */
export function lowConfidenceGenericFixture(): ProductIntelligence {
  return baseProductIntelligence({
    product: { name: "ProBoost", category: "AI Productivity Platform" },
    confidence: {
      overall: 20,
      reasoning: "The description is extremely vague with no distinguishing detail.",
    },
    constraints: {
      budgetLevel: "not specified",
      timeToResultsRequired: "not specified",
      marketingExperience: "not specified",
    },
  });
}

/** Every channel-relevant signal set uniformly low — no channel should read
 * as a strong acquisition fit. Used for testing the "acquisition" bottleneck
 * (§11), which is deliberately independent of website quality. */
export function uniformlyWeakAcquisitionFixture(): ProductIntelligence {
  return baseProductIntelligence({
    marketSignals: {
      searchIntent: 10,
      communityPresence: 10,
      visualContentPotential: 10,
      wordOfMouthPotential: 10,
      buyerAccessibility: 10,
      marketMaturity: 10,
    },
    channelSignals: {
      seo: { relevance: 10, reasoning: "x" },
      outbound: { relevance: 10, reasoning: "x" },
      communities: { relevance: 10, reasoning: "x" },
      content: { relevance: 10, reasoning: "x" },
      social: { relevance: 10, reasoning: "x" },
      partnerships: { relevance: 10, reasoning: "x" },
      paidAds: { relevance: 10, reasoning: "x" },
      referrals: { relevance: 10, reasoning: "x" },
    },
    productFitSignals: {
      technicalAudienceFit: 10,
      visualAudienceFit: 10,
      communityAudienceFit: 10,
      searchDrivenProblem: 10,
      impulsePurchasePotential: 10,
      salesLedPotential: 10,
    },
    problem: {
      primaryProblem: "Unclear problem — nothing distinctive.",
      painSeverity: 10,
      urgency: 10,
      frequency: 10,
      willingnessToPay: 10,
    },
  });
}

// ---------------------------------------------------------------------------
// Deep merge / partial-type helpers, scoped to this test file only.
// ---------------------------------------------------------------------------

type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeDeep<T>(base: T, overrides: DeepPartial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(overrides)) {
    return (overrides as T) ?? base;
  }
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(overrides)) {
    const overrideValue = (overrides as Record<string, unknown>)[key];
    const baseValue = (base as Record<string, unknown>)[key];
    result[key] = isPlainObject(baseValue) && isPlainObject(overrideValue)
      ? mergeDeep(baseValue, overrideValue as DeepPartial<typeof baseValue>)
      : overrideValue;
  }
  return result as T;
}
