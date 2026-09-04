/**
 * Experiment lab — where a recommendation finds out whether it was right.
 *
 * Every experiment is drawn on the same track: baseline on the left, target
 * on the right, and wherever the metric currently sits between them. Because
 * all three use the same track, "running", "shipped" and "not started" are
 * readable at a glance without a status badge anywhere on the page.
 *
 * The running experiment says out loud that it is too early to read. That
 * sentence is the whole point of the screen.
 */

import { motion } from 'motion/react'
import { Button, Label } from '@/components/primitives'
import { EmptyState } from '@/illustrations'
import { cn, mapRange } from '@/lib/cn'
import { EASE, calm, fade, rise, riseLg, stagger, useReducedMotion } from '@/lib/motion'
import { EXPERIMENTS, type Experiment } from '@/data/growth'

/* ------------------------------------------------------------------
   The track — one geometry, three meanings
   ------------------------------------------------------------------ */

function useDomain(e: Experiment) {
  const values = [e.baseline, e.target, e.current ?? e.baseline]
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = (hi - lo) * 0.18 || 1
  return { d0: lo - pad, d1: hi + pad }
}

function Track({ e }: { e: Experiment }) {
  const reduced = useReducedMotion()
  const { d0, d1 } = useDomain(e)
  const at = (v: number) => mapRange(v, d0, d1, 0, 100)

  const hasCurrent = typeof e.current === 'number'
  const beatTarget = hasCurrent && (e.current as number) >= e.target
  const running = e.status === 'running'

  return (
    <div className="w-full max-w-[520px]">
      {/* Current value, floating above where it actually sits. */}
      <div className="relative h-11">
        {hasCurrent && (
          <motion.div
            className="absolute -translate-x-1/2 whitespace-nowrap text-center"
            initial={{ opacity: 0, left: `${at(e.baseline)}%` }}
            whileInView={{ opacity: 1, left: `${at(e.current as number)}%` }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: reduced ? 0 : 0.85, ease: EASE.out }}
          >
            <span
              className={cn(
                't-h2 tnum',
                running ? 'text-accent' : beatTarget ? 'text-positive' : 'text-ink'
              )}
            >
              {(e.current as number).toFixed(1)}%
            </span>
          </motion.div>
        )}
      </div>

      <div className="relative h-3">
        {/* The span from baseline to target. */}
        <div aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-hairline" />

        {/* Distance travelled. */}
        {hasCurrent && (
          <motion.div
            aria-hidden
            className={cn(
              'absolute top-1/2 h-px -translate-y-1/2 origin-left',
              running ? 'bg-accent' : beatTarget ? 'bg-positive' : 'bg-ink'
            )}
            style={{ left: `${at(e.baseline)}%` }}
            initial={{ width: 0 }}
            whileInView={{ width: `${at(e.current as number) - at(e.baseline)}%` }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: reduced ? 0 : 0.85, ease: EASE.out }}
          />
        )}

        {/* Baseline tick. */}
        <span
          aria-hidden
          className="absolute top-1/2 h-2.5 w-px -translate-x-1/2 -translate-y-1/2 bg-hairline-strong"
          style={{ left: `${at(e.baseline)}%` }}
        />

        {/* Target — dashed, because it is a hope, not a measurement. */}
        <span
          aria-hidden
          className="absolute top-1/2 h-3.5 w-px -translate-x-1/2 -translate-y-1/2 border-l border-dashed border-faint"
          style={{ left: `${at(e.target)}%` }}
        />

        {/* Where it is now. */}
        {hasCurrent && (
          <motion.span
            aria-hidden
            className={cn(
              'absolute top-1/2 h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-[3px] ring-canvas',
              running ? 'bg-accent' : beatTarget ? 'bg-positive' : 'bg-ink'
            )}
            initial={{ left: `${at(e.baseline)}%`, scale: reduced ? 1 : 0.4 }}
            whileInView={{ left: `${at(e.current as number)}%`, scale: 1 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: reduced ? 0 : 0.85, ease: EASE.out }}
          />
        )}
      </div>

      {/* Ends, labelled. */}
      <div className="relative mt-3 h-8">
        <span
          className="t-meta tnum absolute -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${at(e.baseline)}%` }}
        >
          {e.baseline.toFixed(1)}%
          <span className="t-label mt-1 block">Baseline</span>
        </span>
        <span
          className="t-meta tnum absolute -translate-x-1/2 whitespace-nowrap text-right"
          style={{ left: `${at(e.target)}%` }}
        >
          {e.target.toFixed(1)}%
          <span className="t-label mt-1 block">Target</span>
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------
   Elapsed time — dashes, one per day
   ------------------------------------------------------------------ */

