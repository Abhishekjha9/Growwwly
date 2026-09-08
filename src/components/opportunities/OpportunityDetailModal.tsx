/**
 * Expanded detail view for one opportunity. Shows the original context, why
 * Growwwly found it, and an editable suggested response — never an "auto
 * reply". Nothing here posts anything; the two actions are copying text to
 * the clipboard and opening the real source URL in a new tab.
 */

'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button, Label } from '@/components/primitives'
import { EASE, useReducedMotion } from '@/lib/motion'
import { SOURCE_TYPE_LABELS } from '@/lib/opportunities/constants'
import type { Opportunity } from '@/types/opportunities'

export function OpportunityDetailModal({
  opportunity,
  onClose,
}: {
  opportunity: Opportunity | null
  onClose: () => void
}) {
  const reduced = useReducedMotion()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (opportunity) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting the editable draft when a new opportunity opens
      setDraft(opportunity.responseDraft)
      setCopied(false)
    }
  }, [opportunity])

  useEffect(() => {
    if (!opportunity) return
    panelRef.current?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the modal opens
  }, [opportunity])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* Clipboard permissions denied — the text is still selectable/editable. */
    }
  }

  return (
    <AnimatePresence>
      {opportunity && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(31,13,17,0.32)] p-5 py-10 backdrop-blur-[2px] sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="w-full max-w-[640px] rounded-[20px] bg-surface p-7 shadow-panel outline-none sm:p-8"
            initial={{ opacity: 0, y: reduced ? 0 : 14, scale: reduced ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduced ? 0 : 8, scale: reduced ? 1 : 0.98 }}
            transition={{ duration: reduced ? 0.15 : 0.32, ease: EASE.out }}
          >
            <Label>{SOURCE_TYPE_LABELS[opportunity.sourceType]} · {opportunity.source}</Label>
            <h2 id={titleId} className="t-h1 mt-3">
              {opportunity.title}
            </h2>

            <div className="mt-5 rounded-[14px] bg-sunk px-5 py-4">
              <Label>Original context</Label>
              <p className="t-meta mt-2 max-w-[64ch] text-muted">{opportunity.snippet}</p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="t-meta">
                Opportunity Score <span className="tnum font-[550] text-ink">{opportunity.opportunityScore}</span>
              </span>
              <span className="t-meta">
                Search relevance <span className="tnum font-[550] text-ink">{opportunity.relevanceScore}</span>
              </span>
              <span className="t-meta">
                Confidence <span className="tnum font-[550] text-ink">{opportunity.confidence}</span>
              </span>
            </div>

            <div className="mt-5">
              <Label>Why Growwwly found this</Label>
              <p className="t-body mt-2 max-w-[64ch] text-ink-2">{opportunity.reason}</p>
            </div>

            {opportunity.matchingSignals.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {opportunity.matchingSignals.map((signal) => (
                  <span
                    key={signal}
                    className="inline-flex items-center rounded-full bg-[rgba(31,13,17,0.045)] px-3 py-1 text-[12px] text-muted"
                  >
                    {signal}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-7 border-t border-hairline pt-6">
              <Label>Suggested response</Label>
              <p className="t-meta mt-1.5 text-faint">{opportunity.suggestedAction} — edit freely before using it.</p>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={7}
                className="t-body mt-3 w-full resize-y rounded-[14px] border border-hairline bg-canvas p-4 text-ink-2 outline-none transition-colors focus:border-hairline-strong"
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <Button type="button" variant="ghost" onClick={onClose}>
                Close
              </Button>
              <div className="flex items-center gap-3">
                <Button type="button" variant="secondary" onClick={handleCopy}>
                  {copied ? 'Copied' : 'Copy response'}
                </Button>
                <a href={opportunity.url} target="_blank" rel="noopener noreferrer">
                  <Button type="button" variant="primary">
                    Open discussion ↗
                  </Button>
                </a>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
