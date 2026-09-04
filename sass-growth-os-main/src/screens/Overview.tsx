/**
 * Overview — the page that answers "what should I do today?" before it
 * answers anything else.
 *
 * Deliberately not a dashboard. It opens as a page of writing, states one
 * decision at full size, then shows the reasoning that produced it and only
 * then the four numbers underneath. Everything below the recommendation is
 * support, and is sized like support.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { MetricRow, ReasoningChain } from '@/components/analytics'
import { Button, Label, ProvenanceTag, Score } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { DUR, EASE, T, calm, fade, rise, riseLg, stagger, useReducedMotion } from '@/lib/motion'
import { HEADLINE_ACTION, METRICS, PLAN, PROJECT } from '@/data/growth'

/* ------------------------------------------------------------------
   Small parts local to this page
   ------------------------------------------------------------------ */

/** Value over label, so a row of these aligns on the value baseline. */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="t-h3 tnum text-ink">{value}</div>
      <Label className="mt-2.5">{label}</Label>
    </div>
  )
}

/** Separates the stats without boxing them. Hidden once the row wraps. */
function StatRule() {
  return <span aria-hidden className="hidden h-9 w-px shrink-0 bg-hairline sm:block" />
}

const CTA_INK =
  'inline-flex h-12 items-center justify-center rounded-[14px] bg-ink px-6 text-[15px] font-[550] ' +
  'text-white shadow-[0_1px_2px_rgba(17,17,17,0.12)] transition-[background-color,transform] ' +
  'duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-black hover:-translate-y-px'

/* ------------------------------------------------------------------
   Screen
   ------------------------------------------------------------------ */

export default function Overview() {
  const reduced = useReducedMotion()
  const [why, setWhy] = useState(false)

  const page = reduced ? fade : stagger(0.07, 0.04)
  const block = calm(rise, reduced)
  const lead = calm(riseLg, reduced)

  return (
    <motion.div variants={page} initial="hidden" animate="show">
      {/* 1 — Editorial intro. No card, no metrics, no chrome. */}
      <motion.header variants={lead} className="pb-16 lg:pb-24">
        <h1 className="t-h1">
          Good morning.
          <br />
          <span className="text-muted">Here’s what deserves your attention.</span>
        </h1>
        {/* The top bar already owns freshness. This line earns its place by
            naming what the recommendation was built from instead. */}
        <p className="t-meta mt-5">
          Read from your product, your site and {PROJECT.analyticsSource} funnel data.
        </p>
      </motion.header>

      {/* 2 — The decision. The heaviest thing on the page, by a wide margin. */}
      <motion.section
        variants={block}
        aria-labelledby="headline-action"
        className="rounded-2xl bg-surface px-6 py-11 shadow-soft sm:px-12 sm:py-14 lg:px-16 lg:py-20"
      >
        <Label tone="accent">{HEADLINE_ACTION.label}</Label>

        <h2 id="headline-action" className="t-title mt-6 max-w-[26ch]">
          {HEADLINE_ACTION.statement}
        </h2>

        <p className="t-body-lg mt-6 max-w-[62ch] text-muted">{HEADLINE_ACTION.support}</p>

        <div className="mt-12 flex flex-wrap items-end gap-x-8 gap-y-9 sm:gap-x-10 lg:mt-14 lg:gap-x-14">
          <div>
            <Score value={HEADLINE_ACTION.score} size="lg" />
            <Label className="mt-3.5">Opportunity score</Label>
          </div>
          <StatRule />
          <Stat value={HEADLINE_ACTION.impact} label="Impact" />
          <StatRule />
          <Stat value={`${HEADLINE_ACTION.confidence}%`} label="Confidence" />
          <StatRule />
          <Stat value={HEADLINE_ACTION.effort} label="Effort" />
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-2 lg:mt-14">
          <Link to="/app/opportunities" className={CTA_INK}>
            View action
          </Link>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => setWhy((v) => !v)}
            aria-expanded={why}
            aria-controls="headline-evidence"
            iconRight={
              <motion.svg
                width="11"
                height="11"
                viewBox="0 0 12 12"
                aria-hidden
                animate={{ rotate: why ? 180 : 0 }}
                transition={reduced ? { duration: 0 } : T.micro}
              >
                <path
                  d="M2.5 4.4 L6 7.9 L9.5 4.4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.svg>
            }
          >
            Why?
          </Button>
        </div>

        {/* The evidence half of the contract. A document, not a modal. */}
        <div id="headline-evidence">
          <AnimatePresence initial={false}>
            {why && (
              <motion.div
                key="evidence"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: reduced ? 0 : DUR.standardSlow, ease: EASE.out }}
                className="overflow-hidden"
              >
                <div className="mt-12 border-t border-hairline pt-9 lg:mt-14">
                  <Label>Evidence</Label>
                  <div className="mt-2">
                    {HEADLINE_ACTION.evidence.map((item, i) => (
                      <div
                        key={item.claim}
                        className={cn('py-7', i > 0 && 'border-t border-hairline')}
                      >
                        <h3 className="t-h3 max-w-[54ch]">{item.claim}</h3>
                        <p className="t-body mt-2 max-w-[70ch]">{item.detail}</p>
                        <ProvenanceTag kind={item.provenance} className="mt-4" />
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.section>

      {/* 3 — The reasoning, drawn. Many signals collapsing into one move. */}
      <motion.section variants={block} className="mt-20 lg:mt-28">
        <Label>How we got here</Label>
        <ReasoningChain
          steps={HEADLINE_ACTION.chain}
          orientation="horizontal"
          className="mt-8 hidden md:block"
        />
        <ReasoningChain
          steps={HEADLINE_ACTION.chain}
          orientation="vertical"
          className="mt-8 md:hidden"
        />
      </motion.section>

      {/* 4 — The four numbers that produced the chain. Nothing else exists. */}
      <motion.section variants={block} className="mt-20 border-t border-hairline pt-10 lg:mt-28">
        <Label>Last 30 days</Label>
        <MetricRow metrics={METRICS} className="mt-8" />
      </motion.section>

      {/* 5 — Where this goes next. */}
      <motion.section variants={block} className="mt-20 border-t border-hairline pt-10 lg:mt-24">
        <Label>Next</Label>
        <h2 className="t-h2 mt-4">Your 30-day plan starts with diagnosis.</h2>
        <p className="t-body mt-3 max-w-[62ch]">{PLAN[0].summary}</p>
        <Link
          to="/app/plan"
          className="group mt-7 inline-flex items-center gap-1.5 text-[14px] font-[500] text-accent transition-colors duration-[180ms] hover:text-accent-ink"
        >
          Open the plan
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            aria-hidden
            className="transition-transform duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5"
          >
            <path
              d="M2.4 6 h6.7 M6.4 3.2 L9.2 6 L6.4 8.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </motion.section>
    </motion.div>
  )
}
