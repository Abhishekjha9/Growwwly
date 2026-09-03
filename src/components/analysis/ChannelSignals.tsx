import * as React from "react"
import { ProductIntelligence } from "@/lib/ai/schemas/product-analysis"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface ChannelSignalsProps {
  data: ProductIntelligence["channelSignals"]
}

export function ChannelSignals({ data }: ChannelSignalsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Channel Signals</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.entries(data).map(([key, channelData]) => (
            <div key={key} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-zinc-500 uppercase font-semibold">AI Signal</span>
                  <span className="font-bold text-lg">{channelData.relevance}/100</span>
                </div>
              </div>
              <Progress value={channelData.relevance} className="h-1.5" />
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {channelData.reasoning}
              </p>

            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
