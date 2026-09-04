/**
 * 30-day plan — a horizontal editorial timeline.
 *
 * Explicitly not a board. A board says "here are some things, in columns";
 * a timeline says "this happens, then this happens, and here is what you will
 * know at the end of it". The four weeks are one argument in sequence, so the
 * page reads left to right and the rule underneath never breaks.
 */

import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Label } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { EASE, calm, fade, rise, riseLg, stagger, useReducedMotion } from '@/lib/motion'
import { HEADLINE_ACTION, PLAN, type PlanWeek } from '@/data/growth'

const TOTAL_TASKS = PLAN.reduce((n, w) => n + w.tasks.length, 0)

/* ------------------------------------------------------------------
   Task — a hairline box, not a checkbox widget
   ------------------------------------------------------------------ */

function Task({ text, done, onToggle }: { text: string; done: boolean; onToggle: () => void }) {
  const reduced = useReducedMotion()

  return (
    <li className="list-none">
      <button
        onClick={onToggle}
        aria-pressed={done}
        className="group flex w-full items-start gap-3 py-2 text-left"
      >
        <span
          className={cn(
            'mt-[0.15em] flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-200',
            done
              ? 'border-ink bg-ink'
              : 'border-hairline-strong group-hover:border-faint'
          )}
        >
          <motion.svg
            width="9"
            height="9"
            viewBox="0 0 10 10"
            aria-hidden
            initial={false}
            animate={{ opacity: done ? 1 : 0, scale: done ? 1 : 0.7 }}
            transition={{ duration: reduced ? 0 : 0.2, ease: EASE.out }}
          >
            <path
              d="M2 5.2 L4.1 7.3 L8 3"
              fill="none"
              stroke="#fff"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        </span>

        <span
          className={cn(
            'text-[14px] leading-[1.55] transition-colors duration-200',
            done ? 'text-faint' : 'text-ink-2'
          )}
        >
          {text}
        </span>
      </button>
    </li>
  )
}

/* ------------------------------------------------------------------
   Week
   ------------------------------------------------------------------ */

function Week({
  week,
  index,
  done,
  onToggle,
}: {
  week: PlanWeek
  index: number
  done: Set<string>
  onToggle: (key: string) => void
}) {
  const reduced = useReducedMotion()
  const first = index === 0
  const complete = week.tasks.every((_, i) => done.has(`${index}-${i}`))

  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: reduced ? 0.2 : 0.6, ease: EASE.out, delay: reduced ? 0 : index * 0.08 }}
      className="relative pl-10 lg:pl-0"
    >
      {/* The node on the rule. Vertical rail below lg, horizontal above. */}
      <span
        aria-hidden
        className={cn(
          'absolute left-[-4.5px] top-1.5 h-[11px] w-[11px] rounded-full border-2 border-canvas lg:left-auto lg:top-[-25px]',
          complete ? 'bg-ink' : first ? 'bg-accent' : 'bg-ghost'
        )}
      />

      <div className="flex items-baseline gap-3">
        <Label tone={first ? 'accent' : 'faint'}>{week.week}</Label>
        <span className="t-meta text-muted">{week.phase}</span>
      </div>

      <h2 className="t-h2 mt-3.5">{week.title}</h2>
      <p className="t-body mt-3 max-w-[38ch] text-muted">{week.summary}</p>

      <ul className="mt-7 m-0 list-none p-0">
        {week.tasks.map((t, i) => (
          <Task
            key={t}
            text={t}
            done={done.has(`${index}-${i}`)}
            onToggle={() => onToggle(`${index}-${i}`)}
          />
        ))}
      </ul>

      {/* What you will know at the end of the week — the point of the week. */}
      <div className="mt-8 border-t border-hairline pt-5">
        <Label>You will know</Label>
        <p className="t-body mt-2.5 max-w-[38ch] text-ink">{week.outcome}</p>
      </div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------
   Screen
   ------------------------------------------------------------------ */

export default function Plan() {
  const reduced = useReducedMotion()
  const [done, setDone] = useState<Set<string>>(new Set())

  const page = reduced ? fade : stagger(0.07, 0.04)
  const block = calm(rise, reduced)
  const lead = calm(riseLg, reduced)

  const toggle = (key: string) =>
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const completed = done.size
  const pct = useMemo(() => (completed / TOTAL_TASKS) * 100, [completed])

  return (
    <motion.div variants={page} initial="hidden" animate="show">
      <motion.header variants={lead}>
        <Label>30-day plan</Label>
        <h1 className="t-h1 mt-4 max-w-[22ch]">{HEADLINE_ACTION.statement}</h1>
        <p className="t-body-lg mt-5 max-w-[60ch] text-muted">
          One month, four movements: find the real cause, make the smallest change that could fix
          it, let it run untouched, then decide from what the numbers say.
        </p>

        {/* Progress, stated once, in words and one hairline. */}
        <div className="mt-9 max-w-[320px]">
          <div className="flex items-baseline justify-between gap-4">
            <span className="t-meta tnum">
              {completed} of {TOTAL_TASKS} done
            </span>
            <span className="t-meta tnum text-muted">{Math.round(pct)}%</span>
          </div>
          <div className="relative mt-3 h-px w-full bg-hairline">
            <motion.div
              aria-hidden
              className="absolute inset-y-0 left-0 origin-left bg-ink"
              animate={{ width: `${pct}%` }}
              transition={{ duration: reduced ? 0 : 0.45, ease: EASE.out }}
            />
          </div>
        </div>
      </motion.header>

      {/* The timeline. One unbroken rule under four weeks. */}
      <motion.section variants={block} className="relative mt-24 lg:mt-32">
        {/* Vertical rail below lg */}
        <div
          aria-hidden
          className="absolute bottom-6 left-0 top-2 w-px bg-hairline-strong lg:hidden"
        />
        {/* Horizontal rule at lg */}
        <div aria-hidden className="absolute -top-6 left-0 hidden h-px w-full bg-hairline-strong lg:block" />

        <div className="grid grid-cols-1 gap-x-10 gap-y-20 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-0">
          {PLAN.map((w, i) => (
            <Week key={w.week} week={w} index={i} done={done} onToggle={toggle} />
          ))}
        </div>
      </motion.section>

      <motion.section variants={block} className="mt-24 border-t border-hairline pt-10 lg:mt-32">
        <Label>At the end</Label>
        <h2 className="t-h2 mt-4 max-w-[30ch]">
          You will either have fixed activation, or know exactly why you haven’t.
        </h2>
        <p className="t-body mt-3.5 max-w-[62ch] text-muted">
          Both are progress. The plan is designed to produce a written learning either way — a
          month that ends in “it didn’t work, and here is the reason” is not a wasted month.
        </p>
      </motion.section>
    </motion.div>
  )
}
