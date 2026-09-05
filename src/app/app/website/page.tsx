/**
 * Website — what Growwwly actually found by inspecting the live site.
 *
 * Every number on this page is either "measured" (Cheerio facts, Lighthouse
 * scores) or an "AI signal" (Gemini's interpretation of screenshots and
 * evidence) — never blended, and never presented as real user behavior or
 * funnel data. See `@/lib/website/types.ts`.
 */

'use client'

import { EmptyState } from '@/components/EmptyState'
import { Label, ProvenanceTag, Reveal, SignalBar, StatusDot } from '@/components/primitives'
import { SignalRow } from '@/components/analyze/SignalRow'
import { useAnalysis } from '@/lib/analysis-store'
import { CHANNEL_LABELS } from '@/lib/growth/constants'
import type { WebsiteIntelligence } from '@/types/website'

const BOTTLENECK_COPY: Record<string, string> = {
  acquisition: 'Acquisition is the current bottleneck',
  positioning: 'Positioning is the current bottleneck',
  conversion: 'Conversion readiness is the current bottleneck',
  technical: 'Technical health is the current bottleneck',
  unknown: 'No single bottleneck stands out',
}

function HealthStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="tnum t-h2 text-ink">{value ?? '—'}</div>
      <Label className="mt-2">{label}</Label>
    </div>
  )
}

function Screenshot({
  label,
  captured,
  dataUrl,
}: {
  label: string
  captured: boolean
  dataUrl: string | null
}) {
  return (
    <div>
      <Label className="mb-3">{label}</Label>
      {captured && dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a base64 data URI, not an optimizable remote asset
        <img
          src={dataUrl}
          alt={`${label} screenshot`}
          className="w-full rounded-[14px] border border-hairline"
        />
      ) : (
        <div className="flex aspect-[9/12] items-center justify-center rounded-[14px] border border-dashed border-hairline-strong">
          <p className="t-meta text-faint">Capture failed</p>
        </div>
      )}
    </div>
  )
}

function WebsiteUnavailable({ website }: { website: WebsiteIntelligence }) {
  return (
    <div className="border-t border-hairline pt-10">
      <Label tone="accent">Website inspection</Label>
      <h1 className="t-h1 mt-4">This site couldn&apos;t be inspected.</h1>
      <p className="t-body mt-3 max-w-[60ch]">
        {website.error ?? 'The website could not be reached.'} Product and growth intelligence
        above are unaffected — they were generated from what you told us.
      </p>
    </div>
  )
}

