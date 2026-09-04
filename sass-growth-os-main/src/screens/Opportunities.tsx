/**
 * Opportunities — everything worth doing, placed against everything it costs.
 *
 * The map is the argument: impact rises, effort runs right, and one point
 * sits alone in the corner where those two facts agree. Nothing is ranked by
 * assertion — you can see why the winner won, and you can see the six things
 * it beat.
 *
 * Selecting a point moves it into the detail panel rather than opening a new
 * object on top of it, so the thing you clicked is the thing you are reading.
 */

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Confidence, Label, Pill, Score, SidePanel } from '@/components/primitives'
import { cn, mapRange } from '@/lib/cn'
import { EASE, T, calm, fade, rise, riseLg, stagger, useReducedMotion } from '@/lib/motion'
import { OPPORTUNITIES, type Opportunity } from '@/data/growth'

const CATEGORIES = ['All', 'Activation', 'Acquisition', 'Conversion', 'Retention'] as const
type Category = (typeof CATEGORIES)[number]

/** Keep points off the axes so nothing sits on a rule. */
const px = (effort: number) => mapRange(effort, 0, 100, 9, 91)
const py = (impact: number) => mapRange(impact, 0, 100, 91, 9)

/** Dot diameter carries score, quietly — 9px to 15px across the whole set. */
const dotSize = (o: Opportunity) => (o.primary ? 18 : mapRange(o.score, 40, 80, 9, 14))

/* ------------------------------------------------------------------
   The field
   ------------------------------------------------------------------ */

function Axis() {
  return (
    <>
      {/* Two rules, no grid. A grid would imply precision we don't have. */}
      <div aria-hidden className="absolute inset-y-0 left-0 w-px bg-hairline-strong" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-hairline-strong" />

      {/* The corner where the answer lives, marked but not filled.
          Sized so that exactly one point is inside it. Drawn any larger it
          caught five of the seven, and a region that admits most of the set
          stops being a recommendation — the map would be saying "do first"
          about nearly everything while the page says one thing won. */}
      <div
        aria-hidden
        className="absolute rounded-[14px] border border-dashed border-accent-line"
        style={{ left: '3%', top: '3%', width: '43%', height: '24%' }}
      />
      <span className="t-label absolute left-[4.5%] top-[6%] text-accent">Do first</span>

      {/* These name the axes. Without them the field is a scatter of dots
          with no units, so they inherit .t-label's muted rather than
          overriding it back down to faint. */}
      <span className="t-label absolute -bottom-7 left-0">Low effort</span>
      <span className="t-label absolute -bottom-7 right-0">High effort</span>
      <span className="t-label absolute -left-1 -top-7">High impact</span>
    </>
  )
}

