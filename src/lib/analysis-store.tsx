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
import type { ProductIntelligence } from '@/types/product'

const STORAGE_KEY = 'growwwly:last-analysis'

interface AnalysisContextValue {
  result: ProductIntelligence | null
  setResult: (result: ProductIntelligence | null) => void
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null)

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [result, setResultState] = useState<ProductIntelligence | null>(null)

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

  const setResult = useCallback((next: ProductIntelligence | null) => {
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
