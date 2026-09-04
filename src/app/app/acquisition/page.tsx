/**
 * Acquisition — eight channels, each with an AI relevance signal.
 *
 * Sorted by signal strength so the strongest reads first, but this is not a
 * ranking produced by a scoring engine — that's Phase 2. Each row is one
 * Gemini-generated estimate of fit for this specific product.
 */

'use client'

import { EmptyState } from '@/components/EmptyState'
import { Label, Reveal } from '@/components/primitives'
import { SignalRow } from '@/components/analyze/SignalRow'
import { useAnalysis } from '@/lib/analysis-store'
import type { ProductIntelligence } from '@/types/product'

const CHANNEL_LABELS: Record<keyof ProductIntelligence['channelSignals'], string> = {
  seo: 'SEO',
  outbound: 'Outbound',
  communities: 'Communities',
  content: 'Content',
  social: 'Social',
  partnerships: 'Partnerships',
  paidAds: 'Paid ads',
  referrals: 'Referrals',
}

export default function AcquisitionPage() {
  const { result } = useAnalysis()
  if (!result) return <EmptyState />

  const channels = (Object.keys(result.channelSignals) as Array<keyof typeof CHANNEL_LABELS>)
    .map((key) => ({
      key,
      label: CHANNEL_LABELS[key],
      ...result.channelSignals[key],
    }))
    .sort((a, b) => b.relevance - a.relevance)

  return (
    <div className="max-w-[880px] pb-4">
      <Reveal>
        <header className="mb-14 lg:mb-20">
          <Label className="mb-4">Acquisition</Label>
          <h1 className="t-h1">Channel signals</h1>
          <p className="t-body mt-5 max-w-[64ch]">
            An AI-generated relevance signal for each channel, for {result.product.name} specifically
            — not a ranked recommendation. The deterministic channel-ranking engine is planned for
            Phase 2.
          </p>
        </header>
      </Reveal>

      <Reveal>
        <section>
          <div className="flex items-baseline justify-between gap-4 pb-1">
            <Label>Channel</Label>
            <Label>AI signal</Label>
          </div>
          <div>
            {channels.map((c, i) => (
              <SignalRow key={c.key} label={c.label} value={c.relevance} reasoning={c.reasoning} first={i === 0} />
            ))}
          </div>
        </section>
      </Reveal>
    </div>
  )
}
