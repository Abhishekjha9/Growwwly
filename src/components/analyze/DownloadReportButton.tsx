/**
 * Triggers a server-rendered PDF export of the *existing* analysis result —
 * no new Gemini call, no re-scoring. Clicking opens a Light/Dark theme
 * picker (`DownloadReportModal`); the chosen theme only ever changes the
 * PDF's visual tokens (`@/lib/report/theme`), never the analysis it renders.
 * See `@/lib/report` and `/api/generate-report`.
 */

'use client'

import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/primitives'
import { DownloadReportModal } from '@/components/analyze/DownloadReportModal'
import { generateGrowthReportPdf, GenerateReportError } from '@/lib/api/generate-report'
import { cn } from '@/lib/cn'
import type { AnalysisResult } from '@/types/analysis'
import type { ReportThemeName } from '@/lib/report/theme'

type Status = 'idle' | 'loading' | 'error'

function DownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2.4 V10.4 M4.6 7.4 L8 10.8 L11.4 7.4" />
      <path d="M2.6 13.2 H13.4" />
    </svg>
  )
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the browser a moment to start the download before the URL is freed.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function DownloadReportButton({
  analysis,
  size = 'lg',
  className,
}: {
  analysis: AnalysisResult
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [theme, setTheme] = useState<ReportThemeName>('light')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  // Belt-and-suspenders against a double-click racing two requests — the
  // disabled state alone already prevents this in practice.
  const inFlight = useRef(false)

  const openModal = useCallback(() => {
    setError('')
    setStatus('idle')
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    if (inFlight.current) return
    setModalOpen(false)
  }, [])

  const handleConfirm = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setStatus('loading')
    setError('')
    try {
      const { blob, filename } = await generateGrowthReportPdf(analysis, theme)
      triggerDownload(blob, filename)
      setStatus('idle')
      setModalOpen(false)
    } catch (err) {
      setStatus('error')
      setError(
        err instanceof GenerateReportError ? err.message : 'Something went wrong. Please try again.'
      )
    } finally {
      inFlight.current = false
    }
  }, [analysis, theme])

  return (
    <div className={className}>
      <Button
        type="button"
        variant="secondary"
        size={size}
        icon={<DownloadIcon />}
        onClick={openModal}
      >
        Download Growth Report
      </Button>

      {status === 'error' && !modalOpen && (
        <p role="alert" className={cn('t-meta mt-2.5 max-w-[46ch] text-negative')}>
          {error}
        </p>
      )}

      <DownloadReportModal
        open={modalOpen}
        selectedTheme={theme}
        onSelectTheme={setTheme}
        onCancel={closeModal}
        onConfirm={handleConfirm}
        isGenerating={status === 'loading'}
        errorMessage={status === 'error' ? error : ''}
      />
    </div>
  )
}
