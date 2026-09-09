import { NextRequest, NextResponse } from "next/server";

import { OpportunityDiscoveryRequestSchema } from "@/lib/opportunities/schemas";
import { discoverOpportunities } from "@/lib/opportunities/engine";

// ---------------------------------------------------------------------------
// POST /api/opportunities
//
// Input:  { analysis: <existing complete AnalysisResult> }
// Output: { success: true, data: { opportunities: Opportunity[] } }
//
// Never mutates the analysis it receives. Never returns a fabricated
// fallback opportunity — a search or provider failure is always a 5xx with a
// safe, user-facing message, and an empty result is a valid 200 response
// ("no strong opportunities found yet" is a UI decision, not an error).
//
// Runtime configuration:
//   - nodejs: required — OpenAI SDK uses Node networking APIs.
//   - maxDuration: 120 s — OpenAI grounded search (multi-query) can take
//     well above Vercel's default 10-15 s function timeout.
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
      console.error("[opportunities] Discovery failed:", err);
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
