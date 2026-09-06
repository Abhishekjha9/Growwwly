/**
 * The Light/Dark document-theme picker shown before a report downloads.
 * Selecting a theme never touches the analysis — it only chooses which
 * `ReportTheme` (`@/lib/report/theme`) the existing PDF generator paints
 * with. See `DownloadReportButton` for the request that follows.
 */

'use client'

import { useEffect, useId, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { EASE, useReducedMotion } from '@/lib/motion'
import { DARK_THEME, LIGHT_THEME, type ReportTheme, type ReportThemeName } from '@/lib/report/theme'

const THEME_OPTIONS: Array<{ name: ReportThemeName; label: string; description: string; theme: ReportTheme }> = [
  {
    name: 'light',
    label: 'Light',
    description: 'White background, black text — the classic Growwwly report.',
    theme: LIGHT_THEME,
  },
  {
    name: 'dark',
    label: 'Dark',
    description: 'Deep charcoal, off-white text — a premium dark editorial read.',
    theme: DARK_THEME,
  },
]

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M3.2 8.4 L6.4 11.6 L12.8 4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** A miniature, color-accurate mockup of the cover page — built from the
 * same theme tokens the real PDF uses, so this genuinely previews the
 * document rather than standing in with unrelated colors. */
function ThemePreview({ theme }: { theme: ReportTheme }) {
  return (
    <div
      className="aspect-[3/4] w-full rounded-[10px] p-3"
      style={{ backgroundColor: theme.background, border: `1px solid ${theme.border}` }}
    >
      <div className="text-[7px] font-[700] tracking-[-0.02em]" style={{ color: theme.foreground }}>
        Growwwly
      </div>
      <div
        className="mt-0.5 text-[4.5px] font-[700] uppercase"
        style={{ color: theme.accent, letterSpacing: '0.08em' }}
      >
        Growth Report
      </div>

      <div className="mt-3 h-1.5 w-[70%] rounded-full" style={{ backgroundColor: theme.foreground }} />
      <div className="mt-1.5 h-[3px] w-[40%] rounded-full" style={{ backgroundColor: theme.foregroundMuted }} />

      <div className="mt-2 space-y-1">
        <div className="h-[2.5px] w-full rounded-full" style={{ backgroundColor: theme.border }} />
        <div className="h-[2.5px] w-[85%] rounded-full" style={{ backgroundColor: theme.border }} />
        <div className="h-[2.5px] w-[60%] rounded-full" style={{ backgroundColor: theme.border }} />
      </div>

      <div className="mt-3 rounded-[5px] p-2" style={{ backgroundColor: theme.surfaceAccent }}>
        <div className="h-[3px] w-[55%] rounded-full" style={{ backgroundColor: theme.accentMuted }} />
        <div className="mt-1.5 h-1 w-[75%] rounded-full" style={{ backgroundColor: theme.foreground }} />
        <div className="mt-2 h-[2.5px] w-full rounded-full" style={{ backgroundColor: theme.border }} />
        <div className="mt-1 h-[2.5px] w-[30%] rounded-full" style={{ backgroundColor: theme.accent }} />
      </div>
    </div>
  )
}

function ThemeOption({
  option,
  selected,
  onSelect,
}: {
  option: (typeof THEME_OPTIONS)[number]
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col gap-2.5 rounded-2xl border p-3 text-left transition-colors duration-150',
        selected
          ? 'border-accent bg-accent-soft/40'
          : 'border-hairline hover:border-hairline-strong hover:bg-[rgba(17,17,17,0.015)]'
      )}
    >
      <ThemePreview theme={option.theme} />
      <div className="flex items-center gap-2">
        <span className="t-h3">{option.label}</span>
        {selected && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-[600] text-white">
            <CheckIcon />
            Selected
          </span>
        )}
      </div>
      <p className="t-meta">{option.description}</p>
    </button>
  )
}

export function DownloadReportModal({
  open,
  selectedTheme,
  onSelectTheme,
  onCancel,
  onConfirm,
  isGenerating,
  errorMessage,
}: {
  open: boolean
  selectedTheme: ReportThemeName
  onSelectTheme: (theme: ReportThemeName) => void
  onCancel: () => void
  onConfirm: () => void
  isGenerating: boolean
  errorMessage: string
}) {
  const reduced = useReducedMotion()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isGenerating) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the modal opens
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,17,17,0.32)] p-5 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isGenerating) onCancel()
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="w-full max-w-[560px] rounded-[20px] bg-surface p-7 shadow-panel outline-none sm:p-8"
            initial={{ opacity: 0, y: reduced ? 0 : 14, scale: reduced ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduced ? 0 : 8, scale: reduced ? 1 : 0.98 }}
            transition={{ duration: reduced ? 0.15 : 0.32, ease: EASE.out }}
          >
            <h2 id={titleId} className="t-h1">
              Download Growth Report
            </h2>
            <p className="t-body mt-2 text-muted">Choose your document style</p>

            <div role="radiogroup" aria-label="Document theme" className="mt-6 grid grid-cols-2 gap-4">
              {THEME_OPTIONS.map((option) => (
                <ThemeOption
                  key={option.name}
                  option={option}
                  selected={selectedTheme === option.name}
                  onSelect={() => onSelectTheme(option.name)}
                />
              ))}
            </div>

            {errorMessage && (
              <p role="alert" className="t-meta mt-5 text-negative">
                {errorMessage}
              </p>
            )}

            <div className="mt-7 flex items-center justify-end gap-3">
              <Button type="button" variant="ghost" onClick={onCancel} disabled={isGenerating}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={onConfirm}
                disabled={isGenerating}
                aria-busy={isGenerating}
              >
                {isGenerating ? 'Generating Report…' : 'Download PDF'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
