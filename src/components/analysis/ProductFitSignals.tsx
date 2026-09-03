import * as React from "react"
import { ProductIntelligence } from "@/lib/ai/schemas/product-analysis"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface ProductFitSignalsProps {
  data: ProductIntelligence["productFitSignals"]
}

export function ProductFitSignals({ data }: ProductFitSignalsProps) {
  const signals = [
    { label: "Technical Audience Fit", value: data.technicalAudienceFit },
    { label: "Visual Audience Fit", value: data.visualAudienceFit },
    { label: "Community Audience Fit", value: data.communityAudienceFit },
    { label: "Search-Driven Problem", value: data.searchDrivenProblem },
    { label: "Impulse Purchase Potential", value: data.impulsePurchasePotential },
    { label: "Sales-Led Potential", value: data.salesLedPotential },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Product Fit Signals</CardTitle>
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
