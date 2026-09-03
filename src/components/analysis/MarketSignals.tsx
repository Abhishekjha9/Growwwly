import * as React from "react"
import { ProductIntelligence } from "@/lib/ai/schemas/product-analysis"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface MarketSignalsProps {
  data: ProductIntelligence["marketSignals"]
}

export function MarketSignals({ data }: MarketSignalsProps) {
  const signals = [
    { label: "Search Intent", value: data.searchIntent },
    { label: "Community Presence", value: data.communityPresence },
    { label: "Visual Content Potential", value: data.visualContentPotential },
    { label: "Word of Mouth Potential", value: data.wordOfMouthPotential },
    { label: "Buyer Accessibility", value: data.buyerAccessibility },
    { label: "Market Maturity", value: data.marketMaturity },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Market Signals</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {signals.map((signal, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{signal.label}</span>
                <span className="font-bold">{signal.value}/100</span>
              </div>
              <Progress value={signal.value} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
