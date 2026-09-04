/**
 * Overview — the grounded summary of the analysis.
 *
 * No opportunity score, no ranked "next move" — that scoring engine is
 * Phase 2. This page states what the model found and how confident it is,
 * then points at the sections with the detail behind it.
 */

'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { EmptyState } from '@/components/EmptyState'
import { Confidence, Label, ProvenanceTag } from '@/components/primitives'
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

export default function Overview() {
  const reduced = useReducedMotion()
  const { result } = useAnalysis()

  const page = reduced ? { hidden: {}, show: {} } : stagger(0.07, 0.04)
  const block = calm(rise, reduced)
  const lead = calm(riseLg, reduced)

  if (!result) {
    return <EmptyState />
  }

  const { product, growthContext, constraints, confidence } = result

  return (
    <motion.div variants={page} initial="hidden" animate="show">
      <motion.header variants={lead} className="pb-16 lg:pb-24">
        <Label>{product.category}</Label>
        <h1 className="t-h1 mt-4">{product.name}</h1>
        <p className="t-body-lg mt-5 max-w-[64ch] text-muted">{product.description}</p>
      </motion.header>

      <motion.section
        variants={block}
        aria-labelledby="growth-context"
        className="rounded-2xl bg-surface px-6 py-11 shadow-soft sm:px-12 sm:py-14 lg:px-16 lg:py-16"
      >
        <Label tone="accent">Growth context</Label>
        <h2 id="growth-context" className="t-title mt-6 max-w-[32ch]">
          {growthContext.currentStage} — moving toward a {growthContext.likelyAcquisitionMotion} motion.
        </h2>
        <ProvenanceTag kind="inferred" className="mt-5" />

        <div className="mt-12 flex flex-wrap items-end gap-x-8 gap-y-9 sm:gap-x-10 lg:mt-14 lg:gap-x-14">
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
            <p className="t-meta mt-2">Eight channels, read for this specific product.</p>
          </Link>
        </div>
      </motion.section>
    </motion.div>
  )
}
