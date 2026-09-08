/**
 * Market — AI-generated signals about the market and audience fit.
 *
 * These are raw strategic signals from the model, not a scoring engine's
 * output. Phase 2 turns signals like these into ranked, deterministic
 * scores; this page only shows what the model currently reads.
 */

'use client'

import { EmptyState } from '@/components/EmptyState'
import { Label, Reveal } from '@/components/primitives'
import { GrowthProfile } from '@/components/analyze/GrowthProfile'
import { useAnalysis } from '@/lib/analysis-store'

export default function MarketPage() {
  const { result } = useAnalysis()
  if (!result) return <EmptyState />

  const { marketSignals } = result.productIntelligence

  return (
    <div className="max-w-[880px] pb-4">
      <Reveal>
        <header className="mb-14 lg:mb-20">
          <Label className="mb-4">Market</Label>
          <h1 className="t-h1">Market signals</h1>
          <p className="t-body mt-5 max-w-[64ch]">
            AI-generated strategic signals, each scored 0–100 by the model. These describe
            direction, not a deterministic measurement — treat them as a starting read, not a
            final verdict.
          </p>
        </header>
      </Reveal>

      <Reveal>
        <section aria-labelledby="sec-market">
          <h2 id="sec-market" className="t-h1 mb-4">
            Market
          </h2>
          <GrowthProfile
            groups={[
              {
                label: 'Discovery',
                signals: [
                  { label: 'Search intent', value: marketSignals.searchIntent },
                  { label: 'Buyer accessibility', value: marketSignals.buyerAccessibility },
                ],
              },
              {
                label: 'Community',
                signals: [
                  { label: 'Community presence', value: marketSignals.communityPresence },
                  { label: 'Word of mouth potential', value: marketSignals.wordOfMouthPotential },
                ],
              },
              {
                label: 'Visual',
                signals: [
                  { label: 'Visual content potential', value: marketSignals.visualContentPotential },
                ],
              },
              {
                label: 'Maturity',
                signals: [{ label: 'Market maturity', value: marketSignals.marketMaturity }],
              },
            ]}
          />
        </section>
      </Reveal>
    </div>
  )
}
