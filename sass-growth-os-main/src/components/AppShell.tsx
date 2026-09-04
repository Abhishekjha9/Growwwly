/**
 * App shell — sidebar, top bar, page canvas.
 *
 * The sidebar is a list of words. The active item is marked by a soft
 * background that *slides* between items rather than blinking on, because
 * the movement is what tells you where you came from.
 */

import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { CoreMark } from '@/growthcore/GrowthCore'
import { cn } from '@/lib/cn'
import { EASE, T, useReducedMotion } from '@/lib/motion'
import { NAV, PROJECT } from '@/data/growth'

/* ------------------------------------------------------------------
   Icons — monochrome, 1.4px strokes, never inside a coloured circle
   ------------------------------------------------------------------ */

const ICONS: Record<string, React.ReactNode> = {
  Overview: (
    <>
      <rect x="2.6" y="2.6" width="4.6" height="4.6" rx="1.4" />
      <rect x="8.8" y="2.6" width="4.6" height="4.6" rx="1.4" />
      <rect x="2.6" y="8.8" width="4.6" height="4.6" rx="1.4" />
      <rect x="8.8" y="8.8" width="4.6" height="4.6" rx="1.4" />
    </>
  ),
  Product: (
    <>
      <path d="M3 4.2 h10" />
      <path d="M3 8 h10" />
      <path d="M3 11.8 h6.2" />
    </>
  ),
  Website: (
    <>
      <rect x="2.4" y="3" width="11.2" height="10" rx="2.2" />
      <path d="M2.4 6.2 h11.2" />
      <circle cx="4.6" cy="4.6" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  SEO: (
    <>
      <circle cx="7.2" cy="7.2" r="4.3" />
      <path d="M10.4 10.4 L13.4 13.4" />
    </>
  ),
  Acquisition: (
    <>
      <path d="M3 12.6 V9.4" />
      <path d="M6.8 12.6 V6.6" />
      <path d="M10.6 12.6 V3.6" />
    </>
  ),
  Opportunities: (
    <>
      <circle cx="5.2" cy="9.8" r="1.9" />
      <circle cx="10.6" cy="5.4" r="2.7" />
    </>
  ),
  '30-day plan': (
    <>
      <path d="M2.6 8 h10.8" />
      <circle cx="4.4" cy="8" r="1.25" />
      <circle cx="11.4" cy="8" r="1.25" />
    </>
  ),
  Experiments: (
    <>
      <path d="M6.4 2.6 v4.1 L3.3 12.1 a1 1 0 0 0 .86 1.5 h7.68 a1 1 0 0 0 .86 -1.5 L9.6 6.7 V2.6" />
      <path d="M5.4 2.6 h5.2" />
    </>
  ),
  Analytics: (
    <>
      <path d="M2.6 4 h10.8" />
      <path d="M4.2 8 h7.6" />
      <path d="M6 12 h4" />
    </>
  ),
  Settings: (
    <>
      <circle cx="8" cy="8" r="2.1" />
      <path d="M8 1.9 v1.5 M8 12.6 v1.5 M1.9 8 h1.5 M12.6 8 h1.5 M3.7 3.7 l1.05 1.05 M11.25 11.25 l1.05 1.05 M12.3 3.7 l-1.05 1.05 M4.75 11.25 l-1.05 1.05" />
    </>
  ),
}

function Icon({ name }: { name: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  )
}

/* ------------------------------------------------------------------
   Nav item
   ------------------------------------------------------------------ */

function NavItem({
  to,
  label,
  end,
  onNavigate,
}: {
  to: string
  label: string
  end?: boolean
  onNavigate?: () => void
}) {
  const reduced = useReducedMotion()
  return (
    <NavLink to={to} end={end} onClick={onNavigate} className="block">
      {({ isActive }) => (
        <div
          className={cn(
            'relative flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] font-[480] transition-colors duration-[160ms]',
            isActive ? 'text-ink' : 'text-muted hover:text-ink'
          )}
        >
          {/* The sliding indicator. One element, shared across every item. */}
          {isActive && (
            <motion.div
              layoutId="nav-active"
              className="absolute inset-0 rounded-[10px] bg-[rgba(17,17,17,0.052)]"
              // A layout animation is driven by JS, so the CSS duration
              // backstop in styles.css never reaches it. The slide is the
              // one piece of motion in the shell that runs on every
              // navigation — it has to be the one that asks.
              transition={
                reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 40, mass: 0.7 }
              }
            />
          )}
          <span className={cn('relative z-10', isActive ? 'text-ink' : 'text-faint')}>
            <Icon name={label} />
          </span>
          <span className="relative z-10">{label}</span>
        </div>
      )}
    </NavLink>
  )
}

