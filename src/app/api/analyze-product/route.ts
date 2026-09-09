import { NextRequest, NextResponse } from "next/server";

import {
  ProductAnalysisRequestSchema,
  ProductIntelligenceSchema,
} from "@/lib/ai/schemas/product-analysis";
import { generateStructuredResponse } from "@/lib/ai/client";
import {
  PRODUCT_ANALYSIS_MAX_OUTPUT_TOKENS,
  PRODUCT_ANALYSIS_SYSTEM_PROMPT,
  buildProductAnalysisUserPrompt,
} from "@/lib/ai/prompts/product-analysis";
import { computeGrowthIntelligence } from "@/lib/growth";
import { analyzeWebsite } from "@/lib/website";
import type { WebsiteIntelligence } from "@/types/website";

// ---------------------------------------------------------------------------
// POST /api/analyze-product
//
// Runtime configuration:
//   - nodejs: required — the OpenAI SDK uses Node APIs (http, streams, etc.)
//     that are not available on the Edge runtime. Without this, Vercel will
//     default to the Edge runtime and the SDK will fail to initialise.
//   - maxDuration: 120 s — GPT-5.6-Sol (reasoning-class) regularly takes
//     30-90 s for a structured Product Intelligence call on Azure. Vercel's
//     default (10 s Hobby / 15 s Pro) kills the function before the AI can
//     respond, causing the frontend to receive a 502/504 with no JSON body,
//     which becomes the "unexpected response" error on the client.
//     120 s > STRUCTURED_RESPONSE_TIMEOUT_MS (90 s) + website analysis headroom.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    // 1. Parse the request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body." },
        { status: 400 }
      );
    }

    // 2. Validate with Zod
    const parsed = ProductAnalysisRequestSchema.safeParse(body);

    if (!parsed.success) {
      const messages = parsed.error.issues.map(
        (e) => `${e.path.join(".")}: ${e.message}`
      );
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request.",
          details: messages,
        },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // 3. Build the prompt and call the configured AI provider (OpenAI by default)
    const userPrompt = buildProductAnalysisUserPrompt(input);

    let rawResult: unknown;
    try {
      rawResult = await generateStructuredResponse({
        systemPrompt: PRODUCT_ANALYSIS_SYSTEM_PROMPT,
        userPrompt,
        responseSchema: ProductIntelligenceSchema,
        temperature: 0.3,
        maxOutputTokens: PRODUCT_ANALYSIS_MAX_OUTPUT_TOKENS,
      });
    } catch (err) {
      // Log the error class + message so Vercel function logs show the exact
      // failure category (timed_out, authentication, rate_limit, server_error,
      // connection) without including API keys or full request bodies.
      const label = err instanceof Error ? `${err.constructor.name}: ${err.message}` : String(err);
      console.error(`[analyze-product] AI provider error: ${label}`);
      return NextResponse.json(
        {
          success: false,
          error:
            err instanceof Error && err.message
              ? err.message
              : "AI analysis failed. Please try again later.",
        },
        { status: 500 }
      );
    }

    // 4. Validate the OpenAI response with Zod
    const validated = ProductIntelligenceSchema.safeParse(rawResult);

    if (!validated.success) {
      console.error(
        "[analyze-product] OpenAI returned invalid structure:",
        validated.error.issues
      );
      return NextResponse.json(
        {
          success: false,
          error:
            "AI returned an unexpected response format. Please try again.",
        },
        { status: 500 }
      );
    }

    // 5. Website Intelligence (Phase 3) — only when a URL was supplied, and
    //    never allowed to fail the rest of the analysis. A broken site, a
    //    Playwright crash, or a Lighthouse timeout all degrade to `null`
    //    (or a "partial" WebsiteIntelligence) rather than a 500.
    let websiteIntelligence: WebsiteIntelligence | null = null;
    if (input.url) {
      try {
        websiteIntelligence = await analyzeWebsite(input.url, {
          name: validated.data.product.name,
          category: validated.data.product.category,
          description: validated.data.product.description,
          primaryUseCase: validated.data.product.primaryUseCase,
        });
      } catch (err) {
        console.error("[analyze-product] Website Intelligence failed unexpectedly:", err);
        websiteIntelligence = null;
      }
    }

    // 6. Run the deterministic Growth Intelligence Engine (Phase 2 + 3) on
    //    top of the validated Product Intelligence and (if present) Website
    //    Intelligence. OpenAI never sees this step and never produces the
    //    final channel scores or the highest-leverage decision — it's plain
    //    TypeScript, computed from the signals already returned above.
    let growthIntelligence;
    try {
      growthIntelligence = computeGrowthIntelligence(validated.data, websiteIntelligence);
    } catch (err) {
      console.error("[analyze-product] Growth Intelligence Engine error:", err);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to compute growth intelligence. Please try again.",
        },
        { status: 500 }
      );
    }

    // 7. Return all three parts of the analysis, clearly separated.
    return NextResponse.json(
      {
        success: true,
        data: {
          productIntelligence: validated.data,
          websiteIntelligence,
          growthIntelligence,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[analyze-product] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
