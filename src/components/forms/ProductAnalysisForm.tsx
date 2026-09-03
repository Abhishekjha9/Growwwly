"use client"

import * as React from "react"
import { useState } from "react"
import { ProductAnalysisRequest } from "@/lib/ai/schemas/product-analysis"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"

interface ProductAnalysisFormProps {
  onSubmit: (data: ProductAnalysisRequest) => void
  isLoading: boolean
}

export function ProductAnalysisForm({ onSubmit, isLoading }: ProductAnalysisFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>({
    name: "",
    description: "",
    url: "",
    targetCustomer: "",
    pricing: "",
    currentUsers: "",
    budget: "",
    marketingExperience: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    const newErrors: Record<string, string> = {}
    if (!formData.name) newErrors.name = "Product name is required"
    if (!formData.description) newErrors.description = "Description is required"

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // Clean data for API (handle empty strings -> undefined, cast numbers)
    const cleanedData: Record<string, any> = {}
    
    Object.entries(formData).forEach(([key, value]) => {
      if (value === "") {
        // omit empty values
        return
      }
      
      if (key === "currentUsers" && typeof value === "string") {
        const parsed = parseInt(value, 10)
        if (!isNaN(parsed)) {
          cleanedData[key] = parsed
        }
      } else {
        cleanedData[key] = value
      }
    })

    onSubmit(cleanedData as ProductAnalysisRequest)
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Analyze Your SaaS</CardTitle>
        <CardDescription>
          Provide details about your product to get AI-powered growth intelligence.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Core Information</h3>
            <div className="grid gap-2">
              <Label htmlFor="name">Product Name <span className="text-red-500">*</span></Label>
              <Input
                id="name"
                name="name"
                value={formData.name || ""}
                onChange={handleChange}
                placeholder="e.g. Growwwly"
                disabled={isLoading}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Product Description <span className="text-red-500">*</span></Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description || ""}
                onChange={handleChange}
                placeholder="What does your product do? What problem does it solve?"
                className="min-h-[100px]"
                disabled={isLoading}
              />
              {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="url">Website URL</Label>
              <Input
                id="url"
                name="url"
                type="url"
                value={formData.url || ""}
                onChange={handleChange}
                placeholder="https://yourproduct.com"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-medium">Market & Customer (Optional)</h3>
            
            <div className="grid gap-2">
              <Label htmlFor="targetCustomer">Target Customer</Label>
              <Input
                id="targetCustomer"
                name="targetCustomer"
                value={formData.targetCustomer || ""}
                onChange={handleChange}
                placeholder="e.g. B2B SaaS Founders"
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="pricing">Pricing</Label>
                <Input
                  id="pricing"
                  name="pricing"
                  value={formData.pricing || ""}
                  onChange={handleChange}
                  placeholder="e.g. $29/mo, Freemium"
                  disabled={isLoading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currentUsers">Current Users</Label>
                <Input
                  id="currentUsers"
                  name="currentUsers"
                  type="number"
                  min="0"
                  value={formData.currentUsers || ""}
                  onChange={handleChange}
                  placeholder="e.g. 100"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-medium">Growth Context (Optional)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="budget">Monthly Budget</Label>
                <Input
                  id="budget"
                  name="budget"
                  value={formData.budget || ""}
                  onChange={handleChange}
                  placeholder="e.g. $1000"
                  disabled={isLoading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="marketingExperience">Marketing Experience</Label>
                <Input
                  id="marketingExperience"
                  name="marketingExperience"
                  value={formData.marketingExperience || ""}
                  onChange={handleChange}
                  placeholder="e.g. Beginner, Expert"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end pt-6">
          <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
            {isLoading ? "Analyzing..." : "Analyze My SaaS"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
