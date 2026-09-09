import { generateOpenAiStructuredResponse } from "@/lib/ai/providers/openai";
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

function extractBase64Data(dataUrl: string | null): { mimeType: string; data: string } | null {
  if (!dataUrl) return null;
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

/**
 * The single OpenAI call for website analysis — one request carrying both
 * screenshots and the extracted evidence. Never throws: a failure here just 
 * means no AI interpretation, not a failed analysis.
 */
export async function interpretWebsite(
  input: InterpretWebsiteInput
): Promise<WebsiteInterpretation | null> {
  const images = [
    extractBase64Data(input.visual.desktop.screenshotDataUrl),
    extractBase64Data(input.visual.mobile.screenshotDataUrl),
  ].filter((part): part is { mimeType: string; data: string } => part !== null);

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
    const raw = await generateOpenAiStructuredResponse({
      systemPrompt: WEBSITE_ANALYSIS_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: WebsiteInterpretationSchema,
      temperature: 0.6,
      images,
    });

    const validated = WebsiteInterpretationSchema.safeParse(raw);
    if (!validated.success) {
      console.error(
        "[website] OpenAI returned an invalid interpretation structure:",
        validated.error.issues
      );
      return null;
    }
    return validated.data;
  } catch (err) {
    console.error("[website] OpenAI visual analysis failed:", err);
    return null;
  }
}
