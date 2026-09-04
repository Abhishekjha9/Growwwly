/**
 * The story — four movements of one argument.
 *
 *   1  You are not short of signals.
 *   2  The work is deciding which one matters.   ← scroll drives the object
 *   3  One decision, sized like a decision.
 *   4  Then you find out whether you were right.
 *
 * The middle movement is the product. Scrolling *is* the analysis: the reader
 * advances the object through its five states with their own hand, so the
 * collapse from six signals to one move is something they did rather than
 * something they were shown.
 */

import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { GrowthCore } from '@/growthcore/GrowthCore'
import { CORE_STATES, SIGNALS, type CoreState } from '@/growthcore/state'
import { ReasoningChain } from '@/components/analytics'
import { Label, Reveal } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { EASE, useReducedMotion } from '@/lib/motion'
import { EXPERIMENTS, HEADLINE_ACTION } from '@/data/growth'

gsap.registerPlugin(ScrollTrigger)

const SHELL = 'mx-auto w-full max-w-[1180px] px-5 sm:px-8 lg:px-10'

/* ------------------------------------------------------------------
   Movement heading — the same setting every time, so the four
   movements read as one piece rather than four sections.
   ------------------------------------------------------------------ */

function Movement({
  index,
  title,
  intro,
}: {
  index: string
  title: string
  intro?: string
}) {
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

/** What each signal actually contributes. Named, so it isn't hand-waving. */
const SIGNAL_READS: Record<string, string> = {
  website: 'Structure, clarity, and the path to the primary action',
  seo: 'Ten technical checks, plus the demand you could plausibly win',
  customers: 'Who buys, what they replaced, and why they stayed',
  pricing: 'What you charge against what the model can support',
  analytics: 'Every stage of the funnel, and where it actually leaks',
  acquisition: 'Six channels scored against this buyer, not a generic one',
}

function Inputs() {
  return (
    <section className={cn(SHELL, 'pt-28 lg:pt-40')}>
      <Movement
        index="One"
        title="You are not short of signals."
        intro="You are short of an answer. Six sources, each of them true, none of them ranked — which is why the honest response to most growth advice is “sure, but where do I start?”"
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
   TWO — the analysis, driven by the reader's scroll
   ================================================================== */

const BEATS: ReadonlyArray<{ state: CoreState; caption: string }> = [
  { state: 'idle', caption: 'Six signals. No order.' },
  { state: 'analyzing', caption: 'Each one read against your product.' },
  { state: 'understanding', caption: 'The places they agree start to show.' },
  { state: 'prioritizing', caption: 'Everything that can wait, waits.' },
  { state: 'decision', caption: 'One move left standing.' },
]

function Analysis() {
  const reduced = useReducedMotion()
  const scope = useRef<HTMLDivElement>(null)
  const [beat, setBeat] = useState(0)

  useEffect(() => {
    // Reduced motion reads the conclusion. No scroll-linked object.
    if (reduced) {
      setBeat(BEATS.length - 1)
      return
    }

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: scope.current,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          // Hold the last beat for the final stretch so the decision rests.
          const p = gsap.utils.clamp(0, 0.999, self.progress / 0.86)
          setBeat(Math.floor(p * BEATS.length))
        },
      })
    }, scope)

    return () => ctx.revert()
  }, [reduced])

  const current = BEATS[Math.min(beat, BEATS.length - 1)]
  const settled = current.state === 'decision'

  return (
    <section
      ref={scope}
      className={cn('relative mt-32 lg:mt-48', !reduced && 'h-[420vh]')}
      aria-label="How the analysis works"
    >
      <div
        className={cn(
          'flex flex-col items-center justify-center',
          reduced ? 'py-16' : 'sticky top-0 h-dvh'
        )}
      >
        <div className={cn(SHELL, 'flex flex-col items-center text-center')}>
          <Label>Two</Label>
          <h2 className="t-h1 mt-4 max-w-[22ch]">The work is deciding which one matters.</h2>

          <GrowthCore
            state={current.state}
            showLabels
            className="mt-10 h-[min(380px,40vh,76vw)] w-[min(380px,40vh,76vw)] lg:mt-12"
          />

          {/* The caption changes; the space it occupies never does. */}
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

          {/* Progress, drawn as five marks rather than a bar. */}
          <div className="mt-2 flex items-center gap-2" aria-hidden>
            {CORE_STATES.map((s, i) => (
              <span
                key={s}
                className={cn(
                  'h-[3px] rounded-full transition-all duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
                  i <= beat ? 'w-7 bg-ink' : 'w-4 bg-hairline-strong'
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ==================================================================
   THREE — the output
   ================================================================== */

const FACETS: ReadonlyArray<{ value: string; label: string }> = [
  { value: String(HEADLINE_ACTION.score), label: 'Opportunity score' },
  { value: HEADLINE_ACTION.impact, label: 'Impact' },
  { value: `${HEADLINE_ACTION.confidence}%`, label: 'Confidence' },
  { value: HEADLINE_ACTION.effort, label: 'Effort' },
]

function Decision() {
  return (
    <section className={cn(SHELL, 'mt-32 lg:mt-48')}>
      <Movement
        index="Three"
        title="One decision, sized like a decision."
        intro="Not a dashboard of things you could look at. One sentence, at the top, with the reasoning that produced it kept directly underneath — so you can disagree with it."
      />

      {/* The only filled surface in the entire story. */}
      <Reveal y={16} className="mt-14 lg:mt-18">
        <div className="rounded-2xl bg-surface px-6 py-11 shadow-soft sm:px-12 sm:py-14 lg:px-16 lg:py-16">
          <Label tone="accent">{HEADLINE_ACTION.label}</Label>
          <p className="t-title mt-6 max-w-[24ch]">{HEADLINE_ACTION.statement}</p>

          <div className="mt-12 flex flex-wrap gap-x-10 gap-y-8 lg:gap-x-16">
            {FACETS.map((f) => (
              <div key={f.label}>
                <div className="t-h2 tnum text-ink">{f.value}</div>
                <Label className="mt-2.5">{f.label}</Label>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal y={12} className="mt-16 lg:mt-20">
        <Label>The reasoning, in full</Label>
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
      </Reveal>
    </section>
  )
}

/* ==================================================================
   FOUR — the loop closes
   ================================================================== */

const SHIPPED = EXPERIMENTS.find((e) => e.status === 'complete')

const LOOP: ReadonlyArray<{ step: string; body: string }> = [
  { step: 'Act', body: 'The recommendation arrives as a four-week plan, not a suggestion to “improve onboarding”.' },
  { step: 'Measure', body: 'One primary metric, one guardrail, a fixed window. Read it at the end, not on day two.' },
  { step: 'Diagnose', body: 'Whatever the result says, it is written down — including when the answer is no.' },
  { step: 'Decide again', body: 'The next highest-leverage move is re-ranked against what you just learned.' },
]

function Loop() {
  return (
    <section className={cn(SHELL, 'mt-32 lg:mt-48')}>
      <Movement
        index="Four"
        title="Then you find out whether you were right."
        intro="A recommendation you never measure is just an opinion with better formatting. Every action becomes an experiment, and every experiment ends in a written learning."
      />

      <div className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:mt-18 lg:grid-cols-4">
        {LOOP.map((l, i) => (
          <Reveal key={l.step} delay={i * 0.06} y={10}>
            <div className="border-t border-hairline pt-6">
              <div className="flex items-baseline gap-3">
                <span className="t-meta tnum text-ghost">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="t-h3">{l.step}</h3>
              </div>
              <p className="t-body mt-3 text-muted">{l.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      {/* A real closed loop, quoted from the lab. Proof the cycle terminates. */}
      {SHIPPED?.result && (
        <Reveal y={12} className="mt-20 lg:mt-24">
          <div className="border-t border-hairline pt-10">
            <Label>A loop that closed</Label>
            <div className="mt-6 flex flex-wrap items-baseline gap-x-5 gap-y-2">
              <span className="t-metric tnum text-accent">+{SHIPPED.result.delta}%</span>
              <span className="t-h3 text-ink">{SHIPPED.metric}</span>
              <span className="t-meta tnum">{SHIPPED.result.significance}% significance</span>
            </div>
            <p className="t-body mt-5 max-w-[68ch]">{SHIPPED.result.learning}</p>
            <p className="t-meta mt-4">{SHIPPED.result.decision}</p>
          </div>
        </Reveal>
      )}
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
      <Loop />
    </div>
  )
}
