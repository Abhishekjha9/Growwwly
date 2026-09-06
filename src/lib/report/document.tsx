import { Document, Page, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";

import type { AnalysisResult } from "@/types/analysis";

import { createRenderContext, type ReportRenderContext } from "./render-context";
import { LIGHT_THEME, type ReportTheme } from "./theme";
import { Texture } from "./texture";
import {
  BrandSignature,
  CoverHeader,
  ExecutiveSummary,
  GrowthDiagnosisHeader,
  GrowthOpportunitiesSection,
  GrowthSnapshot,
  HighestLeverageActionPanel,
  NextMoveSection,
  NoWebsiteSection,
  ProductIntelligenceSection,
  ReportFooter,
  StrengthsWeaknessesSection,
  WebsiteIntelligenceSection,
  WebsiteUnavailableSection,
} from "./sections";

/**
 * A themed page: the grain texture painted first (bottom layer), then a
 * `pageContent` wrapper carrying the report's line-height around the
 * chapter's flowing content, then the fixed footer (and, on the closing
 * chapter, the brand signature) as siblings of that wrapper — never nested
 * inside it. `ReportFooter`/`BrandSignature` rely on `fixed` to repeat
 * identically across every physical page a chapter wraps onto; nesting them
 * inside the `lineHeight`-bearing `pageContent` View breaks that (verified
 * directly: doing so silently drops the footer/brand text on every page
 * once a chapter spans more than one physical page). Keeping them as
 * `ThemedPage`'s own trailing children — not part of the chapter's
 * `children` prop — is what keeps them correctly exempt from pagination.
 */
function ThemedPage({
  t,
  brand = false,
  children,
}: {
  t: ReportRenderContext;
  brand?: boolean;
  children: ReactNode;
}) {
  return (
    <Page size="A4" style={t.styles.page}>
      <Texture t={t} />
      <View style={t.styles.pageContent}>{children}</View>
      {brand ? <BrandSignature t={t} /> : null}
      <ReportFooter t={t} />
    </Page>
  );
}

/**
 * The root PDF document — three narrative chapters, each its own `<Page>`
 * (WHAT SHOULD I DO / WHY & WHERE ARE THE OPPORTUNITIES / IS THE WEBSITE
 * READY, WHAT'S THE DIAGNOSIS). Each `<Page>` is only a *starting* point,
 * not a page-count limit: react-pdf packs each chapter's actual content
 * across as many physical pages as it needs, so a short section never
 * strands its neighbour on an almost-empty page just because of a hard
 * break — the boundaries below exist for narrative reasons, not layout
 * ones. Website Intelligence and the closing Growth Diagnosis share one
 * chapter so the diagnosis picks up wherever the website findings end,
 * rather than always forcing a fresh page regardless of how much room
 * is left.
 *
 * `theme` is the only thing that changes between Light and Dark — same
 * components, same content, same page structure either way. `t` (theme +
 * its derived styles) is computed once here and passed down as a plain prop
 * — see `render-context.ts` for why this isn't React Context.
 */
export function GrowthReportDocument({
  analysis,
  theme = LIGHT_THEME,
}: {
  analysis: AnalysisResult;
  theme?: ReportTheme;
}) {
  const { productIntelligence, websiteIntelligence, growthIntelligence } = analysis;
  const generatedOn = new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date());
  const websiteUrl = websiteIntelligence?.url ?? null;
  const t = createRenderContext(theme);

  return (
    <Document
      title={`Growwwly Growth Intelligence Report — ${productIntelligence.product.name}`}
      author="Growwwly"
      creator="Growwwly"
      producer="Growwwly"
    >
      {/* Chapter 1 — What should I do? */}
      <ThemedPage t={t}>
        <CoverHeader
          t={t}
          productName={productIntelligence.product.name}
          websiteUrl={websiteUrl}
          generatedOn={generatedOn}
        />
        <ExecutiveSummary t={t} productIntelligence={productIntelligence} />
        <GrowthSnapshot t={t} productIntelligence={productIntelligence} growthIntelligence={growthIntelligence} />
        <HighestLeverageActionPanel t={t} growthIntelligence={growthIntelligence} />
      </ThemedPage>

      {/* Chapter 2 — Why does Growwwly think this, and where are the
          opportunities? Product Intelligence and Growth Opportunities share
          one flow so neither one's overflow stalls a page half-empty. */}
      <ThemedPage t={t}>
        <ProductIntelligenceSection t={t} productIntelligence={productIntelligence} />
        <View style={t.styles.section}>
          <GrowthOpportunitiesSection t={t} growthIntelligence={growthIntelligence} />
        </View>
      </ThemedPage>

      {/* Chapter 3 — Is the website ready, and what's the diagnosis? Ends
          on the same decision the report opened with, then closes on a
          subtle Growwwly brand signature in the page's own whitespace. */}
      <ThemedPage t={t} brand>
        {websiteIntelligence === null ? (
          <NoWebsiteSection t={t} />
        ) : websiteIntelligence.status === "unavailable" ? (
          <WebsiteUnavailableSection t={t} website={websiteIntelligence} />
        ) : (
          <WebsiteIntelligenceSection t={t} website={websiteIntelligence} />
        )}
        <View style={t.styles.section}>
          <GrowthDiagnosisHeader t={t} growthIntelligence={growthIntelligence} />
        </View>
        <StrengthsWeaknessesSection t={t} website={websiteIntelligence} />
        <NextMoveSection t={t} growthIntelligence={growthIntelligence} />
      </ThemedPage>
    </Document>
  );
}
