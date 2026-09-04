import { Label, SignalBar } from '@/components/primitives'
import { cn } from '@/lib/cn'

/**
 * One AI-generated 0–100 signal. Deliberately not called a score, a rank or
 * a measurement — see AGENTS.md §8. The deterministic scoring engine that
 * would turn this into a real ranking is Phase 2.
 */
export function SignalRow({
  label,
  value,
  reasoning,
  first = false,
}: {
  label: string
  value: number
  reasoning?: string
  first?: boolean
}) {
  return (
    <div className={cn('py-6', !first && 'border-t border-hairline')}>
      <div className="flex items-baseline justify-between gap-4">
        <span className="t-h3">{label}</span>
        <span className="flex items-baseline gap-2">
          <span className="tnum t-h2 text-ink">{value}</span>
          <Label>AI signal</Label>
        </span>
      </div>
      <SignalBar value={value} tone="accent" className="mt-4" />
      {reasoning && <p className="t-body mt-4 max-w-[64ch] text-muted">{reasoning}</p>}
    </div>
  )
}
