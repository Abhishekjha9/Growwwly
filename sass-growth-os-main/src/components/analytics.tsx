/**
 * The analytical language: three components, one grammar.
 *
 *   MetricRow      four measurements, one flagged — the row states the situation
 *   ReasoningChain the argument, drawn instead of written
 *   Funnel         where the loss actually happens
 *
 * No cards. No colour beyond a single highlight on the one thing that matters.
 */

import { useRef } from 'react'
import { motion, useInView } from 'motion/react'
import type { Variants } from 'motion/react'
import { cn, mapRange } from '@/lib/cn'
import { EASE, calm, rise, stagger, useReducedMotion } from '@/lib/motion'
import { Counter, Delta, Label, ProvenanceDot, Sparkline } from '@/components/primitives'
import type { FunnelStage, Metric } from '@/data/growth'

/* ============================================================
   METRIC ROW
   A horizontal analytical row — hairlines, not boxes.
   ============================================================ */

/**
 * Divider geometry per position. Stacked at 390 uses horizontal rules,
 * 2-up at 768 needs a mid rule, 4-up on desktop is vertical only.
 * Written per-index because Tailwind needs literal class strings.
 */
function dividerFor(i: number): string {
  if (i === 0) return ''
  if (i === 1) return 'border-t border-hairline pt-6 md:border-t-0 md:pt-0 md:border-l md:pl-8'
  if (i === 2)
    return 'border-t border-hairline pt-6 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-8'
  return 'border-t border-hairline pt-6 md:border-l md:pl-8 lg:border-t-0 lg:pt-0'
}

export function MetricRow({ metrics, className }: { metrics: Metric[]; className?: string }) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      className={cn('grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-4', className)}
      variants={stagger(0.06)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
    >
      {metrics.map((m, i) => (
        <motion.div key={m.id} variants={calm(rise, reduced)} className={dividerFor(i)}>
          <div className="flex items-center gap-2">
            <span className="t-meta">{m.label}</span>
            <ProvenanceDot kind={m.provenance} />
          </div>

          <div className="t-metric tnum mt-3 text-ink">
            <Counter to={m.value} />
          </div>

          <div className="mt-3.5 flex items-center gap-3">
            <Delta value={m.delta} />
            {/* Accent is reserved for the bottleneck. Every other line stays grey. */}
            <Sparkline points={m.spark} tone={m.flagged ? 'accent' : 'muted'} />
          </div>

          {m.flagged && (
            <Label tone="accent" className="mt-3">
              Bottleneck
            </Label>
          )}
        </motion.div>
      ))}
    </motion.div>
  )
}

/* ============================================================
   REASONING CHAIN
   Replaces a paragraph. The connectors draw in sequence so the
   argument is watched being made, not read.
   ============================================================ */

export type ChainTone = 'neutral' | 'warn' | 'accent' | 'decision'

export interface ChainStep {
  value: string
  label: string
  tone: ChainTone
}

/** Cadence: 5 steps × 0.26s ≈ 1.4s for the whole argument. */
const CHAIN_STEP = 0.26

function Chevron({ orientation }: { orientation: 'vertical' | 'horizontal' }) {
  return orientation === 'vertical' ? (
    <svg width="9" height="6" viewBox="0 0 9 6" aria-hidden className="text-ghost">
      <path
        d="M1 1 L4.5 4.6 L8 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg width="6" height="9" viewBox="0 0 6 9" aria-hidden className="text-ghost">
      <path
        d="M1 1 L4.6 4.5 L1 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ReasoningChain({
  steps,
  className,
  orientation = 'vertical',
}: {
  steps: ReadonlyArray<ChainStep>
  className?: string
  orientation?: 'vertical' | 'horizontal'
}) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLOListElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const state = inView ? 'show' : 'hidden'
  const vertical = orientation === 'vertical'

  const stepV: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : 8 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: reduced ? 0.15 : 0.5, ease: EASE.out, delay: reduced ? 0 : i * CHAIN_STEP },
    }),
  }

  // The connector draws itself — transform only, so it is free to animate.
  const lineV: Variants = reduced
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: vertical ? { scaleY: 0 } : { scaleX: 0 },
        show: (i: number) => ({
          ...(vertical ? { scaleY: 1 } : { scaleX: 1 }),
          transition: { duration: 0.3, ease: EASE.out, delay: i * CHAIN_STEP + 0.16 },
        }),
      }

  const chevronV: Variants = {
    hidden: { opacity: reduced ? 1 : 0 },
    show: (i: number) => ({
      opacity: 1,
      transition: { duration: reduced ? 0 : 0.2, ease: EASE.out, delay: reduced ? 0 : i * CHAIN_STEP + 0.32 },
    }),
  }

  return (
    // The wrapper owns `className` so a caller's responsive display utility
    // (`hidden md:block`) can never collide with the list's own `flex`.
    <div className={className}>
      <ol
        ref={ref}
        className={cn(
          vertical ? 'flex flex-col items-start' : 'flex flex-wrap items-center',
          'm-0 list-none p-0'
        )}
      >
      {steps.map((s, i) => {
        const decision = s.tone === 'decision'
        const valueClass = vertical
          ? decision
            ? 't-metric'
            : 't-h1'
          : decision
            ? 't-h1'
            : 't-h2'

        return (
          <li
            key={`${s.value}-${s.label}`}
            className={cn(vertical ? 'flex flex-col items-start' : 'flex min-w-0 items-center')}
          >
            {i > 0 && (
              <div
                className={cn(
                  'flex shrink-0 items-center',
                  vertical ? 'ml-2 flex-col gap-1.5 py-2.5' : 'mx-3 flex-row gap-1.5 sm:mx-4'
                )}
              >
                <motion.div
                  aria-hidden
                  custom={i - 1}
                  variants={lineV}
                  initial="hidden"
                  animate={state}
                  className={cn(
                    'bg-hairline-strong',
                    vertical ? 'h-7 w-px origin-top' : 'h-px w-8 origin-left sm:w-12'
                  )}
                />
                <motion.div custom={i - 1} variants={chevronV} initial="hidden" animate={state}>
                  <Chevron orientation={orientation} />
                </motion.div>
              </div>
            )}

            <motion.div
              custom={i}
              variants={stepV}
              initial="hidden"
              animate={state}
              className={cn(
                'shrink-0',
                // The decision is the only filled object in the chain.
                decision && 'rounded-lg bg-accent-soft px-5 py-4'
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    valueClass,
                    'tnum block',
                    s.tone === 'accent' ? 'text-accent' : 'text-ink'
                  )}
                >
                  {s.value}
                </span>
                {s.tone === 'warn' && (
                  <span
                    aria-hidden
                    className="inline-block h-[6px] w-[6px] shrink-0 rounded-full bg-warning"
                  />
                )}
              </div>
              <span className={cn('t-meta mt-1.5 block', decision && 'text-accent-ink')}>
                {s.label}
              </span>
            </motion.div>
          </li>
        )
        })}
      </ol>
    </div>
  )
}

