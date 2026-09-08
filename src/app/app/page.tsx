/**
 * Overview — states the decision first, then the reasoning behind it.
 *
 * The highest-leverage action comes from the deterministic Growth
 * Intelligence Engine (`@/lib/growth`), not from Gemini — it's the one
 * thing on this page that isn't a raw AI signal or a direct read of the
 * founder's own answers. It gets the loudest surface in the system: the
 * dark Statement panel, not another card among equals.
 */

'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { EmptyState } from '@/components/EmptyState'
import { Button, Confidence, Label, ProvenanceTag, Statement } from '@/components/primitives'
import { DownloadReportButton } from '@/components/analyze/DownloadReportButton'
import { actionSubjectLabel, CHANNEL_LABELS } from '@/lib/growth/constants'
import { calm, rise, riseLg, stagger, useReducedMotion } from '@/lib/motion'
import { useAnalysis } from '@/lib/analysis-store'

function Stat({ value, label, tone = 'ink' }: { value: string; label: string; tone?: 'ink' | 'shell' }) {
  return (
    <div>
      <div className={tone === 'shell' ? 't-h3 text-shell-ink' : 't-h3 text-ink'}>{value}</div>
      <Label className={tone === 'shell' ? 'mt-2.5 text-shell-faint' : 'mt-2.5'}>{label}</Label>
    </div>
  )
}

function StatRule({ tone = 'ink' }: { tone?: 'ink' | 'shell' }) {
  return (
    <span
      aria-hidden
      className={
        tone === 'shell'
          ? 'hidden h-9 w-px shrink-0 bg-[rgba(245,222,222,0.16)] sm:block'
          : 'hidden h-9 w-px shrink-0 bg-hairline sm:block'
      }
    />
  )
}

const DECISION_TYPE_COPY: Record<'commit' | 'test', string> = {
  commit: 'Current highest-leverage action',
  test: 'Worth testing first',
}

export default function Overview() {
  const reduced = useReducedMotion()
  const { result } = useAnalysis()

  const page = reduced ? { hidden: {}, show: {} } : stagger(0.07, 0.04)
  const block = calm(rise, reduced)
  const lead = calm(riseLg, reduced)

  if (!result) {
    return <EmptyState />
  }

  const { productIntelligence, growthIntelligence } = result
  const { product, growthContext, constraints, confidence } = productIntelligence
  const { highestLeverageAction: action } = growthIntelligence

  const wordmarkLines = action.channel ? [CHANNEL_LABELS[action.channel]] : ['GROWWWLY']

  return (
    <motion.div variants={page} initial="hidden" animate="show">
      <motion.header variants={lead} className="pb-16 lg:pb-24">
        <Label>{product.category}</Label>
        <h1 className="t-h1 mt-4">{product.name}</h1>
        <p className="t-body-lg mt-5 max-w-[64ch] text-muted">{product.description}</p>
      </motion.header>

      {/* The decision. Real, deterministic, and the loudest surface in the system. */}
      <motion.div variants={block}>
        <Statement wordmark={wordmarkLines} className="px-6 py-11 sm:px-12 sm:py-14 lg:px-16 lg:py-20">
          <Label className="text-shell-accent">YOUR NEXT MOVE</Label>
          <p className="t-meta mt-2 text-shell-faint">{DECISION_TYPE_COPY[action.decisionType]}</p>

          <h2 className="t-title mt-6 max-w-[26ch] text-shell-ink">{action.title}</h2>

          <p className="t-body-lg mt-6 max-w-[62ch] text-shell-muted">{action.reason}</p>

          <div className="mt-12 flex flex-wrap items-end gap-x-8 gap-y-9 sm:gap-x-10 lg:mt-14 lg:gap-x-14">
            <div>
              <div className="t-metric-xl tnum text-shell-ink">{action.opportunityScore}</div>
              <Label className="mt-3.5 text-shell-faint">Opportunity score</Label>
            </div>
            <StatRule tone="shell" />
            <Stat
              tone="shell"
              value={actionSubjectLabel(action.channel)}
              label={action.channel ? 'Channel' : 'Focus'}
            />
            <StatRule tone="shell" />
            <Stat tone="shell" value={action.expectedImpact} label="Expected impact" />
            <StatRule tone="shell" />
            <Stat tone="shell" value={action.effortLabel} label="Estimated effort" />
          </div>

          {action.evidence.length > 0 && (
            <div className="mt-12 border-t border-[rgba(245,222,222,0.14)] pt-9 lg:mt-14">
              <Label className="text-shell-faint">Why</Label>
              <ul className="mt-4 space-y-2.5">
                {action.evidence.map((item) => (
                  <li key={item} className="t-body flex gap-2.5 text-shell-ink-2">
                    <span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-shell-faint" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Statement>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/app/acquisition">
            <Button variant="primary" size="lg">
              See ranked channels
            </Button>
          </Link>
          <DownloadReportButton analysis={result} />
        </div>
      </motion.div>

      <motion.section
        variants={block}
        aria-labelledby="growth-context"
        className="mt-20 border-t border-hairline pt-10 lg:mt-28"
      >
        <Label tone="accent">Growth context</Label>
        <h2 id="growth-context" className="t-h1 mt-4 max-w-[32ch]">
          {growthContext.currentStage} — moving toward a {growthContext.likelyAcquisitionMotion} motion.
        </h2>
        <ProvenanceTag kind="inferred" className="mt-5" />

        <div className="mt-10 flex flex-wrap items-end gap-x-8 gap-y-9 sm:gap-x-10 lg:gap-x-14">
          <Stat value={growthContext.expectedSalesCycle} label="Expected sales cycle" />
          <StatRule />
          <Stat value={growthContext.estimatedCustomerValue} label="Estimated customer value" />
          <StatRule />
          <Stat value={constraints.budgetLevel} label="Budget level" />
          <StatRule />
          <Stat value={constraints.timeToResultsRequired} label="Time to results" />
        </div>
      </motion.section>

      <motion.section variants={block} className="mt-20 border-t border-hairline pt-10 lg:mt-28">
        <Label>Model confidence</Label>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
          <Confidence value={confidence.overall} className="text-[15px]" />
        </div>
        <p className="t-body mt-4 max-w-[64ch]">{confidence.reasoning}</p>
      </motion.section>

      <motion.section variants={block} className="mt-20 border-t border-hairline pt-10 lg:mt-24">
        <Label>Explore the profile</Label>
        <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-3">
          <Link href="/app/product" className="group">
            <h3 className="t-h3 transition-colors duration-150 group-hover:text-accent">Product & customer</h3>
            <p className="t-meta mt-2">Who it&apos;s for, the problem, and who buys.</p>
          </Link>
          <Link href="/app/market" className="group">
            <h3 className="t-h3 transition-colors duration-150 group-hover:text-accent">Market signals</h3>
            <p className="t-meta mt-2">Search intent, community, and audience fit.</p>
          </Link>
          <Link href="/app/acquisition" className="group">
            <h3 className="t-h3 transition-colors duration-150 group-hover:text-accent">Acquisition</h3>
            <p className="t-meta mt-2">Eight channels, ranked by opportunity score.</p>
          </Link>
        </div>
      </motion.section>
    </motion.div>
  )
}
