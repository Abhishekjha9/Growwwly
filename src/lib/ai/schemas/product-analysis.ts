import { z } from "zod";

// ---------------------------------------------------------------------------
// REQUEST SCHEMA — validates the incoming POST body
// ---------------------------------------------------------------------------

export const ProductAnalysisRequestSchema = z.object({
  /** Required: the name of the SaaS product */
  name: z
    .string()
    .min(1, "Product name is required")
    .max(200, "Product name is too long"),

  /** Required: a description of what the product does */
  description: z
    .string()
    .min(1, "Product description is required")
    .max(5000, "Product description is too long"),

  /** Optional: the product's website — also the trigger for Phase 3 Website
   * Intelligence. Only http/https is ever accepted; deeper safety checks
   * (private-IP/SSRF protection) happen at fetch time in `@/lib/website`. */
  url: z
    .string()
    .url("Invalid URL format")
    .refine((value) => /^https?:\/\//i.test(value), {
      message: "URL must start with http:// or https://",
    })
    .optional(),

  /** Optional: who the product is built for */
  targetCustomer: z.string().max(1000).optional(),

  /** Optional: pricing information */
  pricing: z.string().max(500).optional(),

  /** Optional: current number of users / customers */
  currentUsers: z.number().int().min(0).optional(),

  /** Optional: founder's marketing budget */
  budget: z.string().max(500).optional(),

  /** Optional: founder's marketing experience level */
  marketingExperience: z.string().max(500).optional(),
});

export type ProductAnalysisRequest = z.infer<
  typeof ProductAnalysisRequestSchema
>;

// ---------------------------------------------------------------------------
// RESPONSE SCHEMA — validates the structured JSON returned by Gemini
// ---------------------------------------------------------------------------

/** 0–100 signal score */
const SignalScore = z
  .number()
  .int()
  .min(0)
  .max(100)
  .describe(
    "Analyst estimate from 0 (extremely weak) to 100 (extremely strong)"
  );

// -- Product Profile --
const ProductProfileSchema = z.object({
  name: z.string(),
  category: z.string(),
  description: z.string(),
  primaryUseCase: z.string(),
  secondaryUseCases: z.array(z.string()),
});

// -- Customer Analysis --
const CustomerAnalysisSchema = z.object({
  primaryCustomer: z.string(),
  buyer: z.string().describe("The person who makes the purchase decision"),
  user: z.string().describe("The person who uses the product day-to-day"),
  idealCustomerProfile: z.string(),
  painPoints: z.array(z.string()),
  jobsToBeDone: z.array(z.string()),
});

// -- Problem Analysis --
const ProblemAnalysisSchema = z.object({
  primaryProblem: z.string(),
  painSeverity: SignalScore,
  urgency: SignalScore,
  frequency: SignalScore,
  willingnessToPay: SignalScore,
});

// -- Market Signals --
const MarketSignalsSchema = z.object({
  searchIntent: SignalScore.describe(
    "How strongly the target customer actively searches for solutions to this problem"
  ),
  communityPresence: SignalScore.describe(
    "How strongly the target audience participates in relevant online communities"
  ),
  visualContentPotential: SignalScore.describe(
    "How naturally the product can be demonstrated through visual content"
  ),
  wordOfMouthPotential: SignalScore.describe(
    "How naturally the product could spread through referrals or sharing"
  ),
  buyerAccessibility: SignalScore.describe(
    "How easily a founder can identify and directly reach potential customers"
  ),
  marketMaturity: SignalScore.describe(
    "How established the market is — 0 = very early/unproven, 100 = mature/saturated"
  ),
});

// -- Channel Signals (raw strategic signals, NOT final scores) --
const ChannelSignalDetail = z.object({
  relevance: SignalScore.describe(
    "How relevant this channel is for this specific product"
  ),
  reasoning: z
    .string()
    .describe("Why this channel has this level of relevance"),
});

const ChannelSignalsSchema = z.object({
  seo: ChannelSignalDetail,
  outbound: ChannelSignalDetail,
  communities: ChannelSignalDetail,
  content: ChannelSignalDetail,
  social: ChannelSignalDetail,
  partnerships: ChannelSignalDetail,
  paidAds: ChannelSignalDetail,
  referrals: ChannelSignalDetail,
});

// -- Product-Fit Signals --
const ProductFitSignalsSchema = z.object({
  technicalAudienceFit: SignalScore.describe(
    "How well the product maps to a technical / developer audience"
  ),
  visualAudienceFit: SignalScore.describe(
    "How well the product maps to a visually-oriented audience"
  ),
  communityAudienceFit: SignalScore.describe(
    "How well the product maps to community-driven audiences"
  ),
  searchDrivenProblem: SignalScore.describe(
    "How likely users discover solutions to this problem via search"
  ),
  impulsePurchasePotential: SignalScore.describe(
    "How likely a buyer would purchase on first encounter without a long evaluation"
  ),
  salesLedPotential: SignalScore.describe(
    "How well the product lends itself to a sales-led / outbound motion"
  ),
});

// -- Growth Context --
const GrowthContextSchema = z.object({
  currentStage: z
    .string()
    .describe(
      "Estimated growth stage, e.g. pre-launch, early traction, scaling, mature"
    ),
  likelyAcquisitionMotion: z
    .string()
    .describe(
      "Most natural acquisition motion, e.g. product-led, sales-led, community-led, content-led"
    ),
  expectedSalesCycle: z
    .string()
    .describe("Expected sales-cycle length, e.g. instant, days, weeks, months"),
  estimatedCustomerValue: z
    .string()
    .describe(
      "Rough customer-value tier, e.g. very low (<$10/mo), low, medium, high, enterprise"
    ),
});

// -- Strategic Constraints --
const ConstraintsSchema = z.object({
  budgetLevel: z.string(),
  timeToResultsRequired: z.string(),
  marketingExperience: z.string(),
});

// -- Confidence --
const ConfidenceSchema = z.object({
  overall: SignalScore.describe(
    "0 = extremely uncertain, 100 = very high confidence in the analysis"
  ),
  reasoning: z
    .string()
    .describe("Explanation of why confidence is at this level"),
});

// ---------------------------------------------------------------------------
// FULL Product Intelligence Profile
// ---------------------------------------------------------------------------

export const ProductIntelligenceSchema = z.object({
  product: ProductProfileSchema,
  customer: CustomerAnalysisSchema,
  problem: ProblemAnalysisSchema,
  marketSignals: MarketSignalsSchema,
  channelSignals: ChannelSignalsSchema,
  productFitSignals: ProductFitSignalsSchema,
  growthContext: GrowthContextSchema,
  constraints: ConstraintsSchema,
  confidence: ConfidenceSchema,
});

export type ProductIntelligence = z.infer<typeof ProductIntelligenceSchema>;
