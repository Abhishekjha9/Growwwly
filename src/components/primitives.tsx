/**
 * The component language.
 *
 * Everything here shares one spacing, radius, type and motion rule set.
 * If a screen needs something that isn't here, it should probably be here.
 */

import { forwardRef, useEffect, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { motion, useInView, useMotionValue, useSpring } from 'framer-motion'
import { cn, clamp, fmtDelta } from '@/lib/cn'
import { T, EASE, useReducedMotion } from '@/lib/motion'
import { PROVENANCE_COPY, type Provenance } from '@/data/growth'

/* ============================================================
   LABEL — the only uppercase in the product
   ============================================================ */

export function Label({
  children,
  className,
  tone = 'faint',
}: {
  children: ReactNode
  className?: string
  tone?: 'faint' | 'accent' | 'ink'
}) {
  return (
    <div
      className={cn(
        't-label',
        tone === 'accent' && 'text-accent',
        tone === 'ink' && 'text-ink',
        className
      )}
    >
      {children}
    </div>
  )
}

/* ============================================================
   BUTTON
   ============================================================ */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet'
type ButtonSize = 'sm' | 'md' | 'lg'

/** Drag/animation handlers collide with motion's own props — drop them. */
type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'
> & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  iconRight?: ReactNode
}

const BTN_BASE =
  'relative inline-flex items-center justify-center gap-2 rounded-[13px] font-[550] whitespace-nowrap ' +
  'transition-[background-color,color,border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] ' +
  'disabled:opacity-40 disabled:pointer-events-none select-none'

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-white hover:bg-[#000] shadow-[0_1px_2px_rgba(17,17,17,0.12)]',
  secondary:
    'bg-surface text-ink border border-hairline hover:border-hairline-strong hover:bg-[#fcfcfa] shadow-[0_1px_2px_rgba(17,17,17,0.03)]',
  ghost: 'text-muted hover:text-ink hover:bg-[rgba(17,17,17,0.04)]',
  quiet: 'text-accent hover:bg-accent-soft',
}

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-[14px]',
  lg: 'h-12 px-6 text-[15px] rounded-[14px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, className, children, ...rest },
  ref
) {
  const reduced = useReducedMotion()
  return (
    <motion.button
      ref={ref}
      whileHover={reduced ? undefined : { y: -1 }}
      whileTap={reduced ? undefined : { y: 0, scale: 0.985 }}
      transition={T.micro}
      className={cn(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className)}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </motion.button>
  )
})

/* ============================================================
   PROVENANCE — fact vs interpretation vs assumption
   A dot and a word. No badges, no colour blocks.
   ============================================================ */

export function ProvenanceDot({ kind, className }: { kind: Provenance; className?: string }) {
  if (kind === 'assumed') {
    return (
      <span
        aria-hidden
        className={cn(
          'inline-block h-[7px] w-[7px] shrink-0 rounded-full border border-dashed border-faint',
          className
        )}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block h-[6px] w-[6px] shrink-0 rounded-full',
        kind === 'measured' ? 'bg-muted' : 'bg-accent',
        className
      )}
    />
  )
}

export function ProvenanceTag({
  kind,
  className,
  showLabel = true,
}: {
  kind: Provenance
  className?: string
  showLabel?: boolean
}) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-[11.5px] tracking-[-0.002em]', className)}
      title={PROVENANCE_COPY[kind]}
    >
      <ProvenanceDot kind={kind} />
      {showLabel && (
        <span className={kind === 'inferred' ? 'text-accent' : 'text-muted'}>
          {PROVENANCE_COPY[kind]}
        </span>
      )}
    </span>
  )
}

/* ============================================================
   CONFIDENCE — a number and a hairline arc. Never a progress bar.
   ============================================================ */

export function Confidence({ value, className }: { value: number; className?: string }) {
  const reduced = useReducedMotion()
  const R = 6.5
  const C = 2 * Math.PI * R
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12px] text-muted', className)}>
      <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden className="-rotate-90">
        <circle cx="8.5" cy="8.5" r={R} fill="none" stroke="var(--color-hairline)" strokeWidth="1.5" />
        <motion.circle
          cx="8.5"
          cy="8.5"
          r={R}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: reduced ? C * (1 - value / 100) : C }}
          whileInView={{ strokeDashoffset: C * (1 - value / 100) }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: reduced ? 0 : 0.8, ease: EASE.out }}
        />
      </svg>
      <span className="tnum">{value}% confidence</span>
    </span>
  )
}

/* ============================================================
   COUNTER — numbers arrive, they don't blink into existence
   ============================================================ */

