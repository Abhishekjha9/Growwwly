/**
 * /analyze — the analysis experience.
 *
 * Three states in one continuous scene: ask → narrate → decide. The Growth
 * Core is the progress indicator; the hairline beneath the narration is the
 * only other one. No percentage, ever.
 *
 * Renders standalone (no AppShell), so it carries its own minimal top bar.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { EASE, T, useReducedMotion } from '@/lib/motion'
import { Button, Label } from '@/components/primitives'
import { TextField, TextAreaField } from '@/components/analyze/Field'
import { GrowthCore, CoreMark } from '@/growthcore/GrowthCore'
import type { CoreState } from '@/growthcore/state'
import { ANALYSIS_STEPS, PROJECT } from '@/data/growth'
import { analyzeProduct, AnalyzeProductError } from '@/lib/api/analyze-product'
import { useAnalysis } from '@/lib/analysis-store'
import type { ProductAnalysisRequest, ProductIntelligence } from '@/types/product'

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

export default function AnalyzePage() {
  const router = useRouter()
  const reduced = useReducedMotion()
  const { setResult } = useAnalysis()

  const [phase, setPhase] = useState<Phase>('entry')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [showMore, setShowMore] = useState(false)
  const [step, setStep] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [profile, setProfile] = useState<ProductIntelligence | null>(null)

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
      setStep(0)
      setPhase('running')
      clearNarration()
      narrationTimer.current = window.setInterval(() => {
        setStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1))
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
  const fill = (step + 1) / ANALYSIS_STEPS.length

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center gap-2.5 px-6 py-6 sm:px-10">
        <CoreMark size={20} />
        <span className="text-[14.5px] font-[560] tracking-[-0.02em] text-ink">{PROJECT.name}</span>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16 sm:px-10">
        <div className="flex w-full max-w-[680px] flex-col items-center">
          {phase !== 'entry' && (
            <motion.div
              layout={!reduced}
              transition={T.sharedSoft}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                'shrink-0',
                phase === 'done' || phase === 'error'
                  ? 'h-[128px] w-[128px] sm:h-[144px] sm:w-[144px]'
                  : 'h-[200px] w-[200px] sm:h-[248px] sm:w-[248px]'
              )}
            >
              <GrowthCore state={coreState} className="h-full w-full" />
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
                <h1 className="t-title mt-4">What are you building?</h1>
                <p className="t-body mt-3 max-w-[52ch] text-muted">
                  Tell us about your SaaS. AI reads it into a product, customer and growth-signal
                  profile.
                </p>

                <form onSubmit={start} className="mt-9 flex flex-col gap-5">
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
                <p className="t-meta text-center text-faint">{form.name}</p>

                <ol className="mt-7">
                  {ANALYSIS_STEPS.map((s, i) => {
                    const done = i < step
                    const current = i === step
                    return (
                      <li key={s.id} className="flex gap-3.5 py-2">
                        <span className="mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center">
                          <span
                            aria-hidden
                            className={cn(
                              'h-[5px] w-[5px] rounded-full transition-colors duration-300',
                              done ? 'bg-ink' : current ? 'bg-accent' : 'bg-hairline-strong'
                            )}
                          />
                        </span>

                        <div className="min-w-0">
                          <div
                            className={cn(
                              'text-[15px] tracking-[-0.014em] transition-colors duration-[400ms]',
                              current ? 'font-[550] text-ink' : done ? 'text-muted' : 'text-ghost'
                            )}
                          >
                            {s.label}
                          </div>
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

            {/* ---- 3a. Decide ------------------------------------------------ */}
            {phase === 'done' && profile && (
              <motion.div
                key="done"
                className="mt-10 w-full max-w-[620px] text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduced ? 0.2 : 0.5, ease: EASE.out }}
              >
                <Label>Analysis complete</Label>
                <h1 className="t-title mt-4">{profile.product.name}</h1>
                <p className="t-body mx-auto mt-4 max-w-[54ch] text-muted">
                  {profile.product.category} · {profile.confidence.overall}% model confidence
                </p>
                <p className="t-body mx-auto mt-5 max-w-[58ch]">{profile.product.description}</p>

                <div className="mt-11 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
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

            {/* ---- 3b. Error -------------------------------------------------- */}
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
        </div>
      </main>
    </div>
  )
}
