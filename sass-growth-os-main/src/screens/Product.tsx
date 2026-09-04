/**
 * Product intelligence — a document, not a dashboard.
 *
 * Every line here is the model's reading of the product. The screen exists so
 * a founder can disagree with it: each value is click-to-edit, and a corrected
 * value stops claiming model confidence, because a human-supplied fact isn't a
 * prediction. Corrections are what re-rank the opportunity list.
 */

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Confidence, Label, ProvenanceTag, Reveal } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { EASE, useReducedMotion } from '@/lib/motion'
import { PRODUCT_SECTIONS, PROJECT, type ProductField } from '@/data/growth'

/* ------------------------------------------------------------------
   EDITOR — a textarea wearing the exact clothes of the text it replaced
   ------------------------------------------------------------------ */

function autosize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function ValueEditor({
  initial,
  label,
  typeClass,
  onCommit,
  onCancel,
}: {
  initial: string
  label: string
  typeClass: string
  onCommit: (next: string) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState(initial)
  /** Escape and Enter both unmount this field — don't let the trailing blur commit twice. */
  const settled = useRef(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    autosize(el)
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  return (
    <textarea
      ref={ref}
      rows={1}
      value={draft}
      aria-label={`${label} — edit value`}
      className={cn(
        typeClass,
        'block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-ink caret-accent'
      )}
      onChange={(e) => {
        setDraft(e.target.value)
        autosize(e.currentTarget)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          settled.current = true
          onCancel()
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          settled.current = true
          onCommit(draft)
        }
      }}
      onBlur={() => {
        if (settled.current) return
        settled.current = true
        onCommit(draft)
      }}
    />
  )
}

/* ------------------------------------------------------------------
   EDITABLE VALUE — display and editor share one type class, so nothing moves
   ------------------------------------------------------------------ */

function EditableValue({
  value,
  label,
  typeClass,
  editing,
  onStart,
  onCancel,
  onCommit,
}: {
  value: string
  label: string
  typeClass: string
  editing: boolean
  onStart: () => void
  onCancel: () => void
  onCommit: (next: string) => void
}) {
  if (editing) {
    return (
      <ValueEditor
        initial={value}
        label={label}
        typeClass={typeClass}
        onCommit={onCommit}
        onCancel={onCancel}
      />
    )
  }
  return (
    <button
      type="button"
      onClick={onStart}
      aria-label={`${label}: ${value}. Edit`}
      className={cn(typeClass, 'block w-full whitespace-pre-wrap text-left text-ink')}
    >
      {value}
    </button>
  )
}

/* ------------------------------------------------------------------
   FIELD ROW — label in the margin, the reading on the canvas
   ------------------------------------------------------------------ */

function FieldRow({
  field,
  value,
  edited,
  onCommit,
}: {
  field: ProductField
  value: string
  edited: boolean
  onCommit: (next: string) => void
}) {
  const reduced = useReducedMotion()
  const [editing, setEditing] = useState(false)

  const typeClass = field.prose ? 't-h3' : 't-h2'
  const foot = editing ? 'editing' : edited ? 'edited' : 'meta'

  const commit = useCallback(
    (next: string) => {
      setEditing(false)
      onCommit(next)
    },
    [onCommit]
  )

  return (
    <div className="group relative border-t border-hairline">
      {/* The plate is the only hover affordance the row needs. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute -inset-x-3 bottom-0 top-px rounded-[14px] bg-[rgba(17,17,17,0.02)] transition-opacity duration-200',
          editing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
        )}
      />

      <div className="relative grid grid-cols-1 gap-y-2 py-7 sm:py-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-x-12 lg:py-9">
        <div
          className={cn(
            'flex items-baseline justify-between gap-4',
            field.prose ? 'lg:pt-[3px]' : 'lg:pt-[6px]'
          )}
        >
          <div className="t-meta text-muted">{field.label}</div>
          {/* Hover reveals the affordance on desktop; touch has no hover, so it stays. */}
          {!editing && (
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              onClick={() => setEditing(true)}
              className="t-meta shrink-0 text-faint transition-opacity duration-200 hover:text-muted lg:opacity-0 lg:group-hover:opacity-100"
            >
              Edit
            </button>
          )}
        </div>

        <div className="min-w-0">
          <div className="max-w-[44ch]">
            <EditableValue
              value={value}
              label={field.label}
              typeClass={typeClass}
              editing={editing}
              onStart={() => setEditing(true)}
              onCancel={() => setEditing(false)}
              onCommit={commit}
            />
          </div>

          {field.detail && (
            <p
              className={
                field.prose ? 't-body mt-3 max-w-[64ch]' : 't-body mt-2.5 max-w-[62ch] text-muted'
              }
            >
              {field.detail}
            </p>
          )}

          <div className="mt-3.5 flex min-h-[17px] items-center">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={foot}
                initial={{ opacity: 0, y: reduced ? 0 : 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : -3 }}
                transition={{ duration: reduced ? 0.12 : 0.18, ease: EASE.quick }}
                className="flex flex-wrap items-center gap-x-5 gap-y-2"
              >
                {foot === 'editing' && (
                  <span className="t-meta text-faint">Enter to save · Esc to cancel</span>
                )}

                {foot === 'edited' && (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] tracking-[-0.002em] text-muted">
                      <span aria-hidden className="inline-block h-[6px] w-[6px] shrink-0 rounded-full bg-ink" />
                      Edited by you
                    </span>
                    <button
                      type="button"
                      onClick={() => onCommit(field.value)}
                      className="text-[11.5px] text-faint underline-offset-2 transition-colors duration-150 hover:text-ink hover:underline"
                    >
                      Revert
                    </button>
                  </>
                )}

                {foot === 'meta' && (
                  <>
                    {field.confidence !== undefined && <Confidence value={field.confidence} />}
                    <ProvenanceTag kind={field.provenance} />
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------
   SCREEN
   ------------------------------------------------------------------ */

export default function Product() {
  const [edits, setEdits] = useState<Record<string, string>>({})

  /** A correction that matches the original isn't a correction — drop it. */
  const commitField = useCallback((id: string, original: string, next: string) => {
    const clean = next.trim()
    setEdits((prev) => {
      if (!clean || clean === original) {
        if (!(id in prev)) return prev
        const rest = { ...prev }
        delete rest[id]
        return rest
      }
      if (prev[id] === clean) return prev
      return { ...prev, [id]: clean }
    })
  }, [])

  const editCount = useMemo(() => Object.keys(edits).length, [edits])

  return (
    <div className="max-w-[880px] pb-4">
      <Reveal>
        <header className="mb-14 lg:mb-20">
          <Label className="mb-4">Analysis</Label>
          <h1 className="t-h1">Product intelligence</h1>
          <p className="t-body mt-5 max-w-[64ch]">
            Everything below was read from {PROJECT.url} — its pages, its pricing and its docs.
            Some of it is measured, most of it is interpretation. Anything that is wrong can be
            corrected in place, and every correction changes what gets recommended next.
          </p>
        </header>
      </Reveal>

      {PRODUCT_SECTIONS.map((section, i) => (
        <Reveal key={section.id} className={i === 0 ? undefined : 'mt-16 lg:mt-24'}>
          <section aria-labelledby={`sec-${section.id}`}>
            <h2 id={`sec-${section.id}`} className="t-label mb-3">
              {section.title}
            </h2>
            {section.intro && <p className="t-meta mb-7 max-w-[58ch]">{section.intro}</p>}

            <div>
              {section.fields.map((field) => (
                <FieldRow
                  key={field.id}
                  field={field}
                  value={edits[field.id] ?? field.value}
                  edited={field.id in edits}
                  onCommit={(next) => commitField(field.id, field.value, next)}
                />
              ))}
            </div>
          </section>
        </Reveal>
      ))}

      <Reveal className="mt-20 border-t border-hairline pt-10 lg:mt-28">
        <Label className="mb-4">What this changes</Label>
        <p className="t-body max-w-[64ch]">
          Corrections are treated as fact, not as another signal. They re-weight the reasoning and
          re-rank the opportunity list — changing who you build for can move a different action to
          the top of it.
        </p>

        <div className="min-h-[26px]">
          <AnimatePresence initial={false}>
            {editCount > 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: EASE.out }}
                className="t-meta mt-4"
              >
                <span className="tnum text-ink">{editCount}</span>{' '}
                {editCount === 1 ? 'correction' : 'corrections'} applied to this analysis.
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <Link
          to="/app/opportunities"
          className="group mt-6 inline-flex items-center gap-2 text-[14px] font-[520] text-accent transition-colors duration-150 hover:text-accent-ink"
        >
          See opportunities
          <svg
            width="13"
            height="13"
            viewBox="0 0 13 13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5"
          >
            <path d="M2.4 6.5 h7.6" />
            <path d="M7.1 3.6 L10 6.5 L7.1 9.4" />
          </svg>
        </Link>
      </Reveal>
    </div>
  )
}
