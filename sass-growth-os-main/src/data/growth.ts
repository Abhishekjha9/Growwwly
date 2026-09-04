/**
 * The analysis. One source of truth for every screen.
 *
 * The narrative this data tells, end to end:
 *   624 signups → 143 activated → activation is the bottleneck →
 *   opportunity score 91 → fix onboarding, don't buy more traffic.
 *
 * Every screen is a different view of that one sentence.
 */

/* -- Provenance ---------------------------------------------------------
   The product's core honesty mechanic: never let an inference wear the
   clothes of a measurement. Three levels, three quiet indicators. */

export type Provenance = 'measured' | 'inferred' | 'assumed'

export const PROVENANCE_COPY: Record<Provenance, string> = {
  measured: 'Measured',
  inferred: 'AI interpretation',
  assumed: 'Assumption',
}

/* -- Project ------------------------------------------------------------ */

export const PROJECT = {
  name: 'Loopwork',
  url: 'loopwork.io',
  fullUrl: 'https://loopwork.io',
  tagline: 'Async standups for engineering teams',
  analyzedAgo: '12 minutes ago',
  analyticsSource: 'PostHog',
  analyticsConnected: true,
} as const

/* -- The decision ------------------------------------------------------- */

export type Effort = 'Low' | 'Medium' | 'High'
export type Impact = 'Low' | 'Medium' | 'High'

export const HEADLINE_ACTION = {
  label: 'Highest-leverage action',
  statement: 'Fix activation before acquiring more traffic.',
  support:
    'You have strong signup volume, but activation is currently the largest measurable bottleneck. Every additional visitor is passing through the same broken step.',
  score: 91,
  impact: 'High' as Impact,
  confidence: 88,
  effort: 'Medium' as Effort,
  /** The reasoning chain, drawn rather than written. */
  chain: [
    { value: '624', label: 'signups', tone: 'neutral' as const },
    { value: '143', label: 'activated', tone: 'warn' as const },
    { value: 'Activation', label: 'bottleneck', tone: 'warn' as const },
    { value: '91', label: 'opportunity score', tone: 'accent' as const },
    { value: 'Fix onboarding', label: 'next move', tone: 'decision' as const },
  ],
  /** Shown behind "Why?" — the evidence, not a paragraph of prose. */
  evidence: [
    {
      claim: 'Signup volume is healthy relative to traffic.',
      detail: '624 signups from 12,428 visitors — a 5.0% visitor→signup rate, above the 3.1% median for this category.',
      provenance: 'measured' as Provenance,
    },
    {
      claim: 'Activation collapses at step 4 of onboarding.',
      detail: '77% of signups never reach an activated state. Drop-off concentrates on the workspace-invite step.',
      provenance: 'measured' as Provenance,
    },
    {
      claim: 'More traffic would not move revenue.',
      detail: 'At the current 22.9% activation rate, a 2× traffic increase yields ~34 additional paid accounts against a 6-week channel ramp.',
      provenance: 'inferred' as Provenance,
    },
    {
      claim: 'Onboarding length is the dominant friction, not pricing.',
      detail: 'Pricing-page exits are within normal range; the drop precedes any pricing exposure.',
      provenance: 'inferred' as Provenance,
    },
  ],
} as const

/* -- Metrics ------------------------------------------------------------ */

export interface Metric {
  id: string
  label: string
  value: number
  display: string
  delta: number
  /** 14 points, most recent last. Normalised 0–1 by the sparkline itself. */
  spark: number[]
  provenance: Provenance
  /** Present only on the stage that is the bottleneck. */
  flagged?: boolean
}

export const METRICS: Metric[] = [
  {
    id: 'visitors',
    label: 'Visitors',
    value: 12428,
    display: '12,428',
    delta: 8.2,
    spark: [38, 41, 39, 44, 47, 45, 52, 55, 53, 58, 61, 59, 66, 71],
    provenance: 'measured',
  },
  {
    id: 'signups',
    label: 'Signups',
    value: 624,
    display: '624',
    delta: 11.4,
    spark: [22, 24, 23, 27, 29, 28, 33, 35, 34, 38, 41, 40, 45, 49],
    provenance: 'measured',
  },
  {
    id: 'activated',
    label: 'Activated',
    value: 143,
    display: '143',
    delta: -4.1,
    spark: [19, 20, 18, 21, 20, 19, 21, 20, 18, 19, 18, 17, 18, 17],
    provenance: 'measured',
    flagged: true,
  },
  {
    id: 'paid',
    label: 'Paid',
    value: 38,
    display: '38',
    delta: 2.7,
    spark: [8, 9, 9, 10, 10, 11, 11, 10, 11, 12, 12, 11, 12, 13],
    provenance: 'measured',
  },
]

