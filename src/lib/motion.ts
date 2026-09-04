'use client'

/**
 * Motion system.
 *
 * Three tiers, and nothing outside them:
 *   micro     150–250ms   hover, buttons, toggles, tooltips
 *   standard  250–500ms   panels, tabs, filtering, navigation
 *   major     600–1200ms  analysis completion, Growth Core transformation
 *
 * Everything eases OUT. Nothing bounces. Nothing spins.
 */

import { useEffect, useSyncExternalStore } from 'react'
import type { Transition, Variants } from 'framer-motion'

/* -- Easing ------------------------------------------------------------- */

export const EASE = {
  /** Default. Decisive start, long soft settle. */
  out: [0.22, 1, 0.36, 1] as const,
  /** Snappier — for small objects that should feel immediate. */
  quick: [0.16, 1, 0.3, 1] as const,
  /** Symmetric — for things that leave and return. */
  inOut: [0.65, 0, 0.35, 1] as const,
}

/* -- Durations (seconds) ------------------------------------------------ */

export const DUR = {
  micro: 0.18,
  microSlow: 0.24,
  standard: 0.34,
  standardSlow: 0.48,
  major: 0.8,
  majorSlow: 1.1,
} as const

/* -- Reusable transitions ----------------------------------------------- */

export const T = {
  micro: { duration: DUR.micro, ease: EASE.quick } satisfies Transition,
  standard: { duration: DUR.standard, ease: EASE.out } satisfies Transition,
  standardSlow: { duration: DUR.standardSlow, ease: EASE.out } satisfies Transition,
  major: { duration: DUR.major, ease: EASE.out } satisfies Transition,

  /** Shared-element / layout transitions. Spring, but heavily damped — no wobble. */
  shared: { type: 'spring', stiffness: 340, damping: 38, mass: 0.9 } satisfies Transition,
  /** Larger objects travelling further. */
  sharedSoft: { type: 'spring', stiffness: 220, damping: 34, mass: 1 } satisfies Transition,
} as const

/* -- Variants ----------------------------------------------------------- */

/** The house entrance: 8px rise, no scale. Used for nearly everything. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: T.standard },
  exit: { opacity: 0, y: -4, transition: T.micro },
}

/** Editorial entrance for headline blocks — travels further, slower. */
export const riseLg: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE.out } },
}

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: T.standard },
  exit: { opacity: 0, transition: T.micro },
}

/**
 * Stagger container. Children must use `rise` (or any variant with the same
 * `hidden`/`show` keys) — children inherit the parent's animate state.
 */
export function stagger(each = 0.055, delay = 0): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren: each, delayChildren: delay } },
  }
}

/* -- Reduced motion ------------------------------------------------------ */

const QUERY = '(prefers-reduced-motion: reduce)'
const STORAGE_KEY = 'growthos:reduced-motion'

/**
 * The OS preference is the honest default, but it is not the only voice: a
 * founder on a shared machine, or one who simply finds the object distracting,
 * needs a switch that works. Settings used to render that switch over local
 * component state, so it moved and changed nothing — the single worst kind of
 * accessibility control, because it looks like the problem is solved.
 *
 * `null` means "follow the system". Anything else is an explicit override.
 */
let override: boolean | null = readOverride()
const listeners = new Set<() => void>()

function readOverride(): boolean | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === '1' ? true : v === '0' ? false : null
  } catch {
    return null
  }
}

function systemPrefers(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches
}

function emit() {
  // The CSS backstop keys off the media query, which an in-app override does
  // not change. Reflect the effective value onto the root so the stylesheet
  // and the JS animations can never disagree about it.
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.reducedMotion = String(override ?? systemPrefers())
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void): () => void {
  if (listeners.size === 0 && typeof window !== 'undefined') {
    window.matchMedia(QUERY).addEventListener('change', emit)
    // Another tab is still the same person with the same preference.
    window.addEventListener('storage', onStorage)
  }
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.matchMedia(QUERY).removeEventListener('change', emit)
      window.removeEventListener('storage', onStorage)
    }
  }
}

function onStorage(e: StorageEvent) {
  if (e.key !== STORAGE_KEY) return
  override = readOverride()
  emit()
}

function snapshot(): boolean {
  return override ?? systemPrefers()
}

/**
 * Writes the effective preference onto `<html>` once, on mount. Mount once
 * near the root (see `app/layout.tsx`).
 *
 * This deliberately runs as an effect rather than a module-level side effect:
 * the server-rendered HTML can never carry a browser preference, so writing
 * it before hydration commits only desyncs the two and trips React's
 * hydration-mismatch warning for no visual benefit — the attribute still
 * can't be present at the true (server) first paint either way.
 */
export function ReducedMotionSync(): null {
  useEffect(() => {
    emit()
  }, [])
  return null
}

/** Set the in-app override. Pass `null` to hand control back to the system. */
export function setReducedMotion(next: boolean | null): void {
  override = next
  try {
    if (next === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
  } catch {
    /* Private mode. The preference still holds for this session. */
  }
  emit()
}

/**
 * Live-updating reduced-motion preference — system preference, unless the user
 * has overridden it in Settings.
 *
 * When true, callers must: drop transforms, keep opacity/state changes, and
 * stop any continuous animation. State must still be readable — never rely on
 * movement alone to convey meaning.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}

/** Collapse a variant set to opacity-only when the user asks for less motion. */
export function calm(v: Variants, reduced: boolean): Variants {
  return reduced ? fade : v
}
