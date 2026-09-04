/**
 * The illustration system.
 *
 * One family, one construction rule: hairline geometry on the bare canvas,
 * built from the same vocabulary as the Growth Core — a rounded solid, a few
 * signal nodes, thin connecting lines. Nothing is filled except the single
 * element the drawing is *about*, and that element is the only accent on
 * screen.
 *
 * These are drawings of a missing state, not decorations of one. Each says
 * what is absent by drawing the shape of the hole.
 */

import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/cn'
import { EASE, useReducedMotion } from '@/lib/motion'

export type IllustrationKind =
  | 'analytics'
  | 'experiments'
  | 'opportunities'
  | 'website'
  | 'plan'
  | 'search'
  | 'generic'

/* ------------------------------------------------------------------
   Shared drawing primitives — every illustration is made of these
   ------------------------------------------------------------------ */

const LINE = 'var(--color-hairline-strong)'
const GHOST = 'var(--color-ghost)'
const ACCENT = 'var(--color-accent)'

/** Structure: present, known, quiet. */
function Solid(props: React.SVGProps<SVGRectElement>) {
  return <rect fill="none" stroke={LINE} strokeWidth="1.1" {...props} />
}

/** Absence: the thing that would be here. Always dashed, never filled. */
function Absent(props: React.SVGProps<SVGRectElement>) {
  return (
    <rect
      fill="none"
      stroke={GHOST}
      strokeWidth="1.1"
      strokeDasharray="3 3.5"
      {...props}
    />
  )
}

/**
 * The single accent mark. Draws itself once, then rests — the only motion
 * in an empty state, and only when motion is welcome.
 */
function Mark({ d, reduced, delay = 0 }: { d: string; reduced: boolean; delay?: number }) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={ACCENT}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={reduced ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{
        duration: reduced ? 0 : 0.9,
        ease: EASE.out,
        delay: reduced ? 0 : delay,
        opacity: { duration: reduced ? 0 : 0.3, delay: reduced ? 0 : delay },
      }}
    />
  )
}

function Node({ cx, cy, accent = false }: { cx: number; cy: number; accent?: boolean }) {
  return <circle cx={cx} cy={cy} r={accent ? 3 : 2.4} fill={accent ? ACCENT : GHOST} />
}

/* ------------------------------------------------------------------
   The drawings — 168 × 112, one concept each
   ------------------------------------------------------------------ */

