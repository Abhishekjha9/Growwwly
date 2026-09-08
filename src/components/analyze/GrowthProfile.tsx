import { Label, ProvenanceTag, SignalBar } from '@/components/primitives'

/**
 * A reusable, compact rendering of a set of Growwwly AI signals — grouped
 * where the page calls for it, one shared provenance tag per section rather
 * than repeated on every row. Every value here is passed in from the
 * existing analysis object; this component only presents it.
 *
 * Used on Product (Product fit, Pain profile) and Market (Market signals),
 * and by anything else that needs the same label/value/bar treatment.
 */

export interface GrowthSignal {
  label: string
  /** 0–100 */
  value: number
}

export interface GrowthSignalGroup {
  /** Optional small caption above the group's rows, e.g. "Discovery". */
  label?: string
  signals: GrowthSignal[]
}

function SignalCell({ signal }: { signal: GrowthSignal }) {
  return (
    <div className="py-4">
      <div className="flex items-baseline justify-between gap-4">
        <span className="t-h3">{signal.label}</span>
        <span className="tnum text-[22px] font-[550] leading-none text-ink">{signal.value}</span>
      </div>
      <SignalBar value={signal.value} tone="accent" className="mt-3" />
    </div>
  )
}

export function GrowthProfile({
  groups,
  provenance = 'inferred',
}: {
  groups: GrowthSignalGroup[]
  /** One tag for the whole profile — every value here shares the same
   * provenance, so it isn't repeated per row. Pass `null` to omit. */
  provenance?: 'measured' | 'inferred' | 'assumed' | null
}) {
  return (
    <div>
      {provenance && <ProvenanceTag kind={provenance} className="mb-2" />}
      <div className="divide-y divide-hairline">
        {groups.map((group, i) => (
          <div key={group.label ?? i} className={group.label ? 'py-5 first:pt-0' : ''}>
            {group.label && <Label className="mb-1">{group.label}</Label>}
            <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
              {group.signals.map((signal) => (
                <SignalCell key={signal.label} signal={signal} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
