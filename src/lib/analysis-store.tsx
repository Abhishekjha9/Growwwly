/**
 * Holds the most recent Product Intelligence result on the client so the
 * `/analyze` form and the `/app` dashboard can share it without a database —
 * there is no Phase 2 persistence layer yet. Backed by sessionStorage purely
 * so a refresh on `/app/*` doesn't lose the analysis that was just run.
 */

'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AnalysisResult } from '@/types/analysis'

// Bumped whenever the stored shape changes: v2 added
// `{ productIntelligence, growthIntelligence }` (was a bare
// ProductIntelligence), v3 added `websiteIntelligence`. A stale entry left
// over in a browser's sessionStorage would otherwise parse fine but crash
// the first component that reads a field the old shape didn't have.
const STORAGE_KEY = 'growwwly:last-analysis:v3'

interface AnalysisContextValue {
  result: AnalysisResult | null
  setResult: (result: AnalysisResult | null) => void
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null)

// ---------------------------------------------------------------------------
// Screenshot data stripping for sessionStorage persistence.
//
// Desktop + mobile JPEG screenshots can each be 1–3 MB as base64, easily
// pushing the serialised AnalysisResult past sessionStorage's ~5 MB per-
// origin quota. When that happens the browser throws a QuotaExceededError
// that the store's catch block silently swallows — so the result saves to
// React state (visible until refresh) but NOT to sessionStorage, so after
// a page refresh the screenshots are gone.
//
// Fix: strip the large screenshot data URLs before writing to sessionStorage,
// preserving all other fields (captured flag, dimensions, interpretation) so
// the measured-evidence panels still work after a refresh. The screenshot
// images are in-memory-only: they are always available during the current
// session, and the Website page can display them if the user hasn't refreshed.
// ---------------------------------------------------------------------------

function stripScreenshots(result: AnalysisResult): AnalysisResult {
  if (!result.websiteIntelligence?.visual) return result
  return {
    ...result,
    websiteIntelligence: {
      ...result.websiteIntelligence,
      visual: {
        desktop: {
          ...result.websiteIntelligence.visual.desktop,
          screenshotDataUrl: null,
        },
        mobile: {
          ...result.websiteIntelligence.visual.mobile,
          screenshotDataUrl: null,
        },
      },
    },
  }
}

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [result, setResultState] = useState<AnalysisResult | null>(null)

  useEffect(() => {
    // Deliberately post-hydration: reading sessionStorage during the initial
    // render would desync the server-rendered (window-less) markup from the
    // client's first paint.
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setResultState(JSON.parse(raw))
    } catch {
      /* Private mode, or corrupted state — start clean. */
    }
  }, [])

  const setResult = useCallback((next: AnalysisResult | null) => {
    setResultState(next)
    try {
      if (next) {
        // Strip large screenshot data URLs before persisting — they can
        // exceed sessionStorage's quota and be silently lost. The in-memory
        // React state retains the full data for the current session.
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stripScreenshots(next)))
      } else {
        sessionStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      /* Private mode or still-too-large even after stripping — in-memory
       * state still holds for this tab's session. */
    }
  }, [])

  const value = useMemo(() => ({ result, setResult }), [result, setResult])

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>
}

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext)
  if (!ctx) throw new Error('useAnalysis must be used within an AnalysisProvider')
  return ctx
}
