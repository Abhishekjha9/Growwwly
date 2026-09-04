/**
 * Growth Core — states.
 *
 * The object is the argument. Each state is one beat of the same sentence:
 * many signals become one profile.
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

export interface SignalSeed {
  id: string
  label: string
  /** Resting position on the unit sphere-ish shell. */
  seed: [number, number, number]
  /** 0–1. Drives which signals survive the prioritizing beat. */
  weight: number
}

/** Which pairs get a connecting line during `understanding`. */
export const SIGNAL_LINKS: Array<[number, number]> = [
  [4, 2],
  [4, 5],
  [0, 1],
  [3, 2],
  [0, 4],
]

/**
 * How much harder a weak signal is pushed out than a strong one as the object
 * spreads. Kept small on purpose: a signal losing the argument is said with
 * opacity, not with distance.
 */
export const SIGNAL_PUSH = 0.8

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
    coreScale: 1,
    emphasis: 0,
  },
  analyzing: {
    spread: 1.1,
    signalOpacity: 1,
    linkOpacity: 0,
    spokeOpacity: 0.4,
    coreScale: 0.97,
    emphasis: 0,
  },
  understanding: {
    spread: 1.02,
    signalOpacity: 1,
    linkOpacity: 0.55,
    spokeOpacity: 0.5,
    coreScale: 1,
    emphasis: 0.25,
  },
  prioritizing: {
    spread: 1.14,
    signalOpacity: 0.14,
    linkOpacity: 0.12,
    spokeOpacity: 0.14,
    coreScale: 1.05,
    emphasis: 1,
  },
  decision: {
    spread: 1.3,
    signalOpacity: 0,
    linkOpacity: 0,
    spokeOpacity: 0,
    coreScale: 1.16,
    emphasis: 1,
  },
}
