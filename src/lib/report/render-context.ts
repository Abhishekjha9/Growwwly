import { createStyles, type ReportStyles } from "./styles";
import type { ReportTheme } from "./theme";

// ---------------------------------------------------------------------------
// Every report component takes this as a `t` prop instead of reaching for
// React Context. That's deliberate, not an oversight: this whole module tree
// is rendered inside an API route via react-pdf's own reconciler, never
// through Next.js's own page/RSC tree — but Next's bundler still statically
// flags any `createContext`/`useContext` usage anywhere in a route's import
// graph as needing a client/server boundary, and its dev server then tries
// to enforce that boundary at runtime too (wrapping the module in an RSC
// proxy that fails when called directly, outside Next's own render tree).
// Plain prop-passing has no such conflict and is unambiguously safe under
// concurrent requests — no shared mutable module state either.
// ---------------------------------------------------------------------------

export interface ReportRenderContext {
  theme: ReportTheme;
  styles: ReportStyles;
}

export function createRenderContext(theme: ReportTheme): ReportRenderContext {
  return { theme, styles: createStyles(theme) };
}
