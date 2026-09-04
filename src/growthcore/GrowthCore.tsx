/**
 * Growth Core — public entry point.
 *
 * A flat SVG drawing: a solid core with a constellation of signals orbiting
 * it, redrawn per state so many signals visibly collapse into one profile.
 * Used everywhere in-app, from the nav mark down to the analysis run.
 */

import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { EASE, useReducedMotion } from '@/lib/motion'
import { SIGNALS, WINNER_INDEX } from '@/data/growth'
import { SHAPE, SIGNAL_LINKS, SIGNAL_PUSH, type CoreState } from './state'

/* ------------------------------------------------------------------
   Flat core — SVG, cheap, used everywhere in-app
   ------------------------------------------------------------------ */

/** Project a 3D seed onto the flat drawing. A fixed, pleasing angle. */
function project(seed: readonly [number, number, number], spread: number) {
  const [x, y, z] = seed
  const depth = 1 + z * 0.12
  return {
    x: 50 + x * 14.5 * spread * depth,
    y: 50 - y * 14.5 * spread * depth,
    scale: depth,
  }
}

export function GrowthCore({
  state = 'idle',
  className,
  showLabels = false,
  animate = true,
}: {
  state?: CoreState
  className?: string
  showLabels?: boolean
  animate?: boolean
}) {
  const reduced = useReducedMotion()
  const shape = SHAPE[state]
  const play = animate && !reduced

  const pts = SIGNALS.map((s, i) => {
    const isWinner = i === WINNER_INDEX
    const pull = isWinner
      ? 1
      : 1 + (shape.spread - 1) * (1 + (1 - s.weight) * SIGNAL_PUSH)
    return { ...project(s.seed, pull), def: s, isWinner }
  })

  return (
    <div className={cn('relative', className)}>
      <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="gc-face" x1="0.2" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="52%" stopColor="#F4F4F1" />
            <stop offset="100%" stopColor="#E7E8E6" />
          </linearGradient>
          <radialGradient id="gc-shadow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="rgba(17,17,17,0.20)" />
            <stop offset="55%" stopColor="rgba(17,17,17,0.06)" />
            <stop offset="100%" stopColor="rgba(17,17,17,0)" />
          </radialGradient>
        </defs>

        <ellipse cx="50" cy="72.5" rx="19" ry="4.6" fill="url(#gc-shadow)" />

        <g stroke="#B9BAC4" strokeWidth="0.32" fill="none">
          {pts.map((p, i) => (
            <motion.line
              key={`spoke-${p.def.id}`}
              x1="50"
              y1="50"
              x2={p.x}
              y2={p.y}
              initial={false}
              animate={{ x2: p.x, y2: p.y, opacity: shape.spokeOpacity }}
              transition={{ duration: play ? 0.9 : 0, ease: EASE.out, delay: play ? i * 0.02 : 0 }}
            />
          ))}
        </g>

        <g stroke="#4F6BFF" strokeWidth="0.28" fill="none">
          {SIGNAL_LINKS.map(([a, b], i) => (
            <motion.line
              key={`link-${a}-${b}`}
              initial={false}
              animate={{
                x1: pts[a].x,
                y1: pts[a].y,
                x2: pts[b].x,
                y2: pts[b].y,
                opacity: shape.linkOpacity,
              }}
              transition={{ duration: play ? 0.9 : 0, ease: EASE.out, delay: play ? 0.1 + i * 0.05 : 0 }}
            />
          ))}
        </g>

        <motion.g
          initial={false}
          animate={{ scale: shape.coreScale }}
          transition={{ duration: play ? 0.9 : 0, ease: EASE.out }}
          style={{ transformOrigin: '50px 50px' }}
        >
          <rect
            x="36.5"
            y="36.5"
            width="27"
            height="27"
            rx="9.4"
            fill="url(#gc-face)"
            stroke="#DFDFDA"
            strokeWidth="0.4"
          />
          <rect
            x="36.5"
            y="36.5"
            width="27"
            height="27"
            rx="9.4"
            fill="none"
            stroke="#4F6BFF"
            strokeWidth="0.55"
            strokeOpacity={state === 'decision' ? 0.5 : 0.2}
          />
        </motion.g>

        {pts.map((p, i) => (
          <motion.circle
            key={p.def.id}
            initial={false}
            animate={{
              cx: p.x,
              cy: p.y,
              r: (p.isWinner ? 1.5 + shape.emphasis * 1.1 : 1.35) * p.scale,
              opacity: p.isWinner
                ? Math.max(shape.signalOpacity, shape.emphasis)
                : shape.signalOpacity,
            }}
            transition={{ duration: play ? 0.9 : 0, ease: EASE.out, delay: play ? i * 0.03 : 0 }}
            fill={p.isWinner && shape.emphasis > 0.3 ? '#4F6BFF' : '#C9C9C3'}
          />
        ))}
      </svg>

      {showLabels && (
        <div className="pointer-events-none absolute inset-0">
          {pts.map((p, i) => (
            <motion.span
              key={p.def.id}
              className={cn(
                'absolute -translate-x-1/2 whitespace-nowrap text-[10.5px] font-[500] tracking-[-0.005em]',
                p.isWinner && shape.emphasis > 0.3 ? 'text-accent' : 'text-faint'
              )}
              initial={false}
              animate={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                opacity: p.isWinner
                  ? Math.max(shape.signalOpacity, shape.emphasis)
                  : shape.signalOpacity,
              }}
              transition={{ duration: play ? 0.9 : 0, ease: EASE.out, delay: play ? i * 0.03 : 0 }}
              style={{ transform: p.y <= 50 ? 'translate(-50%, -230%)' : 'translate(-50%, 130%)' }}
            >
              {p.def.label}
            </motion.span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------
   CoreMark — the logo. The same object, reduced to 20px.
   ------------------------------------------------------------------ */

export function CoreMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cn('shrink-0', className)} aria-hidden>
      <rect x="7" y="7" width="10" height="10" rx="3.4" fill="#111111" />
      <circle cx="12" cy="2.6" r="1.5" fill="#4F6BFF" />
      <circle cx="20.4" cy="8.4" r="1.15" fill="#C9C9C3" />
      <circle cx="3.6" cy="8.4" r="1.15" fill="#C9C9C3" />
      <circle cx="18.2" cy="19.4" r="1.15" fill="#C9C9C3" />
      <circle cx="5.8" cy="19.4" r="1.15" fill="#C9C9C3" />
      <g stroke="#C9C9C3" strokeWidth="0.7" opacity="0.55">
        <path d="M12 5.6 V7" />
        <path d="M18.6 9.2 L16.4 10.4" />
        <path d="M5.4 9.2 L7.6 10.4" />
      </g>
    </svg>
  )
}
