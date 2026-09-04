/**
 * The story — three movements of one argument.
 *
 *   1  You are not short of signals.
 *   2  The work is deciding what they mean, together.
 *   3  Then you get one profile, not six disconnected facts.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { GrowthCore } from '@/growthcore/GrowthCore'
import { CORE_STATES, type CoreState } from '@/growthcore/state'
import { Label, Reveal } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { EASE, useReducedMotion } from '@/lib/motion'
import { SIGNALS, SIGNAL_READS } from '@/data/growth'

const SHELL = 'mx-auto w-full max-w-[1180px] px-5 sm:px-8 lg:px-10'

/* ------------------------------------------------------------------
   Movement heading
   ------------------------------------------------------------------ */

function Movement({ index, title, intro }: { index: string; title: string; intro?: string }) {
  return (
    <Reveal className="max-w-[46ch]">
      <Label>{index}</Label>
      <h2 className="t-title mt-5">{title}</h2>
      {intro && <p className="t-body-lg mt-6 max-w-[54ch] text-muted">{intro}</p>}
    </Reveal>
  )
}

/* ==================================================================
   ONE — the inputs
   ================================================================== */

function Inputs() {
  return (
    <section className={cn(SHELL, 'pt-28 lg:pt-40')}>
      <Movement
        index="One"
        title="You are not short of signals."
        intro="Your product, your customers, and the market you're selling into are each true on their own. None of them are ranked — which is why most growth advice starts with “it depends.”"
      />

      <ol className="mt-16 list-none p-0 lg:mt-20">
        {SIGNALS.map((s, i) => (
          <Reveal key={s.id} delay={i * 0.05} y={10}>
            <li className="grid grid-cols-[auto_1fr] items-baseline gap-x-5 border-t border-hairline py-6 sm:grid-cols-[3.5rem_13rem_1fr] sm:gap-x-8 sm:py-7">
              <span className="t-meta tnum text-ghost">{String(i + 1).padStart(2, '0')}</span>
              <span className="t-h3">{s.label}</span>
              <span className="t-body col-span-2 mt-2 text-muted sm:col-span-1 sm:mt-0">
                {SIGNAL_READS[s.id]}
              </span>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  )
}

/* ==================================================================
   TWO — the analysis, auto-paced
   ================================================================== */

const BEATS: ReadonlyArray<{ state: CoreState; caption: string }> = [
  { state: 'idle', caption: 'Six signals. No order.' },
  { state: 'analyzing', caption: 'Each one read against your product.' },
  { state: 'understanding', caption: 'The places they agree start to show.' },
  { state: 'prioritizing', caption: 'Everything that can wait, waits.' },
  { state: 'decision', caption: 'One profile, drawn from all of it.' },
]

function Analysis() {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const started = useInView(ref, { once: true, margin: '-120px' })
  const [beat, setBeat] = useState(0)

  useEffect(() => {
    if (!started || reduced) return
    if (beat >= BEATS.length - 1) return
    const t = window.setTimeout(() => setBeat((b) => b + 1), 1000)
    return () => window.clearTimeout(t)
  }, [started, beat, reduced])

  const current = BEATS[reduced ? BEATS.length - 1 : Math.min(beat, BEATS.length - 1)]
  const settled = current.state === 'decision'

  return (
    <section className="mt-32 lg:mt-48" aria-label="How the analysis works">
      <div ref={ref} className={cn(SHELL, 'flex flex-col items-center text-center')}>
        <Label>Two</Label>
        <h2 className="t-h1 mt-4 max-w-[22ch]">The work is deciding what they mean, together.</h2>

        <GrowthCore
          state={current.state}
          showLabels
          className="mt-10 h-[min(380px,40vh,76vw)] w-[min(380px,40vh,76vw)] lg:mt-12"
        />

        <div className="mt-8 flex h-16 w-full max-w-[34ch] items-start justify-center">
          <motion.p
            key={current.caption}
            initial={{ opacity: 0, y: reduced ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.42, ease: EASE.out }}
            className={cn('t-h3', settled ? 'text-ink' : 'text-muted')}
          >
            {current.caption}
          </motion.p>
        </div>

        <div className="mt-2 flex items-center gap-2" aria-hidden>
          {CORE_STATES.map((s, i) => (
            <span
              key={s}
              className={cn(
                'h-[3px] rounded-full transition-all duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
                i <= beat || reduced ? 'w-7 bg-ink' : 'w-4 bg-hairline-strong'
              )}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

/* ==================================================================
   THREE — the output
   ================================================================== */

function Decision() {
  return (
    <section className={cn(SHELL, 'mt-32 lg:mt-48')}>
      <Movement
        index="Three"
        title="One profile, not six disconnected facts."
        intro="Product, customer, problem, market signals, channel fit and growth context — read together, and handed back as one document you can act on."
      />

      <Reveal y={16} className="mt-14 lg:mt-18">
        <div className="rounded-2xl bg-surface px-6 py-11 shadow-soft sm:px-12 sm:py-14 lg:px-16 lg:py-16">
          <Label tone="accent">Product intelligence</Label>
          <p className="t-title mt-6 max-w-[26ch]">Who it&apos;s for, what it solves, and where it can grow.</p>
          <p className="t-body-lg mt-6 max-w-[58ch] text-muted">
            Every value comes labeled as what it is — read from what you told it, or the model&apos;s
            interpretation. Nothing is presented as a guarantee.
          </p>
        </div>
      </Reveal>
    </section>
  )
}

/* ------------------------------------------------------------------ */

export default function Story() {
  return (
    <div>
      <Inputs />
      <Analysis />
      <Decision />
    </div>
  )
}
