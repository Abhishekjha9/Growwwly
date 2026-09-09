import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type FieldTone = 'surface' | 'burgundy'

function getBoxStyles(tone: FieldTone = 'surface') {
  const base =
    'w-full rounded-md border px-4 text-[15px] tracking-[-0.012em] ' +
    'outline-none transition-colors duration-[180ms]'

  if (tone === 'burgundy') {
    return cn(
      base,
      'bg-accent-hover border-accent-line/30 text-canvas',
      'placeholder:text-ghost focus-within:border-accent-line'
    )
  }

  return cn(
    base,
    'bg-surface border-hairline text-ink',
    'placeholder:text-ghost focus-within:border-hairline-strong'
  )
}

export function TextField({
  label,
  hint,
  className,
  tone = 'surface',
  labelClassName,
  ...rest
}: { label: string; hint?: string; tone?: FieldTone; labelClassName?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className={cn('t-meta mb-2 block', labelClassName || 'text-muted')}>{label}</span>
      <input {...rest} className={cn(getBoxStyles(tone), 'h-12', className)} />
      {hint && <span className={cn('t-meta mt-1.5 block', labelClassName || 'text-faint')}>{hint}</span>}
    </label>
  )
}

export function TextAreaField({
  label,
  hint,
  className,
  tone = 'surface',
  labelClassName,
  ...rest
}: { label: string; hint?: string; tone?: FieldTone; labelClassName?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      <span className={cn('t-meta mb-2 block', labelClassName || 'text-muted')}>{label}</span>
      <textarea {...rest} className={cn(getBoxStyles(tone), 'min-h-[120px] resize-y py-3', className)} />
      {hint && <span className={cn('t-meta mt-1.5 block', labelClassName || 'text-faint')}>{hint}</span>}
    </label>
  )
}
