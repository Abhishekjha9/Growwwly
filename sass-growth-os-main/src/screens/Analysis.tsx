/**
 * /analyze — the analysis experience.
 *
 * Three states in one continuous scene: ask → narrate → decide.
 * Never a spinner. The Growth Core is the progress indicator; the hairline
 * beneath the narration is the only other one. No percentage, ever.
 *
 * Renders standalone (no AppShell), so it carries its own minimal top bar.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/cn'
import { EASE, T, useReducedMotion } from '@/lib/motion'
import { Button, Counter, Label, ProvenanceTag, StatusDot } from '@/components/primitives'
import { CoreMark, GrowthCore } from '@/growthcore/GrowthCore'
import type { CoreState } from '@/growthcore/state'
import { ANALYSIS_STEPS, HEADLINE_ACTION, PROJECT } from '@/data/growth'

type Phase = 'entry' | 'running' | 'done'

/** One step of narration. Slow enough to read, fast enough to feel decisive. */
const STEP_MS = 1100

/** The Core reorganises as the run progresses — it is the state, not a decoration. */
function coreStateFor(phase: Phase, step: number): CoreState {
  if (phase === 'entry') return 'idle'
  if (phase === 'done') return 'decision'
  if (step >= 4) return 'prioritizing'
  if (step >= 2) return 'understanding'
  return 'analyzing'
}

