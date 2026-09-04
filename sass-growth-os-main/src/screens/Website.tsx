/**
 * Website — the audit, drawn on the page it is about.
 *
 * The preview is an abstraction of the real page, not a screenshot: enough
 * structure to recognise where you are, no more. Findings are annotated the
 * way an art director annotates a proof — a hairline out of the artwork into
 * the margin, and a short sentence there.
 *
 * The attention layer is a prediction and is labelled as one, every time it
 * is on screen. It is the one place in this product where we draw something
 * we did not measure, so it never gets to look like data.
 */

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Label, Pill, ProvenanceTag } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { DUR, EASE, calm, fade, rise, riseLg, stagger, useReducedMotion } from '@/lib/motion'
import { ATTENTION_REGIONS, AUDIT_FINDINGS, PROJECT, type AuditFinding, type Severity } from '@/data/growth'

/* ------------------------------------------------------------------
   Severity — a word and a mark, never a coloured card
   ------------------------------------------------------------------ */

const SEVERITY_COPY: Record<Severity, string> = {
  critical: 'Costing you conversions',
  warning: 'Worth fixing',
  note: 'Checked, no action',
}

function SeverityMark({ severity }: { severity: Severity }) {
  if (severity === 'note') {
    return <span aria-hidden className="inline-block h-[7px] w-[7px] shrink-0 rounded-full border border-ghost" />
  }
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block h-[7px] w-[7px] shrink-0 rounded-full',
        // Blue is the colour of the answer everywhere else in the product.
        // Spending it on the problems made the audit mark faults in exactly
        // the same ink as the recommendation that fixes them.
        severity === 'critical' ? 'bg-negative' : 'bg-warning'
      )}
    />
  )
}

/* ------------------------------------------------------------------
   The page abstraction
   ------------------------------------------------------------------ */

/** A block of "content". Grey where it is fine, hairline where it is not. */
function Bar({ w, h = 7, className }: { w: string; h?: number; className?: string }) {
  return (
    <div
      className={cn('rounded-full bg-[rgba(17,17,17,0.07)]', className)}
      style={{ width: w, height: h }}
    />
  )
}