function Drawing({ kind, reduced }: { kind: IllustrationKind; reduced: boolean }) {
  switch (kind) {
    /* Three stages measured, the fourth unknown — the funnel stops short. */
    case 'analytics':
      return (
        <>
          <Solid x="34" y="20" width="100" height="17" rx="5" />
          <Solid x="46" y="45" width="76" height="17" rx="5" />
          <Absent x="58" y="70" width="52" height="17" rx="5" />
          <path d="M84 39 v4 M84 64 v4" stroke={GHOST} strokeWidth="1.1" strokeLinecap="round" />
          <Mark d="M70 78.5 h28" reduced={reduced} delay={0.25} />
        </>
      )

    /* A control arm and a variant arm that was never started. */
    case 'experiments':
      return (
        <>
          <path d="M30 40 h108" stroke={LINE} strokeWidth="1.1" strokeLinecap="round" />
          <Node cx={30} cy={40} />
          <Node cx={138} cy={40} />
          <path
            d="M30 72 h108"
            stroke={GHOST}
            strokeWidth="1.1"
            strokeDasharray="3 3.5"
            strokeLinecap="round"
          />
          <Node cx={30} cy={72} />
          <Mark d="M30 72 h34" reduced={reduced} delay={0.3} />
          <circle cx="64" cy="72" r="3" fill={ACCENT} />
        </>
      )

    /* An impact/effort field with nothing plotted in it yet. */
    case 'opportunities':
      return (
        <>
          <path d="M34 92 V22" stroke={LINE} strokeWidth="1.1" strokeLinecap="round" />
          <path d="M34 92 H140" stroke={LINE} strokeWidth="1.1" strokeLinecap="round" />
          <Absent x="34" y="22" width="53" height="35" rx="6" />
          <Node cx={104} cy={70} />
          <Node cx={122} cy={80} />
          <Mark d="M52 46 a8 8 0 1 1 0.01 0" reduced={reduced} delay={0.3} />
        </>
      )

    /* A page frame whose content has not been read. */
    case 'website':
      return (
        <>
          <Solid x="30" y="18" width="108" height="76" rx="9" />
          <path d="M30 33 h108" stroke={LINE} strokeWidth="1.1" />
          <circle cx="39" cy="25.5" r="1.6" fill={GHOST} />
          <Absent x="44" y="45" width="80" height="8" rx="4" />
          <Absent x="44" y="61" width="56" height="8" rx="4" />
          <Mark d="M44 78 h34" reduced={reduced} delay={0.3} />
        </>
      )

    /* Four weeks, none of them written. */
    case 'plan':
      return (
        <>
          <path d="M26 56 h116" stroke={LINE} strokeWidth="1.1" strokeLinecap="round" />
          {[26, 65, 104, 142].map((x, i) => (
            <circle
              key={x}
              cx={x}
              cy="56"
              r="4"
              fill="var(--color-canvas)"
              stroke={i === 0 ? ACCENT : GHOST}
              strokeWidth={i === 0 ? 1.5 : 1.1}
              strokeDasharray={i === 0 ? undefined : '2.5 2.5'}
            />
          ))}
          <Absent x="52" y="28" width="28" height="7" rx="3.5" />
          <Absent x="91" y="70" width="28" height="7" rx="3.5" />
          <Mark d="M14 28 h24 M14 35 h15" reduced={reduced} delay={0.3} />
        </>
      )

    /* Looked everywhere. Nothing matched. */
    case 'search':
      return (
        <>
          <Absent x="30" y="24" width="46" height="12" rx="6" />
          <Absent x="30" y="46" width="62" height="12" rx="6" />
          <Absent x="30" y="68" width="38" height="12" rx="6" />
          <circle cx="116" cy="52" r="17" fill="none" stroke={LINE} strokeWidth="1.2" />
          <Mark d="M128.5 64.5 L140 76" reduced={reduced} delay={0.3} />
        </>
      )

    /* The core at rest: signals present, no decision drawn from them yet. */
    default:
      return (
        <>
          <Solid x="66" y="38" width="36" height="36" rx="11" />
          <path
            d="M84 38 V20 M102 56 H128 M84 74 V92 M66 56 H40"
            stroke={GHOST}
            strokeWidth="1"
            strokeDasharray="3 3.5"
          />
          <Node cx={84} cy={20} />
          <Node cx={128} cy={56} />
          <Node cx={84} cy={92} />
          <Node cx={40} cy={56} />
          <Mark d="M76 56 h16" reduced={reduced} delay={0.35} />
        </>
      )
  }
}

/* ------------------------------------------------------------------
   Illustration
   ------------------------------------------------------------------ */

export function Illustration({
  kind = 'generic',
  width = 168,
  className,
}: {
  kind?: IllustrationKind
  width?: number
  className?: string
}) {
  const reduced = useReducedMotion()
  return (
    <svg
      width={width}
      height={(width / 168) * 112}
      viewBox="0 0 168 112"
      fill="none"
      aria-hidden
      className={cn('shrink-0 overflow-visible', className)}
    >
      <Drawing kind={kind} reduced={reduced} />
    </svg>
  )
}

/* ------------------------------------------------------------------
   EMPTY STATE

   Left-aligned and set as prose, because an empty state is a sentence
   the product is saying to you — not a placeholder card. No border, no
   background, no centred dead-end.
   ------------------------------------------------------------------ */

export function EmptyState({
  kind = 'generic',
  title,
  body,
  action,
  className,
}: {
  kind?: IllustrationKind
  title: string
  body?: string
  action?: ReactNode
  className?: string
}) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0.2 : 0.6, ease: EASE.out }}
      className={cn('max-w-[54ch]', className)}
    >
      <Illustration kind={kind} className="-ml-2" />
      <h2 className="t-h1 mt-8">{title}</h2>
      {body && <p className="t-body mt-3.5 max-w-[52ch] text-muted">{body}</p>}
      {action && <div className="mt-8 flex flex-wrap items-center gap-2">{action}</div>}
    </motion.div>
  )
}
