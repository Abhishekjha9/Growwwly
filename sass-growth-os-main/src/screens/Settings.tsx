/**
 * Settings — deliberately the quietest screen in the product.
 *
 * Nothing here is a decision, so nothing here competes for attention: a label
 * in the margin, a line of explanation, one control on the right. Values are
 * edited in place rather than inside a form, because the page you read and the
 * page you change should be the same page.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Button, Label, Pill, Reveal } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { T, setReducedMotion, useReducedMotion } from '@/lib/motion'
import { PROJECT } from '@/data/growth'

/* ------------------------------------------------------------------
   LAYOUT — section, row. No cards; the page is the canvas.
   ------------------------------------------------------------------ */

function Group({
  id,
  label,
  note,
  children,
}: {
  id: string
  label: string
  note: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={`${id}-label`} className="border-t border-hairline pt-9 lg:pt-10">
      <h2 id={`${id}-label`} className="t-label">
        {label}
      </h2>
      <p className="t-meta mt-2.5 max-w-[54ch]">{note}</p>
      <div className="mt-5 lg:mt-6">{children}</div>
    </section>
  )
}

function Row({
  title,
  titleId,
  description,
  className,
  children,
}: {
  title: string
  titleId?: string
  description?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-10',
        className
      )}
    >
      <div className="min-w-0">
        <div id={titleId} className="t-body font-[500] text-ink">
          {title}
        </div>
        {description && <div className="t-meta mt-0.5 max-w-[48ch]">{description}</div>}
      </div>
      <div className="flex min-h-8 items-center sm:justify-self-end">{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------
   INLINE FIELD — the editor wears the exact clothes of the text
   ------------------------------------------------------------------ */

/** Display and editor share this box, so committing an edit moves nothing. */
const FIELD_BOX =
  't-body -ml-2 block w-full rounded-[10px] px-2 py-0.5 text-ink sm:ml-0 sm:-mr-2 sm:w-[280px]'

function InlineEditor({
  initial,
  label,
  onCommit,
  onCancel,
}: {
  initial: string
  label: string
  onCommit: (next: string) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(initial)
  /** Enter and Escape both unmount the field — don't let the trailing blur commit twice. */
  const settled = useRef(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  return (
    <input
      ref={ref}
      type="text"
      value={draft}
      aria-label={`${label} — edit`}
      spellCheck={false}
      autoComplete="off"
      className={cn(FIELD_BOX, 'border-0 bg-sunk caret-accent sm:text-right')}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          settled.current = true
          onCancel()
        } else if (e.key === 'Enter') {
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

function InlineField({
  value,
  label,
  onCommit,
}: {
  value: string
  label: string
  onCommit: (next: string) => void
}) {
  const [editing, setEditing] = useState(false)

  const commit = useCallback(
    (next: string) => {
      setEditing(false)
      onCommit(next)
    },
    [onCommit]
  )

  if (editing) {
    return (
      <InlineEditor
        initial={value}
        label={label}
        onCommit={commit}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={`${label}: ${value}. Edit`}
      className={cn(
        FIELD_BOX,
        'text-left transition-colors duration-150 hover:bg-[rgba(17,17,17,0.045)] sm:text-right'
      )}
    >
      {value}
    </button>
  )
}

/* ------------------------------------------------------------------
   SWITCH — the one place a track is allowed to carry accent
   ------------------------------------------------------------------ */

function Switch({
  checked,
  onChange,
  labelledBy,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  labelledBy: string
}) {
  const reduced = useReducedMotion()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
        checked ? 'bg-accent' : 'bg-[rgba(17,17,17,0.16)] hover:bg-[rgba(17,17,17,0.24)]'
      )}
    >
      <motion.span
        aria-hidden
        className="absolute left-[2px] h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(17,17,17,0.24)]"
        animate={{ x: checked ? 16 : 0 }}
        transition={reduced ? { duration: 0 } : T.micro}
      />
    </button>
  )
}

/* ------------------------------------------------------------------
   CONTENT
   ------------------------------------------------------------------ */

const CADENCE = ['Daily', 'Weekly', 'Manual'] as const
type Cadence = (typeof CADENCE)[number]

const SOURCES = [
  {
    id: 'posthog',
    name: PROJECT.analyticsSource,
    purpose: 'Funnel stages, activation and retention events.',
  },
  {
    id: 'search-console',
    name: 'Google Search Console',
    purpose: 'Impressions, queries and ranking movement.',
  },
  { id: 'stripe', name: 'Stripe', purpose: 'Revenue, plan mix and expansion.' },
] as const

type DangerState = 'idle' | 'confirming' | 'queued'

const DANGER_COPY: Record<DangerState, string> = {
  idle: `${PROJECT.name}, its analysis history and every experiment attached to it.`,
  confirming: `Delete ${PROJECT.name} permanently?`,
  queued: 'Queued for deletion. Nothing is analyzed until you undo.',
}

/* ------------------------------------------------------------------
   SCREEN
   ------------------------------------------------------------------ */

export default function Settings() {
  const navigate = useNavigate()
  const reduced = useReducedMotion()

  /** The OS preference on its own, so the row can say where the default came from. */
  const systemReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const [name, setName] = useState<string>(PROJECT.name)
  const [url, setUrl] = useState<string>(PROJECT.url)
  const [cadence, setCadence] = useState<Cadence>('Weekly')
  const [connected, setConnected] = useState<Record<string, boolean>>({
    posthog: PROJECT.analyticsConnected,
    'search-console': false,
    stripe: false,
  })
  const [danger, setDanger] = useState<DangerState>('idle')

  // A confirmation is a modal state, even when it is inline.
  useEffect(() => {
    if (danger !== 'confirming') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDanger('idle')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [danger])

  const swap = reduced ? { duration: 0.16 } : T.standard

  return (
    <div className="max-w-[720px] pb-4">
      <Reveal>
        <header className="mb-11 lg:mb-14">
          <Label className="mb-4">Workspace</Label>
          <h1 className="t-h1">Settings</h1>
          <p className="t-body mt-5 max-w-[56ch]">
            Everything below applies to {name} and to the analysis running against {url}.
          </p>
        </header>
      </Reveal>

      <div className="space-y-11 lg:space-y-14">
        {/* -- Project ------------------------------------------------ */}
        <Reveal>
          <Group id="project" label="Project" note="What gets analyzed, and how often.">
            <Row title="Project name">
              <InlineField value={name} label="Project name" onCommit={(next) => setName(next.trim() || PROJECT.name)} />
            </Row>

            <Row title="Site URL">
              <InlineField value={url} label="Site URL" onCommit={(next) => setUrl(next.trim() || PROJECT.url)} />
            </Row>

            <Row title="Analysis cadence" description="Manual keeps the current analysis until you ask for a new one.">
              <div role="group" aria-label="Analysis cadence" className="flex gap-1.5">
                {CADENCE.map((option) => (
                  <Pill key={option} active={option === cadence} onClick={() => setCadence(option)}>
                    {option}
                    {option === cadence && <span className="sr-only"> — selected</span>}
                  </Pill>
                ))}
              </div>
            </Row>
          </Group>
        </Reveal>

        {/* -- Data sources ------------------------------------------- */}
        <Reveal>
          <Group
            id="sources"
            label="Data sources"
            note="Read on every analysis run. Nothing is written back."
          >
            {SOURCES.map((source) => {
              const on = connected[source.id]
              return (
                <Row
                  key={source.id}
                  title={source.name}
                  description={source.purpose}
                  className="border-b border-hairline last:border-b-0"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={on ? 'on' : 'off'}
                      initial={{ opacity: 0, y: reduced ? 0 : 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: reduced ? 0 : -3 }}
                      transition={T.micro}
                      className="flex items-center gap-5"
                    >
                      {on ? (
                        <>
                          <span className="t-meta inline-flex items-center gap-2">
                            <span
                              aria-hidden
                              className="inline-block h-[6px] w-[6px] shrink-0 rounded-full bg-positive"
                            />
                            Connected
                          </span>
                          <button
                            type="button"
                            aria-label={`Disconnect ${source.name}`}
                            onClick={() =>
                              setConnected((prev) => ({ ...prev, [source.id]: false }))
                            }
                            className="t-meta text-faint transition-colors duration-150 hover:text-ink"
                          >
                            Disconnect
                          </button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={`Connect ${source.name}`}
                          onClick={() => setConnected((prev) => ({ ...prev, [source.id]: true }))}
                        >
                          Connect
                        </Button>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </Row>
              )
            })}
          </Group>
        </Reveal>

        {/* -- Motion -------------------------------------------------- */}
        <Reveal>
          <Group
            id="motion"
            label="Motion"
            note="Motion here explains a state change. It is never required to read a number."
          >
            <Row
              title="Reduced motion"
              titleId="reduced-motion-label"
              description={
                systemReduced
                  ? 'Your system is currently asking for reduced motion, so this starts on. Turning it off applies to this app only.'
                  : 'Follows your system preference until you change it here. Transitions become instant; nothing is hidden.'
              }
            >
              {/* This switch drives the real preference every animated
                  component reads, not a copy of it — see lib/motion. */}
              <Switch
                checked={reduced}
                onChange={setReducedMotion}
                labelledBy="reduced-motion-label"
              />
            </Row>
          </Group>
        </Reveal>

        {/* -- Analysis ------------------------------------------------ */}
        <Reveal>
          <Group
            id="analysis"
            label="Analysis"
            note="A full re-read of your site, funnel and channels."
          >
            <Row title="Re-run analysis" description={`Last completed ${PROJECT.analyzedAgo}.`}>
              <Button size="sm" variant="secondary" onClick={() => navigate('/analyze')}>
                Run now
              </Button>
            </Row>
          </Group>
        </Reveal>

        {/* -- Danger -------------------------------------------------- */}
        <Reveal>
          <Group
            id="danger"
            label="Danger"
            note="Removing this project removes everything derived from it."
          >
            <div className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-10">
              <div className="min-w-0">
                <div className="t-body font-[500] text-ink">Delete project</div>
                <div className="mt-0.5 min-h-[20px]">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={danger}
                      initial={{ opacity: 0, y: reduced ? 0 : 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: reduced ? 0 : -4 }}
                      transition={swap}
                      className={cn(
                        't-meta max-w-[48ch]',
                        danger === 'confirming' && 'text-ink-2'
                      )}
                    >
                      {DANGER_COPY[danger]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex min-h-8 items-center sm:justify-self-end">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={danger}
                    initial={{ opacity: 0, y: reduced ? 0 : 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reduced ? 0 : -4 }}
                    transition={swap}
                    className="flex items-center gap-2"
                  >
                    {danger === 'idle' && (
                      <Button size="sm" variant="secondary" onClick={() => setDanger('confirming')}>
                        <span className="text-negative">Delete project</span>
                      </Button>
                    )}

                    {danger === 'confirming' && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setDanger('idle')}>
                          Cancel
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setDanger('queued')}>
                          <span className="text-negative">Delete permanently</span>
                        </Button>
                      </>
                    )}

                    {danger === 'queued' && (
                      <button
                        type="button"
                        onClick={() => setDanger('idle')}
                        className="t-meta text-faint transition-colors duration-150 hover:text-ink"
                      >
                        Undo
                      </button>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </Group>
        </Reveal>
      </div>
    </div>
  )
}