/* ============================================================
   FUNNEL
   Linear width makes Paid invisible against 12,428 visitors, so
   width is sqrt-scaled into a readable band. Proportion survives;
   the small stages stay legible.
   ============================================================ */

function widthPct(value: number, max: number): number {
  return mapRange(Math.sqrt(value / max), 0, 1, 16, 100)
}

function Taper({ dense }: { dense: boolean }) {
  return (
    <svg
      width="14"
      height={dense ? 14 : 22}
      viewBox={`0 0 14 ${dense ? 14 : 22}`}
      aria-hidden
      className="shrink-0"
    >
      <path
        d={`M1 0 L5 ${dense ? 14 : 22} M13 0 L9 ${dense ? 14 : 22}`}
        stroke="var(--color-hairline-strong)"
        strokeWidth="1"
      />
    </svg>
  )
}

export function Funnel({
  stages,
  className,
  dense = false,
}: {
  stages: FunnelStage[]
  className?: string
  dense?: boolean
}) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLOListElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const max = Math.max(...stages.map((s) => s.value))

  return (
    <ol ref={ref} className={cn('m-0 list-none p-0', className)}>
      {stages.map((s, i) => {
        const bottleneck = s.bottleneck === true
        const h = dense
          ? bottleneck
            ? 'h-[46px]'
            : 'h-[36px]'
          : bottleneck
            ? 'h-[68px]'
            : 'h-[52px]'

        return (
          <li key={s.id}>
            {i > 0 && s.fromPrev !== null && (
              <div className={cn('flex items-center gap-3', dense ? 'py-1.5 pl-3' : 'py-2.5 pl-4')}>
                <Taper dense={dense} />
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span
                    className={cn(
                      'tnum text-[13px] font-[550]',
                      bottleneck ? 'text-accent' : 'text-muted'
                    )}
                  >
                    {s.fromPrev}%
                  </span>
                  <span className="t-meta text-faint">from {stages[i - 1].label}</span>
                  {!dense && s.note && (
                    <span
                      className={cn(
                        't-meta max-w-[46ch]',
                        bottleneck ? 'text-ink-2' : 'text-faint'
                      )}
                    >
                      {s.note}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className={cn('relative w-full', h)}>
              <motion.div
                aria-hidden
                className={cn(
                  'absolute inset-y-0 left-0 origin-left rounded-md',
                  bottleneck ? 'border border-accent-line bg-accent-soft' : 'bg-sunk'
                )}
                style={{ width: `${widthPct(s.value, max)}%` }}
                initial={{ scaleX: reduced ? 1 : 0 }}
                animate={inView ? { scaleX: 1 } : { scaleX: reduced ? 1 : 0 }}
                transition={{ duration: reduced ? 0 : 0.7, ease: EASE.out, delay: reduced ? 0 : i * 0.09 }}
              />
              <div
                className={cn(
                  'absolute inset-0 flex items-center gap-4',
                  dense ? 'px-3.5' : 'px-5'
                )}
              >
                <span
                  className={cn(
                    'text-ink',
                    dense ? 'text-[13.5px] font-[550]' : 't-h3',
                    bottleneck && !dense && 't-h2'
                  )}
                >
                  {s.label}
                </span>
                <span
                  className={cn(
                    'tnum text-ink',
                    dense ? 'text-[13.5px]' : 'text-[15px]',
                    bottleneck ? 'font-[550]' : 'font-[450] text-muted'
                  )}
                >
                  {s.display}
                </span>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
