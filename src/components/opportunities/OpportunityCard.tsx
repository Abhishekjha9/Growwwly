/**
 * One opportunity — a real, sourced web discussion the deterministic ranking
 * in `@/lib/opportunities/rank` scored for this product. Row-based, no card
 * shadow or border, same editorial idiom as `ChannelResultRow` — a dot +
 * word for the "high opportunity" state rather than a colored badge.
 */

import { Label, SignalBar } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { HIGH_OPPORTUNITY_THRESHOLD, SOURCE_TYPE_LABELS } from '@/lib/opportunities/constants'
import type { Opportunity } from '@/types/opportunities'

function HighOpportunityTag() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] tracking-[-0.002em]">
      <span aria-hidden className="inline-block h-[6px] w-[6px] shrink-0 rounded-full bg-accent" />
      <span className="text-accent">High opportunity</span>
    </span>
  )
}

export function OpportunityCard({
  opportunity,
  rank,
  onOpen,
  onDraftResponse,
}: {
  opportunity: Opportunity
  rank: number
  onOpen: () => void
  onDraftResponse: () => void
}) {
  const isHigh = opportunity.opportunityScore >= HIGH_OPPORTUNITY_THRESHOLD

  const metaParts = [SOURCE_TYPE_LABELS[opportunity.sourceType], opportunity.source].filter(Boolean)
  if (opportunity.publishedAt) metaParts.push(opportunity.publishedAt)
  if (opportunity.commentCount !== undefined) {
    metaParts.push(`${opportunity.commentCount.toLocaleString('en-US')} comments`)
  }

  return (
    <div className="border-t border-hairline py-6 sm:py-7">
      <div className="grid grid-cols-[2.25rem_1fr_auto] items-baseline gap-x-4 sm:grid-cols-[2.75rem_1fr_auto] sm:gap-x-6">
        <span className={cn('t-meta tnum', isHigh ? 'text-accent' : 'text-muted')}>
          {String(rank).padStart(2, '0')}
        </span>

        <div className="min-w-0">
          {isHigh && (
            <div className="mb-1.5">
              <HighOpportunityTag />
            </div>
          )}
          <button type="button" onClick={onOpen} className="t-h2 text-left hover:text-accent-ink">
            {opportunity.title}
          </button>
          <p className="t-meta mt-1.5 text-faint">{metaParts.join(' · ')}</p>
        </div>

        {/* The score is the number a founder scans for first — always
            prominent, not just on the single highest card. */}
        <span className="flex items-baseline gap-2">
          <span className="tnum text-right text-[30px] font-[550] leading-none text-ink">
            {opportunity.opportunityScore}
          </span>
          <Label>Opportunity</Label>
        </span>
      </div>

      <SignalBar value={opportunity.opportunityScore} tone={isHigh ? 'accent' : 'muted'} className="mt-4" />

      <div className="mt-4 rounded-[14px] bg-sunk px-4 py-3.5">
        <Label>Why this matters</Label>
        <p className="t-meta mt-1.5 line-clamp-2 max-w-[64ch] text-muted">{opportunity.reason}</p>
      </div>

      {opportunity.matchingSignals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {opportunity.matchingSignals.map((signal) => (
            <span
              key={signal}
              className="inline-flex items-center rounded-full bg-[rgba(31,13,17,0.045)] px-3 py-1 text-[12px] text-muted"
            >
              {signal}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a
          href={opportunity.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center rounded-[11px] border border-hairline px-3.5 text-[13px] font-[550] text-ink transition-colors hover:border-hairline-strong hover:bg-[#fdf6f4]"
        >
          View discussion ↗
        </a>
        <button
          type="button"
          onClick={onDraftResponse}
          className="inline-flex h-9 items-center rounded-[11px] px-3.5 text-[13px] font-[550] text-accent transition-colors hover:bg-accent-soft"
        >
          Draft response
        </button>
      </div>
    </div>
  )
}
