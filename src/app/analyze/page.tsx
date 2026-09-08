/**
 * /analyze — the product's front door.
 *
 * Four states in one continuous scene: ask → narrate → decide. Entry is a
 * wide editorial two-column composition (who we are, then the form);
 * running/done/error share a single narrow centered column. The Growth Core
 * marks done/error; a stage-based progress ring marks running — mapped to
 * real named analysis stages, never a fabricated precise percentage.
 *
 * Renders standalone (no AppShell), so it carries its own minimal top bar.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { EASE, T, useReducedMotion } from '@/lib/motion'
import { BackgroundWordmark, Button, Label, ProgressRing } from '@/components/primitives'
import { TextField, TextAreaField } from '@/components/analyze/Field'
import { GrowthCore, CoreMark } from '@/growthcore/GrowthCore'
import type { CoreState } from '@/growthcore/state'
import { PROJECT, buildAnalysisSteps } from '@/data/growth'
import { actionSubjectLabel } from '@/lib/growth/constants'
import { analyzeProduct, AnalyzeProductError } from '@/lib/api/analyze-product'
import { useAnalysis } from '@/lib/analysis-store'
import type { ProductAnalysisRequest } from '@/types/product'
import type { AnalysisResult } from '@/types/analysis'

type Phase = 'entry' | 'running' | 'done' | 'error'

/** Narration paces itself — the real request runs independently and may
 * finish sooner or later than the steps do. */
const STEP_MS = 1600

interface FormState {
  name: string
  description: string
  url: string
  targetCustomer: string
  pricing: string
  currentUsers: string
  budget: string
  marketingExperience: string
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  url: '',
  targetCustomer: '',
  pricing: '',
  currentUsers: '',
  budget: '',
  marketingExperience: '',
}

function toRequest(form: FormState): ProductAnalysisRequest {
  const req: Record<string, unknown> = {
    name: form.name.trim(),
    description: form.description.trim(),
  }
  if (form.url.trim()) req.url = form.url.trim()
  if (form.targetCustomer.trim()) req.targetCustomer = form.targetCustomer.trim()
  if (form.pricing.trim()) req.pricing = form.pricing.trim()
  if (form.budget.trim()) req.budget = form.budget.trim()
  if (form.marketingExperience.trim()) req.marketingExperience = form.marketingExperience.trim()
  if (form.currentUsers.trim()) {
    const n = parseInt(form.currentUsers, 10)
    if (!Number.isNaN(n) && n >= 0) req.currentUsers = n
  }
  return req as ProductAnalysisRequest
}

function coreStateFor(phase: Phase, step: number): CoreState {
  if (phase === 'entry') return 'idle'
  if (phase === 'done') return 'decision'
  if (phase === 'error') return 'idle'
  if (step >= 3) return 'prioritizing'
  if (step >= 1) return 'understanding'
  return 'analyzing'
}

/** A stage-based read of progress — each real named stage advances the ring
 * by an equal share, and running never claims 100%: that number is earned
 * only once the actual request has resolved. Not a fabricated backend
 * percentage, just the same honest "which of N named stages are we on" the
 * old hairline bar used, presented as a ring instead of a line. */
function percentFor(step: number, totalSteps: number): number {
  return Math.min(96, Math.round(((step + 1) / totalSteps) * 100))
}