/* -- Funnel ------------------------------------------------------------- */

export interface FunnelStage {
  id: string
  label: string
  value: number
  display: string
  /** Conversion from the previous stage. Null for the first. */
  fromPrev: number | null
  bottleneck?: boolean
  note?: string
}

export const FUNNEL: FunnelStage[] = [
  { id: 'visitors', label: 'Visitors', value: 12428, display: '12,428', fromPrev: null },
  { id: 'signups', label: 'Signups', value: 624, display: '624', fromPrev: 5.0, note: 'Above category median of 3.1%.' },
  {
    id: 'activated',
    label: 'Activated',
    value: 143,
    display: '143',
    fromPrev: 22.9,
    bottleneck: true,
    note: '481 signups never reached an activated state. This is the largest absolute loss in the funnel.',
  },
  { id: 'paid', label: 'Paid', value: 38, display: '38', fromPrev: 26.6, note: 'Healthy once activated — the problem is upstream.' },
]

export const FUNNEL_VERDICT = 'Acquisition is not the highest-leverage problem right now.'

/* -- Product intelligence ----------------------------------------------- */

export interface ProductField {
  id: string
  label: string
  value: string
  detail?: string
  confidence?: number
  provenance: Provenance
  /** Longer prose fields render as a paragraph rather than a large value. */
  prose?: boolean
}

export const PRODUCT_SECTIONS: Array<{
  id: string
  title: string
  intro?: string
  fields: ProductField[]
}> = [
  {
    id: 'audience',
    title: "Who you're building for",
    intro:
      'Derived from your site copy, pricing structure, and the language of your own documentation.',
    fields: [
      {
        id: 'buyer',
        label: 'Primary buyer',
        value: 'B2B SaaS founders',
        detail: 'Technical founders at 5–40 person teams who already run some form of written standup.',
        confidence: 92,
        provenance: 'inferred',
      },
      {
        id: 'user',
        label: 'Primary user',
        value: 'Engineering managers',
        detail: 'The buyer and the daily user are not the same person — your onboarding currently assumes they are.',
        confidence: 78,
        provenance: 'inferred',
      },
      {
        id: 'segment',
        label: 'Company size',
        value: '5–40 employees',
        confidence: 84,
        provenance: 'inferred',
      },
    ],
  },
  {
    id: 'problem',
    title: 'The problem',
    fields: [
      {
        id: 'core',
        label: 'Core problem solved',
        value: 'Standup meetings waste distributed teams’ time',
        confidence: 90,
        provenance: 'inferred',
      },
      {
        id: 'friction',
        label: 'Where it breaks today',
        value: 'Slow activation during onboarding',
        detail: 'Teams sign up individually, but the product only becomes valuable once three or more teammates join.',
        confidence: 88,
        provenance: 'inferred',
      },
      {
        id: 'urgency',
        label: 'Market urgency',
        value: 'High',
        detail: 'Not directly measurable. Inferred from category funding activity and competitor launch cadence.',
        provenance: 'assumed',
      },
    ],
  },
  {
    id: 'commercial',
    title: 'Purchase intent & pricing',
    fields: [
      { id: 'intent', label: 'Purchase intent', value: 'High', confidence: 81, provenance: 'inferred' },
      {
        id: 'price',
        label: 'Entry price',
        value: '$49/month',
        detail: 'Per workspace, up to 10 seats. Read directly from your pricing page.',
        provenance: 'measured',
      },
      { id: 'model', label: 'Model', value: 'Self-serve, no sales touch', provenance: 'measured' },
      {
        id: 'expansion',
        label: 'Expansion path',
        value: 'Seat-based',
        detail: 'Revenue grows only when teams grow — which makes the invite step commercially load-bearing.',
        confidence: 74,
        provenance: 'inferred',
      },
    ],
  },
  {
    id: 'positioning',
    title: 'Positioning',
    fields: [
      {
        id: 'current',
        label: 'How you position today',
        value: 'A faster standup tool',
        prose: true,
        detail:
          'Your homepage leads with the format — async, written, threaded. That describes the mechanism, not the outcome. Buyers comparing three similar tools cannot separate you on mechanism alone.',
        confidence: 86,
        provenance: 'inferred',
      },
      {
        id: 'sharper',
        label: 'Sharper alternative',
        value: 'The standup that survives timezones',
        prose: true,
        detail:
          'Leads with the situation the buyer is already in. Narrows the market deliberately — which is what makes it land.',
        confidence: 69,
        provenance: 'inferred',
      },
      {
        id: 'moat',
        label: 'Defensibility',
        value: 'Weak today',
        prose: true,
        detail:
          'Feature parity with two competitors. The durable wedge is the multiplayer data you accumulate, not the writing surface.',
        provenance: 'assumed',
      },
    ],
  },
]

