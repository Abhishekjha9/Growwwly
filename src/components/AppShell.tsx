/**
 * App shell — sidebar, top bar, page canvas.
 *
 * The sidebar is a list of words. The active item is marked by a soft
 * background that *slides* between items rather than blinking on, because
 * the movement is what tells you where you came from.
 */

'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { CoreMark } from '@/growthcore/GrowthCore'
import { cn } from '@/lib/cn'
import { EASE, T, useReducedMotion } from '@/lib/motion'
import { NAV, PROJECT } from '@/data/growth'
import { useAnalysis } from '@/lib/analysis-store'

/* ------------------------------------------------------------------
   Icons — monochrome, 1.4px strokes, never inside a coloured circle
   ------------------------------------------------------------------ */

const ICONS: Record<string, ReactNode> = {
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
  Market: (
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
  Website: (
    <>
      <rect x="2.4" y="3" width="11.2" height="10" rx="2.2" />
      <path d="M2.4 6.2 h11.2" />
      <circle cx="4.6" cy="4.6" r="0.5" fill="currentColor" stroke="none" />
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
  const pathname = usePathname()
  const isActive = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)

  return (
    <Link href={to} onClick={onNavigate} className="block">
      <div
        className={cn(
          'relative flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] font-[480] transition-colors duration-[160ms]',
          isActive ? 'text-ink' : 'text-muted hover:text-ink'
        )}
      >
        {isActive && (
          <motion.div
            layoutId="nav-active"
            className="absolute inset-0 rounded-[10px] bg-[rgba(17,17,17,0.052)]"
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
    </Link>
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
        <span className="text-[14.5px] font-[560] tracking-[-0.025em]">{PROJECT.name}</span>
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
  const reduced = useReducedMotion()
  const { result } = useAnalysis()

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
        <span className="truncate text-[14px] font-[540] tracking-[-0.02em]">
          {result?.productIntelligence.product.name ?? 'No analysis yet'}
        </span>
        {result && (
          <span className="hidden truncate text-[13px] text-faint sm:block">
            {result.productIntelligence.product.category}
          </span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Link
          href="/analyze"
          className="ml-2 flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-[12.5px] font-[500] text-muted transition-colors hover:bg-[rgba(17,17,17,0.05)] hover:text-ink"
        >
          <motion.svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            aria-hidden
            whileHover={reduced ? undefined : { rotate: 45 }}
            transition={T.micro}
          >
            <path d="M8 2.4 V13.6 M2.4 8 H13.6" />
          </motion.svg>
          New analysis
        </Link>

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

export default function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const reduced = useReducedMotion()

  // Close the mobile drawer on navigation. Adjusted during render rather
  // than in an effect, per https://react.dev/learn/you-might-not-need-an-effect.
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setMenuOpen(false)
  }

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
              key={pathname}
              initial={{ opacity: 0, y: reduced ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -4 }}
              transition={{ duration: 0.3, ease: EASE.out }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
