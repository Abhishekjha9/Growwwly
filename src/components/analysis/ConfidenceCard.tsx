import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

interface ConfidenceCardProps {
  score: number
  reasoning: string
}

export function ConfidenceCard({ score, reasoning }: ConfidenceCardProps) {
  const getBadgeVariant = (s: number) => {
    if (s >= 80) return "default"
    if (s >= 50) return "secondary"
    return "destructive"
  }
  
  return (
    <Card className="bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">AI Confidence Score</CardTitle>
          <Badge variant={getBadgeVariant(score)}>{score}/100</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={score} className="h-2" />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {reasoning}
        </p>
      </CardContent>
    </Card>
  )
}
