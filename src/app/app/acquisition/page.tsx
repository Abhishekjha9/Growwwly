/**
 * Acquisition — eight channels, ranked by Opportunity Score.
 *
 * The ranking, scores and recommendations here come from the deterministic
 * Growth Intelligence Engine (`@/lib/growth`), not from OpenAI. OpenAI's own
 * raw relevance signal is still shown for each channel, clearly separated,
 * so the two are never confused.
 */

'use client'

import { EmptyState } from '@/components/EmptyState'
import { Label, Reveal, SignalBar } from '@/components/primitives'
import { ChannelResultRow } from '@/components/analyze/ChannelResultRow'
import { CHANNEL_LABELS } from '@/lib/growth/constants'
import { useAnalysis } from '@/lib/analysis-store'

export default function AcquisitionPage() {
  const { result } = useAnalysis()
  if (!result) return <EmptyState />

  const { rankedChannels, summary } = result.growthIntelligence
  const { product } = result.productIntelligence

  return (
    <div className="max-w-[880px] pb-4">
      <Reveal>
        <header className="mb-14 lg:mb-20">
          <Label className="mb-4">Acquisition</Label>
          <h1 className="t-h1">Ranked channels</h1>
          <p className="t-body mt-5 max-w-[64ch]">
            Eight channels for {product.name}, ranked by Opportunity Score — a framework score our
            code computes from the model&apos;s market, product-fit and channel signals, tempered
            by confidence, effort and the constraints you gave us. Not a score OpenAI generated.
          </p>
          {summary.decisionType === 'test' && (
            <p className="t-body mt-4 max-w-[64ch] text-accent-ink">
              Top opportunities are closely matched, or overall confidence is low — worth testing
              before committing fully to one channel.
            </p>
          )}
        </header>
      </Reveal>

      <Reveal>
        <section aria-labelledby="sec-opportunity">
          <h2 id="sec-opportunity" className="t-h1 mb-4">
            Channel opportunity
          </h2>
          <div className="space-y-4">
            {rankedChannels.map((c, i) => (
              <div key={c.channel} className="flex items-center gap-4">
                <span className="w-[104px] shrink-0 t-meta text-ink sm:w-[132px]">
                  {CHANNEL_LABELS[c.channel]}
                </span>
                <SignalBar
                  value={c.opportunityScore}
                  tone={i === 0 ? 'accent' : 'muted'}
                  className="flex-1"
                />
                <span className="w-6 shrink-0 text-right tnum t-meta font-[550] text-ink">
                  {c.opportunityScore}
                </span>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal className="mt-16 lg:mt-24">
        <section>
          <div>
            {rankedChannels.map((c, i) => (
              <ChannelResultRow key={c.channel} result={c} rank={i + 1} lead={i === 0} />
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal className="mt-16 max-w-[62ch]">
        <p className="t-body text-muted">
          Opportunity Score weighs each channel&apos;s signal fit against the reliability of this
          analysis, the relative effort the channel takes to run, and your stated budget,
          experience and timeline. It moves as the product, and the analysis, do.
        </p>
      </Reveal>
    </div>
  )
}
