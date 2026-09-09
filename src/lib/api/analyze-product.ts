import type { ProductAnalysisRequest } from '@/types/product'
import type { AnalysisResult } from '@/types/analysis'

export class AnalyzeProductError extends Error {}

/**
 * Calls the existing Phase 1+2 backend. Never throws the raw fetch/parse
 * error — always a message safe to show a user (no stack traces, no API keys).
 */
export async function analyzeProduct(
  input: ProductAnalysisRequest
): Promise<AnalysisResult> {
  let response: Response
  try {
    response = await fetch('/api/analyze-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch {
    throw new AnalyzeProductError('Could not reach the server. Check your connection and try again.')
  }

  let data: unknown
  try {
    data = await response.json()
  } catch {
    // The server returned a non-JSON body — most likely a gateway timeout
    // (Vercel 504) or a crash before the response was written. Surface a
    // specific, actionable message rather than the generic "unexpected response."
    if (response.status === 504 || response.status === 524) {
      throw new AnalyzeProductError(
        'The analysis took too long and timed out. Please try again — if it keeps failing, try a shorter product description.'
      )
    }
    if (response.status === 502 || response.status === 503) {
      throw new AnalyzeProductError('The server is temporarily unavailable. Please try again in a moment.')
    }
    throw new AnalyzeProductError('The server returned an unexpected response. Please try again.')
  }

  const body = data as { success?: boolean; data?: AnalysisResult; error?: string }

  if (!response.ok || !body.success || !body.data) {
    throw new AnalyzeProductError(body.error || 'Analysis failed. Please try again.')
  }

  return body.data
}