export default function WebsitePage() {
  const { result } = useAnalysis()
  if (!result) return <EmptyState />

  const { websiteIntelligence, growthIntelligence } = result

  if (!websiteIntelligence) {
    return (
      <EmptyState
        title="No website analyzed"
        body="Add a website URL on your next analysis to see technical health, conversion readiness, and real screenshots here."
      />
    )
  }

  if (websiteIntelligence.status === 'unavailable') {
    return <WebsiteUnavailable website={websiteIntelligence} />
  }

  const { seo, performance, visual, interpretation } = websiteIntelligence
  const { bottleneck } = growthIntelligence

  return (
    <div className="max-w-[880px] pb-4">
      <Reveal>
        <header className="mb-14 lg:mb-20">
          <Label className="mb-4">Website</Label>
          <h1 className="t-h1">{websiteIntelligence.crawl.finalUrl ?? websiteIntelligence.url}</h1>
          <p className="t-body mt-5 max-w-[64ch]">
            Growwwly fetched this page, rendered it in a real browser, and had Gemini interpret
            the result. Measured facts and AI interpretation are kept separate throughout.
          </p>
          {websiteIntelligence.status === 'partial' && (
            <p className="t-meta mt-4 max-w-[64ch] text-faint">
              {websiteIntelligence.error ?? 'Part of this inspection was unavailable.'}
            </p>
          )}
        </header>
      </Reveal>

      {bottleneck.type !== 'unknown' && (
        <Reveal>
          <section className="mb-16 rounded-2xl bg-surface px-6 py-9 shadow-soft sm:px-10 sm:py-11 lg:mb-24">
            <Label tone="accent">{BOTTLENECK_COPY[bottleneck.type]}</Label>
            <p className="t-body-lg mt-4 max-w-[62ch] text-ink-2">{bottleneck.reason}</p>
          </section>
        </Reveal>
      )}

      <Reveal>
        <section aria-labelledby="sec-health">
          <h2 id="sec-health" className="t-label mb-1">
            Website health
          </h2>
          <p className="t-meta mb-6 max-w-[58ch]">Lighthouse — measured, not interpreted.</p>

          {performance.status === 'measured' ? (
            <>
              <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-t border-hairline py-7 sm:grid-cols-4">
                <HealthStat label="Performance" value={performance.performance} />
                <HealthStat label="Accessibility" value={performance.accessibility} />
                <HealthStat label="Best practices" value={performance.bestPractices} />
                <HealthStat label="SEO" value={performance.seo} />
              </div>
              <ProvenanceTag kind="measured" />
            </>
          ) : (
            <p className="t-body border-t border-hairline py-7 text-muted">
              Technical audit unavailable — {performance.reason ?? 'no reason given'}.
            </p>
          )}

          {seo && (
            <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-4 border-t border-hairline pt-7 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <StatusDot status={seo.title ? 'pass' : 'fail'} />
                <span className="t-body">{seo.title ? 'Has a page title' : 'Missing page title'}</span>
              </div>
              <div className="flex items-center gap-3">
                <StatusDot status={seo.metaDescription ? 'pass' : 'fail'} />
                <span className="t-body">
                  {seo.metaDescription ? 'Has a meta description' : 'Missing meta description'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <StatusDot status={seo.h1Count === 1 ? 'pass' : seo.h1Count === 0 ? 'fail' : 'warn'} />
                <span className="t-body">{seo.h1Count} H1 heading{seo.h1Count === 1 ? '' : 's'}</span>
              </div>
              <div className="flex items-center gap-3">
                <StatusDot status={seo.images.missingAlt === 0 ? 'pass' : 'warn'} />
                <span className="t-body">
                  {seo.images.missingAlt} of {seo.images.total} images missing alt text
                </span>
              </div>
              <div className="flex items-center gap-3">
                <StatusDot status={seo.structuredData.present ? 'pass' : 'warn'} />
                <span className="t-body">
                  {seo.structuredData.present ? 'Structured data present' : 'No structured data found'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <StatusDot status={seo.socialMeta.openGraphPresent ? 'pass' : 'warn'} />
                <span className="t-body">
                  {seo.socialMeta.openGraphPresent ? 'Open Graph tags present' : 'No Open Graph tags'}
                </span>
              </div>
            </div>
          )}
        </section>
      </Reveal>

      {interpretation && (
        <>
          <Reveal className="mt-16 lg:mt-24">
            <section aria-labelledby="sec-conversion">
              <h2 id="sec-conversion" className="t-label mb-1">
                Website conversion
              </h2>
              <p className="t-meta mb-6 max-w-[58ch]">
                AI-interpreted readiness signals — the model&apos;s reading of the screenshots and
                page evidence, not a measured conversion rate.
              </p>
              <div>
                <SignalRow label="Value proposition clarity" value={interpretation.conversion.valuePropositionClarity} first />
                <SignalRow label="CTA prominence" value={interpretation.conversion.ctaProminence} />
                <SignalRow label="Trust signal strength" value={interpretation.conversion.trustSignalStrength} />
                <SignalRow label="Social proof strength" value={interpretation.conversion.socialProofStrength} />
                <SignalRow label="Pricing visibility" value={interpretation.conversion.pricingVisibility} />
                <SignalRow label="Signup ease" value={100 - interpretation.conversion.signupFriction} />
              </div>
              <p className="t-body mt-2 max-w-[64ch] text-muted">{interpretation.conversion.summary}</p>
            </section>
          </Reveal>

          <Reveal className="mt-16 lg:mt-24">
            <section aria-labelledby="sec-experience">
              <h2 id="sec-experience" className="t-label mb-6">
                Website experience
              </h2>
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <Screenshot label="Desktop" captured={visual.desktop.captured} dataUrl={visual.desktop.screenshotDataUrl} />
                <Screenshot label="Mobile" captured={visual.mobile.captured} dataUrl={visual.mobile.screenshotDataUrl} />
              </div>

              <div className="mt-8 border-t border-hairline pt-7">
                <Label>Visual hierarchy</Label>
                <p className="t-body mt-3 max-w-[64ch]">{interpretation.visualHierarchy.summary}</p>
                <p className="t-meta mt-3 max-w-[64ch] italic text-faint">
                  {interpretation.visualHierarchy.attentionSummary}
                </p>
                <SignalBar value={interpretation.visualHierarchy.hierarchyClarity} tone="accent" className="mt-4" />
              </div>

              {interpretation.mobile.layoutIssues.length > 0 && (
                <div className="mt-7 border-t border-hairline pt-7">
                  <Label>Mobile issues</Label>
                  <ul className="mt-3 space-y-2">
                    {interpretation.mobile.layoutIssues.map((issue) => (
                      <li key={issue} className="t-body flex gap-2.5 text-ink-2">
                        <span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ghost" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </Reveal>

          <Reveal className="mt-16 lg:mt-24">
            <section aria-labelledby="sec-implications">
              <h2 id="sec-implications" className="t-label mb-6">
                Growth implications
              </h2>
              <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
                <div>
                  <Label tone="accent" className="mb-3">Strengths</Label>
                  <ul className="space-y-2.5">
                    {interpretation.strengths.map((s) => (
                      <li key={s} className="t-body text-ink-2">{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <Label className="mb-3">Weaknesses</Label>
                  <ul className="space-y-2.5">
                    {interpretation.weaknesses.map((w) => (
                      <li key={w} className="t-body text-ink-2">{w}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <Label className="mb-3">Opportunities</Label>
                  <ul className="space-y-2.5">
                    {interpretation.opportunities.map((o) => (
                      <li key={o} className="t-body text-ink-2">{o}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {growthIntelligence.highestLeverageAction.channel === null && (
                <p className="t-meta mt-8 border-t border-hairline pt-6">
                  This is currently the highest-leverage focus — see Overview. Once resolved, the
                  next step would likely be {CHANNEL_LABELS[growthIntelligence.rankedChannels[0].channel]}.
                </p>
              )}
            </section>
          </Reveal>
        </>
      )}
    </div>
  )
}
