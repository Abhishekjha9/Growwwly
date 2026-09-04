/**
 * Acquisition — six channels, ranked for this buyer.
 *
 * A ranking is only useful if it is willing to rank things last, and to say
 * that the whole category is the wrong question right now. Both happen here:
 * Paid is called premature, and the page opens by telling you that none of
 * these is your next move.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Label, ProvenanceTag } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { DUR, EASE, calm, fade, rise, riseLg, stagger, useReducedMotion } from '@/lib/motion'
import { CHANNELS, type Channel } from '@/data/growth'

/* ------------------------------------------------------------------
   Score, drawn as a length
   ------------------------------------------------------------------ */

function ScoreBar({ score, lead }: { score: number; lead: boolean }) {
  const reduced = useReducedMotion()
  return (
    <div className="relative h-px w-full bg-hairline" aria-hidden>
      <motion.div
        className={cn('absolute inset-y-0 left-0 origin-left', lead ? 'bg-accent' : 'bg-ghost')}
        style={{ width: `${score}%` }}
        initial={{ scaleX: reduced ? 1 : 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: reduced ? 0 : 0.8, ease: EASE.out }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------
   Row
   ------------------------------------------------------------------ */

function ChannelRow({ channel, open, onToggle }: { channel: Channel; open: boolean; onToggle: () => void }) {
  const reduced = useReducedMotion()
  const lead = channel.rank === 1
  const panelId = `channel-${channel.id}`

  return (
    <div className="border-t border-hairline">
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="group grid w-full grid-cols-[2.25rem_1fr_auto] items-baseline gap-x-4 py-7 text-left sm:grid-cols-[2.75rem_1fr_9rem_auto] sm:gap-x-6"
      >
        <span className={cn('t-meta tnum', lead ? 'text-accent' : 'text-muted')}>
          {String(channel.rank).padStart(2, '0')}
        </span>

        <span className="min-w-0">
          <span className={cn('block', lead ? 't-h1' : 't-h2', 'transition-colors duration-200 group-hover:text-ink')}>
            {channel.name}
          </span>
          <span className="t-meta mt-2 block sm:hidden">{channel.verdict}</span>
        </span>

        <span className="t-body hidden text-muted sm:block">{channel.verdict}</span>

        <span className="flex items-center gap-4">
          <span className={cn('tnum text-right', lead ? 't-h2 text-ink' : 't-h3 text-muted')}>
            {channel.score}
          </span>
          <motion.svg
            width="11"
            height="11"
            viewBox="0 0 12 12"
            aria-hidden
            className="shrink-0 text-faint"
            animate={{ rotate: open ? 180 : 0 }}
            transition={reduced ? { duration: 0 } : { duration: DUR.micro, ease: EASE.out }}
          >
            <path
              d="M2.5 4.4 L6 7.9 L9.5 4.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        </span>
      </button>

      <div className="pb-1">
        <ScoreBar score={channel.score} lead={lead} />
      </div>

      <div id={panelId}>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="detail"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: reduced ? 0 : DUR.standardSlow, ease: EASE.out }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 gap-x-12 gap-y-8 py-9 sm:pl-[3.5rem] lg:grid-cols-[1fr_18rem]">
                <div>
                  <p className="t-body max-w-[66ch] text-ink">{channel.reasoning}</p>

                  <div className="mt-7">
                    <Label tone="accent">First move</Label>
                    <p className="t-body mt-2.5 max-w-[62ch] text-ink">{channel.firstMove}</p>
                  </div>

                  <ProvenanceTag kind={channel.provenance} className="mt-6" />
                </div>

                {/* Fit, as a definition list. No gauges. */}
                <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-1 lg:gap-y-4">
                  {channel.fitFactors.map((f) => (
                    <div key={f.label} className="lg:flex lg:items-baseline lg:justify-between lg:gap-4">
                      <dt className="t-meta">{f.label}</dt>
                      <dd className="m-0 mt-1 text-[14px] font-[500] text-ink lg:mt-0 lg:text-right">
                        {f.value}
                      </dd>
                    </div>
                  ))}
                  <div className="lg:flex lg:items-baseline lg:justify-between lg:gap-4">
                    <dt className="t-meta">Time to signal</dt>
                    <dd className="m-0 mt-1 text-[14px] font-[500] text-ink lg:mt-0 lg:text-right">
                      {channel.timeToSignal}
                    </dd>
                  </div>
                  <div className="lg:flex lg:items-baseline lg:justify-between lg:gap-4">
                    <dt className="t-meta">Effort</dt>
                    <dd className="m-0 mt-1 text-[14px] font-[500] text-ink lg:mt-0 lg:text-right">
                      {channel.effort}
                    </dd>
                  </div>
                </dl>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------
   Screen
   ------------------------------------------------------------------ */

export default function Acquisition() {
  const reduced = useReducedMotion()
  const [open, setOpen] = useState<string | null>(CHANNELS[0].id)

  const page = reduced ? fade : stagger(0.07, 0.04)
  const block = calm(rise, reduced)
  const lead = calm(riseLg, reduced)

  return (
    <motion.div variants={page} initial="hidden" animate="show">
      <motion.header variants={lead}>
        <Label>Acquisition</Label>
        <h1 className="t-h1 mt-4 max-w-[24ch]">SEO is your strongest channel.</h1>
        <p className="t-body-lg mt-5 max-w-[64ch] text-muted">
          It is still not your next move. Every channel below pours visitors into a funnel that
          loses 77% of signups before they activate — which is why the ranking is here, and the
          recommendation is somewhere else.
        </p>
        <Link
          to="/app"
          className="group mt-6 inline-flex items-center gap-1.5 text-[14px] font-[500] text-accent transition-colors duration-[180ms] hover:text-accent-ink"
        >
          See the actual recommendation
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            aria-hidden
            className="transition-transform duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5"
          >
            <path
              d="M2.4 6 h6.7 M6.4 3.2 L9.2 6 L6.4 8.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </motion.header>

      <motion.section variants={block} className="mt-16 lg:mt-20">
        <div className="flex items-baseline justify-between gap-4 pb-4">
          <Label>Ranked for your buyer</Label>
          <Label>Fit score</Label>
        </div>

        {CHANNELS.map((c) => (
          <ChannelRow
            key={c.id}
            channel={c}
            open={open === c.id}
            onToggle={() => setOpen((v) => (v === c.id ? null : c.id))}
          />
        ))}
        <div className="border-t border-hairline" />
      </motion.section>

      <motion.section variants={block} className="mt-16 max-w-[62ch]">
        <p className="t-body text-muted">
          Scores weigh buyer concentration, competitive density, your existing foundation and
          payback period against a $588 ACV. They are estimates, and they move as the
          product does.
        </p>
      </motion.section>
    </motion.div>
  )
}
