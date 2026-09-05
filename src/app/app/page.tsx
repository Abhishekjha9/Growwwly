/**
 * Overview — states the decision first, then the reasoning behind it.
 *
 * The highest-leverage action comes from the deterministic Growth
 * Intelligence Engine (`@/lib/growth`), not from Gemini — it's the one
 * thing on this page that isn't a raw AI signal or a direct read of the
 * founder's own answers.
 */

'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { EmptyState } from '@/components/EmptyState'
import { Confidence, Label, ProvenanceTag } from '@/components/primitives'
import { actionSubjectLabel } from '@/lib/growth/constants'
import { calm, rise, riseLg, stagger, useReducedMotion } from '@/lib/motion'
import { useAnalysis } from '@/lib/analysis-store'

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="t-h3 text-ink">{value}</div>
      <Label className="mt-2.5">{label}</Label>
    </div>
  )
}

function StatRule() {
  return <span aria-hidden className="hidden h-9 w-px shrink-0 bg-hairline sm:block" />
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

  return (
    <motion.div variants={page} initial="hidden" animate="show">
      <motion.header variants={lead} className="pb-16 lg:pb-24">
        <Label>{product.category}</Label>
        <h1 className="t-h1 mt-4">{product.name}</h1>
        <p className="t-body-lg mt-5 max-w-[64ch] text-muted">{product.description}</p>
      </motion.header>

      {/* The decision. Real, deterministic, and the heaviest thing on the page. */}
      <motion.section
        variants={block}
        aria-labelledby="headline-action"
        className="rounded-2xl bg-surface px-6 py-11 shadow-soft sm:px-12 sm:py-14 lg:px-16 lg:py-20"
      >
        <Label tone="accent">{DECISION_TYPE_COPY[action.decisionType]}</Label>

        <h2 id="headline-action" className="t-title mt-6 max-w-[26ch]">
          {action.title}
        </h2>

        <p className="t-body-lg mt-6 max-w-[62ch] text-muted">{action.reason}</p>

        <div className="mt-12 flex flex-wrap items-end gap-x-8 gap-y-9 sm:gap-x-10 lg:mt-14 lg:gap-x-14">
          <div>
            <div className="tnum text-[56px] font-[550] leading-[0.9] tracking-[-0.05em] text-ink">
              {action.opportunityScore}
            </div>
            <Label className="mt-3.5">Opportunity score</Label>
          </div>
          <StatRule />
          <Stat value={actionSubjectLabel(action.channel)} label={action.channel ? 'Channel' : 'Focus'} />
          <StatRule />
          <Stat value={action.expectedImpact} label="Expected impact" />
          <StatRule />
          <Stat value={action.effortLabel} label="Estimated effort" />
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-2 lg:mt-14">
          <Link
            href="/app/acquisition"
            className="inline-flex h-12 items-center justify-center rounded-[14px] bg-ink px-6 text-[15px] font-[550] text-white shadow-[0_1px_2px_rgba(17,17,17,0.12)] transition-[background-color,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-black hover:-translate-y-px"
          >
            See ranked channels
          </Link>
        </div>

        {action.evidence.length > 0 && (
          <div className="mt-12 border-t border-hairline pt-9 lg:mt-14">
            <Label>Why</Label>
            <ul className="mt-4 space-y-2.5">
              {action.evidence.map((item) => (
                <li key={item} className="t-body flex gap-2.5 text-ink-2">
                  <span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ghost" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </motion.section>

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
