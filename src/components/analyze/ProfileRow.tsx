import type { ReactNode } from 'react'
import { ProvenanceTag } from '@/components/primitives'
import { cn } from '@/lib/cn'

/**
 * A single read line of the Product Intelligence profile: label in the
 * margin, the model's reading on the canvas. Everything here is AI
 * interpretation of what the founder typed — never a measurement — so every
 * row carries the same provenance tag.
 */
export function ProfileRow({
  label,
  children,
  prose = false,
  first = false,
}: {
  label: string
  children: ReactNode
  prose?: boolean
  first?: boolean
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-y-2 py-7 sm:py-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-x-12 lg:py-9',
        !first && 'border-t border-hairline'
      )}
    >
      <div className={cn(prose ? 'lg:pt-[3px]' : 'lg:pt-[6px]')}>
        <div className="t-meta text-muted">{label}</div>
      </div>

      <div className="min-w-0">
        <div className={cn('max-w-[64ch]', prose ? 't-body' : 't-h2')}>{children}</div>
        <div className="mt-3.5">
          <ProvenanceTag kind="inferred" />
        </div>
      </div>
    </div>
  )
}

export function ProfileList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-faint">—</span>
  return (
    <ul className="list-none space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <span aria-hidden className="mt-[11px] h-1 w-1 shrink-0 rounded-full bg-ghost" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
