/**
 * Analytics — the connected-data screen.
 *
 * One visualization, and then the sentence it produces. The temptation here is
 * six charts; the honest version is a single funnel, the three conversion rates
 * that describe it, and a verdict large enough that nobody has to read the
 * funnel twice to reach it.
 *
 * Every number on this page is measured — that is the whole reason it exists.
 * The verdict drawn from those numbers is not, and says so.
 */

import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Funnel } from '@/components/analytics'
import { EmptyState } from '@/illustrations'
import { Button, Counter, Label, ProvenanceTag } from '@/components/primitives'
import { cn, fmt } from '@/lib/cn'
import { calm, fade, rise, riseLg, stagger, useReducedMotion } from '@/lib/motion'
import { FUNNEL, FUNNEL_VERDICT, PROJECT } from '@/data/growth'

/* ------------------------------------------------------------------
   Derived from the funnel — never restated by hand
   ------------------------------------------------------------------ */

/** The bottleneck and the stage feeding it. The verdict rests on these two. */
const BOTTLENECK_INDEX = Math.max(
  FUNNEL.findIndex((s) => s.bottleneck),
  1
)
const BOTTLENECK = FUNNEL[BOTTLENECK_INDEX]
const UPSTREAM = FUNNEL[BOTTLENECK_INDEX - 1]
const LOST = UPSTREAM.value - BOTTLENECK.value

/** Stage-to-stage conversion. Only the bottleneck rate is allowed the accent. */
const CONVERSIONS = FUNNEL.slice(1).map((stage, i) => ({
  id: stage.id,
  rate: stage.fromPrev ?? 0,
  label: `${FUNNEL[i].label} → ${stage.label}`,
  accent: Boolean(stage.bottleneck),
}))

const NOTED = FUNNEL.filter((stage) => stage.note)

/* ------------------------------------------------------------------
   Page head — shared by both the connected and disconnected states
   ------------------------------------------------------------------ */

function PageHead({ children }: { children?: React.ReactNode }) {
  return (
    <header>
      <Label>Analytics</Label>
      <h1 className="t-h1 mt-3">Your funnel</h1>
      {children}
    </header>
  )
}

function ArrowRight() {
  return (
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
  )
}

/* ------------------------------------------------------------------
   Screen
   ------------------------------------------------------------------ */

export default function Analytics() {
  const reduced = useReducedMotion()

  const page = reduced ? fade : stagger(0.07, 0.04)
  const block = calm(rise, reduced)
  const lead = calm(riseLg, reduced)

  const connected: boolean = PROJECT.analyticsConnected

  if (!connected) {
    return (
      <motion.div
        variants={page}
        initial="hidden"
        animate="show"
        className="mx-auto w-full max-w-[880px]"
      >
        <motion.div variants={lead}>
          <PageHead />
        </motion.div>

        <motion.div variants={block} className="mt-20 lg:mt-28">
          <EmptyState
            kind="analytics"
            title="No analytics connected."
            body={`Connect ${PROJECT.analyticsSource} and the funnel is read directly from your product — four stages, last thirty days. Until then the strategist works from your website alone, and says so.`}
            action={<Button variant="primary">Connect {PROJECT.analyticsSource}</Button>}
          />
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={page}
      initial="hidden"
      animate="show"
      className="mx-auto w-full max-w-[880px]"
    >
      <motion.div variants={lead}>
        <PageHead>
          <p className="t-meta mt-4 flex items-center gap-2">
            <span aria-hidden className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-positive" />
            Connected to {PROJECT.analyticsSource} · Last 30 days
          </p>
        </PageHead>
      </motion.div>

      {/* The one visualization on this screen. It gets the room. */}
      <motion.section
        variants={block}
        aria-label="Funnel, last 30 days"
        className="mt-16 lg:mt-24"
      >
        <Funnel stages={FUNNEL} />

        {/* Stage annotations. The bottleneck's note is in ink so it outweighs the rest. */}
        <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-3 lg:mt-14">
          {NOTED.map((stage) => (
            <div key={stage.id}>
              <Label tone={stage.bottleneck ? 'ink' : 'faint'}>{stage.label}</Label>
              <p
                className={cn(
                  't-meta mt-2.5 max-w-[34ch]',
                  stage.bottleneck ? 'text-ink' : 'text-muted'
                )}
              >
                {stage.note}
              </p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* The point of the screen. Heavier than the page title, deliberately. */}
      <motion.section
        variants={block}
        aria-labelledby="funnel-verdict"
        className="mt-24 border-t border-hairline pt-12 lg:mt-32 lg:pt-16"
      >
        {/* The biggest sentence on the page is the one thing on it that was
            not measured — it is what the strategist concluded from what was.
            Left unmarked it made the footnote below into a false promise:
            the page claimed every inference is marked, while its own headline
            went unmarked. Marking it costs nothing and is the whole product. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Label>What this means</Label>
          <ProvenanceTag kind="inferred" />
        </div>

        <h2 id="funnel-verdict" className="t-title mt-6 max-w-[20ch]">
          {FUNNEL_VERDICT}
        </h2>

        <p className="t-body-lg mt-7 max-w-[58ch] text-muted">
          <span className="tnum font-[540] text-ink">{fmt(LOST)}</span> signups are lost between
          signup and activation — the largest absolute loss anywhere in the funnel. The top of the
          funnel is already above category median; the step after it is not.
        </p>

        <Link
          to="/app"
          className="group mt-8 inline-flex items-center gap-1.5 text-[14px] font-[500] text-accent transition-colors duration-[180ms] hover:text-accent-ink"
        >
          See the recommendation
          <ArrowRight />
        </Link>
      </motion.section>

      {/* The only other data on the page. Three numbers, three hairlines. */}
      <motion.section variants={block} className="mt-24 border-t border-hairline pt-10 lg:mt-28">
        <Label>Stage conversion</Label>

        <div className="mt-9 grid grid-cols-1 sm:mt-11 sm:grid-cols-3">
          {CONVERSIONS.map((c, i) => (
            <div
              key={c.id}
              className={cn(
                'py-6 first:pt-0 sm:py-0',
                i > 0 &&
                  'border-t border-hairline sm:border-t-0 sm:border-l sm:border-hairline sm:pl-8 lg:pl-12'
              )}
            >
              <div className={cn('t-metric', c.accent ? 'text-accent' : 'text-ink')}>
                <Counter to={c.rate} format={(n) => `${n.toFixed(1)}%`} />
              </div>
              <Label className="mt-3.5">{c.label}</Label>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.p
        variants={block}
        className="t-meta mt-20 flex max-w-[68ch] flex-wrap items-baseline gap-x-2.5 gap-y-1 lg:mt-24"
      >
        <ProvenanceTag kind="measured" />
        <span className="flex-1 basis-[24ch]">
          Every number on this page is read directly from your connected{' '}
          {PROJECT.analyticsSource} project. Nothing here is modelled or estimated. The one
          conclusion drawn from them is marked as an interpretation above.
        </span>
      </motion.p>
    </motion.div>
  )
}
