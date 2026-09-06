import type { AnalysisResult } from '@/types/analysis'
import type { ReportThemeName } from '@/lib/report/theme'

export class GenerateReportError extends Error {}

const FILENAME_FALLBACK = 'growwwly-growth-report.pdf'

function filenameFromContentDisposition(header: string | null): string {
  if (!header) return FILENAME_FALLBACK
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      /* fall through to the plain filename below */
    }
  }
  const plainMatch = /filename="([^"]+)"/i.exec(header)
  return plainMatch ? plainMatch[1] : FILENAME_FALLBACK
}

/**
 * Calls `/api/generate-report` with the existing analysis result and returns
 * the rendered PDF as a Blob, ready to hand to the browser's download flow.
 * Never throws a raw fetch/parse error — always a message safe to show.
 */
export async function generateGrowthReportPdf(
  analysis: AnalysisResult,
  theme: ReportThemeName = 'light'
): Promise<{ blob: Blob; filename: string }> {
  let response: Response
  try {
    response = await fetch('/api/generate-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis, theme }),
    })
  } catch {
    throw new GenerateReportError('Could not reach the server. Check your connection and try again.')
  }

  if (!response.ok) {
    let message = 'Report generation failed. Please try again.'
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      /* Non-JSON error body — keep the default message. */
    }
    throw new GenerateReportError(message)
  }

  const blob = await response.blob()
  const filename = filenameFromContentDisposition(response.headers.get('Content-Disposition'))
  return { blob, filename }
}
