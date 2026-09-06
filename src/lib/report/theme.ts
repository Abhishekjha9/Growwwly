// ---------------------------------------------------------------------------
// Theme tokens for the PDF report. Every color the report ever draws comes
// from one of these two objects — no component reaches for a raw hex value.
// This is what makes Light/Dark a single deterministic
// `generateGrowthReport(analysis, theme)` call rather than two separate
// generators: the component tree and layout never change, only which
// `ReportTheme` gets threaded through as the `t` render context prop
// (`./render-context.ts`).
// ---------------------------------------------------------------------------

export interface ReportTheme {
  /** Page background. */
  background: string;
  /** Neutral elevated surface — cards, metric tiles, the AI-signal box. */
  surface: string;
  /** Accent-tinted surface — the two hero panels (Highest-Leverage Action,
   * Your Next Move). Deliberately distinct from `surface`, not just a
   * lighter/darker variant of it. */
  surfaceAccent: string;
  /** Primary text — headings, big numbers. */
  foreground: string;
  /** Body copy — paragraphs, rationale text. */
  foregroundBody: string;
  /** Secondary text — labels, meta rows, table cells. */
  foregroundMuted: string;
  /** Tertiary text — captions, footer disclaimer, "deprioritize" state. */
  foregroundFaint: string;
  /** Decorative marks only (bullet dots) — never used for text. */
  foregroundGhost: string;
  /** Hairline dividers. */
  border: string;
  /** Slightly more visible dividers (table header rule). */
  borderStrong: string;
  /** Growwwly blue — bar fills, dots, the one recurring brand color. */
  accent: string;
  /** A text-safe accent variant (labels/values set in accent color). */
  accentMuted: string;

  /** Background grain (Part B) — kept as theme tokens rather than a
   * hardcoded constant so dark mode can run slightly more visible texture
   * than light mode without any component knowing the difference. */
  grainColor: string;
  /** Per-dot stroke opacity — the actual visible intensity of the grain. */
  grainOpacity: number;
  /** Dot diameter in points. */
  grainDotSize: number;

  /** The final page's giant background wordmark (Part C) — accent-toned,
   * not foreground-toned, so it reads as brand color rather than a dark
   * logo. Dark mode runs a touch more opaque, same reasoning as grain. */
  brandmarkColor: string;
  brandmarkOpacity: number;
}

/** The current, approved report appearance — unchanged from before theming
 * existed. This is the default and the baseline every other theme is
 * measured against. */
export const LIGHT_THEME: ReportTheme = {
  background: "#ffffff",
  surface: "#f4f4f1",
  surfaceAccent: "#eef1ff",
  foreground: "#111111",
  foregroundBody: "#3d3d3b",
  foregroundMuted: "#6f6f6f",
  foregroundFaint: "#9b9b97",
  foregroundGhost: "#c4c4bf",
  border: "#e9e9e6",
  borderStrong: "#dcdcd7",
  accent: "#4f6bff",
  accentMuted: "#3247c4",

  // Barely-there — "premium paper," never a visible grey cast.
  grainColor: "#111111",
  grainOpacity: 0.035,
  grainDotSize: 1,

  brandmarkColor: "#4f6bff",
  brandmarkOpacity: 0.1,
};

/** Premium dark editorial equivalent — same warm-neutral undertone as the
 * light theme's canvas, inverted, with the same cool-blue accent contrast
 * relationship preserved. Not a generic slate/blue-black dark mode. */
export const DARK_THEME: ReportTheme = {
  background: "#141412",
  surface: "#1e1e1b",
  surfaceAccent: "#1a2136",
  foreground: "#f5f4f0",
  foregroundBody: "#cbc9c2",
  foregroundMuted: "#8f8d86",
  foregroundFaint: "#68665f",
  foregroundGhost: "#47453f",
  border: "#2a2a26",
  borderStrong: "#38372f",
  accent: "#6d86ff",
  accentMuted: "#aab7ff",

  // Large dark surfaces read as flat without a little more grain than light
  // mode — still subtle, just a touch more present.
  grainColor: "#f5f4f0",
  grainOpacity: 0.05,
  grainDotSize: 1.1,

  // Lighter/paler blue than the dark theme's own `accent` — reads as a
  // soft glow against the charcoal background rather than blending into it.
  brandmarkColor: "#aab7ff",
  brandmarkOpacity: 0.16,
};

export type ReportThemeName = "light" | "dark";

export const REPORT_THEMES: Record<ReportThemeName, ReportTheme> = {
  light: LIGHT_THEME,
  dark: DARK_THEME,
};

export function resolveReportTheme(name: ReportThemeName | undefined): ReportTheme {
  return REPORT_THEMES[name ?? "light"];
}