/* -- Website audit ------------------------------------------------------ */

export type Severity = 'critical' | 'warning' | 'note'

export interface AuditFinding {
  id: string
  /** The page element this annotation points at. */
  target: string
  headline: string
  severity: Severity
  /** Anchor point on the preview, as a percentage of its box. */
  anchor: { x: number; y: number }
  /** Which side the annotation label sits on. */
  side: 'left' | 'right'
  detail: string
  evidence: string[]
  fix: string
  provenance: Provenance
}

export const AUDIT_FINDINGS: AuditFinding[] = [
  {
    id: 'hero',
    target: 'Hero',
    headline: 'Positioning is unclear.',
    severity: 'critical',
    anchor: { x: 50, y: 21 },
    side: 'left',
    detail:
      'The headline describes what the product is rather than the situation it resolves. A first-time visitor cannot tell within five seconds whether this is built for them.',
    evidence: [
      'Headline names the mechanism ("async standups"), not the outcome.',
      'No audience qualifier above the fold — nothing says who this is for.',
      'Median time-to-scroll is 2.4s, below the 4s threshold for comprehension.',
    ],
    fix: 'Lead with the buyer’s situation. Put the audience qualifier in the subhead, not the footer.',
    provenance: 'inferred',
  },
  {
    id: 'cta',
    target: 'Primary CTA',
    headline: 'Low visual prominence.',
    severity: 'critical',
    anchor: { x: 50, y: 37 },
    side: 'right',
    detail:
      'The primary action carries the same visual weight as the secondary link beside it. Attention splits, and neither action wins.',
    evidence: [
      'Contrast ratio between primary and secondary CTA is 1.2:1.',
      'CTA sits 640px down on a 1440px viewport — below the fold on laptops.',
      'Three competing links within 120px of the primary action.',
    ],
    fix: 'One primary action above the fold. Demote the secondary to a text link.',
    provenance: 'measured',
  },
  {
    id: 'proof',
    target: 'Social proof',
    headline: 'Appears too late.',
    severity: 'warning',
    anchor: { x: 50, y: 62 },
    side: 'left',
    detail:
      'Customer logos and testimonials sit below the pricing section — after the moment where a skeptical visitor decides whether to keep reading.',
    evidence: [
      'First proof element appears at 2,180px scroll depth.',
      'Only 31% of sessions reach that depth.',
    ],
    fix: 'Move one line of proof directly beneath the hero. Keep the full section where it is.',
    provenance: 'measured',
  },
  {
    id: 'pricing',
    target: 'Pricing',
    headline: 'Plan differences are not scannable.',
    severity: 'warning',
    anchor: { x: 50, y: 78 },
    side: 'right',
    detail:
      'Three plans share eleven identical rows. The actual decision — seat count — is buried in the middle of the table.',
    evidence: ['11 of 14 feature rows are identical across plans.', 'No recommended plan is marked.'],
    fix: 'Collapse shared rows. Mark a default plan. Lead each column with the seat count.',
    provenance: 'inferred',
  },
  {
    id: 'nav',
    target: 'Navigation',
    headline: 'Reads well.',
    severity: 'note',
    anchor: { x: 50, y: 7 },
    side: 'right',
    detail:
      'Five items, clear labels, persistent CTA. No changes recommended — noted so you know it was checked.',
    evidence: ['5 top-level items — within the comfortable scanning range.'],
    fix: 'No action needed.',
    provenance: 'measured',
  },
]

