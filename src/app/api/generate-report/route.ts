import { NextRequest, NextResponse } from "next/server";

import { GenerateReportRequestSchema } from "@/lib/report/types";
import { generateGrowthReport } from "@/lib/report/generate";
import { buildReportFilename, contentDispositionFor } from "@/lib/report/filename";
import { resolveReportTheme } from "@/lib/report/theme";

// react-pdf renders with Node APIs (Buffer, fs for its built-in font
// metrics) — this route cannot run on the Edge runtime.
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/generate-report
//
// Pure export layer: takes an already-computed AnalysisResult, validates it,
// and renders it to a PDF. No OpenAI call, no website fetch, no Lighthouse
// run, no re-scoring — see `@/lib/report/generate.ts`.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
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

    const parsed = GenerateReportRequestSchema.safeParse(body);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`);
      return NextResponse.json(
        { success: false, error: "Invalid analysis payload.", details: messages },
        { status: 400 }
      );
    }

    const { analysis, theme: themeName } = parsed.data;
    const theme = resolveReportTheme(themeName);

    let pdf: Buffer;
    try {
      pdf = await generateGrowthReport(analysis, theme);
    } catch (err) {
      console.error("[generate-report] PDF generation failed:", err);
      return NextResponse.json(
        { success: false, error: "Failed to generate the report. Please try again." },
        { status: 500 }
      );
    }

    const filename = buildReportFilename(analysis.productIntelligence.product.name);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDispositionFor(filename),
        "Content-Length": String(pdf.length),
      },
    });
  } catch (err) {
    console.error("[generate-report] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
