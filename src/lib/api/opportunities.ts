import type { AnalysisResult } from '@/types/analysis'
import type { Opportunity } from '@/types/opportunities'

export class OpportunitiesError extends Error {}

/**
 * Calls `/api/opportunities`. Never throws the raw fetch/parse error —
 * always a message safe to show a user (no stack traces, no API keys).
 * User-triggered only (the "Find Opportunities" button) — never called on
 * page load.
 */
export async function discoverOpportunities(analysis: AnalysisResult): Promise<Opportunity[]> {
  let response: Response
  try {
    response = await fetch('/api/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis }),
    })
  } catch {
    throw new OpportunitiesError('Could not reach the server. Check your connection and try again.')
  }

  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new OpportunitiesError('The server returned an unexpected response. Please try again.')
  }

  const body = data as { success?: boolean; data?: { opportunities: Opportunity[] }; error?: string }

  if (!response.ok || !body.success || !body.data) {
    throw new OpportunitiesError(body.error || 'Opportunity discovery is temporarily unavailable.')
  }

  return body.data.opportunities
}
