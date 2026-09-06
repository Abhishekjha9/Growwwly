import { StyleSheet } from "@react-pdf/renderer";

import type { ReportTheme } from "./theme";

// ---------------------------------------------------------------------------
// Structure (spacing, radii, sizes) never changes between themes — only
// color does. `createStyles(theme)` is called once per document render
// (see `theme-context.tsx`) and produces the exact same shape either way.
// ---------------------------------------------------------------------------

export const PAGE_PADDING = 42;

/** One consistent vertical rhythm, used instead of ad hoc margin values.
 * xs/sm: label→value, related fields. md/lg: between sub-sections and major
 * sections. Not a hard rule for every single gap, but the default scale. */
export const SPACING = {
  xs: 6,
  sm: 10,
  md: 18,
  lg: 28,
} as const;

export function createStyles(theme: ReportTheme) {
  return StyleSheet.create({
    page: {
      paddingTop: PAGE_PADDING,
      paddingBottom: PAGE_PADDING + 18,
      paddingHorizontal: PAGE_PADDING,
      backgroundColor: theme.background,
      color: theme.foreground,
      fontFamily: "Helvetica",
      fontSize: 9.5,
      // `lineHeight` lives on `pageContent` below, not here — see that
      // style's comment for why the split exists.
    },
    /** Wraps a chapter's flowing content (but not the fixed texture/footer/
     * brand-signature layers, which are siblings of this View in
     * `document.tsx`'s `ThemedPage` — never children of it). Carries the
     * report's line-height so it doesn't have to sit on `page` itself: with
     * `lineHeight` on `page`, react-pdf's fixed-position footer/brandmark
     * text (both use the `render` prop) got nested one level differently
     * and stopped repeating correctly across a wrapped chapter's physical
     * pages. Moving it here, with fixed elements kept as plain siblings
     * rather than children passed through this wrapper, fixed it. */
    pageContent: {
      lineHeight: 1.5,
    },

    // -- Type ------------------------------------------------------------
    label: {
      fontFamily: "Helvetica-Bold",
      fontSize: 7.5,
      letterSpacing: 1.1,
      textTransform: "uppercase",
      color: theme.foregroundMuted,
    },
    labelAccent: {
      color: theme.accentMuted,
    },
    h1: {
      fontFamily: "Helvetica-Bold",
      fontSize: 22,
      color: theme.foreground,
      lineHeight: 1.15,
      // Every h1 in this report follows directly under a `SectionLabel`
      // kicker — this is the gap between the two, not a per-page tweak.
      marginTop: 12,
    },
    h2: {
      fontFamily: "Helvetica-Bold",
      fontSize: 14,
      color: theme.foreground,
    },
    h3: {
      fontFamily: "Helvetica-Bold",
      fontSize: 11,
      color: theme.foreground,
    },
    body: {
      fontSize: 9.5,
      color: theme.foregroundBody,
      lineHeight: 1.55,
    },
    meta: {
      fontSize: 8.25,
      color: theme.foregroundMuted,
      lineHeight: 1.5,
    },
    faint: {
      fontSize: 8,
      color: theme.foregroundFaint,
    },

    // -- Layout ------------------------------------------------------------
    row: {
      flexDirection: "row",
    },
    spaceBetween: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    wrap: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    hairlineRule: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      borderTopStyle: "solid",
    },
    section: {
      marginTop: 22,
    },
    sectionHeader: {
      marginBottom: 10,
    },

    // -- Cards / panels ------------------------------------------------------
    card: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 14,
    },
    panel: {
      backgroundColor: theme.surfaceAccent,
      borderRadius: 10,
      padding: 18,
    },
    metricCard: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },

    // -- Bars --------------------------------------------------------------
    barTrack: {
      height: 3,
      backgroundColor: theme.border,
      borderRadius: 2,
      position: "relative",
      width: "100%",
    },
    barFill: {
      position: "absolute",
      top: 0,
      left: 0,
      height: 3,
      backgroundColor: theme.accent,
      borderRadius: 2,
    },

    // -- Dots / tags ---------------------------------------------------------
    dot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      marginRight: 5,
    },
    numberBadge: {
      width: 18,
      height: 18,
      borderRadius: 5,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    numberBadgeText: {
      fontFamily: "Helvetica-Bold",
      fontSize: 8,
      color: theme.foregroundMuted,
    },

    // -- Footer ------------------------------------------------------------
    footer: {
      position: "absolute",
      bottom: 18,
      left: PAGE_PADDING,
      right: PAGE_PADDING,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      borderTopStyle: "solid",
      paddingTop: 8,
      flexDirection: "row",
      justifyContent: "space-between",
    },
  });
}

export type ReportStyles = ReturnType<typeof createStyles>;