/** Soft intensity regions for the predicted-attention layer. Not behavioural data. */
export const ATTENTION_REGIONS = [
  { x: 50, y: 20, r: 30, intensity: 1 },
  { x: 50, y: 34, r: 18, intensity: 0.44 },
  { x: 22, y: 7, r: 12, intensity: 0.38 },
  { x: 50, y: 58, r: 20, intensity: 0.22 },
  { x: 50, y: 78, r: 16, intensity: 0.16 },
]

/* -- SEO ---------------------------------------------------------------- */

export type CheckStatus = 'pass' | 'warn' | 'fail'

export interface SeoCheck {
  id: string
  label: string
  status: CheckStatus
  note: string
}

export const SEO = {
  score: 84,
  headline: 'Strong SEO potential',
  summary:
    'Technical foundation is sound. The gap is topical depth — you rank for your brand and almost nothing else.',
  checks: [
    { id: 'title', label: 'Title', status: 'pass', note: '54 characters, includes the primary term.' },
    { id: 'meta', label: 'Meta description', status: 'pass', note: '148 characters, action-led.' },
    { id: 'h1', label: 'H1', status: 'pass', note: 'Exactly one, matches the page intent.' },
    { id: 'headings', label: 'Headings', status: 'warn', note: 'Two H2s skip to H4 further down the page.' },
    { id: 'canonical', label: 'Canonical', status: 'pass', note: 'Self-referencing and correct.' },
    { id: 'robots', label: 'Robots', status: 'pass', note: 'Indexable. Sitemap declared.' },
    { id: 'internal', label: 'Internal links', status: 'fail', note: 'Four internal links total. Blog posts are orphaned.' },
    { id: 'alt', label: 'Alt text', status: 'warn', note: '9 of 21 images are missing alt attributes.' },
    { id: 'schema', label: 'Structured data', status: 'fail', note: 'No Organization or SoftwareApplication schema.' },
    { id: 'perf', label: 'Performance', status: 'pass', note: 'LCP 1.4s, CLS 0.02, INP 118ms.' },
  ] satisfies SeoCheck[],
} as const

/* -- Acquisition channels ----------------------------------------------- */

export interface Channel {
  rank: number
  id: string
  name: string
  score: number
  verdict: string
  reasoning: string
  fitFactors: Array<{ label: string; value: string }>
  firstMove: string
  timeToSignal: string
  effort: Effort
  provenance: Provenance
}