export function Counter({
  to,
  duration = 1.1,
  className,
  format,
}: {
  to: number
  duration?: number
  className?: string
  format?: (n: number) => string
}) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const [shown, setShown] = useState(reduced ? to : 0)

  useEffect(() => {
    if (!inView || reduced) {
      // Syncs the displayed value to the reduced-motion preference, which can
      // flip at runtime (Settings) after this component has already mounted.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (reduced) setShown(to)
      return
    }
    let raf = 0
    let start = 0
    const tick = (t: number) => {
      if (!start) start = t
      const p = clamp((t - start) / (duration * 1000), 0, 1)
      // ease-out quint — fast arrival, long settle
      const eased = 1 - Math.pow(1 - p, 5)
      setShown(to * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, to, duration, reduced])

  const out = format ? format(shown) : Math.round(shown).toLocaleString('en-US')
  return (
    <span ref={ref} className={cn('tnum', className)}>
      {out}
    </span>
  )
}

/* ============================================================
   SCORE — one large number.
   ============================================================ */

export function Score({
  value,
  size = 'lg',
  className,
  animate = true,
}: {
  value: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  animate?: boolean
}) {
  const sizes = {
    sm: 'text-[22px] tracking-[-0.035em]',
    md: 'text-[34px] tracking-[-0.042em]',
    lg: 'text-[56px] tracking-[-0.05em] leading-[0.9]',
    xl: 't-metric-xl',
  }
  return (
    <div className={cn('tnum font-[550] text-ink', sizes[size], className)}>
      {animate ? <Counter to={value} /> : Math.round(value)}
    </div>
  )
}

/* ============================================================
   DELTA — small change indicator
   ============================================================ */

export function Delta({ value, className }: { value: number; className?: string }) {
  const up = value >= 0
  return (
    <span
      className={cn(
        'tnum inline-flex items-center gap-1 text-[12.5px] font-[500]',
        up ? 'text-positive' : 'text-negative',
        className
      )}
    >
      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden className={up ? '' : 'rotate-180'}>
        <path d="M4 1.2 L7 6.2 L1 6.2 Z" fill="currentColor" opacity="0.85" />
      </svg>
      {fmtDelta(value).replace(/^[+−]/, '')}
    </span>
  )
}

/* ============================================================
   SIGNAL BAR — a 0–100 AI signal, drawn as a length. Never called
   a score, a rank, or a measurement.
   ============================================================ */

export function SignalBar({
  value,
  tone = 'muted',
  className,
}: {
  value: number
  tone?: 'muted' | 'accent'
  className?: string
}) {
  const reduced = useReducedMotion()
  return (
    <div className={cn('relative h-px w-full bg-hairline', className)} aria-hidden>
      <motion.div
        className={cn('absolute inset-y-0 left-0 origin-left', tone === 'accent' ? 'bg-accent' : 'bg-ghost')}
        style={{ width: `${clamp(value, 0, 100)}%` }}
        initial={{ scaleX: reduced ? 1 : 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: reduced ? 0 : 0.8, ease: EASE.out }}
      />
    </div>
  )
}

/* ============================================================
   STATUS DOT — pass / warn / fail. No coloured cards.
   ============================================================ */

export function StatusDot({ status }: { status: 'pass' | 'warn' | 'fail' }) {
  if (status === 'pass') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0">
        <circle cx="8" cy="8" r="7.25" fill="none" stroke="var(--color-hairline)" strokeWidth="1.5" />
        <path
          d="M5 8.2 L7.1 10.3 L11 6.2"
          fill="none"
          stroke="var(--color-positive)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (status === 'warn') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0">
        <circle cx="8" cy="8" r="7.25" fill="none" stroke="var(--color-hairline)" strokeWidth="1.5" />
        <path d="M8 4.4 V8.6" stroke="var(--color-warning)" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="8" cy="11.2" r="0.95" fill="var(--color-warning)" />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0">
      <circle cx="8" cy="8" r="7.25" fill="none" stroke="var(--color-hairline)" strokeWidth="1.5" />
      <path
        d="M5.6 5.6 L10.4 10.4 M10.4 5.6 L5.6 10.4"
        stroke="var(--color-negative)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* ============================================================
   PILL
   ============================================================ */

export function Pill({
  children,
  active,
  onClick,
  className,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  className?: string
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center rounded-full px-3 text-[12.5px] font-[500] transition-colors duration-[180ms]',
        active
          ? 'bg-ink text-white'
          : 'bg-[rgba(17,17,17,0.045)] text-muted hover:text-ink hover:bg-[rgba(17,17,17,0.07)]',
        className
      )}
    >
      {children}
    </Comp>
  )
}

/* ============================================================
   SECTION — editorial page section. Not a card.
   ============================================================ */

export function Section({
  label,
  title,
  intro,
  children,
  className,
  divider = true,
}: {
  label?: string
  title?: string
  intro?: string
  children?: ReactNode
  className?: string
  divider?: boolean
}) {
  return (
    <section className={cn(divider && 'border-t border-hairline pt-10', 'mb-16', className)}>
      {label && <Label className="mb-3">{label}</Label>}
      {title && <h2 className="t-h1 mb-3">{title}</h2>}
      {intro && <p className="t-body max-w-[62ch] mb-8">{intro}</p>}
      {children}
    </section>
  )
}

/* ============================================================
   REVEAL — the house scroll entrance
   ============================================================ */

export function Reveal({
  children,
  delay = 0,
  y = 12,
  className,
  once = true,
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
  once?: boolean
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-60px' }}
      transition={{ duration: reduced ? 0.2 : 0.62, ease: EASE.out, delay: reduced ? 0 : delay }}
    >
      {children}
    </motion.div>
  )
}

/* ============================================================
   CURSOR-FOLLOWING SPOTLIGHT — used sparingly (hero, core)
   ============================================================ */

export function useMouseSpring(strength = 12) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 90, damping: 22, mass: 0.6 })
  const sy = useSpring(y, { stiffness: 90, damping: 22, mass: 0.6 })

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2
      const ny = (e.clientY / window.innerHeight - 0.5) * 2
      x.set(nx * strength)
      y.set(ny * strength)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [x, y, strength])

  return { x: sx, y: sy }
}
