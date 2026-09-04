/**
 * SEO — the restraint screen.
 *
 * One number, one sentence, ten lines. The checks animate in sequence because
 * the sequence is the point: the list should read as being verified in front
 * of you, not as ten results that were already sitting there.
 */

import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { Label, ProvenanceTag, Reveal, Score, StatusDot } from '@/components/primitives'
import { DUR, EASE, useReducedMotion } from '@/lib/motion'
import { CHANNELS, SEO, type CheckStatus, type SeoCheck } from '@/data/growth'

/* The list begins after the score has finished arriving. */
const ROWS_START = 0.42
const ROW_STAGGER = 0.07
/** The dot lands a beat after its row — that beat is the "verified" moment. */
const DOT_OFFSET = 0.16

/** Screen-reader equivalent of the StatusDot glyph, which is decorative. */
const STATUS_LABEL: Record<CheckStatus, string> = {
  pass: 'Pass',
  warn: 'Warning',
  fail: 'Fail',
}

function CheckRow({ check, index }: { check: SeoCheck; index: number }) {
  const reduced = useReducedMotion()
  const at = ROWS_START + index * ROW_STAGGER

  return (
    <motion.li
      className="border-t border-hairline"
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.standard, ease: EASE.out, delay: at }}
    >
      <div className="flex gap-3.5 py-4">
        <motion.span
          className="mt-[4px] inline-flex"
          initial={reduced ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: DUR.microSlow, ease: EASE.out, delay: at + DOT_OFFSET }}
        >
          <StatusDot status={check.status} />
        </motion.span>

        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-10">
          <h3 className="t-h3">
            {check.label}
            <span className="sr-only"> — {STATUS_LABEL[check.status]}</span>
          </h3>
          {/* Left-aligned in a fixed column rather than right-aligned: a
              two-line note set flush right reads with a ragged left edge. */}
          <p className="t-body text-muted sm:w-[34ch] sm:shrink-0">{check.note}</p>
        </div>
      </div>
    </motion.li>
  )
}

export default function Seo() {
  const reduced = useReducedMotion()
  const failing = SEO.checks.filter((c) => c.status === 'fail')
  const seoChannel = CHANNELS.find((c) => c.id === 'seo')

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <Reveal>
        <header>
          <Label>Analysis</Label>
          <h1 className="t-h1 mt-3">SEO</h1>
        </header>
      </Reveal>

      {/* The score carries the whole screen. Nothing competes with it. */}
      <section className="mt-24 sm:mt-32 lg:mt-40">
        <Reveal delay={0.06}>
          <Score value={SEO.score} size="xl" />
          {/* A rule, not a gauge: it settles at 84 as the number counts up. */}
          <div className="relative mt-7 h-px w-[140px] max-w-full bg-hairline" aria-hidden>
            <motion.div
              className="absolute inset-0 origin-left bg-ink"
              initial={{ scaleX: reduced ? SEO.score / 100 : 0 }}
              animate={{ scaleX: SEO.score / 100 }}
              transition={{ duration: reduced ? 0 : 1.1, ease: EASE.out }}
            />
          </div>
        </Reveal>

        <Reveal delay={0.16} className="mt-8">
          <h2 className="t-h2">{SEO.headline}</h2>
          <p className="t-body mt-3 max-w-[58ch]">{SEO.summary}</p>
          <div className="mt-6">
            <ProvenanceTag kind="inferred" />
          </div>
        </Reveal>
      </section>

      <section className="mt-24 border-t border-hairline pt-9 sm:mt-28">
        <div className="flex items-baseline justify-between gap-4">
          <Label>Ten checks</Label>
          <ProvenanceTag kind="measured" />
        </div>

        <ul className="mt-6 border-b border-hairline">
          {SEO.checks.map((check, i) => (
            <CheckRow key={check.id} check={check} index={i} />
          ))}
        </ul>
      </section>

      <Reveal className="mt-20 mb-4" delay={0.05}>
        <Label>What to fix first</Label>
        <p className="t-body mt-4 max-w-[58ch]">
          <span className="tnum">{failing.length}</span> of{' '}
          <span className="tnum">{SEO.checks.length}</span> checks fail —{' '}
          {failing.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ' and '}
              <span className="font-[540] text-ink">{c.label.toLowerCase()}</span>
            </span>
          ))}
          .{' '}
          <span className="text-muted">{failing.map((c) => c.note).join(' ')}</span>
        </p>

        {seoChannel && (
          <p className="t-meta mt-7">
            SEO ranks <span className="tnum">#{seoChannel.rank}</span> of{' '}
            <span className="tnum">{CHANNELS.length}</span> acquisition channels —{' '}
            {seoChannel.verdict.toLowerCase()}.
          </p>
        )}

        <Link
          to="/app/acquisition"
          className="group mt-3 inline-flex items-center gap-1.5 text-[13px] font-[500] text-accent transition-colors duration-[180ms] hover:text-accent-ink"
        >
          See the channel analysis
          <svg
            width="11"
            height="11"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="transition-transform duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-[2px]"
          >
            <path d="M2 6 h7" />
            <path d="M6.2 3 L9.2 6 L6.2 9" />
          </svg>
        </Link>
      </Reveal>
    </div>
  )
}