export const CHANNELS: Channel[] = [
  {
    rank: 1,
    id: 'seo',
    name: 'SEO',
    score: 88,
    verdict: 'Strongest long-term fit',
    reasoning:
      'Your buyers search for the problem in explicit terms, competition on the long tail is thin, and your technical foundation already scores 84.',
    fitFactors: [
      { label: 'Search demand', value: '14.2k/mo' },
      { label: 'Competition', value: 'Low on long tail' },
      { label: 'Existing foundation', value: '84 / 100' },
      { label: 'Payback period', value: '4–6 months' },
    ],
    firstMove: 'Publish three comparison pages against the two competitors buyers already evaluate you against.',
    timeToSignal: '6–10 weeks',
    effort: 'Medium',
    provenance: 'inferred',
  },
  {
    rank: 2,
    id: 'communities',
    name: 'Developer communities',
    score: 82,
    verdict: 'Fastest signal',
    reasoning:
      'Your buyer is already gathered in a small number of places and your product is demonstrable in a single screenshot.',
    fitFactors: [
      { label: 'Audience density', value: 'Very high' },
      { label: 'Time to first signal', value: '1–2 weeks' },
      { label: 'Scalability', value: 'Limited' },
      { label: 'Founder-dependent', value: 'Yes' },
    ],
    firstMove: 'Answer the ten highest-traffic threads about async standups — with a real answer, not a link.',
    timeToSignal: '1–2 weeks',
    effort: 'Low',
    provenance: 'inferred',
  },
  {
    rank: 3,
    id: 'outbound',
    name: 'Outbound',
    score: 71,
    verdict: 'Works, but expensive at your price point',
    reasoning:
      'Your ACV of $588 does not comfortably support a human-touch outbound motion. Viable only if it stays fully founder-led.',
    fitFactors: [
      { label: 'ACV', value: '$588' },
      { label: 'Target list size', value: '~8,000' },
      { label: 'Reply rate', value: '3–5% est.' },
      { label: 'Payback period', value: '9+ months' },
    ],
    firstMove: 'Test 50 hand-written emails to teams that recently posted remote engineering roles.',
    timeToSignal: '2–3 weeks',
    effort: 'Medium',
    provenance: 'inferred',
  },
  {
    rank: 4,
    id: 'content',
    name: 'Content',
    score: 65,
    verdict: 'Compounding, but slow to prove',
    reasoning:
      'Useful as fuel for SEO rather than as a standalone channel. On its own, attribution stays unclear for two quarters.',
    fitFactors: [
      { label: 'Compounding', value: 'Yes' },
      { label: 'Time to signal', value: '3–6 months' },
      { label: 'Requires', value: 'Consistent cadence' },
      { label: 'Overlap with SEO', value: 'High' },
    ],
    firstMove: 'Fold this into SEO rather than running it separately.',
    timeToSignal: '3–6 months',
    effort: 'High',
    provenance: 'inferred',
  },
  {
    rank: 5,
    id: 'social',
    name: 'Social',
    score: 51,
    verdict: 'Low fit for this buyer',
    reasoning:
      'Engineering managers do not evaluate tooling through social feeds. Useful for recruiting and credibility — not for pipeline.',
    fitFactors: [
      { label: 'Buyer presence', value: 'Passive' },
      { label: 'Intent quality', value: 'Low' },
      { label: 'Effort to maintain', value: 'High' },
      { label: 'Best use', value: 'Credibility only' },
    ],
    firstMove: 'Do not invest here this quarter.',
    timeToSignal: 'Unclear',
    effort: 'High',
    provenance: 'inferred',
  },
  {
    rank: 6,
    id: 'paid',
    name: 'Paid',
    score: 44,
    verdict: 'Premature',
    reasoning:
      'Paid acquisition amplifies whatever the funnel already does. At 22.9% activation, it would amplify the leak.',
    fitFactors: [
      { label: 'Current activation', value: '22.9%' },
      { label: 'Est. CAC', value: '$210–340' },
      { label: 'Payback at current rate', value: 'Negative' },
      { label: 'Revisit when', value: 'Activation > 35%' },
    ],
    firstMove: 'Revisit after activation improves. Not before.',
    timeToSignal: 'n/a',
    effort: 'Medium',
    provenance: 'inferred',
  },
]

/* -- Opportunities ------------------------------------------------------ */

export interface Opportunity {
  id: string
  name: string
  /** 0–100 both axes. */
  impact: number
  effort: number
  confidence: number
  score: number
  category: 'Activation' | 'Acquisition' | 'Conversion' | 'Retention'
  summary: string
  detail: string
  evidence: string[]
  primary?: boolean
}

