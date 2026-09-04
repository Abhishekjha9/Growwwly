/**
 * Settings — deliberately the quietest screen in the product.
 *
 * The only real, working preference in Phase 1 is motion. Everything else
 * teammate's original design sketched here (connected data sources, project
 * cadence, danger zone) depends on Phase 2 infrastructure that doesn't
 * exist yet, so it isn't pretended into being here.
 */

'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Label, Reveal } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { T, setReducedMotion, useReducedMotion } from '@/lib/motion'

function Group({ label, note, children }: { label: string; note: string; children: ReactNode }) {
  return (
    <section className="border-t border-hairline pt-9 lg:pt-10">
      <h2 className="t-label">{label}</h2>
      <p className="t-meta mt-2.5 max-w-[54ch]">{note}</p>
      <div className="mt-5 lg:mt-6">{children}</div>
    </section>
  )
}

function Row({
  title,
  description,
  children,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-10">
      <div className="min-w-0">
        <div className="t-body font-[500] text-ink">{title}</div>
        {description && <div className="t-meta mt-0.5 max-w-[48ch]">{description}</div>}
      </div>
      <div className="flex min-h-8 items-center sm:justify-self-end">{children}</div>
    </div>
  )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  const reduced = useReducedMotion()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Reduced motion"
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

export default function SettingsPage() {
  const reduced = useReducedMotion()
  const systemReduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div className="max-w-[720px] pb-4">
      <Reveal>
        <header className="mb-11 lg:mb-14">
          <Label className="mb-4">Workspace</Label>
          <h1 className="t-h1">Settings</h1>
        </header>
      </Reveal>

      <Reveal>
        <Group label="Motion" note="Motion here explains a state change. It is never required to read a number.">
          <Row
            title="Reduced motion"
            description={
              systemReduced
                ? 'Your system is currently asking for reduced motion, so this starts on. Turning it off applies to this app only.'
                : 'Follows your system preference until you change it here. Transitions become instant; nothing is hidden.'
            }
          >
            <Switch checked={reduced} onChange={setReducedMotion} />
          </Row>
        </Group>
      </Reveal>
    </div>
  )
}
