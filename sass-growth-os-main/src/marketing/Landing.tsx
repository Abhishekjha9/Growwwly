/**
 * Landing — the argument, made once.
 *
 * The page makes no claim the object doesn't make first: six signals arrive,
 * they resolve, one sentence is left standing. Everything else on this page
 * exists to get out of that sentence's way.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { Variants } from 'motion/react'
import Lenis from 'lenis'
import Story from './story'
import { CoreMark, GrowthCore } from '@/growthcore/GrowthCore'
import type { CoreState } from '@/growthcore/state'
import { Label, Reveal } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { EASE, calm, rise, riseLg, stagger, useReducedMotion } from '@/lib/motion'
import { HEADLINE_ACTION, NAV } from '@/data/growth'

/* ------------------------------------------------------------------
   Copy deck — the only strings this page owns. Everything the product
   asserts comes from the analysis itself.
   ------------------------------------------------------------------ */

const COPY = {
  brand: 'GrowthOS',
  headline: 'Know what to do next.',
  sub: 'Your product, website and funnel analyzed into one clear growth decision.',
  primary: 'Analyze my SaaS',
  secondary: 'See how it works',
  recommendation: 'Recommendation',
  replay: 'Replay',
  closing: 'Stop guessing which growth lever to pull.',
  reassurance: 'No credit card. Analysis takes about 40 seconds.',
} as const

const STORY_ID = 'how-it-works'

/** The four analysis surfaces, pointed at the real routes. */
const FOOTER_LINKS = NAV.slice(1, 5)

/* ------------------------------------------------------------------
   Actions
   ------------------------------------------------------------------ */

function CtaLink({
  to,
  size = 'md',
  children,
}: {
  to: string
  size?: 'md' | 'lg'
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap bg-ink font-[550] text-white',
        'shadow-[0_1px_2px_rgba(17,17,17,0.12)]',
        'transition-[background-color,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
        'hover:-translate-y-px hover:bg-[#000] active:translate-y-0',
        size === 'lg' ? 'h-12 rounded-[14px] px-6 text-[15px]' : 'h-9 rounded-[13px] px-4 text-[13.5px]'
      )}
    >
      {children}
    </Link>
  )
}

/** Quiet secondary action. The arrow points at the section it moves you to. */
function ScrollAction({ onClick, size = 'md' }: { onClick: () => void; size?: 'md' | 'lg' }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group inline-flex items-center gap-1.5 rounded-[13px] px-2 font-[500] text-muted',
        'transition-colors duration-[180ms] hover:text-ink',
        size === 'lg' ? 'h-12 text-[15px]' : 'h-9 text-[13.5px]'
      )}
    >
      {COPY.secondary}
      <svg
        width="11"
        height="11"
        viewBox="0 0 12 12"
        aria-hidden
        className="translate-y-0 opacity-55 transition-transform duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-[2px]"
      >
        <path
          d="M6 2.2 V9.1 M3.1 6.3 L6 9.4 L8.9 6.3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

/* ------------------------------------------------------------------
   Top bar — transparent until the page has moved
   ------------------------------------------------------------------ */

function TopNav({ onHowItWorks }: { onHowItWorks: () => void }) {
  const [lifted, setLifted] = useState(false)

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter]',
        'duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
        lifted ? 'border-hairline bg-canvas/80 backdrop-blur-xl' : 'border-transparent bg-transparent'
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center gap-4 px-5 sm:px-8 lg:px-10">
        <Link to="/" className="flex items-center gap-2.5" aria-label={`${COPY.brand} home`}>
          <CoreMark size={21} />
          <span className="text-[14.5px] font-[560] tracking-[-0.025em]">{COPY.brand}</span>
        </Link>

        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <span className="hidden sm:block">
            <ScrollAction onClick={onHowItWorks} />
          </span>
          <CtaLink to="/analyze">{COPY.primary}</CtaLink>
        </div>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------
   Hero sequence — one staged run, then rest
   ------------------------------------------------------------------ */

const BEATS: ReadonlyArray<{ at: number; state: CoreState }> = [
  { at: 900, state: 'analyzing' },
  { at: 2000, state: 'understanding' },
  { at: 3200, state: 'prioritizing' },
  { at: 4400, state: 'decision' },
]

function useCoreSequence(reduced: boolean) {
  const [run, setRun] = useState(0)
  const [state, setState] = useState<CoreState>(reduced ? 'decision' : 'idle')

  useEffect(() => {
    // Reduced motion gets the conclusion, not the performance.
    if (reduced) {
      setState('decision')
      return
    }
    setState('idle')
    const timers = BEATS.map((b) => window.setTimeout(() => setState(b.state), b.at))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [reduced, run])

  const replay = useCallback(() => setRun((r) => r + 1), [])
  return { state, replay, settled: state === 'decision' }
}

/** The object arrives after the words — slower than anything else on the page. */
const coreEnter: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.9, ease: EASE.out } },
}

/**
 * The object is sized by what the hero has left over, not by a fixed fraction
 * of the viewport.
 *
 * Everything else in this section — headline, sub, actions, the gaps, and the
 * recommendation the sequence resolves into — is about 610px of fixed chrome at
 * `lg`. Sizing the core at `44vh` claimed another 396px of a 900px laptop and
 * pushed the payoff sentence below the fold, which means the one line the whole
 * performance exists to produce was never on screen when it arrived. Subtracting
 * the chrome instead keeps that sentence in the first viewport, and lets the
 * object grow to its full size on a taller display rather than capping it early.
 *
 * Below `lg` the hero is allowed to scroll, and the object is sized by width.
 */
