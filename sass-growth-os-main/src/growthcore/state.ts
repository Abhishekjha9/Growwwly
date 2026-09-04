/**
 * Growth Core — states.
 *
 * The object is the argument. Each state is one beat of the same sentence:
 * many signals become one decision.
 *
 *   idle           signals drift, unconnected
 *   analyzing      signals move, the core begins to gather them
 *   understanding  thin lines appear between related signals
 *   prioritizing   weak signals retreat; the strongest is emphasised
 *   decision       everything falls away except the core
 */

export type CoreState = 'idle' | 'analyzing' | 'understanding' | 'prioritizing' | 'decision'

export const CORE_STATES: CoreState[] = [
  'idle',
  'analyzing',
  'understanding',
  'prioritizing',
  'decision',
]

export interface SignalDef {
  id: string
  label: string
  /** Resting position on the unit sphere-ish shell. */
  seed: [number, number, number]
  /** Orbit speed multiplier. */
  speed: number
  /** 0–1. Drives which signals survive the prioritizing beat. */
  weight: number
}

/** Six signals: the inputs named on the landing page. */
export const SIGNALS: SignalDef[] = [
  { id: 'website', label: 'Website', seed: [-1.62, 0.74, 0.32], speed: 0.42, weight: 0.72 },
  { id: 'seo', label: 'SEO', seed: [1.48, 0.96, -0.28], speed: 0.35, weight: 0.66 },
  { id: 'customers', label: 'Customers', seed: [-1.28, -0.86, -0.46], speed: 0.5, weight: 0.58 },
  { id: 'pricing', label: 'Pricing', seed: [1.68, -0.62, 0.4], speed: 0.31, weight: 0.44 },
  // The signal that wins. Activation data is what produces the recommendation.
  { id: 'analytics', label: 'Analytics', seed: [0.22, 1.52, 0.5], speed: 0.38, weight: 1 },
  { id: 'acquisition', label: 'Acquisition', seed: [0.06, -1.58, -0.36], speed: 0.46, weight: 0.5 },
]

/**
 * How much harder a weak signal is pushed out than a strong one as the object
 * spreads. Kept small on purpose: a signal losing the argument is said with
 * opacity, not with distance. Pushed far enough to leave the frame, it reads
 * as a rendering fault rather than as a signal being set aside.
 */
export const SIGNAL_PUSH = 0.8

/** Which pairs get a connecting line during `understanding`. */
export const SIGNAL_LINKS: Array<[number, number]> = [
  [4, 2], // analytics ↔ customers
  [4, 5], // analytics ↔ acquisition
  [0, 1], // website ↔ seo
  [3, 2], // pricing ↔ customers
  [0, 4], // website ↔ analytics
]

/** Per-state geometry of the whole object. */
export interface StateShape {
  /** How far signals sit from the core. 1 = resting shell. */
  spread: number
  /** Opacity of ordinary (non-winning) signals. */
  signalOpacity: number
  /** Opacity of the signal↔signal links. */
  linkOpacity: number
  /** Opacity of the core↔signal spokes. */
  spokeOpacity: number
  /** Rotation speed of the whole constellation. */
  churn: number
  /** Scale of the central object. */
  coreScale: number
  /** How strongly the winning signal is emphasised. */
  emphasis: number
}

export const SHAPE: Record<CoreState, StateShape> = {
  idle: {
    spread: 1,
    signalOpacity: 0.9,
    linkOpacity: 0,
    spokeOpacity: 0.16,
    churn: 0.055,
    coreScale: 1,
    emphasis: 0,
  },
  analyzing: {
    spread: 1.1,
    signalOpacity: 1,
    linkOpacity: 0,
    spokeOpacity: 0.4,
    churn: 0.2,
    coreScale: 0.97,
    emphasis: 0,
  },
  understanding: {
    spread: 1.02,
    signalOpacity: 1,
    linkOpacity: 0.55,
    spokeOpacity: 0.5,
    churn: 0.11,
    coreScale: 1,
    emphasis: 0.25,
  },
  prioritizing: {
    spread: 1.14,
    signalOpacity: 0.14,
    linkOpacity: 0.12,
    spokeOpacity: 0.14,
    churn: 0.06,
    coreScale: 1.05,
    emphasis: 1,
  },
  decision: {
    spread: 1.3,
    signalOpacity: 0,
    linkOpacity: 0,
    spokeOpacity: 0,
    churn: 0.03,
    coreScale: 1.16,
    emphasis: 1,
  },
}

/** The winning signal — the one that survives to become the decision. */
export const WINNER_INDEX = 4
