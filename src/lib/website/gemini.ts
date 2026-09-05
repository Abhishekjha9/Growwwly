import { generateStructuredResponse, type GeminiImagePart } from "@/lib/ai/gemini";
import {
  buildWebsiteAnalysisUserPrompt,
  WEBSITE_ANALYSIS_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/website-analysis";
import { WebsiteInterpretationSchema } from "./types";
import type {
  CrawlEvidence,
  PerformanceEvidence,
  SeoEvidence,
  VisualEvidence,
  WebsiteInterpretation,
} from "./types";

export interface InterpretWebsiteInput {
  url: string;
  crawl: CrawlEvidence;
  seo: SeoEvidence;
  performance: PerformanceEvidence;
  visual: VisualEvidence;
  product?: {
    name: string;
    category: string;
    description: string;
    primaryUseCase: string;
  };
}

function toImagePart(dataUrl: string | null): GeminiImagePart | null {
  if (!dataUrl) return null;
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

/**
 * The single Gemini call for website analysis — one request carrying both
 * screenshots and the extracted evidence, never called more than once per
 * analysis (see §17). Never throws: a failure here just means no AI
 * interpretation, not a failed analysis.
 */
export async function interpretWebsite(
  input: InterpretWebsiteInput
): Promise<WebsiteInterpretation | null> {
  const images = [
    toImagePart(input.visual.desktop.screenshotDataUrl),
    toImagePart(input.visual.mobile.screenshotDataUrl),
  ].filter((part): part is GeminiImagePart => part !== null);

  const userPrompt = buildWebsiteAnalysisUserPrompt({
    url: input.url,
    crawl: input.crawl,
    seo: input.seo,
    performance: input.performance,
    desktopCaptured: input.visual.desktop.captured,
    mobileCaptured: input.visual.mobile.captured,
    product: input.product,
  });

  try {
    const raw = await generateStructuredResponse({
      systemPrompt: WEBSITE_ANALYSIS_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: WebsiteInterpretationSchema,
      temperature: 0.6,
      images,
    });

    const validated = WebsiteInterpretationSchema.safeParse(raw);
    if (!validated.success) {
      console.error(
        "[website] Gemini returned an invalid interpretation structure:",
        validated.error.issues
      );
      return null;
    }
    return validated.data;
  } catch (err) {
    console.error("[website] Gemini visual analysis failed:", err);
    return null;
  }
}
