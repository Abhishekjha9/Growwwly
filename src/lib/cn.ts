/** Minimal class joiner. No dependency, no merge magic — order wins. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** Clamp helper used by charts, bubbles and progress geometry. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Map a value from one range to another. */
export function mapRange(
  n: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  if (inMax === inMin) return outMin
  return outMin + ((n - inMin) / (inMax - inMin)) * (outMax - outMin)
}

/** 12,428 — the only number formatting used in the product. */
export function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

/** +12.4% / −3.1% — signed, with a true minus sign. */
export function fmtDelta(n: number, digits = 1): string {
  const s = Math.abs(n).toFixed(digits)
  return `${n < 0 ? '−' : '+'}${s}%`
}
