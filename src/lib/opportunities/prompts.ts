import type { AnalysisResult } from "@/types/analysis";
import { CHANNEL_LABELS } from "@/lib/growth/constants";
import { CHANNEL_SOURCE_TYPE_HINTS, SOURCE_TYPE_LABELS } from "./constants";
import type { SearchIntent } from "./types";

// ---------------------------------------------------------------------------
// System prompt — Growwwly's Opportunity INTERPRETATION step. The model never
// searches: it is handed real search results (from the independent search
// provider, see `@/lib/search`) and only judges, classifies and drafts. It
// references results by id; the application resolves every URL itself.
// ---------------------------------------------------------------------------

export const OPPORTUNITY_INTERPRETATION_SYSTEM_PROMPT = `You are Growwwly's Growth Opportunity Discovery engine — a research assistant for a SaaS founder.

You are given a product's Product Intelligence, its highest-leverage acquisition channel, and a numbered list of REAL public web search results (each with an id like "S3", a title, domain, optional date, and a text excerpt). Decide which results are genuine opportunities: current, real public discussions where this product's target customer is discussing the relevant problem, and where the product could genuinely help.

Do not return generic marketing advice. Prefer real discussions, questions, complaints, recommendation requests, implementation problems and alternatives threads — not articles about the category in the abstract.

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
- Pages published BY a vendor or competitor (e.g. "Best X alternatives", "/compare/" pages, a company blog promoting its own tool). They are marketing, not conversations — exclude them even when they mention this product's category.
- Articles merely ABOUT this product — there is no one there asking for help.
- Obvious SEO spam or content farms.
- Conversations where this product would be irrelevant or a non-sequitur.
- The product's own website or its own social/community pages.
- Anything that would require pretending to be a customer or a fake account.

## Critical rules

- Only use the search results you are given. Reference each opportunity by its exact \`sourceId\` from the list. Never output, construct, guess or modify a URL — the application attaches the real URL from the search result itself.
- Never invent a date, comment count, vote count, engagement metric, author name, or quote that is not in the excerpt.
- Never pretend the founder has used a product or personally experienced the problem.
- Use each sourceId at most once. If only a few results genuinely qualify, return only those (or none) — never pad the list.
- \`sourceType\`: classify from the domain and excerpt — "reddit" / "hacker_news" only when the domain is reddit.com / news.ycombinator.com; "forum" for community Q&A/forums; "discussion" for other conversational threads; "article" for blog posts/articles; "other" otherwise.
- \`relevanceSignal\`, \`audienceMatchSignal\`, \`intentSignal\`, and \`productAlignmentSignal\` are your own analyst estimates (0–100). You do NOT decide the final ranking or score — a deterministic system computes that from your signals, so give honest, differentiated estimates rather than defaulting every result to the same number.
- \`intentTypes\`: the intent signals actually visible in the excerpt.
- \`reason\` should explain, specifically, why this exact discussion matters for this exact product — which customer, problem or product signal it matches. Never generic boilerplate.
- \`responseDraft\` must read like a genuinely helpful comment from someone who understands this problem: lead with real value, never oversell, never claim a fabricated personal story, and only mention the product when it's naturally relevant to what was asked. This is a draft a human will review and edit before ever posting it.

Return the strongest opportunities first (at most 8).`;

// ---------------------------------------------------------------------------
// User prompt builder
// ---------------------------------------------------------------------------

export interface InterpretationSource {
  id: string;
  title: string;
  domain: string;
  publishedDate: string | null;
  content: string;
}

export function buildOpportunityInterpretationUserPrompt(
  analysis: AnalysisResult,
  intents: SearchIntent[],
  sources: InterpretationSource[]
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
    `${channelLabel} — favor these kinds of sources when they genuinely qualify: ${preferredSourceTypes}.`,
    ``,
    `## Search angles that produced these results`,
    ...intents.map((intent, i) => `${i + 1}. ${intent.description}`),
    ``,
    `## Search results`,
    ...sources.map((s) =>
      [
        `[${s.id}] ${s.title}`,
        `domain: ${s.domain}${s.publishedDate ? ` | published: ${s.publishedDate}` : ""}`,
        `excerpt: ${s.content}`,
        ``,
      ].join("\n")
    ),
    `Return structured JSON only, referencing results by sourceId.`,
  ];

  return parts.join("\n");
}
