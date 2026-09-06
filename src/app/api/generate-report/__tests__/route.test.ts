import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "../route";
import { computeGrowthIntelligence } from "@/lib/growth";
import { developerApiFixture } from "@/lib/growth/__tests__/fixtures";
import { healthyWebsiteFixture } from "@/lib/growth/__tests__/websiteFixtures";
import type { AnalysisResult } from "@/types/analysis";

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/generate-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validAnalysis(): AnalysisResult {
  const productIntelligence = developerApiFixture();
  const websiteIntelligence = healthyWebsiteFixture();
  return {
    productIntelligence,
    websiteIntelligence,
    growthIntelligence: computeGrowthIntelligence(productIntelligence, websiteIntelligence),
  };
}

describe("POST /api/generate-report", () => {
  it("15a. rejects invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/generate-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("15b. rejects a request missing the analysis field", async () => {
    const res = await POST(postRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/invalid/i);
  });

  it("15c. rejects a structurally malformed analysis object", async () => {
    const res = await POST(
      postRequest({ analysis: { productIntelligence: { not: "valid" } } })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(Array.isArray(json.details)).toBe(true);
  });

  it("generates a downloadable PDF for a valid analysis", async () => {
    const res = await POST(postRequest({ analysis: validAnalysis() }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("16. sanitizes the filename in Content-Disposition from an unsafe product name", async () => {
    const analysis = validAnalysis();
    analysis.productIntelligence.product.name = '../../etc/passwd <script>alert(1)</script>';
    const res = await POST(postRequest({ analysis }));
    expect(res.status).toBe(200);
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).not.toContain("..");
    expect(disposition).not.toContain("<");
    expect(disposition).not.toContain(">");
    expect(disposition).toMatch(/filename="growwwly-[a-z0-9-]+-growth-report\.pdf"/);
  });

  it("generates a valid PDF when theme is 'dark'", async () => {
    const res = await POST(postRequest({ analysis: validAnalysis(), theme: "dark" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("generates a valid PDF when theme is 'light'", async () => {
    const res = await POST(postRequest({ analysis: validAnalysis(), theme: "light" }));
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("defaults to the light theme when no theme is provided", async () => {
    const res = await POST(postRequest({ analysis: validAnalysis() }));
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("rejects an invalid theme value", async () => {
    const res = await POST(postRequest({ analysis: validAnalysis(), theme: "neon" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});