export default function Analysis() {
  const navigate = useNavigate()
  const reduced = useReducedMotion()

  const [phase, setPhase] = useState<Phase>('entry')
  const [url, setUrl] = useState<string>(PROJECT.url)
  const [step, setStep] = useState(0)

  const timers = useRef<number[]>([])

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }, [])

  // The run. Same sequence and timing under reduced motion — only the
  // transforms are dropped, never the narration.
  useEffect(() => {
    if (phase !== 'running') return
    clearTimers()
    ANALYSIS_STEPS.forEach((_, i) => {
      if (i === 0) return
      timers.current.push(window.setTimeout(() => setStep(i), i * STEP_MS))
    })
    timers.current.push(
      window.setTimeout(() => setPhase('done'), ANALYSIS_STEPS.length * STEP_MS)
    )
    return clearTimers
  }, [phase, clearTimers])

  useEffect(() => clearTimers, [clearTimers])

  const start = (e: FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    setStep(0)
    setPhase('running')
  }

  const reset = () => {
    clearTimers()
    setStep(0)
    setPhase('entry')
  }

  const coreState = coreStateFor(phase, step)
  const fill = (step + 1) / ANALYSIS_STEPS.length

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* Minimal bar — identity only. Nothing to click away to mid-run. */}
      <header className="flex items-center gap-2.5 px-6 py-6 sm:px-10">
        <CoreMark size={20} />
        <span className="text-[14.5px] font-[560] tracking-[-0.02em] text-ink">GrowthOS</span>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16 sm:px-10">
        <div className="flex w-full max-w-[680px] flex-col items-center">
          {/* The object persists from run into decision — same core, it travels.
              `layout`, not `layoutId`: it never unmounts between the two phases,
              so there is no second element for a shared id to pair with. */}
          {phase !== 'entry' && (
            <motion.div
              layout={!reduced}
              transition={T.sharedSoft}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                'shrink-0',
                phase === 'done'
                  ? 'h-[128px] w-[128px] sm:h-[144px] sm:w-[144px]'
                  : 'h-[200px] w-[200px] sm:h-[248px] sm:w-[248px]'
              )}
            >
              <GrowthCore three state={coreState} className="h-full w-full" />
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {/* ---- 1. Ask -------------------------------------------------- */}
            {phase === 'entry' && (
              <motion.div
                key="entry"
                className="w-full max-w-[560px]"
                initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : -28 }}
                transition={{ duration: reduced ? 0.2 : 0.45, ease: EASE.out }}
              >
                <Label>New analysis</Label>
                <h1 className="t-title mt-4">Which SaaS should we look at?</h1>

                <form onSubmit={start} className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <div className="flex h-14 flex-1 items-center rounded-md border border-hairline bg-surface pl-4 pr-3 transition-colors duration-[180ms] focus-within:border-hairline-strong">
                    <span aria-hidden className="select-none text-[16px] text-ghost">
                      https://
                    </span>
                    <input
                      autoFocus
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="yourcompany.com"
                      aria-label="Site to analyze"
                      spellCheck={false}
                      autoComplete="off"
                      className="h-full min-w-0 flex-1 bg-transparent pl-0.5 text-[16px] tracking-[-0.012em] text-ink outline-none placeholder:text-ghost"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!url.trim()}
                    className="h-14 rounded-md px-7 text-[15px]"
                  >
                    Analyze
                  </Button>
                </form>

                <p className="t-meta mt-4 max-w-[52ch]">
                  We’ll read your site, your positioning and — if connected — your funnel.
                </p>
              </motion.div>
            )}

            {/* ---- 2. Narrate ---------------------------------------------- */}
            {phase === 'running' && (
              <motion.div
                key="running"
                className="mt-12 w-full max-w-[460px]"
                initial={{ opacity: 0, y: reduced ? 0 : 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : -12 }}
                transition={{ duration: reduced ? 0.2 : 0.5, ease: EASE.out }}
              >
                <p className="t-meta text-center text-faint">{url}</p>

                <ol className="mt-7">
                  {ANALYSIS_STEPS.map((s, i) => {
                    const done = i < step
                    const current = i === step
                    return (
                      <li key={s.id} className="flex gap-3.5 py-2">
                        <span className="mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center">
                          {done ? (
                            <motion.span
                              initial={{ opacity: 0, scale: reduced ? 1 : 0.7 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: reduced ? 0.15 : 0.32, ease: EASE.out }}
                              className="flex"
                            >
                              <StatusDot status="pass" />
                            </motion.span>
                          ) : (
                            <span
                              aria-hidden
                              className={cn(
                                'h-[5px] w-[5px] rounded-full transition-colors duration-300',
                                current ? 'bg-accent' : 'bg-hairline-strong'
                              )}
                            />
                          )}
                        </span>

                        <div className="min-w-0">
                          <div
                            className={cn(
                              'text-[15px] tracking-[-0.014em] transition-colors duration-[400ms]',
                              current
                                ? 'font-[550] text-ink'
                                : done
                                  ? 'text-muted'
                                  : 'text-ghost'
                            )}
                          >
                            {s.label}
                          </div>
                          {/* Fixed slot — the list must not reflow as it narrates. */}
                          <div className="h-[18px] overflow-hidden">
                            <motion.p
                              className="t-meta truncate text-faint"
                              initial={false}
                              animate={{ opacity: current ? 1 : 0 }}
                              transition={{ duration: reduced ? 0.15 : 0.4, ease: EASE.out }}
                            >
                              {s.detail}
                            </motion.p>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ol>

                {/* The only progress indicator. No number attached to it. */}
                <div aria-hidden className="mt-8 h-px w-full bg-hairline">
                  <motion.div
                    className="h-px origin-left bg-ink"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: fill }}
                    transition={{ duration: reduced ? 0 : STEP_MS / 1000, ease: 'linear' }}
                  />
                </div>

                <p className="sr-only" aria-live="polite">
                  {ANALYSIS_STEPS[step]?.label ?? ''}
                </p>
              </motion.div>
            )}

            {/* ---- 3. Decide ------------------------------------------------ */}
            {phase === 'done' && (
              <motion.div
                key="done"
                className="mt-10 w-full max-w-[620px] text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduced ? 0.2 : 0.5, ease: EASE.out }}
              >
                <Staged delay={0} reduced={reduced}>
                  <Label>Analysis complete</Label>
                </Staged>

                <Staged delay={0.1} reduced={reduced}>
                  <h1 className="t-title mt-4">We found your next move.</h1>
                </Staged>

                {/* The recommendation lands last, and outweighs everything above it. */}
                <Staged delay={0.5} reduced={reduced}>
                  <div className="mt-10 border-t border-hairline pt-9">
                    <div className="flex items-center justify-center gap-3">
                      <Label tone="accent">{HEADLINE_ACTION.label}</Label>
                      <ProvenanceTag kind="inferred" showLabel={false} />
                    </div>
                    <p className="t-h1 mx-auto mt-4 max-w-[19ch] text-ink">
                      {HEADLINE_ACTION.statement}
                    </p>
                    <p className="t-body mx-auto mt-4 max-w-[54ch]">{HEADLINE_ACTION.support}</p>
                  </div>
                </Staged>

                <Staged delay={0.66} reduced={reduced}>
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
                    <span className="flex items-baseline gap-2">
                      <span className="tnum text-[30px] font-[550] leading-none tracking-[-0.04em] text-accent">
                        <Counter to={HEADLINE_ACTION.score} />
                      </span>
                      <span className="t-meta">score</span>
                    </span>
                    <Rule />
                    <Datum label="Impact" value={HEADLINE_ACTION.impact} />
                    <Rule />
                    <Datum label="Confidence" value={`${HEADLINE_ACTION.confidence}%`} />
                    <Rule />
                    <Datum label="Effort" value={HEADLINE_ACTION.effort} />
                  </div>
                </Staged>

                <Staged delay={0.82} reduced={reduced}>
                  <div className="mt-11 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={() => navigate('/app')}
                      className="w-full sm:w-auto"
                    >
                      View your dashboard
                    </Button>
                    <Button variant="ghost" size="lg" onClick={reset} className="w-full sm:w-auto">
                      Analyze another site
                    </Button>
                  </div>
                </Staged>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------
   Staged — the completion reveals in beats, not all at once.
   ------------------------------------------------------------------ */

function Staged({
  delay,
  reduced,
  children,
}: {
  delay: number
  reduced: boolean
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0.25 : 0.7, ease: EASE.out, delay }}
    >
      {children}
    </motion.div>
  )
}

/* ------------------------------------------------------------------
   Supporting data — quiet, inline, subordinate to the statement.
   ------------------------------------------------------------------ */

function Datum({ label, value }: { label: string; value: string }) {
  return (
    <span className="t-meta">
      {label} <span className="tnum font-[550] text-ink">{value}</span>
    </span>
  )
}

function Rule() {
  return <span aria-hidden className="hidden h-3 w-px bg-hairline sm:block" />
}
