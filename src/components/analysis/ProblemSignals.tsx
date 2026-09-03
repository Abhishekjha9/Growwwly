import * as React from "react"
import { ProductIntelligence } from "@/lib/ai/schemas/product-analysis"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface ProblemSignalsProps {
  data: ProductIntelligence["problem"]
}

export function ProblemSignals({ data }: ProblemSignalsProps) {
  const signals = [
    { label: "Pain Severity", value: data.painSeverity },
    { label: "Urgency", value: data.urgency },
    { label: "Frequency", value: data.frequency },
    { label: "Willingness to Pay", value: data.willingnessToPay },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Problem Signals</CardTitle>
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