export default function AnalyzePage() {
  const router = useRouter()
  const reduced = useReducedMotion()
  const { setResult } = useAnalysis()

  const [phase, setPhase] = useState<Phase>('entry')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [showMore, setShowMore] = useState(false)
  const [step, setStep] = useState(0)
  const [steps, setSteps] = useState(() => buildAnalysisSteps(false))
  const [errorMessage, setErrorMessage] = useState('')
  const [profile, setProfile] = useState<AnalysisResult | null>(null)

  const narrationTimer = useRef<number | null>(null)

  const clearNarration = useCallback(() => {
    if (narrationTimer.current) window.clearInterval(narrationTimer.current)
    narrationTimer.current = null
  }, [])

  useEffect(() => clearNarration, [clearNarration])

  const field = (key: keyof FormState) => (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const runAnalysis = useCallback(
    async (request: ProductAnalysisRequest) => {
      const activeSteps = buildAnalysisSteps(!!request.url)
      setSteps(activeSteps)
      setStep(0)
      setPhase('running')
      clearNarration()
      narrationTimer.current = window.setInterval(() => {
        setStep((s) => Math.min(s + 1, activeSteps.length - 1))
      }, STEP_MS)

      try {
        const data = await analyzeProduct(request)
        clearNarration()
        setProfile(data)
        setResult(data)
        setPhase('done')
      } catch (err) {
        clearNarration()
        setErrorMessage(
          err instanceof AnalyzeProductError ? err.message : 'Something went wrong. Please try again.'
        )
        setPhase('error')
      }
    },
    [clearNarration, setResult]
  )

  const start = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.description.trim()) return
    void runAnalysis(toRequest(form))
  }

  const retry = () => {
    void runAnalysis(toRequest(form))
  }

  const reset = () => {
    clearNarration()
    setStep(0)
    setProfile(null)
    setPhase('entry')
  }

  const coreState = coreStateFor(phase, step)
  const percent = percentFor(step, steps.length)
  const currentStep = steps[step]

  const formFields = (
    <form onSubmit={start} className="flex flex-col gap-5">
      <TextField
        label="Product name"
        autoFocus
        required
        value={form.name}
        onChange={field('name')}
        placeholder="e.g. Growwwly"
      />
      <TextAreaField
        label="What does it do?"
        required
        value={form.description}
        onChange={field('description')}
        placeholder="What problem does it solve, and for whom?"
      />
      <TextField
        label="Website URL"
        type="url"
        value={form.url}
        onChange={field('url')}
        placeholder="https://yourproduct.com"
      />

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="t-meta -mt-1 self-start text-faint transition-colors duration-150 hover:text-ink"
      >
        {showMore ? 'Hide additional context' : 'Add more context (optional)'}
      </button>

      <AnimatePresence initial={false}>
        {showMore && (
          <motion.div
            key="more"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.32, ease: EASE.out }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 gap-5 border-t border-hairline pt-5 sm:grid-cols-2">
              <TextField
                label="Target customer"
                value={form.targetCustomer}
                onChange={field('targetCustomer')}
                placeholder="e.g. B2B SaaS founders"
              />
              <TextField
                label="Pricing"
                value={form.pricing}
                onChange={field('pricing')}
                placeholder="e.g. $29/mo, freemium"
              />
              <TextField
                label="Current users"
                type="number"
                min={0}
                value={form.currentUsers}
                onChange={field('currentUsers')}
                placeholder="e.g. 100"
              />
              <TextField
                label="Monthly marketing budget"
                value={form.budget}
                onChange={field('budget')}
                placeholder="e.g. $1,000"
              />
              <TextField
                label="Marketing experience"
                className="sm:col-span-2"
                value={form.marketingExperience}
                onChange={field('marketingExperience')}
                placeholder="e.g. Beginner, some experience, expert"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={!form.name.trim() || !form.description.trim()}
        className="mt-2 w-full sm:w-auto sm:self-start"
      >
        Analyze
      </Button>
    </form>
  )

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center gap-2.5 px-6 py-6 sm:px-10">
        <CoreMark size={20} />
        <span className="text-[14.5px] font-[560] tracking-[-0.02em] text-ink">{PROJECT.name}</span>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16 sm:px-8 lg:px-10">
        <AnimatePresence mode="wait">
          {/* ---- 1. Ask — wide editorial two-column composition ------------ */}
          {phase === 'entry' && (
            <motion.div
              key="entry"
              className="grid w-full max-w-[1120px] gap-y-14 lg:grid-cols-2 lg:items-center lg:gap-x-20"
              initial={{ opacity: 0, y: reduced ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: reduced ? 1 : 0.985, y: reduced ? 0 : -16 }}
              transition={{ duration: reduced ? 0.2 : 0.45, ease: EASE.out }}
            >
              {/* Left — who Growwwly is */}
              <div>
                <Label tone="accent">Growth intelligence</Label>
                <h1 className="t-display mt-5 max-w-[11ch]">
                  What are
                  <br />
                  you building?
                </h1>
                <p className="t-body-lg mt-7 max-w-[48ch] text-muted">
                  Tell Growwwly what you&apos;re building. We&apos;ll read your product, your
                  customers and your market, evaluate every acquisition channel, and tell you the
                  one thing worth doing next.
                </p>

                {/* Editorial background type, in the column's own empty
                    space below the copy — never behind the headline or the
                    form on the right. */}
                <BackgroundWordmark
                  lines={['GROWWWLY']}
                  size="compact"
                  className="mt-16 hidden lg:block"
                />
              </div>

              {/* Right — the form, in a proper card */}
              <div className="rounded-[18px] border border-hairline bg-surface p-7 shadow-soft sm:p-9">
                <Label>New analysis</Label>
                <h2 className="t-h2 mt-3">Analyze your SaaS</h2>
                <p className="t-meta mt-2 max-w-[42ch]">
                  AI reads it into a product, customer and growth-signal profile.
                </p>
                <div className="mt-7">{formFields}</div>
              </div>
            </motion.div>
          )}

          {/* ---- 2/3/4. Narrate, decide, or fail — narrow centered column -- */}
          {phase !== 'entry' && (
            <motion.div
              key="progress"
              className="flex w-full max-w-[680px] flex-col items-center"
              initial={{ opacity: 0, y: reduced ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -10 }}
              transition={{ duration: reduced ? 0.2 : 0.45, ease: EASE.out }}
            >
              {(phase === 'done' || phase === 'error') && (
                <motion.div
                  layout={!reduced}
                  transition={T.sharedSoft}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-[128px] w-[128px] shrink-0 sm:h-[144px] sm:w-[144px]"
                >
                  <GrowthCore state={coreState} className="h-full w-full" />
                </motion.div>
              )}

              <AnimatePresence mode="wait">
                {/* ---- 2. Narrate — stage-based circular progress --------- */}
                {phase === 'running' && (
                  <motion.div
                    key="running"
                    className="flex flex-col items-center"
                    initial={{ opacity: 0, y: reduced ? 0 : 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reduced ? 0 : -12 }}
                    transition={{ duration: reduced ? 0.2 : 0.5, ease: EASE.out }}
                  >
                    <p className="t-meta text-center text-faint">{form.name}</p>

                    <ProgressRing value={percent} size={216} className="mt-8">
                      <span className="t-metric tnum text-ink">{percent}%</span>
                    </ProgressRing>

                    <p className="mt-8 text-center text-[15px] font-[600] uppercase tracking-[0.02em] text-ink">
                      {currentStep?.label}
                    </p>
                    <p className="t-body mt-2.5 max-w-[38ch] text-center text-muted">
                      {currentStep?.detail}
                    </p>

                    <p className="sr-only" aria-live="polite">
                      {currentStep?.label ?? ''}
                    </p>
                  </motion.div>
                )}

                {/* ---- 3. Decide -------------------------------------------- */}
                {phase === 'done' && profile && (
                  <motion.div
                    key="done"
                    className="mt-10 w-full max-w-[620px] text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: reduced ? 0.2 : 0.5, ease: EASE.out }}
                  >
                    <Label>Analysis complete</Label>
                    <h1 className="t-title mt-4">{profile.productIntelligence.product.name}</h1>
                    <p className="t-body mx-auto mt-4 max-w-[54ch] text-muted">
                      {profile.productIntelligence.product.category} ·{' '}
                      {profile.productIntelligence.confidence.overall}% model confidence
                    </p>
                    <p className="t-body mx-auto mt-5 max-w-[58ch]">
                      {profile.productIntelligence.product.description}
                    </p>

                    <div className="mt-10 border-t border-hairline pt-8">
                      <Label tone="accent">Highest-leverage action</Label>
                      <p className="t-h2 mx-auto mt-3.5 max-w-[26ch] text-ink">
                        {profile.growthIntelligence.highestLeverageAction.title}
                      </p>
                      <p className="t-meta mx-auto mt-2.5 max-w-[52ch]">
                        {actionSubjectLabel(profile.growthIntelligence.highestLeverageAction.channel)} ·{' '}
                        {profile.growthIntelligence.highestLeverageAction.opportunityScore} opportunity
                        score
                      </p>
                    </div>

                    <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={() => router.push('/app')}
                        className="w-full sm:w-auto"
                      >
                        View full profile
                      </Button>
                      <Button variant="ghost" size="lg" onClick={reset} className="w-full sm:w-auto">
                        Analyze another product
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* ---- 4. Error -------------------------------------------- */}
                {phase === 'error' && (
                  <motion.div
                    key="error"
                    className="mt-10 w-full max-w-[520px] text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: reduced ? 0.2 : 0.5, ease: EASE.out }}
                  >
                    <Label tone="accent">Analysis failed</Label>
                    <h1 className="t-h1 mt-4">{errorMessage}</h1>
                    <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                      <Button variant="primary" size="lg" onClick={retry} className="w-full sm:w-auto">
                        Try again
                      </Button>
                      <Button variant="ghost" size="lg" onClick={reset} className="w-full sm:w-auto">
                        Edit details
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