function Field({
  items,
  selected,
  onSelect,
}: {
  items: Opportunity[]
  selected: Opportunity | null
  onSelect: (o: Opportunity) => void
}) {
  const reduced = useReducedMotion()
  const [hover, setHover] = useState<string | null>(null)

  return (
    <div className="relative mt-12 mb-10 aspect-[5/4] w-full max-w-[760px] sm:aspect-[16/10]">
      <Axis />

      {items.map((o, i) => {
        const size = dotSize(o)
        const on = hover === o.id || selected?.id === o.id
        const showLabel = o.primary || on
        const isSelected = selected?.id === o.id

        return (
          <div
            key={o.id}
            className="absolute"
            style={{ left: `${px(o.effort)}%`, top: `${py(o.impact)}%` }}
          >
            <motion.button
              onClick={() => onSelect(o)}
              onMouseEnter={() => setHover(o.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(o.id)}
              onBlur={() => setHover(null)}
              aria-label={`${o.name} — impact ${o.impact}, effort ${o.effort}, score ${o.score}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-3"
              initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: reduced ? 0 : 0.5,
                ease: EASE.out,
                delay: reduced ? 0 : 0.15 + i * 0.05,
              }}
            >
              {/* The dot itself travels into the panel when selected. */}
              {!isSelected && (
                <motion.span
                  layoutId={`opp-${o.id}`}
                  transition={reduced ? { duration: 0 } : T.shared}
                  className={cn(
                    'block rounded-full',
                    o.primary
                      ? 'bg-accent ring-[5px] ring-accent-soft'
                      : on
                        ? 'bg-ink'
                        : 'bg-[rgba(17,17,17,0.28)]'
                  )}
                  style={{ width: size, height: size }}
                />
              )}
            </motion.button>

            <AnimatePresence>
              {showLabel && (
                <motion.span
                  key="label"
                  initial={{ opacity: 0, y: reduced ? 0 : 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.22, ease: EASE.out }}
                  className={cn(
                    'pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[12.5px] font-[500]',
                    o.primary ? 'text-accent-ink' : 'text-ink'
                  )}
                  style={{ top: size / 2 + 9 }}
                >
                  {o.name}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------
   Detail
   ------------------------------------------------------------------ */

function Detail({ o, onClose }: { o: Opportunity | null; onClose: () => void }) {
  const reduced = useReducedMotion()

  return (
    <SidePanel open={o !== null} onClose={onClose} labelledBy="opp-title">
      {o && (
        <div className="px-7 pb-16 pt-16 sm:px-11">
          <div className="flex items-center gap-3">
            <motion.span
              layoutId={`opp-${o.id}`}
              transition={reduced ? { duration: 0 } : T.shared}
              className={cn(
                'block rounded-full',
                o.primary ? 'bg-accent ring-[5px] ring-accent-soft' : 'bg-ink'
              )}
              style={{ width: o.primary ? 14 : 11, height: o.primary ? 14 : 11 }}
            />
            <Label tone={o.primary ? 'accent' : 'faint'}>{o.category}</Label>
          </div>

          <h2 id="opp-title" className="t-h1 mt-5">
            {o.name}
          </h2>
          <p className="t-body-lg mt-4 max-w-[46ch] text-muted">{o.summary}</p>

          <div className="mt-10 flex flex-wrap items-end gap-x-10 gap-y-6">
            <div>
              <Score value={o.score} size="md" />
              <Label className="mt-2.5">Opportunity score</Label>
            </div>
            <div>
              <div className="t-h3 tnum">{o.impact}</div>
              <Label className="mt-2.5">Impact</Label>
            </div>
            <div>
              <div className="t-h3 tnum">{o.effort}</div>
              <Label className="mt-2.5">Effort</Label>
            </div>
          </div>

          <Confidence value={o.confidence} className="mt-7" />

          <div className="mt-10 border-t border-hairline pt-8">
            <p className="t-body max-w-[52ch] text-ink">{o.detail}</p>
          </div>

          <div className="mt-9">
            <Label>Evidence</Label>
            <ul className="mt-3.5 list-none p-0">
              {o.evidence.map((e) => (
                <li key={e} className="t-body flex gap-3 py-1.5 text-muted">
                  <span aria-hidden className="mt-[0.62em] h-px w-3 shrink-0 bg-hairline-strong" />
                  <span className="max-w-[46ch]">{e}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </SidePanel>
  )
}

/* ------------------------------------------------------------------
   Ranked list — the same seven, readable without a mouse
   ------------------------------------------------------------------ */

function Row({ o, index, onSelect }: { o: Opportunity; index: number; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="group grid w-full grid-cols-[2.25rem_1fr_auto] items-baseline gap-x-4 border-t border-hairline py-6 text-left sm:grid-cols-[2.5rem_1fr_7rem_auto] sm:gap-x-6"
    >
      <span className={cn('t-meta tnum', o.primary ? 'text-accent' : 'text-muted')}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <span className="min-w-0">
        <span className={cn('block', o.primary ? 't-h2' : 't-h3')}>{o.name}</span>
        <span className="t-body mt-1.5 block text-muted">{o.summary}</span>
      </span>
      <span className="t-meta hidden sm:block">{o.category}</span>
      <span className={cn('tnum text-right', o.primary ? 't-h2 text-ink' : 't-h3 text-muted')}>
        {o.score}
      </span>
    </button>
  )
}

/* ------------------------------------------------------------------
   Screen
   ------------------------------------------------------------------ */

export default function Opportunities() {
  const reduced = useReducedMotion()
  const [category, setCategory] = useState<Category>('All')
  const [selected, setSelected] = useState<Opportunity | null>(null)

  const page = reduced ? fade : stagger(0.07, 0.04)
  const block = calm(rise, reduced)
  const lead = calm(riseLg, reduced)

  const shown =
    category === 'All' ? OPPORTUNITIES : OPPORTUNITIES.filter((o) => o.category === category)
  const ranked = [...shown].sort((a, b) => b.score - a.score)
  const winner = OPPORTUNITIES.find((o) => o.primary)

  return (
    <motion.div variants={page} initial="hidden" animate="show">
      <motion.header variants={lead}>
        <Label>Opportunity map</Label>
        <h1 className="t-h1 mt-4 max-w-[24ch]">
          Seven things worth doing. One worth doing first.
        </h1>
        <p className="t-body-lg mt-5 max-w-[62ch] text-muted">
          Impact against effort, scored for your product. {winner?.name} wins because it is the
          only high-impact move that is also cheap — everything else asks for more and returns
          less.
        </p>
      </motion.header>

      <motion.section variants={block} className="mt-14">
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((c) => (
            <Pill key={c} active={category === c} onClick={() => setCategory(c)}>
              {c}
            </Pill>
          ))}
        </div>

        <Field items={shown} selected={selected} onSelect={setSelected} />
      </motion.section>

      <motion.section variants={block} className="mt-20 lg:mt-24">
        <div className="flex items-baseline justify-between gap-4 pb-4">
          <Label>Ranked</Label>
          <Label>Score</Label>
        </div>
        {ranked.map((o, i) => (
          <Row key={o.id} o={o} index={i} onSelect={() => setSelected(o)} />
        ))}
        <div className="border-t border-hairline" />
      </motion.section>

      <Detail o={selected} onClose={() => setSelected(null)} />
    </motion.div>
  )
}
