import type { AnalysisResult } from "@/types/analysis";
import { CHANNEL_LABELS } from "@/lib/growth/constants";
import { CHANNEL_SOURCE_TYPE_HINTS, SOURCE_TYPE_LABELS } from "./constants";
import type { SearchIntent } from "./types";

// ---------------------------------------------------------------------------
// System prompt — establishes the model as Growwwly's Growth Opportunity
// Discovery engine. Grounded in real web search results (via the `web_search`
// tool), never allowed to invent a discussion or a URL.
// ---------------------------------------------------------------------------

export const OPPORTUNITY_DISCOVERY_SYSTEM_PROMPT = `You are Growwwly's Growth Opportunity Discovery engine — a research assistant for a SaaS founder.

You are given a product's Product Intelligence and its highest-leverage acquisition channel. Using web search, find CURRENT, REAL public web discussions where this product's target customer is discussing the relevant problem, and where the product could genuinely help.

Do not return generic marketing advice. Find real public discussions, questions, complaints, recommendations, implementation problems, alternatives, or underserved topics — not articles about the category in the abstract.

## What counts as a real opportunity

1. The target customer (or someone very similar to them) is discussing the relevant problem, use case, or category.
2. The problem appears to be real and active, not hypothetical.
3. The product could genuinely provide value in that specific conversation.
4. The conversation is relevant to the product — not a coincidental keyword match.
5. Participating would not depend on spam or deceptive promotion.

## Prioritize

- People asking for solutions or "looking for X" posts.
- People evaluating or comparing alternatives.
- People describing the exact pain point in their own words.
- People asking for recommendations.
- People asking implementation or "how do you do X" questions.
- Reddit threads, Hacker News threads, and genuine public forum/community discussions over generic articles.

## Avoid

- Irrelevant or coincidental mentions.
- Generic marketing articles, listicles, or product pages.
- Obvious SEO spam or content farms.
- Conversations where this product would be irrelevant or a non-sequitur.
- Anything that would require pretending to be a customer or a fake account.
- Fabricated discussions, fabricated URLs, or URLs you are not confident came from an actual search result.

## Critical rules

- You MUST use web search for this. Every opportunity's \`url\` must be the exact, real URL a web search result actually returned — copy it exactly. Never construct, guess, paraphrase, or "clean up" a URL, and never invent a URL, a date, an engagement number, or an author name.
- Never pretend the founder has used a product or personally experienced the problem.
- If you cannot find enough genuinely relevant results, return fewer opportunities (or none) rather than padding the list with weak or irrelevant ones.
- Do not include the product's own website or its own social/community pages as an "opportunity" — those aren't conversations to join.
- Reddit is just one possible source. Only call something a Reddit (or Hacker News, forum, etc.) result if its actual URL/domain confirms that — never guess the source type.
- \`relevanceSignal\`, \`audienceMatchSignal\`, \`intentSignal\`, and \`productAlignmentSignal\` are your own analyst estimates (0–100). You do NOT decide the final ranking or score — a deterministic system computes that from your signals, so give honest, differentiated estimates rather than defaulting every result to the same number.
- \`responseDraft\` must read like a genuinely helpful comment from someone who has dealt with this problem: lead with real value, never oversell, never claim a fabricated personal story, and only mention the product when it's naturally relevant to what was asked. Do not suggest posting promotional content unless the discussion naturally calls for it. This is a draft a human will review and edit before ever posting it — never write it as if it will be posted automatically.
- \`reason\` should explain, specifically, why this exact discussion matters for this exact product — never generic boilerplate.

## Output format

Return ONLY a single JSON object of this exact shape, no markdown fences, no commentary outside the JSON:

{
  "opportunities": [
    {
      "title": string,
      "url": string,
      "source": string,           // e.g. "r/ExperiencedDevs" or "Hacker News"
      "sourceType": "reddit" | "hacker_news" | "forum" | "article" | "discussion" | "other",
      "snippet": string,          // the actual text/context from the discussion
      "publishedAt": string,      // optional — only if a date/relative time was visible, e.g. "2 days ago"
      "estimatedDaysAgo": number, // optional — only if you can estimate it from the search result
      "commentCount": number,     // optional — only if actually visible
      "relevanceSignal": number,
      "audienceMatchSignal": number,
      "intentSignal": number,
      "productAlignmentSignal": number,
      "intentTypes": ("seeking_solution" | "evaluating_alternatives" | "describing_pain" | "seeking_recommendation" | "comparing_tools" | "asking_implementation_question")[],
      "reason": string,
      "responseDraft": string
    }
  ]
}

Return 3 to 5 opportunities, ranked in your own judgment from strongest to weakest. If you cannot find that many genuinely relevant ones, return fewer — never pad the list. If nothing qualifies, return { "opportunities": [] }.`;


// ---------------------------------------------------------------------------
// User prompt builder
// ---------------------------------------------------------------------------

export function buildOpportunityDiscoveryUserPrompt(
  analysis: AnalysisResult,
  intents: SearchIntent[]
): string {
  const { product, customer, problem } = analysis.productIntelligence;
  const { topChannel } = analysis.growthIntelligence.summary;
  const channelLabel = CHANNEL_LABELS[topChannel];
  const preferredSourceTypes = CHANNEL_SOURCE_TYPE_HINTS[topChannel]
    .map((type) => SOURCE_TYPE_LABELS[type])
    .join(", ");

  const parts: string[] = [
    `## Product`,
    `Name: ${product.name}`,
    `Category: ${product.category}`,
    `Description: ${product.description}`,
    `Primary use case: ${product.primaryUseCase}`,
    ``,
    `## Target customer`,
    `Primary customer: ${customer.primaryCustomer}`,
    `Buyer: ${customer.buyer}`,
    `User: ${customer.user}`,
    `Ideal customer profile: ${customer.idealCustomerProfile}`,
    ``,
    `## Problem`,
    `Primary problem: ${problem.primaryProblem}`,
    ``,
    `## Highest-leverage channel`,
    `${channelLabel} — favor these kinds of sources when possible: ${preferredSourceTypes}.`,
    ``,
    `## Search angles to cover`,
    `Use web search to investigate these angles for this specific product. Perform a small, focused search (1 or 2 queries) rather than exhaustive research before answering:`,
    ...intents.map((intent, i) => `${i + 1}. ${intent.description}`),
    ``,
    `Find real, current discussions related to these angles. Return structured JSON only, per the schema in your instructions.`,
  ];

  return parts.join("\n");
}