/* ------------------------------------------------------------------
   Sidebar
   ------------------------------------------------------------------ */

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <CoreMark size={21} />
        <span className="text-[14.5px] font-[560] tracking-[-0.025em]">GrowthOS</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 pt-2">
        {NAV.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            label={item.label}
            end={'end' in item ? item.end : undefined}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="px-3 pb-4">
        <div className="mb-3 px-2.5">
          <div className="h-px w-full bg-hairline" />
        </div>
        <NavItem to="/app/settings" label="Settings" onNavigate={onNavigate} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------
   Top bar
   ------------------------------------------------------------------ */

function TopBar({ onMenu }: { onMenu: () => void }) {
  const [refreshing, setRefreshing] = useState(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!refreshing) return
    const t = setTimeout(() => setRefreshing(false), 1600)
    return () => clearTimeout(t)
  }, [refreshing])

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-hairline bg-canvas/85 px-5 backdrop-blur-xl lg:px-10">
      <button
        onClick={onMenu}
        aria-label="Open navigation"
        className="-ml-1 flex h-9 w-9 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-[rgba(17,17,17,0.05)] hover:text-ink lg:hidden"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          <path
            d="M2.5 4.5 h11 M2.5 8 h11 M2.5 11.5 h11"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div className="flex min-w-0 items-baseline gap-2.5">
        <span className="truncate text-[14px] font-[540] tracking-[-0.02em]">{PROJECT.name}</span>
        <span className="hidden truncate text-[13px] text-faint sm:block">{PROJECT.url}</span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={refreshing ? 'run' : 'idle'}
            initial={{ opacity: 0, y: reduced ? 0 : 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : -3 }}
            transition={T.micro}
            // Hidden on small screens at rest to save the room, but never
            // while re-analyzing: the icon no longer spins, so this line is
            // the only thing telling a phone that anything is happening.
            className={cn(
              'items-center gap-1.5 text-[12.5px] text-muted',
              refreshing ? 'flex' : 'hidden sm:flex'
            )}
          >
            <span
              className={cn(
                'inline-block h-1.5 w-1.5 rounded-full',
                refreshing ? 'bg-accent' : 'bg-positive'
              )}
            />
            {refreshing ? 'Re-analyzing…' : `Analysis updated ${PROJECT.analyzedAgo}`}
          </motion.span>
        </AnimatePresence>

        <button
          onClick={() => setRefreshing(true)}
          aria-label="Re-run analysis"
          className="ml-2 flex h-8 w-8 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-[rgba(17,17,17,0.05)] hover:text-ink"
        >
          {/* This does not spin. A rotating glyph is the one shape this
              product has argued against from the landing page onward — the
              analysis run refuses a spinner and shows its reasoning instead
              — and the shell was contradicting that on every in-app screen,
              in the only infinite loop in the codebase. Work in progress is
              said by dimming the control and by the line to its left. */}
          <motion.svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            aria-hidden
            animate={{ opacity: refreshing ? 0.4 : 1 }}
            transition={T.micro}
          >
            <path d="M13.4 8 a5.4 5.4 0 1 1 -1.6 -3.85" />
            <path d="M13.6 2.2 v3.2 h-3.2" />
          </motion.svg>
        </button>

        <div
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[11.5px] font-[560] text-white"
          title="Signed in"
        >
          A
        </div>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------
   Shell
   ------------------------------------------------------------------ */

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const reduced = useReducedMotion()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-dvh w-[228px] border-r border-hairline bg-canvas lg:block">
        <SidebarBody />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-[rgba(17,17,17,0.16)] backdrop-blur-[2px] lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.aside
              className="fixed left-0 top-0 z-50 h-dvh w-[252px] border-r border-hairline bg-canvas lg:hidden"
              initial={{ x: reduced ? 0 : '-100%', opacity: reduced ? 0 : 1 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: reduced ? 0 : '-100%', opacity: reduced ? 0 : 1 }}
              transition={
                reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 300, damping: 34 }
              }
            >
              <SidebarBody onNavigate={() => setMenuOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:pl-[228px]">
        <TopBar onMenu={() => setMenuOpen(true)} />
        <main className="mx-auto w-full max-w-[1180px] px-5 pb-32 pt-10 sm:px-8 lg:px-10 lg:pt-14">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: reduced ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -4 }}
              transition={{ duration: 0.3, ease: EASE.out }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
