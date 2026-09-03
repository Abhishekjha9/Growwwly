import { NextRequest, NextResponse } from "next/server";

import {
  ProductAnalysisRequestSchema,
  ProductIntelligenceSchema,
} from "@/lib/ai/schemas/product-analysis";
import { generateStructuredResponse } from "@/lib/ai/gemini";
import {
  PRODUCT_ANALYSIS_SYSTEM_PROMPT,
  buildProductAnalysisUserPrompt,
} from "@/lib/ai/prompts/product-analysis";

// ---------------------------------------------------------------------------
// POST /api/analyze-product
// ---------------------------------------------------------------------------

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

    // 3. Build the prompt and call Gemini
    const userPrompt = buildProductAnalysisUserPrompt(input);

    let rawResult: unknown;
    try {
      rawResult = await generateStructuredResponse({
        systemPrompt: PRODUCT_ANALYSIS_SYSTEM_PROMPT,
        userPrompt,
        responseSchema: ProductIntelligenceSchema,
        temperature: 0.7,
      });
    } catch (err) {
      console.error("[analyze-product] Gemini API error:", err);
      return NextResponse.json(
        {
          success: false,
          error: "AI analysis failed. Please try again later.",
        },
        { status: 500 }
      );
    }

    // 4. Validate the Gemini response with Zod
    const validated = ProductIntelligenceSchema.safeParse(rawResult);

    if (!validated.success) {
      console.error(
        "[analyze-product] Gemini returned invalid structure:",
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

    // 5. Return the validated Product Intelligence Profile
    return NextResponse.json(
      { success: true, data: validated.data },
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
