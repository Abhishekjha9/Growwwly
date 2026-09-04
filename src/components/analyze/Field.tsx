import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const BOX =
  'w-full rounded-md border border-hairline bg-surface px-4 text-[15px] tracking-[-0.012em] text-ink ' +
  'outline-none transition-colors duration-[180ms] placeholder:text-ghost focus-within:border-hairline-strong'

export function TextField({
  label,
  hint,
  className,
  ...rest
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="t-meta mb-2 block text-muted">{label}</span>
      <input {...rest} className={cn(BOX, 'h-12', className)} />
      {hint && <span className="t-meta mt-1.5 block text-faint">{hint}</span>}
    </label>
  )
}

export function TextAreaField({
  label,
  hint,
  className,
  ...rest
}: { label: string; hint?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      <span className="t-meta mb-2 block text-muted">{label}</span>
      <textarea {...rest} className={cn(BOX, 'min-h-[120px] resize-y py-3', className)} />
      {hint && <span className="t-meta mt-1.5 block text-faint">{hint}</span>}
    </label>
  )
}
