/**
 * Growth Opportunities — the first concrete step of the Autonomous Growth
 * Engine. Reads the *existing* analysis result (`useAnalysis`) — no second
 * analysis state — and, only when the user explicitly asks, searches the
 * live web via Gemini + Google Search grounding for real discussions where
 * this product's highest-leverage channel could act. Every opportunity shown
 * carries a real source URL; nothing here posts anything automatically.
 */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { Button, Label, Reveal } from '@/components/primitives'
import { OpportunityCard } from '@/components/opportunities/OpportunityCard'
import { OpportunityDetailModal } from '@/components/opportunities/OpportunityDetailModal'
import { OpportunityFilters, type OpportunityFilter } from '@/components/opportunities/OpportunityFilters'
import { useAnalysis } from '@/lib/analysis-store'
import { discoverOpportunities, OpportunitiesError } from '@/lib/api/opportunities'
import { CHANNEL_LABELS } from '@/lib/growth/constants'
import { useReducedMotion } from '@/lib/motion'
import type { Opportunity } from '@/types/opportunities'

type Status = 'idle' | 'loading' | 'success' | 'empty' | 'error'

const LOADING_STAGES = [
  { label: 'Searching the web…', detail: 'Running targeted searches across Reddit, Hacker News, and forums' },
  { label: 'Analyzing conversations…', detail: 'Checking relevance to your product and target customer' },
  { label: 'Ranking opportunities…', detail: 'Scoring and sorting by the Growwwly Opportunity Score' },
] as const

const STAGE_MS = 1800
const CACHE_KEY = 'growwwly:opportunities:v1'

interface Cache {
  productName: string
  channel: string
  opportunities: Opportunity[]
}

function readCache(productName: string, channel: string): Opportunity[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached: Cache = JSON.parse(raw)
    if (cached.productName !== productName || cached.channel !== channel) return null
    return cached.opportunities
  } catch {
    return null
  }
}

function writeCache(productName: string, channel: string, opportunities: Opportunity[]) {
  try {
    const cache: Cache = { productName, channel, opportunities }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* Private mode — results still hold for this render. */
  }
}

function matchesFilter(opportunity: Opportunity, filter: OpportunityFilter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'reddit':
    case 'hacker_news':
    case 'forum':
    case 'article':
      return opportunity.sourceType === filter
    case 'high':
      return opportunity.opportunityScore >= 75
    case 'recent':
      return opportunity.publishedAt !== undefined
    default:
      return true
  }
}

function LoadingNarration({ stageIndex }: { stageIndex: number }) {
  const reduced = useReducedMotion()
  const fill = (stageIndex + 1) / LOADING_STAGES.length
  const stage = LOADING_STAGES[stageIndex]

  return (
    <div className="border-t border-hairline pt-10">
      <p className="t-h2">{stage.label}</p>
      <p className="t-body mt-2 text-muted">{stage.detail}</p>
      <div aria-hidden className="mt-6 h-px w-full max-w-[420px] bg-hairline">
        <div
          className="h-px origin-left bg-ink transition-transform"
          style={{
            transform: `scaleX(${fill})`,
            transitionDuration: reduced ? '0ms' : `${STAGE_MS}ms`,
            transitionTimingFunction: 'linear',
          }}
        />
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {stage.label}
      </p>
    </div>
  )
}

