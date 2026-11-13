import { NextRequest, NextResponse } from "next/server";

import { OpportunityDiscoveryRequestSchema } from "@/lib/opportunities/schemas";
import { discoverOpportunities } from "@/lib/opportunities/engine";
import { httpStatusForAIError, isAIProviderError, type AIProviderError } from "@/lib/ai/errors";
import {
  httpStatusForSearchError,
  isSearchProviderError,
  type SearchProviderError,
} from "@/lib/search";

// ---------------------------------------------------------------------------
// POST /api/opportunities
//
// Input:  { analysis: <existing complete AnalysisResult> }
// Output: { success: true, data: { opportunities: Opportunity[] } }
//
// Pipeline: Tavily search (@/lib/search) → AI interpretation → deterministic
// ranking. Search errors and AI errors get distinct, specific messages.
//
// Never mutates the analysis it receives. Never returns a fabricated
// fallback opportunity — a search or provider failure is always a 5xx with a
// safe, user-facing message, and an empty result is a valid 200 response
// ("no strong opportunities found yet" is a UI decision, not an error).
//
// Runtime configuration:
//   - nodejs: required — provider adapters use Node networking APIs.
//   - maxDuration: 120 s — a grounded search request can take well above
//     Vercel's default 10-15 s function timeout (provider timeout: 90 s).
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  console.log("[opportunities] request started");

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body." },
        { status: 400 }
      );
    }

    const parsed = OpportunityDiscoveryRequestSchema.safeParse(body);
    if (!parsed.success) {
      const messages = parsed.error.issues.map(
        (e) => `${e.path.join(".")}: ${e.message}`
      );
      return NextResponse.json(
        { success: false, error: "Invalid analysis payload.", details: messages },
        { status: 400 }
      );
    }

    let opportunities;
    try {
      opportunities = await discoverOpportunities(parsed.data.analysis);
    } catch (err) {
      console.error(
        "[opportunities] Discovery failed:",
        isAIProviderError(err) ? `${err.provider}/${err.kind}: ${err.message}` : err
      );
      if (isSearchProviderError(err)) {
        const headers: Record<string, string> = {};
        if (err.retryAfterSeconds) headers["Retry-After"] = String(err.retryAfterSeconds);
        return NextResponse.json(
          { success: false, error: searchErrorMessage(err), errorKind: `search_${err.kind}` },
          { status: httpStatusForSearchError(err), headers }
        );
      }
      if (isAIProviderError(err)) {
        const headers: Record<string, string> = {};
        if (err.retryAfterSeconds) headers["Retry-After"] = String(err.retryAfterSeconds);
        return NextResponse.json(
          { success: false, error: opportunityErrorMessage(err), errorKind: err.kind },
          { status: httpStatusForAIError(err), headers }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: "Opportunity discovery is temporarily unavailable.",
        },
        { status: 502 }
      );
    }

    console.log(`[opportunities] request completed: ${Date.now() - requestStartTime}ms`);
    return NextResponse.json(
      { success: true, data: { opportunities } },
      { status: 200 }
    );
  } catch (err) {
    console.error("[opportunities] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

/** User-safe message for each SEARCH failure (Tavily stage). */
function searchErrorMessage(err: SearchProviderError): string {
  switch (err.kind) {
    case "configuration":
      return "Opportunity discovery isn't set up yet: the search API key (TAVILY_API_KEY) is missing on the server.";
    case "authentication":
      return "Opportunity discovery can't search right now: the server's search API key was rejected. Check TAVILY_API_KEY.";
    case "quota_exhausted":
      return "Opportunity discovery is temporarily unavailable due to search quota limits — this month's free search credits are used up.";
    case "usage_check_failed":
      return "Opportunity discovery is paused because remaining free search credits couldn't be verified. Please try again in a few minutes.";
    case "rate_limited":
      return `The search service is rate-limiting requests. Try again in ${err.retryAfterSeconds ? `about ${err.retryAfterSeconds}s` : "a minute"}.`;
    case "timeout":
      return "The web search timed out. Please try again.";
    case "service_unavailable":
    case "connection":
      return "The search service is temporarily unavailable. Please try again shortly.";
    default:
      return "The web search failed. Please try again.";
  }
}

/** User-safe message for each AI failure (interpretation stage — search
 * already succeeded at this point). */
function opportunityErrorMessage(err: AIProviderError): string {
  switch (err.kind) {
    case "quota_exhausted":
      return "Search results were found, but the AI's free daily quota is used up, so they couldn't be analyzed. Try again after it resets (midnight Pacific time).";
    case "rate_limited":
      return `Search results were found, but the AI is rate-limited right now. Try again in ${err.retryAfterSeconds ? `about ${err.retryAfterSeconds}s` : "a minute"}.`;
    case "timeout":
      return "Search results were found, but analyzing them timed out. Please try again.";
    case "invalid_output":
      return "Search results were found, but the AI couldn't interpret them reliably. Please try again.";
    case "free_tier_unavailable":
    case "unsupported_capability":
    case "configuration":
    case "authentication":
      return "Search results were found, but the AI provider isn't configured to analyze them on the server.";
    default:
      return "Search results were found, but the AI interpretation failed. Please try again.";
  }
}
