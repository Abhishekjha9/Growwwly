import { Text, View } from "@react-pdf/renderer";

import type { ReportRenderContext } from "./render-context";

// ---------------------------------------------------------------------------
// Small visual atoms shared by every report section. Nothing here reads or
// transforms analysis data — that stays in `sections.tsx`. These are purely
// presentational, mirroring the shape (never the pixels) of the app's own
// `components/primitives.tsx`. Every component takes the render context
// (`t: { theme, styles }`) as a prop — see `render-context.ts` for why that's
// a prop and not a React Context — so the same components render correctly
// in both Light and Dark.
// ---------------------------------------------------------------------------

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function SectionLabel({
  t,
  children,
  accent = false,
}: {
  t: ReportRenderContext;
  children: React.ReactNode;
  accent?: boolean;
}) {
  const { styles } = t;
  return <Text style={[styles.label, accent ? styles.labelAccent : undefined]}>{children}</Text>;
}

/** A 0–100 value drawn as a length — never called a measurement unless the
 * caller has already established it is one. */
export function ScoreBar({ t, value, width }: { t: ReportRenderContext; value: number; width?: number | string }) {
  const { styles } = t;
  return (
    <View style={[styles.barTrack, width !== undefined ? { width } : undefined]}>
      <View style={[styles.barFill, { width: `${clamp(value, 0, 100)}%` }]} />
    </View>
  );
}

export function Stat({ t, label, value }: { t: ReportRenderContext; label: string; value: string | number }) {
  const { theme, styles } = t;
  return (
    <View wrap={false}>
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 15, color: theme.foreground }}>
        {value}
      </Text>
      <Text style={[styles.label, { marginTop: 3 }]}>{label}</Text>
    </View>
  );
}

/** The one number the whole report is built around — visually the largest
 * stat wherever it appears, so it always reads as the primary metric. */
export function HeroStat({ t, label, value }: { t: ReportRenderContext; label: string; value: string | number }) {
  const { theme, styles } = t;
  return (
    <View wrap={false}>
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 29, color: theme.foreground, lineHeight: 1 }}>
        {value}
      </Text>
      <Text style={[styles.label, { marginTop: 4 }]}>{label}</Text>
    </View>
  );
}

/** A compact metric block — same value/label pairing as `Stat`, given a
 * subtle card so a row of them reads as structured, not just floating text. */
export function MetricCard({ t, label, value }: { t: ReportRenderContext; label: string; value: string | number }) {
  const { theme, styles } = t;
  return (
    <View style={[styles.metricCard, { minWidth: 92 }]} wrap={false}>
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 18, color: theme.foreground }}>{value}</Text>
      <Text style={[styles.label, { marginTop: 4 }]}>{label}</Text>
    </View>
  );
}

/** A numbered compact block — "01  <text>" — used wherever a list of flat
 * strings (strengths/weaknesses/opportunities) needs to read as distinct,
 * scannable items rather than a dense bulleted paragraph. */
export function NumberedItem({
  t,
  index,
  children,
}: {
  t: ReportRenderContext;
  index: number;
  children: React.ReactNode;
}) {
  const { styles } = t;
  return (
    <View style={{ flexDirection: "row", gap: 10 }} wrap={false}>
      <View style={styles.numberBadge}>
        <Text style={styles.numberBadgeText}>{String(index).padStart(2, "0")}</Text>
      </View>
      <Text style={[styles.body, { flex: 1, marginTop: 1 }]}>{children}</Text>
    </View>
  );
}

/** The three score types this report uses, side by side, wherever they first
 * appear together — so the distinction is established once and stays subtle. */
export function ScoreLegend({ t }: { t: ReportRenderContext }) {
  const { styles } = t;
  const items: Array<{ title: string; caption: string }> = [
    { title: "AI signal", caption: "AI interpretation" },
    { title: "Channel score", caption: "Channel fit" },
    { title: "Opportunity score", caption: "Growth prioritization" },
  ];
  return (
    <View style={[styles.row, { gap: 24 }]} wrap={false}>
      {items.map((item) => (
        <View key={item.title}>
          <Text style={styles.label}>{item.title}</Text>
          <Text style={[styles.faint, { marginTop: 2 }]}>{item.caption}</Text>
        </View>
      ))}
    </View>
  );
}

export function Divider({
  t,
  marginTop = 12,
  marginBottom = 12,
}: {
  t: ReportRenderContext;
  marginTop?: number;
  marginBottom?: number;
}) {
  const { styles } = t;
  return <View style={[styles.hairlineRule, { marginTop, marginBottom }]} />;
}

export function Bullets({ t, items }: { t: ReportRenderContext; items: string[] }) {
  const { theme, styles } = t;
  if (items.length === 0) return null;
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: "row", marginTop: i === 0 ? 0 : 5 }}>
          <Text style={{ color: theme.foregroundGhost, marginRight: 6 }}>{"•"}</Text>
          <Text style={[styles.body, { flex: 1 }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

/** "MEASURED" vs "AI INTERPRETATION" — the one distinction this whole report
 * is built around. Never omit it next to a number OpenAI produced. */
export function ProvenanceTag({
  t,
  kind,
}: {
  t: ReportRenderContext;
  kind: "measured" | "interpretation" | "framework";
}) {
  const { theme, styles } = t;
  const copy =
    kind === "measured" ? "Measured" : kind === "framework" ? "Growwwly framework" : "AI interpretation";
  const color = kind === "interpretation" ? theme.accentMuted : theme.foregroundMuted;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{copy}</Text>
    </View>
  );
}

export function RecommendationTag({ t, kind }: { t: ReportRenderContext; kind: string }) {
  const { theme } = t;
  const RECOMMENDATION_COLOR: Record<string, string> = {
    recommended: theme.accentMuted,
    consider: theme.foregroundMuted,
    deprioritize: theme.foregroundFaint,
  };
  const RECOMMENDATION_COPY: Record<string, string> = {
    recommended: "Recommended",
    consider: "Consider",
    deprioritize: "Deprioritize",
  };
  const color = RECOMMENDATION_COLOR[kind] ?? theme.foregroundMuted;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={[{ width: 5, height: 5, borderRadius: 3, marginRight: 5 }, { backgroundColor: color }]} />
      <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color }}>
        {RECOMMENDATION_COPY[kind] ?? kind}
      </Text>
    </View>
  );
}

export function KeyValueRow({
  t,
  label,
  children,
  first = false,
}: {
  t: ReportRenderContext;
  label: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  const { theme, styles } = t;
  return (
    <View
      style={[
        { paddingVertical: 8 },
        !first ? { borderTopWidth: 1, borderTopColor: theme.border, borderTopStyle: "solid" as const } : undefined,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={{ marginTop: 3 }}>
        {typeof children === "string" || typeof children === "number" ? (
          <Text style={styles.body}>{children}</Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}
