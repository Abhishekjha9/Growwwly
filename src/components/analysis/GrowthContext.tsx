import * as React from "react"
import { ProductIntelligence } from "@/lib/ai/schemas/product-analysis"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface GrowthContextProps {
  data: ProductIntelligence["growthContext"]
}

export function GrowthContext({ data }: GrowthContextProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Growth Context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-sm text-zinc-500 mb-2">Current Stage</h4>
            <Badge variant="secondary" className="capitalize">{data.currentStage}</Badge>
          </div>
          <div>
            <h4 className="font-medium text-sm text-zinc-500 mb-2">Likely Acquisition Motion</h4>
            <Badge variant="secondary" className="capitalize">{data.likelyAcquisitionMotion.replace("-", " ")}</Badge>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-sm text-zinc-500 mb-1">Expected Sales Cycle</h4>
            <p className="text-sm font-medium">{data.expectedSalesCycle}</p>
          </div>
          <div>
            <h4 className="font-medium text-sm text-zinc-500 mb-1">Estimated Customer Value</h4>
            <p className="text-sm font-medium">{data.estimatedCustomerValue}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
