import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";

import type { AnalysisResult } from "@/types/analysis";
import { GrowthReportDocument } from "./document";
import { LIGHT_THEME, type ReportTheme } from "./theme";

// `renderToBuffer` is typed to accept only a literal `<Document>` element,
// not a component that renders one — `GrowthReportDocument` does the latter
// by design (it needs an `analysis` prop). The element it produces really is
// a `<Document>` at render time; this alias just names the type
// `renderToBuffer` expects without hardcoding an import path for it.
type PDFDocumentElement = Parameters<typeof renderToBuffer>[0];

/**
 * Renders the existing, already-computed `AnalysisResult` into a PDF.
 *
 * This is purely a presentation/export layer: no OpenAI call, no website
 * fetch, no Lighthouse run, no Playwright capture, and no re-scoring. Every
 * value in the resulting PDF is read directly from the `analysis` argument.
 * `theme` (Light by default) only ever changes visual tokens — the
 * component tree, content and pagination are identical either way.
 */
export async function generateGrowthReport(
  analysis: AnalysisResult,
  theme: ReportTheme = LIGHT_THEME
): Promise<Buffer> {
  const element = createElement(GrowthReportDocument, { analysis, theme }) as unknown as PDFDocumentElement;
  return renderToBuffer(element);
}
