import { Text, View } from "@react-pdf/renderer";

import type { ProductIntelligence } from "@/types/product";
import type { ChannelResult, GrowthIntelligence } from "@/types/growth";
import type { WebsiteIntelligence } from "@/types/website";
import { actionSubjectLabel, CHANNEL_LABELS } from "@/lib/growth/constants";

import type { ReportRenderContext } from "./render-context";
import {
  Bullets,
  HeroStat,
  KeyValueRow,
  MetricCard,
  NumberedItem,
  ProvenanceTag,
  RecommendationTag,
  ScoreBar,
  ScoreLegend,
  SectionLabel,
  Stat,
} from "./primitives";

// ---------------------------------------------------------------------------
// Every component here is a pure presentation of fields already present on
// `AnalysisResult` (`@/types/analysis`). Nothing is computed, scored, or
// invented here — see `generate.ts` for the "no OpenAI, no scoring" guarantee.
// `t` (theme + styles, see `render-context.ts`) is threaded through as a
// prop rather than read from React Context, so every section renders
// correctly in both Light and Dark without touching Next.js's RSC boundary
// detection (this whole tree is rendered by react-pdf inside an API route,
// never through Next's own page/component tree).
// ---------------------------------------------------------------------------

const DECISION_TYPE_COPY: Record<string, string> = {
  commit: "Current highest-leverage action",
  test: "Worth testing first",
};

const BOTTLENECK_LABELS: Record<string, string> = {
  acquisition: "Acquisition",
  positioning: "Positioning",
  conversion: "Conversion",
  technical: "Technical",
  unknown: "Unknown",
};

/* ============================================================
   PAGE 1 — Cover, executive summary, highest-leverage action
   ============================================================ */

export function CoverHeader({
  t,
  productName,
  websiteUrl,
  generatedOn,
}: {
  t: ReportRenderContext;
  productName: string;
  websiteUrl: string | null;
  generatedOn: string;
}) {
  const { theme, styles } = t;
  return (
    <View>
      <View style={styles.spaceBetween}>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 13, letterSpacing: -0.3, color: theme.foreground }}>
          Growwwly
        </Text>
        <Text style={styles.meta}>{generatedOn}</Text>
      </View>
      <SectionLabel t={t} accent>Growth Intelligence Report</SectionLabel>
      <Text style={styles.h1}>{productName}</Text>
      {websiteUrl && (
        <Text style={[styles.meta, { marginTop: 10 }]} wrap>
          {websiteUrl}
        </Text>
      )}
      <Text style={[styles.body, { marginTop: 12, maxWidth: 440 }]}>
        This report summarizes {productName}&apos;s Growwwly analysis: product intelligence read
        from what was provided, deterministic growth-channel scoring, and — where a website was
        analyzed — measured website health alongside AI interpretation of positioning and
        conversion readiness.
      </Text>
    </View>
  );
}

