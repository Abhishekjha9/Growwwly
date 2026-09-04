/**
 * Static, non-analysis content shared by the shell and the marketing site.
 *
 * Everything that depends on a specific product's analysis lives in the
 * actual Product Intelligence response (`@/types/product`), never here.
 * Nothing in this file is a measurement or a score — it's copy, navigation,
 * and the six illustrative "signal" categories used on the marketing page.
 */

/* -- Provenance ---------------------------------------------------------
   Every value the app shows a founder is either read from what they typed,
   or interpreted by the model. Never let one wear the clothes of the other. */

export type Provenance = 'measured' | 'inferred' | 'assumed'

export const PROVENANCE_COPY: Record<Provenance, string> = {
  measured: 'From your answers',
  inferred: 'AI interpretation',
  assumed: 'Assumption',
}

/* -- Brand ---------------------------------------------------------------- */

export const PROJECT = {
  name: 'Growwwly',
  tagline: 'Understand your SaaS before you scale it.',
} as const

/* -- Marketing: the six inputs an analysis reads ------------------------- */

export interface SignalDef {
  id: string
  label: string
  seed: [number, number, number]
  speed: number
  weight: number
}

export const SIGNALS: SignalDef[] = [
  { id: 'product', label: 'Product', seed: [-1.62, 0.74, 0.32], speed: 0.42, weight: 0.78 },
  { id: 'customer', label: 'Customer', seed: [1.48, 0.96, -0.28], speed: 0.35, weight: 0.7 },
  { id: 'problem', label: 'Problem', seed: [-1.28, -0.86, -0.46], speed: 0.5, weight: 0.64 },
  { id: 'market', label: 'Market signals', seed: [1.68, -0.62, 0.4], speed: 0.31, weight: 0.6 },
  { id: 'channels', label: 'Channel fit', seed: [0.22, 1.52, 0.5], speed: 0.38, weight: 0.9 },
  { id: 'growth', label: 'Growth context', seed: [0.06, -1.58, -0.36], speed: 0.46, weight: 0.5 },
]

export const SIGNAL_READS: Record<string, string> = {
  product: 'What it does, and the use cases it actually serves',
  customer: 'Who buys it, who uses it, and what they need done',
  problem: 'How painful, how urgent, and whether people will pay',
  market: 'Search intent, community presence, and how the market moves',
  channels: 'How well the product fits SEO, outbound, community and more',
  growth: 'Stage, likely motion, sales cycle, and rough customer value',
}

export const WINNER_INDEX = 4

/* -- Navigation ------------------------------------------------------------
   Only screens backed by real Phase 1 data. */

export const NAV = [
  { to: '/app', label: 'Overview', end: true },
  { to: '/app/product', label: 'Product' },
  { to: '/app/market', label: 'Market' },
  { to: '/app/acquisition', label: 'Acquisition' },
] as const

/* -- Analysis run narration ------------------------------------------------ */

export const ANALYSIS_STEPS = [
  { id: 'product', label: 'Understanding your product', detail: 'Reading what it does and who it serves' },
  { id: 'customer', label: 'Identifying your customers', detail: 'Buyer, user, and ideal customer profile' },
  { id: 'market', label: 'Evaluating market signals', detail: 'Search intent, community, word of mouth' },
  { id: 'channels', label: 'Mapping acquisition channels', detail: 'SEO, outbound, communities and more' },
  { id: 'confidence', label: 'Generating product intelligence', detail: 'Assembling the full profile' },
] as const
