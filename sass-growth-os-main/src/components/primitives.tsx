/**
 * The component language.
 *
 * Everything here shares one spacing, radius, type and motion rule set.
 * If a screen needs something that isn't here, it should probably be here.
 */

import { forwardRef, useEffect, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { motion, useInView, useMotionValue, useSpring, AnimatePresence } from 'motion/react'
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
        // Ghost is 1.7:1 on canvas. This dot is the difference between a fact
        // and a guess — it has to survive a bright room and a cheap screen.
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
   SCORE — one large number. Used for 91, 84, 88.
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
        <path
          d="M4 1.2 L7 6.2 L1 6.2 Z"
          fill="currentColor"
          opacity="0.85"
        />
      </svg>
      {fmtDelta(value).replace(/^[+−]/, '')}
    </span>
  )
}

/* ============================================================
   SPARKLINE — tiny, quiet, no axes, no grid
   ============================================================ */

export function Sparkline({
  points,
  width = 72,
  height = 22,
  tone = 'muted',
  className,
}: {
  points: number[]
  width?: number
  height?: number
  tone?: 'muted' | 'accent' | 'warning'
  className?: string
}) {
  const reduced = useReducedMotion()
  const min = Math.min(...points)
  const max = Math.max(...points)
  const pad = 2
  const w = width - pad * 2
  const h = height - pad * 2

  const d = points
    .map((p, i) => {
      const x = pad + (i / (points.length - 1)) * w
      const y = pad + h - ((p - min) / (max - min || 1)) * h
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')

  const stroke =
    tone === 'accent'
      ? 'var(--color-accent)'
      : tone === 'warning'
        ? 'var(--color-warning)'
        : 'var(--color-ghost)'

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      aria-hidden
    >
      <motion.path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: '-30px' }}
        transition={{ duration: reduced ? 0 : 1, ease: EASE.out }}
      />
    </svg>
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
   TOOLTIP — quiet, instant-ish, never blocks
   ============================================================ */

export function Tooltip({
  label,
  children,
  side = 'top',
}: {
  label: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom'
}) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: side === 'top' ? 3 : -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={T.micro}
            className={cn(
              'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-[9px] bg-ink px-2.5 py-1.5 text-[12px] font-[450] text-white/95 shadow-[0_6px_20px_-8px_rgba(17,17,17,0.4)]',
              side === 'top' ? 'bottom-[calc(100%+7px)]' : 'top-[calc(100%+7px)]'
            )}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
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
   SIDE PANEL — the detail surface behind shared-element rows
   ============================================================ */

export function SidePanel({
  open,
  onClose,
  children,
  labelledBy,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  labelledBy?: string
}) {
  const reduced = useReducedMotion()
  const panelRef = useRef<HTMLElement>(null)

  /* `onClose` is passed inline by every caller, so it is a new function on
     every render. Depending on it directly would tear this effect down and
     rebuild it constantly — which, once focus restoration lives here, means
     yanking focus back to the trigger while the panel is still open. */
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return

    /* `aria-modal` is a promise to assistive technology that the rest of the
       page is inert. Without moving focus into the panel, a screen-reader or
       keyboard user was left on the trigger behind the overlay, tabbing
       through content the attribute had just told them was not there. */
    const returnTo = document.activeElement as HTMLElement | null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeRef.current()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0)
      if (items.length === 0) return

      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // After mount, so the element exists to receive it.
    const t = window.setTimeout(() => panelRef.current?.focus(), 0)

    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      // Back to the thing that opened it, not to the top of the document.
      returnTo?.focus?.()
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-[rgba(17,17,17,0.14)] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE.out }}
            onClick={onClose}
          />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            // Focusable as a container so focus has somewhere to land that
            // reads the panel's own label, rather than jumping to whatever
            // control happens to be first.
            tabIndex={-1}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-[560px] overflow-y-auto bg-surface shadow-[var(--shadow-panel)] outline-none sm:rounded-l-[24px]"
            initial={{ x: reduced ? 0 : '100%', opacity: reduced ? 0 : 1 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: reduced ? 0 : '100%', opacity: reduced ? 0 : 1 }}
            transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 260, damping: 34 }}
          >
            <button
              onClick={onClose}
              aria-label="Close panel"
              className="absolute right-5 top-5 z-10 flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-[rgba(17,17,17,0.05)] hover:text-ink"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path
                  d="M3 3 L11 11 M11 3 L3 11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
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