function Days({ elapsed, total }: { elapsed: number; total: number }) {
  return (
    <div>
      <Label>Elapsed</Label>
      <div className="mt-3 flex items-center gap-[3px]" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-3 w-[3px] rounded-full',
              i < elapsed ? 'bg-ink' : 'bg-hairline-strong'
            )}
          />
        ))}
      </div>
      <p className="t-meta tnum mt-3">
        Day {elapsed} of {total}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------
   One experiment
   ------------------------------------------------------------------ */

function Card({ e, index }: { e: Experiment; index: number }) {
  const reduced = useReducedMotion()
  const draft = e.status === 'draft'

  return (
    <motion.article
      initial={{ opacity: 0, y: reduced ? 0 : 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: reduced ? 0.2 : 0.6, ease: EASE.out, delay: reduced ? 0 : index * 0.06 }}
      className="border-t border-hairline py-12 first:border-t-0 first:pt-0"
    >
      <div className="grid grid-cols-1 gap-x-14 gap-y-10 lg:grid-cols-[1fr_20rem]">
        <div>
          <div className="flex items-center gap-3">
            <Label tone={e.status === 'running' ? 'accent' : 'faint'}>
              {e.status === 'running' ? 'Running' : e.status === 'complete' ? 'Shipped' : 'Not started'}
            </Label>
            <span className="t-meta text-muted">{e.metric}</span>
          </div>

          <h2 className={cn('mt-4 max-w-[34ch]', draft ? 't-h2 text-muted' : 't-h2')}>
            {e.hypothesis}
          </h2>

          {/* Result, where there is one. */}
          {e.result && (
            <div className="mt-8">
              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
                <span className="t-metric tnum text-positive">+{e.result.delta}%</span>
                <span className="t-meta tnum">{e.result.significance}% significance</span>
              </div>
              <p className="t-body mt-5 max-w-[62ch] text-ink">{e.result.learning}</p>
              <p className="t-meta mt-4">{e.result.decision}</p>
            </div>
          )}

          {/* The honest sentence. */}
          {e.status === 'running' && (
            <p className="t-body mt-7 max-w-[58ch] text-muted">
              Trending toward the target, but {e.daysTotal - e.daysElapsed} days short of a clean
              read. Nothing here is a result yet.
            </p>
          )}

          {draft && (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button variant="secondary">Start experiment</Button>
              <span className="t-meta">Designed for {e.daysTotal} days.</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-10">
          <Track e={e} />

          {!draft && (
            <div className="flex flex-wrap gap-x-12 gap-y-8">
              <Days elapsed={e.daysElapsed} total={e.daysTotal} />
              <div>
                <Label>Sample</Label>
                <div className="mt-3 flex items-baseline gap-4">
                  <span className="tnum text-[15px] font-[500] text-ink">
                    {e.sample.control.toLocaleString('en-US')}
                    <span className="t-label mt-1 block">Control</span>
                  </span>
                  <span className="tnum text-[15px] font-[500] text-ink">
                    {e.sample.variant.toLocaleString('en-US')}
                    <span className="t-label mt-1 block">Variant</span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.article>
  )
}

/* ------------------------------------------------------------------
   Screen
   ------------------------------------------------------------------ */

export default function Experiments() {
  const reduced = useReducedMotion()

  const page = reduced ? fade : stagger(0.07, 0.04)
  const block = calm(rise, reduced)
  const lead = calm(riseLg, reduced)

  const running = EXPERIMENTS.filter((e) => e.status === 'running').length
  const ordered = [
    ...EXPERIMENTS.filter((e) => e.status === 'running'),
    ...EXPERIMENTS.filter((e) => e.status === 'complete'),
    ...EXPERIMENTS.filter((e) => e.status === 'draft'),
  ]

  return (
    <motion.div variants={page} initial="hidden" animate="show">
      <motion.header variants={lead}>
        <Label>Experiments</Label>
        <h1 className="t-h1 mt-4 max-w-[24ch]">
          {running === 1 ? 'One experiment running.' : `${running} experiments running.`}
        </h1>
        <p className="t-body-lg mt-5 max-w-[62ch] text-muted">
          Each one starts as a recommendation and ends as a written learning — including the ones
          that fail. A result you never wrote down is a result you will have to find again.
        </p>
      </motion.header>

      {ordered.length === 0 ? (
        <motion.div variants={block} className="mt-20">
          <EmptyState
            kind="experiments"
            title="Nothing running yet."
            body="When you act on a recommendation, it becomes an experiment here — with a baseline, a target, and a date it will be read."
            action={<Button variant="primary">Design an experiment</Button>}
          />
        </motion.div>
      ) : (
        <motion.section variants={block} className="mt-16 lg:mt-20">
          {ordered.map((e, i) => (
            <Card key={e.id} e={e} index={i} />
          ))}
        </motion.section>
      )}
    </motion.div>
  )
}
