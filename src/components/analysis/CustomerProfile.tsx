import * as React from "react"
import { ProductIntelligence } from "@/lib/ai/schemas/product-analysis"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

interface CustomerProfileProps {
  data: ProductIntelligence["customer"]
}

export function CustomerProfile({ data }: CustomerProfileProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Customer Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-sm text-zinc-500 mb-1">Primary Customer</h4>
            <p className="text-sm font-medium">{data.primaryCustomer}</p>
          </div>
          <div>
            <h4 className="font-medium text-sm text-zinc-500 mb-1">Buyer vs User</h4>
            <p className="text-sm">
              Buyer: <span className="font-medium">{data.buyer}</span> <br />
              User: <span className="font-medium">{data.user}</span>
            </p>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-medium text-sm text-zinc-500 mb-2">Ideal Customer Profile (ICP)</h4>
          <p className="text-sm italic border-l-2 border-zinc-300 pl-3 dark:border-zinc-700">
            &quot;{data.idealCustomerProfile}&quot;
          </p>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-sm text-zinc-500 mb-2">Pain Points</h4>
            <ul className="list-disc list-inside text-sm space-y-1">
              {data.painPoints.map((pain, idx) => (
                <li key={idx}>{pain}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-sm text-zinc-500 mb-2">Jobs to be Done (JTBD)</h4>
            <ul className="list-disc list-inside text-sm space-y-1">
              {data.jobsToBeDone.map((job, idx) => (
                <li key={idx}>{job}</li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