export const OPPORTUNITIES: Opportunity[] = [
  {
    id: 'onboarding',
    name: 'Improve onboarding',
    impact: 92,
    effort: 38,
    confidence: 88,
    score: 91,
    category: 'Activation',
    summary: 'Cut onboarding from six steps to three.',
    detail:
      'Activation drops 77% between signup and first value. The invite step demands a decision the user is not yet ready to make.',
    evidence: [
      '481 of 624 signups never activate.',
      'Step 4 (workspace invite) accounts for 61% of all drop-off.',
      'Sessions that skip the invite step activate at 3.1× the rate.',
    ],
    primary: true,
  },
  {
    id: 'seo-content',
    name: 'SEO comparison pages',
    impact: 74,
    effort: 46,
    confidence: 79,
    score: 76,
    category: 'Acquisition',
    summary: 'Three comparison pages against the tools you lose to.',
    detail:
      'High-intent search demand exists and is thinly served. Compounds, but pays back over months rather than weeks.',
    evidence: ['14.2k monthly searches on the problem term.', 'Two competitors rank with thin pages.'],
  },
  {
    id: 'pricing-page',
    name: 'New pricing page',
    impact: 58,
    effort: 30,
    confidence: 72,
    score: 63,
    category: 'Conversion',
    summary: 'Make the plan decision scannable.',
    detail: 'Eleven of fourteen rows are identical across plans, so the table adds effort without adding clarity.',
    evidence: ['No recommended plan marked.', 'Seat count — the real decision — sits mid-table.'],
  },
  {
    id: 'communities',
    name: 'Community presence',
    impact: 62,
    effort: 22,
    confidence: 74,
    score: 68,
    category: 'Acquisition',
    summary: 'Answer where your buyers already are.',
    detail: 'Fast signal and low cost, but founder-dependent and hard to scale beyond a few hours a week.',
    evidence: ['Buyer concentration is very high in four communities.'],
  },
  {
    id: 'referral',
    name: 'Referral program',
    impact: 44,
    effort: 64,
    confidence: 51,
    score: 41,
    category: 'Retention',
    summary: 'Reward teams for inviting other teams.',
    detail: 'Structurally sound for a seat-based model — but referrals require activated users, and you do not have enough yet.',
    evidence: ['Only 143 activated accounts to refer from.'],
  },
  {
    id: 'outbound-test',
    name: 'Outbound test',
    impact: 48,
    effort: 55,
    confidence: 58,
    score: 46,
    category: 'Acquisition',
    summary: 'Fifty hand-written emails.',
    detail: 'Worth a bounded test to learn language, not worth building a motion around at this ACV.',
    evidence: ['$588 ACV against a 9-month payback.'],
  },
  {
    id: 'lifecycle',
    name: 'Lifecycle email',
    impact: 66,
    effort: 34,
    confidence: 69,
    score: 65,
    category: 'Activation',
    summary: 'Recover signups who stalled mid-onboarding.',
    detail: 'A direct second attempt at the 481 accounts that stalled. Smaller ceiling than fixing the step itself, but additive.',
    evidence: ['481 stalled accounts, none currently contacted.'],
  },
]

/* -- 30-day plan -------------------------------------------------------- */

export interface PlanWeek {
  week: string
  phase: 'Diagnose' | 'Implement' | 'Experiment' | 'Measure'
  title: string
  summary: string
  tasks: string[]
  outcome: string
}

export const PLAN: PlanWeek[] = [
  {
    week: 'Week 01',
    phase: 'Diagnose',
    title: 'Identify friction',
    summary: 'Watch the step fail before you change it. Assumptions are expensive at this stage.',
    tasks: [
      'Instrument each of the six onboarding steps individually',
      'Watch fifteen session recordings of stalled signups',
      'Interview five users who stalled at the invite step',
      'Write down the single sentence that explains the drop',
    ],
    outcome: 'A specific, named cause — not "onboarding is too long".',
  },
  {
    week: 'Week 02',
    phase: 'Implement',
    title: 'Fix onboarding',
    summary: 'Make the smallest change that could plausibly move the number.',
    tasks: [
      'Collapse six steps into three',
      'Make the workspace invite skippable',
      'Deliver first value before asking for teammates',
      'Ship behind a flag at 50% of new signups',
    ],
    outcome: 'A shorter path to first value, live for half of new signups.',
  },
  {
    week: 'Week 03',
    phase: 'Experiment',
    title: 'Test the new flow',
    summary: 'Let it run untouched. Resist reading the result on day two.',
    tasks: [
      'Hold the split steady for the full week',
      'Track activation as the single primary metric',
      'Watch qualified-signup rate as the guardrail',
      'Log every anomaly without acting on it',
    ],
    outcome: 'A clean comparison, uncontaminated by mid-flight changes.',
  },
  {
    week: 'Week 04',
    phase: 'Measure',
    title: 'Compare activation',
    summary: 'Decide from evidence: ship, iterate, or revert. All three are acceptable answers.',
    tasks: [
      'Compare activation across both cohorts',
      'Confirm paid conversion did not degrade',
      'Write the learning down, whatever it says',
      'Choose the next highest-leverage action',
    ],
    outcome: 'A decision backed by evidence, and a written learning.',
  },
]