export function ExecutiveSummary({
  t,
  productIntelligence,
}: {
  t: ReportRenderContext;
  productIntelligence: ProductIntelligence;
}) {
  const { theme, styles } = t;
  const { customer, problem, confidence } = productIntelligence;
  return (
    <View style={[styles.section, { marginTop: 20 }]}>
      <SectionLabel t={t}>Executive summary</SectionLabel>
      <View style={{ marginTop: 7 }}>
        <KeyValueRow t={t} label="Target customer" first>
          {customer.primaryCustomer}
        </KeyValueRow>
        <KeyValueRow t={t} label="Core problem">{problem.primaryProblem}</KeyValueRow>
        <View style={[{ paddingVertical: 7, borderTopWidth: 1, borderTopColor: theme.border, borderTopStyle: "solid" }]}>
          <Text style={styles.label}>Model confidence</Text>
          <View style={{ marginTop: 5, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11, color: theme.foreground }}>
              {confidence.overall}%
            </Text>
            <View style={{ flex: 1 }}>
              <ScoreBar t={t} value={confidence.overall} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

/** A compact, real-metrics-only glance between the executive summary and the
 * decision below — every value here is read straight off `growthIntelligence`
 * and `productIntelligence`, never computed or invented for this snapshot. */
export function GrowthSnapshot({
  t,
  productIntelligence,
  growthIntelligence,
}: {
  t: ReportRenderContext;
  productIntelligence: ProductIntelligence;
  growthIntelligence: GrowthIntelligence;
}) {
  const { styles } = t;
  const { summary } = growthIntelligence;
  return (
    <View style={{ marginTop: 16 }} wrap={false}>
      <SectionLabel t={t}>Growth snapshot</SectionLabel>
      <View style={[styles.wrap, { marginTop: 8, gap: 22 }]}>
        <Stat t={t} value={`${productIntelligence.confidence.overall}%`} label="Confidence" />
        <Stat t={t} value={summary.topOpportunityScore} label="Top opportunity" />
        <Stat t={t} value={CHANNEL_LABELS[summary.topChannel]} label="Top channel" />
      </View>
    </View>
  );
}

/**
 * The hero of the report: "what should I do" (title), "why" (reason), and
 * "what evidence supports it" (bullets), in that order — the Opportunity
 * Score is rendered larger than every other stat here and in the ranked
 * table, since it's the one number this whole document is organized around.
 */
export function HighestLeverageActionPanel({
  t,
  growthIntelligence,
}: {
  t: ReportRenderContext;
  growthIntelligence: GrowthIntelligence;
}) {
  const { styles } = t;
  const action = growthIntelligence.highestLeverageAction;
  return (
    <View style={[styles.panel, { marginTop: 18, padding: 16 }]} wrap={false}>
      <SectionLabel t={t} accent>{DECISION_TYPE_COPY[action.decisionType] ?? "Highest-leverage action"}</SectionLabel>
      <Text style={[styles.h2, { marginTop: 7, fontSize: 17 }]}>{action.title}</Text>
      <Text style={[styles.body, { marginTop: 7, maxWidth: 460 }]}>{action.reason}</Text>

      <View style={[styles.wrap, { marginTop: 13, gap: 24, alignItems: "flex-end" }]}>
        <HeroStat t={t} value={action.opportunityScore} label="Opportunity score" />
        <Stat t={t} value={actionSubjectLabel(action.channel)} label={action.channel ? "Channel" : "Focus"} />
        <Stat t={t} value={action.expectedImpact} label="Expected impact" />
        <Stat t={t} value={action.effortLabel} label="Estimated effort" />
        <Stat t={t} value={action.priority} label="Priority" />
      </View>

      {action.evidence.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <SectionLabel t={t}>Why</SectionLabel>
          <View style={{ marginTop: 5 }}>
            <Bullets t={t} items={action.evidence} />
          </View>
        </View>
      )}
    </View>
  );
}

/* ============================================================
   PAGE 2 — Product intelligence
   ============================================================ */

function SignalGrid({
  t,
  items,
}: {
  t: ReportRenderContext;
  items: Array<{ label: string; value: number }>;
}) {
  const { theme, styles } = t;
  return (
    <View style={[styles.wrap, { gap: 16, marginTop: 8 }]}>
      {items.map((item) => (
        <View key={item.label} style={{ width: "45%" }}>
          <View style={styles.spaceBetween}>
            <Text style={styles.meta}>{item.label}</Text>
            <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color: theme.foreground }}>{item.value}</Text>
          </View>
          <View style={{ marginTop: 4 }}>
            <ScoreBar t={t} value={item.value} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ProductIntelligenceSection({
  t,
  productIntelligence,
}: {
  t: ReportRenderContext;
  productIntelligence: ProductIntelligence;
}) {
  const { styles } = t;
  const { product, customer, problem, marketSignals, productFitSignals } = productIntelligence;
  return (
    <View>
      <SectionLabel t={t} accent>Product intelligence</SectionLabel>
      <Text style={[styles.h1, { fontSize: 18 }]}>{product.name}</Text>
      <Text style={[styles.meta, { marginTop: 8 }]}>{product.category}</Text>

      <View style={styles.section}>
        <SectionLabel t={t}>The product</SectionLabel>
        <View style={{ marginTop: 6 }}>
          <KeyValueRow t={t} label="Primary use case" first>
            {product.primaryUseCase}
          </KeyValueRow>
          {product.secondaryUseCases.length > 0 && (
            <KeyValueRow t={t} label="Secondary use cases">
              <Bullets t={t} items={product.secondaryUseCases} />
            </KeyValueRow>
          )}
          <KeyValueRow t={t} label="Target customer">{customer.primaryCustomer}</KeyValueRow>
          <KeyValueRow t={t} label="Buyer / user">{`${customer.buyer} / ${customer.user}`}</KeyValueRow>
        </View>
      </View>

      <View style={styles.section}>
        <SectionLabel t={t}>The problem</SectionLabel>
        <Text style={[styles.body, { marginTop: 6 }]}>{problem.primaryProblem}</Text>
        <SignalGrid
          t={t}
          items={[
            { label: "Pain severity", value: problem.painSeverity },
            { label: "Urgency", value: problem.urgency },
            { label: "Frequency", value: problem.frequency },
            { label: "Willingness to pay", value: problem.willingnessToPay },
          ]}
        />
      </View>

      <View style={styles.section} wrap={false}>
        <SectionLabel t={t}>Market signals</SectionLabel>
        <Text style={[styles.faint, { marginTop: 4 }]}>AI-generated strategic signals, 0–100.</Text>
        <SignalGrid
          t={t}
          items={[
            { label: "Search intent", value: marketSignals.searchIntent },
            { label: "Community presence", value: marketSignals.communityPresence },
            { label: "Visual content potential", value: marketSignals.visualContentPotential },
            { label: "Word of mouth potential", value: marketSignals.wordOfMouthPotential },
            { label: "Buyer accessibility", value: marketSignals.buyerAccessibility },
            { label: "Market maturity", value: marketSignals.marketMaturity },
          ]}
        />
      </View>

      <View style={styles.section} wrap={false}>
        <SectionLabel t={t}>Product fit</SectionLabel>
        <Text style={[styles.faint, { marginTop: 4 }]}>AI-generated strategic signals, 0–100.</Text>
        <SignalGrid
          t={t}
          items={[
            { label: "Technical audience fit", value: productFitSignals.technicalAudienceFit },
            { label: "Visual audience fit", value: productFitSignals.visualAudienceFit },
            { label: "Community audience fit", value: productFitSignals.communityAudienceFit },
            { label: "Search-driven problem", value: productFitSignals.searchDrivenProblem },
            { label: "Impulse purchase potential", value: productFitSignals.impulsePurchasePotential },
            { label: "Sales-led potential", value: productFitSignals.salesLedPotential },
          ]}
        />
      </View>
    </View>
  );
}

/* ============================================================
   PAGE 3 — Growth opportunities
   ============================================================ */

const TABLE_COLS = {
  rank: "5%",
  channel: "15%",
  opportunity: "21%",
  channelScore: "10%",
  confidence: "11%",
  effort: "9%",
  recommendation: "16%",
  aiSignal: "13%",
} as const;

function ChannelTableHeader({ t }: { t: ReportRenderContext }) {
  const { theme, styles } = t;
  return (
    <View style={[styles.row, { paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: theme.borderStrong, borderBottomStyle: "solid" }]}>
      <Text style={[styles.label, { width: TABLE_COLS.rank }]}>#</Text>
      <Text style={[styles.label, { width: TABLE_COLS.channel }]}>Channel</Text>
      <Text style={[styles.label, { width: TABLE_COLS.opportunity }]}>Opportunity</Text>
      <Text style={[styles.label, { width: TABLE_COLS.channelScore }]}>Channel score</Text>
      <Text style={[styles.label, { width: TABLE_COLS.confidence }]}>Confidence</Text>
      <Text style={[styles.label, { width: TABLE_COLS.effort }]}>Effort</Text>
      <Text style={[styles.label, { width: TABLE_COLS.recommendation }]}>Recommendation</Text>
      <Text style={[styles.label, { width: TABLE_COLS.aiSignal }]}>AI signal</Text>
    </View>
  );
}

function ChannelTableRow({
  t,
  result,
  rank,
  lead = false,
}: {
  t: ReportRenderContext;
  result: ChannelResult;
  rank: number;
  lead?: boolean;
}) {
  const { theme, styles } = t;
  return (
    <View
      style={[
        styles.row,
        { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border, borderBottomStyle: "solid", alignItems: "center" },
      ]}
      wrap={false}
    >
      <Text style={[styles.meta, { width: TABLE_COLS.rank }]}>{String(rank).padStart(2, "0")}</Text>
      <Text style={[{ width: TABLE_COLS.channel, fontFamily: "Helvetica-Bold", fontSize: 9.5, color: theme.foreground }]}>
        {CHANNEL_LABELS[result.channel]}
      </Text>
      <View style={{ width: TABLE_COLS.opportunity, paddingRight: 12 }}>
        <Text
          style={{
            fontFamily: "Helvetica-Bold",
            fontSize: lead ? 13 : 10.5,
            color: theme.foreground,
          }}
        >
          {result.opportunityScore}
        </Text>
        <View style={{ marginTop: 4 }}>
          <ScoreBar t={t} value={result.opportunityScore} />
        </View>
      </View>
      <Text style={[styles.meta, { width: TABLE_COLS.channelScore }]}>{result.channelScore}</Text>
      <Text style={[styles.meta, { width: TABLE_COLS.confidence }]}>{result.confidenceLabel}</Text>
      <Text style={[styles.meta, { width: TABLE_COLS.effort }]}>{result.effortLabel}</Text>
      <View style={{ width: TABLE_COLS.recommendation }}>
        <RecommendationTag t={t} kind={result.recommendation} />
      </View>
      <Text style={[styles.meta, { width: TABLE_COLS.aiSignal }]}>{result.aiSignal.relevance}/100</Text>
    </View>
  );
}

export function GrowthOpportunitiesSection({
  t,
  growthIntelligence,
}: {
  t: ReportRenderContext;
  growthIntelligence: GrowthIntelligence;
}) {
  const { theme, styles } = t;
  const { rankedChannels, summary } = growthIntelligence;
  return (
    <View>
      <SectionLabel t={t} accent>Growth opportunities</SectionLabel>
      <Text style={[styles.h1, { fontSize: 18 }]}>Ranked channels</Text>
      <Text style={[styles.body, { marginTop: 8, maxWidth: 470 }]}>
        Eight acquisition channels, ranked by Opportunity Score — a framework score Growwwly&apos;s
        code computes from the model&apos;s market, product-fit and channel signals, tempered by
        confidence, effort and stated constraints. &quot;AI signal&quot; is OpenAI&apos;s own raw
        relevance read for the channel — not a market measurement.
      </Text>
      {summary.decisionType === "test" && (
        <Text style={[styles.meta, { marginTop: 8, color: theme.accentMuted }]}>
          Top opportunities are closely matched, or overall confidence is low — worth testing before
          committing fully to one channel.
        </Text>
      )}

      <View style={[styles.section, { marginTop: 16 }]} wrap={false}>
        <ScoreLegend t={t} />
      </View>

      <View style={{ marginTop: 14 }}>
        <ChannelTableHeader t={t} />
        {rankedChannels.map((c, i) => (
          <ChannelTableRow key={c.channel} t={t} result={c} rank={i + 1} lead={i === 0} />
        ))}
      </View>

      <View style={styles.section}>
        <SectionLabel t={t}>Channel interpretation — top ranked</SectionLabel>
        <Text style={[styles.faint, { marginTop: 4 }]}>
          Rationale and evidence produced by the Growth Intelligence Engine, not OpenAI.
        </Text>
        {rankedChannels.slice(0, 3).map((c, i) => (
          <View key={c.channel} style={[{ marginTop: 12, paddingTop: i === 0 ? 0 : 0 }]} wrap={false}>
            <View style={styles.spaceBetween}>
              <Text style={[styles.h3, { fontSize: 10.5 }]}>{CHANNEL_LABELS[c.channel]}</Text>
              <RecommendationTag t={t} kind={c.recommendation} />
            </View>
            <Text style={[styles.body, { marginTop: 4 }]}>{c.rationale}</Text>
            <View style={[styles.card, { marginTop: 6, padding: 8 }]}>
              <Text style={styles.label}>AI signal</Text>
              <Text style={[styles.meta, { marginTop: 3 }]}>
                {c.aiSignal.relevance}/100 — {c.aiSignal.reasoning}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ============================================================
   PAGE 4 — Website intelligence
   ============================================================ */

function HealthStat({ t, label, value }: { t: ReportRenderContext; label: string; value: number | null }) {
  return <MetricCard t={t} label={label} value={value ?? "Unavailable"} />;
}

export function NoWebsiteSection({ t }: { t: ReportRenderContext }) {
  const { styles } = t;
  return (
    <View>
      <SectionLabel t={t} accent>Website intelligence</SectionLabel>
      <Text style={[styles.h1, { fontSize: 18 }]}>Website analysis was not provided.</Text>
      <Text style={[styles.body, { marginTop: 8, maxWidth: 440 }]}>
        No website URL was given as part of this analysis. Product Intelligence and Growth
        Intelligence above were generated from the founder&apos;s own answers and are unaffected.
      </Text>
    </View>
  );
}

export function WebsiteUnavailableSection({
  t,
  website,
}: {
  t: ReportRenderContext;
  website: WebsiteIntelligence;
}) {
  const { styles } = t;
  return (
    <View>
      <SectionLabel t={t} accent>Website intelligence</SectionLabel>
      <Text style={[styles.h1, { fontSize: 18 }]}>This site couldn&apos;t be inspected.</Text>
      <Text style={[styles.meta, { marginTop: 6 }]}>{website.url}</Text>
      <Text style={[styles.body, { marginTop: 8, maxWidth: 440 }]}>
        {website.error ?? "The website could not be reached."} Product and growth intelligence are
        unaffected — they were generated from what the founder told us.
      </Text>
    </View>
  );
}

export function WebsiteIntelligenceSection({
  t,
  website,
}: {
  t: ReportRenderContext;
  website: WebsiteIntelligence;
}) {
  const { styles } = t;
  const { seo, performance, interpretation } = website;
  return (
    <View>
      <SectionLabel t={t} accent>Website intelligence</SectionLabel>
      <Text style={[styles.h1, { fontSize: 18 }]} wrap>
        {website.crawl.finalUrl ?? website.url}
      </Text>
      {website.status === "partial" && (
        <Text style={[styles.meta, { marginTop: 6 }]}>
          {website.error ?? "Part of this inspection was unavailable."}
        </Text>
      )}

      <View style={styles.section} wrap={false}>
        <View style={styles.spaceBetween}>
          <SectionLabel t={t}>Website health</SectionLabel>
          <ProvenanceTag t={t} kind="measured" />
        </View>
        <Text style={[styles.faint, { marginTop: 4 }]}>Lighthouse — measured, not interpreted.</Text>
        {performance.status === "measured" ? (
          <View style={[styles.wrap, { gap: 22, marginTop: 10 }]}>
            <HealthStat t={t} label="Performance" value={performance.performance} />
            <HealthStat t={t} label="Accessibility" value={performance.accessibility} />
            <HealthStat t={t} label="Best practices" value={performance.bestPractices} />
            <HealthStat t={t} label="SEO" value={performance.seo} />
          </View>
        ) : (
          <Text style={[styles.body, { marginTop: 8 }]}>
            Technical audit unavailable — {performance.reason ?? "no reason given"}.
          </Text>
        )}

        {seo && (
          <View style={{ marginTop: 12 }}>
            <Bullets
              t={t}
              items={[
                seo.title ? "Has a page title" : "Missing page title",
                seo.metaDescription ? "Has a meta description" : "Missing meta description",
                `${seo.h1Count} H1 heading${seo.h1Count === 1 ? "" : "s"}`,
                `${seo.images.missingAlt} of ${seo.images.total} images missing alt text`,
                seo.structuredData.present ? "Structured data present" : "No structured data found",
                seo.socialMeta.openGraphPresent ? "Open Graph tags present" : "No Open Graph tags",
              ]}
            />
          </View>
        )}
      </View>

      {interpretation && (
        <>
          <View style={styles.section} wrap={false}>
            <View style={styles.spaceBetween}>
              <SectionLabel t={t}>Positioning</SectionLabel>
              <ProvenanceTag t={t} kind="interpretation" />
            </View>
            <SignalGrid
              t={t}
              items={[
                { label: "Target customer clarity", value: interpretation.positioning.targetCustomerClarity },
                { label: "Problem clarity", value: interpretation.positioning.problemClarity },
                { label: "Differentiation clarity", value: interpretation.positioning.differentiationClarity },
              ]}
            />
            <Text style={[styles.body, { marginTop: 8 }]}>{interpretation.positioning.summary}</Text>
          </View>

          <View style={styles.section} wrap={false}>
            <View style={styles.spaceBetween}>
              <SectionLabel t={t}>Conversion</SectionLabel>
              <ProvenanceTag t={t} kind="interpretation" />
            </View>
            <SignalGrid
              t={t}
              items={[
                { label: "Value proposition clarity", value: interpretation.conversion.valuePropositionClarity },
                { label: "CTA prominence", value: interpretation.conversion.ctaProminence },
                { label: "Trust signal strength", value: interpretation.conversion.trustSignalStrength },
                { label: "Social proof strength", value: interpretation.conversion.socialProofStrength },
                { label: "Pricing visibility", value: interpretation.conversion.pricingVisibility },
                { label: "Signup ease", value: 100 - interpretation.conversion.signupFriction },
              ]}
            />
            <Text style={[styles.body, { marginTop: 8 }]}>{interpretation.conversion.summary}</Text>
          </View>

          <View style={styles.section} wrap={false}>
            <View style={styles.spaceBetween}>
              <SectionLabel t={t}>Visual & experience</SectionLabel>
              <ProvenanceTag t={t} kind="interpretation" />
            </View>
            <View style={{ marginTop: 8 }}>
              <KeyValueRow t={t} label="Desktop assessment" first>
                {interpretation.hero.summary}
              </KeyValueRow>
              <KeyValueRow t={t} label="Hierarchy assessment">{interpretation.visualHierarchy.summary}</KeyValueRow>
              <KeyValueRow t={t} label="Mobile assessment">{interpretation.mobile.summary}</KeyValueRow>
              {interpretation.mobile.layoutIssues.length > 0 && (
                <KeyValueRow t={t} label="Mobile issues">
                  <Bullets t={t} items={interpretation.mobile.layoutIssues} />
                </KeyValueRow>
              )}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

/* ============================================================
   FINAL PAGE — Growth Diagnosis: bottleneck headline, strengths/
   weaknesses/opportunities, a closing "Your Next Move" decision, and a
   Growwwly brand signature in the page's remaining whitespace. This is the
   "so what?" page — it opens with the diagnosis and ends with the same
   decision the report opened with (§ HighestLeverageAction), deliberately
   bookending the document around one answer.
   ============================================================ */

const BOTTLENECK_HEADLINES: Record<string, string> = {
  acquisition: "Acquisition is the current growth bottleneck.",
  positioning: "Positioning is the current growth bottleneck.",
  conversion: "Conversion readiness is the current growth bottleneck.",
  technical: "Technical health is the current growth bottleneck.",
  unknown: "No critical website bottleneck detected.",
};

const DECISION_WORD: Record<string, string> = {
  commit: "Commit",
  test: "Test first",
};

export function GrowthDiagnosisHeader({
  t,
  growthIntelligence,
}: {
  t: ReportRenderContext;
  growthIntelligence: GrowthIntelligence;
}) {
  const { styles } = t;
  const { bottleneck } = growthIntelligence;
  return (
    <View wrap={false}>
      <SectionLabel t={t} accent>Growth diagnosis</SectionLabel>
      <Text style={[styles.h1, { fontSize: 19 }]}>
        {BOTTLENECK_HEADLINES[bottleneck.type] ?? BOTTLENECK_LABELS[bottleneck.type]}
      </Text>
      {bottleneck.reason && (
        <Text style={[styles.body, { marginTop: 8, maxWidth: 460 }]}>{bottleneck.reason}</Text>
      )}
    </View>
  );
}

function ScanBlock({
  t,
  label,
  accent = false,
  items,
}: {
  t: ReportRenderContext;
  label: string;
  accent?: boolean;
  items: string[];
}) {
  const { styles } = t;
  if (items.length === 0) return null;
  return (
    <View style={[styles.section, { marginTop: 18 }]} wrap={false}>
      <SectionLabel t={t} accent={accent}>{label}</SectionLabel>
      <View style={{ marginTop: 10, gap: 9 }}>
        {items.map((item, i) => (
          <NumberedItem key={item} t={t} index={i + 1}>
            {item}
          </NumberedItem>
        ))}
      </View>
    </View>
  );
}

export function StrengthsWeaknessesSection({
  t,
  website,
}: {
  t: ReportRenderContext;
  website: WebsiteIntelligence | null;
}) {
  const interpretation = website?.interpretation;
  if (!interpretation) return null;
  const { strengths, weaknesses, opportunities } = interpretation;
  if (strengths.length === 0 && weaknesses.length === 0 && opportunities.length === 0) return null;

  return (
    <View>
      <ScanBlock t={t} label="What's working" accent items={strengths} />
      <ScanBlock t={t} label="What needs attention" items={weaknesses} />
      <ScanBlock t={t} label="Opportunities" items={opportunities} />
    </View>
  );
}

/**
 * Closes the report on the same decision it opened with — the exact same
 * `highestLeverageAction` data as page one's hero panel, restated here as
 * the report's final word rather than a new recommendation.
 */
export function NextMoveSection({
  t,
  growthIntelligence,
}: {
  t: ReportRenderContext;
  growthIntelligence: GrowthIntelligence;
}) {
  const { theme, styles } = t;
  const action = growthIntelligence.highestLeverageAction;
  return (
    <View style={[styles.panel, styles.section]} wrap={false}>
      <SectionLabel t={t} accent>Your next move</SectionLabel>
      <Text style={[styles.h2, { marginTop: 8, fontSize: 16 }]}>{action.title}</Text>

      <View style={[styles.row, { marginTop: 10, alignItems: "center", gap: 10 }]}>
        <Text style={[styles.meta, { color: theme.foregroundBody }]}>
          {actionSubjectLabel(action.channel)} · Opportunity {action.opportunityScore}
        </Text>
        <View style={{ width: 1, height: 10, backgroundColor: theme.borderStrong }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Text style={styles.label}>Decision</Text>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, color: theme.accentMuted }}>
            {(DECISION_WORD[action.decisionType] ?? action.decisionType).toUpperCase()}
          </Text>
        </View>
      </View>

      {action.evidence.length > 0 && (
        <View style={{ marginTop: 14 }}>
          <SectionLabel t={t}>Why</SectionLabel>
          <View style={{ marginTop: 6 }}>
            <Bullets t={t} items={action.evidence} />
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * The report's closing brand signature — giant, low-opacity, editorial
 * background typography in the spirit of an oversized website-footer
 * wordmark. Pure decoration: no analysis data, no new claims.
 *
 * `fixed`, with a `render` callback that only returns text when
 * `pageNumber === totalPages` — i.e. only on the document's true final
 * page. This is deliberate, and the *only* mechanism that actually
 * guarantees the wordmark can never create an extra page: `fixed` elements
 * are fully exempt from react-pdf's pagination/overflow sizing (the same
 * mechanism the footer already relies on to repeat on every page). A plain
 * `position: absolute` block that *isn't* fixed is **not** exempt — it was
 * tried and directly falsified here: react-pdf still measures its natural
 * content height against the remaining space on the page where it's
 * declared, and will happily split it across a new page if it doesn't fit,
 * regardless of the absolute positioning. Since content length varies per
 * analysis, "how much space is left after the card" can't be predicted at
 * author time — `fixed` sidesteps the question entirely by never
 * participating in that calculation at all.
 */
export function BrandSignature({ t }: { t: ReportRenderContext }) {
  const { theme } = t;
  return (
    <>
      <Text
        fixed
        style={{
          position: "absolute",
          bottom: 58,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "Helvetica-Bold",
          fontSize: 64,
          letterSpacing: 0,
          color: theme.brandmarkColor,
          opacity: theme.brandmarkOpacity,
          // Deliberately no `lineHeight` here — verified directly: a
          // `render`-prop `<Text>` with an explicit `lineHeight` in its own
          // style renders nothing at all (a real react-pdf quirk, distinct
          // from the `<Page>`-level one noted on `styles.ts`). This text is
          // a single line, so it doesn't need one anyway.
        }}
        render={({ pageNumber, totalPages }) => (pageNumber === totalPages ? "GROWWWLY" : "")}
      />
      <Text
        fixed
        style={{
          position: "absolute",
          bottom: 46,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "Helvetica-Bold",
          fontSize: 8,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: theme.brandmarkColor,
          opacity: theme.brandmarkOpacity * 1.6,
        }}
        render={({ pageNumber, totalPages }) => (pageNumber === totalPages ? "Growth Intelligence" : "")}
      />
    </>
  );
}

/* ============================================================
   FOOTER — repeats on every page
   ============================================================ */

export function ReportFooter({ t }: { t: ReportRenderContext }) {
  const { styles } = t;
  return (
    <View style={styles.footer} fixed>
      <View>
        <Text style={styles.faint}>Generated by Growwwly</Text>
        <Text style={[styles.faint, { marginTop: 2 }]}>
          AI-derived insights and framework scores are recommendations, not guaranteed outcomes.
        </Text>
      </View>
      <Text
        style={styles.faint}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}
