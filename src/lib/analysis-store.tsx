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
      if (next) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      else sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* Private mode. The value still holds for this tab's session. */
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