/* -- Experiments -------------------------------------------------------- */

export type ExperimentStatus = 'running' | 'complete' | 'draft'

export interface Experiment {
  id: string
  status: ExperimentStatus
  hypothesis: string
  metric: string
  baseline: number
  target: number
  current?: number
  /** 0–100 for running experiments. */
  progress: number
  daysElapsed: number
  daysTotal: number
  sample: { control: number; variant: number }
  result?: { delta: number; significance: number; learning: string; decision: string }
}

export const EXPERIMENTS: Experiment[] = [
  {
    id: 'onboarding-steps',
    status: 'running',
    hypothesis: 'Reducing onboarding steps from 6 to 3 will increase activation.',
    metric: 'Activation rate',
    // The measured rate on the funnel, not a rounded stand-in. Every screen
    // reads 22.9% off METRICS; an experiment baselined at 22 is quietly
    // claiming a different starting line than the one the product argues from.
    baseline: 22.9,
    target: 30,
    current: 26.4,
    progress: 62,
    daysElapsed: 9,
    daysTotal: 14,
    sample: { control: 312, variant: 308 },
  },
  {
    id: 'invite-timing',
    status: 'complete',
    hypothesis: 'Moving the teammate invite after first value will increase completion of the invite step.',
    // This experiment measures the step it changed, not the headline metric.
    // Scoped to "Activation rate" it read as a shipped, significant win that
    // had already taken activation from 22 to 30 — which would mean the
    // bottleneck this entire analysis rests on was fixed a fortnight ago, and
    // every screen recommending an activation fix was arguing against its own
    // experiment log. A local step moved; the funnel did not.
    metric: 'Invite-step completion',
    baseline: 41.0,
    target: 52.0,
    current: 54.3,
    progress: 100,
    daysElapsed: 14,
    daysTotal: 14,
    sample: { control: 288, variant: 291 },
    result: {
      delta: 13.3,
      significance: 96,
      learning:
        'Moving the invite after first value lifted completion of that step by 13 points. Activation overall moved less than a point — the drop-off relocated to step 4 rather than disappearing. The invite’s position was a real problem, but not the binding one.',
      decision: 'Shipped to 100%. Activation remains the bottleneck.',
    },
  },
  {
    id: 'hero-headline',
    status: 'draft',
    hypothesis: 'Leading with the buyer’s situation rather than the mechanism will increase signup rate.',
    metric: 'Visitor → signup',
    baseline: 5.0,
    target: 6.2,
    progress: 0,
    daysElapsed: 0,
    daysTotal: 21,
    sample: { control: 0, variant: 0 },
  },
]

/* -- Analysis sequence -------------------------------------------------- */

export const ANALYSIS_STEPS = [
  { id: 'product', label: 'Understanding your product', detail: 'Reading positioning, pricing and audience signals' },
  { id: 'website', label: 'Analyzing your website', detail: 'Inspecting structure, clarity and conversion path' },
  { id: 'seo', label: 'Checking technical SEO', detail: 'Ten checks across structure and performance' },
  { id: 'channels', label: 'Evaluating acquisition channels', detail: 'Scoring six channels against your buyer' },
  { id: 'funnel', label: 'Reading your funnel', detail: 'Connected to PostHog — four stages' },
  { id: 'decision', label: 'Finding your next move', detail: 'Ranking every opportunity by leverage' },
] as const

/* -- Navigation --------------------------------------------------------- */

export const NAV = [
  { to: '/app', label: 'Overview', end: true },
  { to: '/app/product', label: 'Product' },
  { to: '/app/website', label: 'Website' },
  { to: '/app/seo', label: 'SEO' },
  { to: '/app/acquisition', label: 'Acquisition' },
  { to: '/app/opportunities', label: 'Opportunities' },
  { to: '/app/plan', label: '30-day plan' },
  { to: '/app/experiments', label: 'Experiments' },
  { to: '/app/analytics', label: 'Analytics' },
] as const