const CORE_SIZE =
  'h-[min(340px,72vw)] w-[min(340px,72vw)] ' +
  'lg:h-[max(200px,min(400px,100dvh_-_624px))] lg:w-[max(200px,min(400px,100dvh_-_624px))]'

function Hero({ onHowItWorks }: { onHowItWorks: () => void }) {
  const reduced = useReducedMotion()
  const { state, replay, settled } = useCoreSequence(reduced)

  return (
    <section className="flex min-h-dvh flex-col items-center justify-center px-5 pb-14 pt-24 text-center sm:px-8 lg:pt-28">
      <motion.div
        variants={stagger(reduced ? 0 : 0.07, reduced ? 0 : 0.06)}
        initial="hidden"
        animate="show"
        className="flex w-full flex-col items-center"
      >
        <motion.h1 variants={calm(riseLg, reduced)} className="t-display max-w-[18ch]">
          {COPY.headline}
        </motion.h1>

        <motion.p variants={calm(rise, reduced)} className="t-body-lg mt-5 max-w-[52ch] text-muted">
          {COPY.sub}
        </motion.p>

        <motion.div
          variants={calm(rise, reduced)}
          className="mt-8 flex flex-col items-center gap-2 sm:flex-row sm:gap-4"
        >
          <CtaLink to="/analyze" size="lg">
            {COPY.primary}
          </CtaLink>
          <ScrollAction onClick={onHowItWorks} size="lg" />
        </motion.div>

        {/* Many signals, one decision — the whole product in one object. */}
        <motion.div
          variants={coreEnter}
          className="mt-10 flex w-full flex-col items-center sm:mt-12 lg:mt-14"
        >
          <GrowthCore three state={state} showLabels className={CORE_SIZE} />

          <motion.div
            className="mt-6 flex flex-col items-center"
            initial={false}
            animate={{ opacity: settled ? 1 : 0, y: settled || reduced ? 0 : 10 }}
            transition={{
              duration: reduced ? 0 : settled ? 0.75 : 0.28,
              ease: EASE.out,
              delay: settled && !reduced ? 0.2 : 0,
            }}
          >
            <Label>{COPY.recommendation}</Label>
            <p className="t-h2 mt-3.5 max-w-[26ch] text-ink">{HEADLINE_ACTION.statement}</p>
          </motion.div>

          {/* Reserved height — the replay affordance never moves the page. */}
          <div className="mt-5 flex h-7 items-center justify-center">
            <AnimatePresence>
              {settled && !reduced && (
                <motion.button
                  key="replay"
                  onClick={replay}
                  aria-label="Replay the analysis sequence"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.3, ease: EASE.out, delay: 0.6 } }}
                  exit={{ opacity: 0, transition: { duration: 0.18, ease: EASE.out } }}
                  className="t-meta rounded-full px-2 py-1 text-faint transition-colors duration-150 hover:text-ink"
                >
                  {COPY.replay}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}

/* ------------------------------------------------------------------
   Closing — one line, one action
   ------------------------------------------------------------------ */

function Closing() {
  return (
    <section className="px-5 pb-32 pt-28 sm:px-8 lg:pb-40 lg:pt-44">
      <Reveal className="mx-auto flex max-w-[760px] flex-col items-center text-center">
        <h2 className="t-title max-w-[18ch]">{COPY.closing}</h2>
        <div className="mt-10">
          <CtaLink to="/analyze" size="lg">
            {COPY.primary}
          </CtaLink>
        </div>
        <p className="t-meta mt-5">{COPY.reassurance}</p>
      </Reveal>
    </section>
  )
}

/* ------------------------------------------------------------------
   Footer
   ------------------------------------------------------------------ */

function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-hairline">
      <Reveal
        y={8}
        className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10"
      >
        <div className="flex items-center gap-2.5">
          <CoreMark size={19} />
          <span className="text-[13.5px] font-[560] tracking-[-0.025em]">{COPY.brand}</span>
        </div>

        <nav className="flex flex-wrap items-center gap-x-7 gap-y-2">
          {FOOTER_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="t-meta text-muted transition-colors duration-150 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <p className="t-meta text-faint">
          <span className="tnum">© {year}</span> {COPY.brand}
        </p>
      </Reveal>
    </footer>
  )
}

/* ------------------------------------------------------------------
   Page
   ------------------------------------------------------------------ */

export default function Landing() {
  const reduced = useReducedMotion()
  const lenisRef = useRef<Lenis | null>(null)

  // Smooth scroll is a comfort, never a requirement. Off when motion is reduced.
  useEffect(() => {
    if (reduced) return

    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true, touchMultiplier: 1.4 })
    lenisRef.current = lenis

    let frame = 0
    const loop = (time: number) => {
      lenis.raf(time)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [reduced])

  const scrollToStory = useCallback(() => {
    const el = document.getElementById(STORY_ID)
    if (!el) return
    const lenis = lenisRef.current
    if (lenis) {
      lenis.scrollTo(el, { offset: -64, duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 3) })
      return
    }
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }, [reduced])

  return (
    <div className="min-h-dvh bg-canvas">
      <TopNav onHowItWorks={scrollToStory} />

      <main>
        <Hero onHowItWorks={scrollToStory} />

        <div id={STORY_ID} className="scroll-mt-16">
          <Story />
        </div>

        <Closing />
      </main>

      <SiteFooter />
    </div>
  )
}
