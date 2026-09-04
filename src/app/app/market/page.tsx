/**
 * Market — AI-generated signals about the market and audience fit.
 *
 * These are raw strategic signals from Gemini, not a scoring engine's
 * output. Phase 2 turns signals like these into ranked, deterministic
 * scores; this page only shows what the model currently reads.
 */

'use client'

import { EmptyState } from '@/components/EmptyState'
import { Label, Reveal } from '@/components/primitives'
import { SignalRow } from '@/components/analyze/SignalRow'
import { useAnalysis } from '@/lib/analysis-store'

export default function MarketPage() {
  const { result } = useAnalysis()
  if (!result) return <EmptyState />

  const { marketSignals, productFitSignals } = result

  return (
    <div className="max-w-[880px] pb-4">
      <Reveal>
        <header className="mb-14 lg:mb-20">
          <Label className="mb-4">Market</Label>
          <h1 className="t-h1">Market & audience signals</h1>
          <p className="t-body mt-5 max-w-[64ch]">
            AI-generated strategic signals, each scored 0–100 by the model. These describe
            direction, not a deterministic measurement — treat them as a starting read, not a
            final verdict.
          </p>
        </header>
      </Reveal>

      <Reveal>
        <section aria-labelledby="sec-market">
          <h2 id="sec-market" className="t-label mb-1">
            Market signals
          </h2>
          <div>
            <SignalRow label="Search intent" value={marketSignals.searchIntent} first />
            <SignalRow label="Community presence" value={marketSignals.communityPresence} />
            <SignalRow label="Visual content potential" value={marketSignals.visualContentPotential} />
            <SignalRow label="Word of mouth potential" value={marketSignals.wordOfMouthPotential} />
            <SignalRow label="Buyer accessibility" value={marketSignals.buyerAccessibility} />
            <SignalRow label="Market maturity" value={marketSignals.marketMaturity} />
          </div>
        </section>
      </Reveal>

      <Reveal className="mt-16 lg:mt-24">
        <section aria-labelledby="sec-fit">
          <h2 id="sec-fit" className="t-label mb-1">
            Product-fit signals
          </h2>
          <div>
            <SignalRow label="Technical audience fit" value={productFitSignals.technicalAudienceFit} first />
            <SignalRow label="Visual audience fit" value={productFitSignals.visualAudienceFit} />
            <SignalRow label="Community audience fit" value={productFitSignals.communityAudienceFit} />
            <SignalRow label="Search-driven problem" value={productFitSignals.searchDrivenProblem} />
            <SignalRow label="Impulse purchase potential" value={productFitSignals.impulsePurchasePotential} />
            <SignalRow label="Sales-led potential" value={productFitSignals.salesLedPotential} />
          </div>
        </section>
      </Reveal>
    </div>
  )
}