function PagePreview({ active }: { active: string | null }) {
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden rounded-[18px] bg-surface">
      {/* Navigation — the one section that reads well. */}
      <div
        className={cn(
          'flex items-center gap-2 border-b border-hairline px-4 py-3 transition-opacity duration-300',
          active && active !== 'nav' && 'opacity-40'
        )}
      >
        <div className="h-[9px] w-[9px] rounded-[3px] bg-ink" />
        <div className="ml-2 flex gap-2.5">
          {[16, 20, 14, 18].map((w, i) => (
            <Bar key={i} w={`${w}px`} h={4} />
          ))}
        </div>
        <div className="ml-auto h-[13px] w-[34px] rounded-full bg-[rgba(17,17,17,0.12)]" />
      </div>

      {/* Hero */}
      <div
        className={cn(
          'flex flex-col items-center gap-2.5 px-6 pb-7 pt-9 transition-opacity duration-300',
          active && active !== 'hero' && 'opacity-40'
        )}
      >
        <Bar w="72%" h={11} className="bg-[rgba(17,17,17,0.16)]" />
        <Bar w="54%" h={11} className="bg-[rgba(17,17,17,0.16)]" />
        <div className="mt-1.5 flex flex-col items-center gap-1.5">
          <Bar w="180px" h={5} />
          <Bar w="140px" h={5} />
        </div>
      </div>

      {/* Two actions of identical weight — the finding, made visible. */}
      <div
        className={cn(
          'flex items-center justify-center gap-2.5 pb-10 transition-opacity duration-300',
          active && active !== 'cta' && 'opacity-40'
        )}
      >
        <div className="h-[19px] w-[74px] rounded-[7px] bg-[rgba(17,17,17,0.14)]" />
        <div className="h-[19px] w-[74px] rounded-[7px] bg-[rgba(17,17,17,0.13)]" />
      </div>

      {/* Body */}
      <div className="flex flex-col items-center gap-2 border-t border-hairline px-8 py-8">
        <Bar w="86%" h={5} />
        <Bar w="78%" h={5} />
        <Bar w="82%" h={5} />
      </div>

      {/* Social proof — arrives here, which is the problem. */}
      <div
        className={cn(
          'flex items-center justify-center gap-4 border-t border-hairline py-7 transition-opacity duration-300',
          active && active !== 'proof' && 'opacity-40'
        )}
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[13px] w-[30px] rounded-[4px] bg-[rgba(17,17,17,0.08)]" />
        ))}
      </div>

      {/* Pricing — three columns of near-identical rows. */}
      <div
        className={cn(
          'flex flex-1 justify-center gap-3 border-t border-hairline px-6 py-7 transition-opacity duration-300',
          active && active !== 'pricing' && 'opacity-40'
        )}
      >
        {[0, 1, 2].map((c) => (
          <div key={c} className="flex flex-1 flex-col items-center gap-1.5 rounded-[9px] border border-hairline px-2 py-3">
            <Bar w="60%" h={6} />
            <div className="mt-1.5 flex w-full flex-col items-center gap-1">
              {[0, 1, 2, 3].map((r) => (
                <Bar key={r} w="72%" h={3} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Predicted, not observed. Soft accent fields, never a heat-map rainbow. */
function AttentionLayer({ on }: { on: boolean }) {
  const reduced = useReducedMotion()
  return (
    <AnimatePresence>
      {on && (
        <motion.div
          key="attention"
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : DUR.standardSlow, ease: EASE.out }}
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px]"
        >
          {ATTENTION_REGIONS.map((r, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${r.x}%`,
                top: `${r.y}%`,
                width: `${r.r * 2}%`,
                height: `${r.r * 2}%`,
                transform: 'translate(-50%, -50%)',
                background: `radial-gradient(circle, rgba(79,107,255,${0.3 * r.intensity}) 0%, rgba(79,107,255,0) 70%)`,
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ------------------------------------------------------------------
   Annotation layer — hairlines from the artwork into the margin
   ------------------------------------------------------------------ */

function Annotations({
  active,
  onHover,
}: {
  active: string | null
  onHover: (id: string | null) => void
}) {
  const reduced = useReducedMotion()

  return (
    <div className="pointer-events-none absolute inset-0 hidden lg:block">
      {AUDIT_FINDINGS.map((f, i) => {
        const left = f.side === 'left'
        const on = active === f.id
        const dim = active !== null && !on

        return (
          <div
            key={f.id}
            className={cn(
              'absolute inset-x-0 transition-opacity duration-300',
              dim ? 'opacity-25' : 'opacity-100'
            )}
            style={{ top: `${f.anchor.y}%` }}
          >
            {/* The line out of the page. */}
            <motion.div
              aria-hidden
              className={cn(
                'absolute h-px -translate-y-1/2',
                on ? 'bg-accent' : 'bg-hairline-strong',
                left ? 'left-[23%] right-1/2 origin-right' : 'left-1/2 right-[23%] origin-left'
              )}
              initial={reduced ? { scaleX: 1 } : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: reduced ? 0 : 0.55, ease: EASE.out, delay: reduced ? 0 : 0.35 + i * 0.08 }}
            />

            {/* The point it refers to. */}
            <motion.span
              aria-hidden
              className={cn(
                'absolute left-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface transition-colors duration-200',
                on ? 'bg-accent' : 'bg-ink'
              )}
              initial={reduced ? { scale: 1 } : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: reduced ? 0 : 0.4, ease: EASE.out, delay: reduced ? 0 : 0.3 + i * 0.08 }}
            />

            {/* The note in the margin. */}
            <motion.button
              onMouseEnter={() => onHover(f.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(f.id)}
              onBlur={() => onHover(null)}
              className={cn(
                'pointer-events-auto absolute w-[21%] -translate-y-1/2 rounded-[10px] px-1 py-1',
                left ? 'left-0 text-right' : 'right-0 text-left'
              )}
              initial={reduced ? { opacity: 1 } : { opacity: 0, x: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduced ? 0 : 0.4, ease: EASE.out, delay: reduced ? 0 : 0.5 + i * 0.08 }}
            >
              <span
                className={cn(
                  'flex items-center gap-2',
                  left ? 'justify-end' : 'justify-start'
                )}
              >
                {left && <span className="t-label text-faint">{f.target}</span>}
                <SeverityMark severity={f.severity} />
                {!left && <span className="t-label text-faint">{f.target}</span>}
              </span>
              <span
                className={cn(
                  'mt-1.5 block text-[13px] leading-[1.4] transition-colors duration-200',
                  on ? 'text-ink' : 'text-muted'
                )}
              >
                {f.headline}
              </span>
            </motion.button>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------
   Finding — the written half of each annotation
   ------------------------------------------------------------------ */

function Finding({
  finding,
  index,
  active,
  onHover,
}: {
  finding: AuditFinding
  index: number
  active: string | null
  onHover: (id: string | null) => void
}) {
  const on = active === finding.id

  return (
    <div
      onMouseEnter={() => onHover(finding.id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        'grid grid-cols-1 gap-x-10 gap-y-4 border-t border-hairline py-9 transition-colors duration-300 md:grid-cols-[13rem_1fr]',
        on && 'bg-[rgba(79,107,255,0.028)]'
      )}
    >
      <div>
        <div className="flex items-center gap-2.5">
          <span className="t-meta tnum text-ghost">{String(index + 1).padStart(2, '0')}</span>
          <SeverityMark severity={finding.severity} />
          <span className="t-h3">{finding.target}</span>
        </div>
        <p className="t-meta mt-2 pl-[1.85rem]">{SEVERITY_COPY[finding.severity]}</p>
      </div>

      <div className="md:pt-0.5">
        <h3 className="t-h3">{finding.headline}</h3>
        <p className="t-body mt-2.5 max-w-[68ch]">{finding.detail}</p>

        <ul className="mt-5 list-none p-0">
          {finding.evidence.map((e) => (
            <li key={e} className="t-body flex gap-3 py-1 text-muted">
              <span aria-hidden className="mt-[0.62em] h-px w-3 shrink-0 bg-hairline-strong" />
              <span className="max-w-[62ch]">{e}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <Label tone="accent">Fix</Label>
          <p className="t-body max-w-[62ch] text-ink">{finding.fix}</p>
        </div>

        <ProvenanceTag kind={finding.provenance} className="mt-5" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------
   Screen
   ------------------------------------------------------------------ */

export default function Website() {
  const reduced = useReducedMotion()
  const [attention, setAttention] = useState(false)
  const [active, setActive] = useState<string | null>(null)

  const page = reduced ? fade : stagger(0.07, 0.04)
  const block = calm(rise, reduced)
  const lead = calm(riseLg, reduced)

  const critical = AUDIT_FINDINGS.filter((f) => f.severity === 'critical').length

  return (
    <motion.div variants={page} initial="hidden" animate="show">
      <motion.header variants={lead}>
        <Label>Website audit</Label>
        {/* Not "above the fold": the critical finding underneath this
            sentence is that the CTA sits 640px down and is *below* the fold
            on a laptop. The headline was contradicting the evidence it
            introduces, on the one screen whose job is to be believed about
            what it saw. */}
        <h1 className="t-h1 mt-4 max-w-[24ch]">
          Two things on the path to signup are costing you conversions.
        </h1>
        <p className="t-body-lg mt-5 max-w-[62ch] text-muted">
          {AUDIT_FINDINGS.length} findings on {PROJECT.fullUrl} — {critical} of them on the primary
          conversion path.
        </p>
      </motion.header>

      {/* The artwork, annotated. */}
      <motion.section variants={block} className="mt-16 lg:mt-20">
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <Pill active={!attention} onClick={() => setAttention(false)}>
            Findings
          </Pill>
          <Pill active={attention} onClick={() => setAttention(true)}>
            Predicted attention
          </Pill>
          <AnimatePresence initial={false}>
            {attention && (
              <motion.p
                initial={{ opacity: 0, x: reduced ? 0 : -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.28, ease: EASE.out }}
                className="t-meta ml-1"
              >
                Modelled from layout and contrast. Not observed behaviour.
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="relative mx-auto w-full max-w-[900px]">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[430px]">
            <div className="absolute inset-0 rounded-[18px] shadow-soft" />
            <PagePreview active={attention ? null : active} />
            <AttentionLayer on={attention} />
          </div>

          {!attention && <Annotations active={active} onHover={setActive} />}
        </div>
      </motion.section>

      {/* The written findings. */}
      <motion.section variants={block} className="mt-20 lg:mt-28">
        <Label>Findings</Label>
        <div className="mt-6">
          {AUDIT_FINDINGS.map((f, i) => (
            <Finding key={f.id} finding={f} index={i} active={active} onHover={setActive} />
          ))}
        </div>
      </motion.section>
    </motion.div>
  )
}
