import { computeGrowthIntelligence } from "@/lib/growth";
import { developerApiFixture } from "@/lib/growth/__tests__/fixtures";
import type { AnalysisResult } from "@/types/analysis";
import type { RawOpportunity } from "../schemas";

export function buildAnalysis(
  productIntelligence = developerApiFixture(),
  websiteIntelligence: AnalysisResult["websiteIntelligence"] = null
): AnalysisResult {
  return {
    productIntelligence,
    websiteIntelligence,
    growthIntelligence: computeGrowthIntelligence(productIntelligence, websiteIntelligence),
  };
}

export function baseRawOpportunity(overrides: Partial<RawOpportunity> = {}): RawOpportunity {
  return {
    title: "How are you managing engineering project visibility across teams?",
    url: "https://www.reddit.com/r/ExperiencedDevs/comments/abc123/visibility/",
    source: "r/ExperiencedDevs",
    sourceType: "reddit",
    snippet: "We have five teams and no idea what anyone is actually working on this week.",
    publishedAt: "2 days ago",
    estimatedDaysAgo: 2,
    commentCount: 34,
    relevanceSignal: 85,
    audienceMatchSignal: 80,
    intentSignal: 75,
    productAlignmentSignal: 78,
    intentTypes: ["seeking_recommendation", "describing_pain"],
    reason: "Strong match with the target customer and core problem this product solves.",
    responseDraft:
      "We ran into this too — the thing that helped most was giving each team one shared view instead of another status meeting.",
    ...overrides,
  };
}
