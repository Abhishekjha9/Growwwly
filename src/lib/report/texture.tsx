import { Path, Svg } from "@react-pdf/renderer";

import type { ReportRenderContext } from "./render-context";

// ---------------------------------------------------------------------------
// A very subtle, fully deterministic grain — a single vector `<Path>` of tiny
// zero-length, round-capped strokes (the standard SVG "draw a dot per stroke"
// trick), not a raster image. One path element per page regardless of dot
// count, so it stays cheap: no external asset, no per-render randomness, no
// noticeable effect on generation time or file size.
// ---------------------------------------------------------------------------

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

/** A small, fixed-seed linear congruential generator — deterministic across
 * runs and platforms, unlike `Math.random()`. Good enough for scattering
 * dots; not used for anything security- or data-sensitive. */
function makeRng(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 48271) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

const DOT_COUNT = 520;
/** Fixed per page size/seed, so it never needs to be recomputed per call —
 * built once at module load. */
const GRAIN_PATH = (() => {
  const rng = makeRng(913_741);
  const segments: string[] = [];
  for (let i = 0; i < DOT_COUNT; i++) {
    const x = (rng() * A4_WIDTH).toFixed(1);
    const y = (rng() * A4_HEIGHT).toFixed(1);
    segments.push(`M${x} ${y}L${x} ${y}`);
  }
  return segments.join("");
})();

/** Full-bleed background grain, `fixed` so it repeats on every physical page
 * produced by wrapping. Placed as the first child of each `<Page>` so later
 * (painted-on-top) content always sits above it. */
export function Texture({ t }: { t: ReportRenderContext }) {
  const { theme } = t;
  return (
    <Svg
      width={A4_WIDTH}
      height={A4_HEIGHT}
      style={{ position: "absolute", top: 0, left: 0 }}
      fixed
    >
      <Path
        d={GRAIN_PATH}
        stroke={theme.grainColor}
        strokeWidth={theme.grainDotSize}
        strokeOpacity={theme.grainOpacity}
        strokeLinecap="round"
      />
    </Svg>
  );
}
