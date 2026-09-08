/** Lightweight filter pills — client-side only, no re-fetch. */

import { Pill } from '@/components/primitives'

export const OPPORTUNITY_FILTERS = [
  'all',
  'reddit',
  'hacker_news',
  'forum',
  'article',
  'high',
  'recent',
] as const

export type OpportunityFilter = (typeof OPPORTUNITY_FILTERS)[number]

const FILTER_LABELS: Record<OpportunityFilter, string> = {
  all: 'All',
  reddit: 'Reddit',
  hacker_news: 'Hacker News',
  forum: 'Forums',
  article: 'Articles',
  high: 'High opportunity',
  recent: 'Recent',
}

export function OpportunityFilters({
  active,
  onChange,
}: {
  active: OpportunityFilter
  onChange: (filter: OpportunityFilter) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPPORTUNITY_FILTERS.map((filter) => (
        <Pill key={filter} active={active === filter} onClick={() => onChange(filter)}>
          {FILTER_LABELS[filter]}
        </Pill>
      ))}
    </div>
  )
}
