import * as React from "react"
import { ProductIntelligence } from "@/lib/ai/schemas/product-analysis"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface ProductOverviewProps {
  data: ProductIntelligence["product"]
}

export function ProductOverview({ data }: ProductOverviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center justify-between">
          <span>Product Overview</span>
          <Badge variant="outline">{data.category}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-medium text-sm text-zinc-500 mb-1">Description</h4>
          <p className="text-sm">{data.description}</p>
        </div>
        <div>
          <h4 className="font-medium text-sm text-zinc-500 mb-1">Primary Use Case</h4>
          <p className="text-sm font-medium">{data.primaryUseCase}</p>
        </div>
        {data.secondaryUseCases.length > 0 && (
          <div>
            <h4 className="font-medium text-sm text-zinc-500 mb-2">Secondary Use Cases</h4>
            <ul className="list-disc list-inside text-sm space-y-1">
              {data.secondaryUseCases.map((useCase, idx) => (
                <li key={idx}>{useCase}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
