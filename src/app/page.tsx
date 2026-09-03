"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ProductAnalysisRequest, ProductIntelligence } from "@/lib/ai/schemas/product-analysis"
import { ProductAnalysisForm } from "@/components/forms/ProductAnalysisForm"
import { ProductOverview } from "@/components/analysis/ProductOverview"
import { CustomerProfile } from "@/components/analysis/CustomerProfile"
import { ProblemSignals } from "@/components/analysis/ProblemSignals"
import { MarketSignals } from "@/components/analysis/MarketSignals"
import { ProductFitSignals } from "@/components/analysis/ProductFitSignals"
import { ChannelSignals } from "@/components/analysis/ChannelSignals"
import { GrowthContext } from "@/components/analysis/GrowthContext"
import { ConfidenceCard } from "@/components/analysis/ConfidenceCard"

const LOADING_MESSAGES = [
  "Analyzing your product...",
  "Identifying your customers...",
  "Mapping potential growth channels...",
  "Evaluating market signals...",
  "Generating product intelligence profile..."
]

export default function Home() {
  const [loading, setLoading] = useState(false)
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ProductIntelligence | null>(null)

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (loading) {
      interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
      }, 3000)
    }
    return () => clearInterval(interval)
  }, [loading])

  const handleAnalyze = async (data: ProductAnalysisRequest) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setLoadingMessageIndex(0)

    try {
      const response = await fetch("/api/analyze-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const resData = await response.json()

      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "Failed to analyze product")
      }

      setResult(resData.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans p-6 md:p-12">
      <main className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4 py-8">
          <h1 className="text-4xl font-bold tracking-tight">Growwwly Product Intelligence</h1>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto text-lg">
            Understand your SaaS, map your ideal customers, and discover AI-generated growth signals.
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 p-4 rounded-md text-center max-w-2xl mx-auto">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Form State */}
          {!result && !loading && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <ProductAnalysisForm onSubmit={handleAnalyze} isLoading={false} />
            </motion.div>
          )}

          {/* Loading State */}
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-24 space-y-8"
            >
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-zinc-200 dark:border-zinc-800 rounded-full" />
                <div className="absolute inset-0 border-4 border-zinc-900 dark:border-zinc-100 rounded-full border-t-transparent dark:border-t-transparent animate-spin" />
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={loadingMessageIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-lg font-medium text-zinc-600 dark:text-zinc-400"
                >
                  {LOADING_MESSAGES[loadingMessageIndex]}
                </motion.p>
              </AnimatePresence>
            </motion.div>
          )}

          {/* Results State */}
          {result && !loading && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Product Intelligence Profile</h2>
                <button 
                  onClick={() => setResult(null)}
                  className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Analyze Another Product
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <ProductOverview data={result.product} />
                  <CustomerProfile data={result.customer} />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ProblemSignals data={result.problem} />
                    <GrowthContext data={result.growthContext} />
                  </div>
                  
                  <MarketSignals data={result.marketSignals} />
                  <ProductFitSignals data={result.productFitSignals} />
                </div>
                
                <div className="lg:col-span-1 space-y-6">
                  <ConfidenceCard 
                    score={result.confidence.overall} 
                    reasoning={result.confidence.reasoning} 
                  />
                  <ChannelSignals data={result.channelSignals} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