export default function OpportunitiesPage() {
  const { result } = useAnalysis()

  const [status, setStatus] = useState<Status>('idle')
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [filter, setFilter] = useState<OpportunityFilter>('all')
  const [stageIndex, setStageIndex] = useState(0)
  const [selected, setSelected] = useState<Opportunity | null>(null)

  const stageTimer = useRef<number | null>(null)
  const inFlight = useRef(false)

  const clearStageTimer = useCallback(() => {
    if (stageTimer.current) window.clearInterval(stageTimer.current)
    stageTimer.current = null
  }, [])

  useEffect(() => clearStageTimer, [clearStageTimer])

  const productName = result?.productIntelligence.product.name ?? ''
  const channel = result?.growthIntelligence.summary.topChannel
  const opportunityScore = result?.growthIntelligence.summary.topOpportunityScore ?? 0

  // Hydrate from this session's last search for the same product + channel —
  // never a new web search on page load, only a display of what was already
  // found.
  useEffect(() => {
    if (!result || !channel) return
    const cached = readCache(productName, channel)
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from sessionStorage, same pattern as analysis-store.tsx
      setOpportunities(cached)
      setStatus(cached.length > 0 ? 'success' : 'empty')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the underlying product/channel changes
  }, [productName, channel])

  const runDiscovery = useCallback(async () => {
    if (!result || !channel || inFlight.current) return
    inFlight.current = true
    setStatus('loading')
    setErrorMessage('')
    setStageIndex(0)
    clearStageTimer()
    stageTimer.current = window.setInterval(() => {
      setStageIndex((s) => Math.min(s + 1, LOADING_STAGES.length - 1))
    }, STAGE_MS)

    try {
      const found = await discoverOpportunities(result)
      clearStageTimer()
      setOpportunities(found)
      writeCache(productName, channel, found)
      setStatus(found.length > 0 ? 'success' : 'empty')
    } catch (err) {
      clearStageTimer()
      setErrorMessage(
        err instanceof OpportunitiesError ? err.message : 'Something went wrong. Please try again.'
      )
      setStatus('error')
    } finally {
      inFlight.current = false
    }
  }, [result, channel, productName, clearStageTimer])

  const filtered = useMemo(
    () => opportunities.filter((o) => matchesFilter(o, filter)),
    [opportunities, filter]
  )

  if (!result || !channel) return <EmptyState />

  const channelLabel = CHANNEL_LABELS[channel]

  return (
    <div className="max-w-[880px] pb-4">
      <Reveal>
        <header className="mb-14 lg:mb-20">
          <Label className="mb-4">Growth Opportunities</Label>
          <h1 className="t-h1">Real conversations where your product may be able to help.</h1>
          <p className="t-body mt-5 max-w-[64ch]">
            Growwwly already told you your highest-leverage channel is {channelLabel.toLowerCase()}. This
            finds the actual, current conversations where you can act on that decision — every result comes
            from a real, sourced web search, never invented.
          </p>
        </header>
      </Reveal>

      <Reveal>
        <section className="border-t border-hairline pt-10">
          <Label>Highest-leverage channel</Label>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="t-h1">{channelLabel}</h2>
            <span className="t-meta">
              Opportunity Score <span className="tnum font-[550] text-ink">{opportunityScore}</span>
            </span>
          </div>

          {status !== 'loading' && (
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="mt-7"
              onClick={runDiscovery}
            >
              {status === 'idle' ? 'Find Opportunities' : 'Search again'}
            </Button>
          )}
        </section>
      </Reveal>

      {status === 'loading' && (
        <div className="mt-2">
          <LoadingNarration stageIndex={stageIndex} />
        </div>
      )}

      {status === 'error' && (
        <div className="mt-2 border-t border-hairline pt-10">
          <p className="t-h2">Opportunity discovery is temporarily unavailable.</p>
          <p className="t-body mt-2 max-w-[56ch] text-muted">{errorMessage}</p>
          <Button type="button" variant="secondary" className="mt-6" onClick={runDiscovery}>
            Retry
          </Button>
        </div>
      )}

      {status === 'empty' && (
        <div className="mt-2 border-t border-hairline pt-10">
          <p className="t-h2">No strong opportunities found yet.</p>
          <p className="t-body mt-2 max-w-[56ch] text-muted">
            Growwwly couldn&apos;t find current, genuinely relevant discussions this time. Try again in a
            while — real conversations come and go.
          </p>
          <Button type="button" variant="secondary" className="mt-6" onClick={runDiscovery}>
            Try again
          </Button>
        </div>
      )}

      {status === 'success' && (
        <Reveal>
          <section className="mt-2">
            <div className="border-t border-hairline pt-8">
              <OpportunityFilters active={filter} onChange={setFilter} />
            </div>

            {filtered.length === 0 ? (
              <p className="t-body mt-8 text-muted">No opportunities match this filter.</p>
            ) : (
              <div>
                {filtered.map((opportunity, i) => (
                  <OpportunityCard
                    key={opportunity.id}
                    opportunity={opportunity}
                    rank={i + 1}
                    onOpen={() => setSelected(opportunity)}
                    onDraftResponse={() => setSelected(opportunity)}
                  />
                ))}
              </div>
            )}
          </section>
        </Reveal>
      )}

      <OpportunityDetailModal opportunity={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
