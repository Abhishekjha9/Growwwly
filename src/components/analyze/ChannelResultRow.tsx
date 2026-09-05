import { Label, SignalBar } from '@/components/primitives'
import { cn } from '@/lib/cn'
import type { ChannelResult, Recommendation } from '@/types/growth'
import { CHANNEL_LABELS } from '@/lib/growth/constants'

const RECOMMENDATION_COPY: Record<Recommendation, string> = {
  recommended: 'Recommended',
  consider: 'Consider',
  deprioritize: 'Deprioritize',
}

function RecommendationTag({ kind }: { kind: Recommendation }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] tracking-[-0.002em]">
      {kind === 'deprioritize' ? (
        <span
          aria-hidden
          className="inline-block h-[7px] w-[7px] shrink-0 rounded-full border border-dashed border-faint"
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            'inline-block h-[6px] w-[6px] shrink-0 rounded-full',
            kind === 'recommended' ? 'bg-accent' : 'bg-muted'
          )}
        />
      )}
      <span className={kind === 'recommended' ? 'text-accent' : 'text-muted'}>
        {RECOMMENDATION_COPY[kind]}
      </span>
    </span>
  )
}

/**
 * One channel's framework result — opportunity score, recommendation and
 * rationale from the deterministic Growth Intelligence Engine, with
 * Gemini's own raw signal kept visually separate underneath so the two are
 * never mistaken for each other.
 */
export function ChannelResultRow({
  result,
  rank,
  lead = false,
}: {
  result: ChannelResult
  rank: number
  lead?: boolean
}) {
  const label = CHANNEL_LABELS[result.channel]

  return (
    <div className={cn('border-t border-hairline py-7 sm:py-8')}>
      <div className="grid grid-cols-[2.25rem_1fr_auto] items-baseline gap-x-4 sm:grid-cols-[2.75rem_1fr_auto] sm:gap-x-6">
        <span className={cn('t-meta tnum', lead ? 'text-accent' : 'text-muted')}>
          {String(rank).padStart(2, '0')}
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className={lead ? 't-h1' : 't-h2'}>{label}</span>
            <RecommendationTag kind={result.recommendation} />
          </div>
        </div>

        <span className="flex items-baseline gap-2">
          <span className={cn('tnum text-right', lead ? 't-h1 text-ink' : 't-h2 text-muted')}>
            {result.opportunityScore}
          </span>
          <Label>Opportunity</Label>
        </span>
      </div>

      <SignalBar value={result.opportunityScore} tone={lead ? 'accent' : 'muted'} className="mt-5" />

      <p className="t-body mt-5 max-w-[64ch] text-ink-2">{result.rationale}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="t-meta">
          Confidence <span className="font-[550] text-ink">{result.confidenceLabel}</span>
        </span>
        <span className="t-meta">
          Estimated effort <span className="font-[550] text-ink">{result.effortLabel}</span>
        </span>
        <span className="t-meta">
          Channel fit <span className="tnum font-[550] text-ink">{result.channelScore}</span>
        </span>
      </div>

      <div className="mt-5 rounded-[14px] bg-sunk px-5 py-4">
        <Label>AI signal</Label>
        <p className="t-meta mt-2 max-w-[64ch] text-muted">
          <span className="tnum font-[550] text-ink">{result.aiSignal.relevance}</span>/100 —{' '}
          {result.aiSignal.reasoning}
        </p>
      </div>
    </div>
  )
}
