import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { buildAnalysis } from "@/lib/opportunities/__tests__/fixtures";

const discoverOpportunitiesMock = vi.fn();
vi.mock("@/lib/opportunities/engine", () => ({
  discoverOpportunities: (...args: unknown[]) => discoverOpportunitiesMock(...args),
}));

const { POST } = await import("../route");

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/opportunities", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/opportunities", () => {
  beforeEach(() => {
    discoverOpportunitiesMock.mockReset();
  });

  it("returns ranked opportunities for a valid analysis", async () => {
    discoverOpportunitiesMock.mockResolvedValue([
      { id: "opp_1", title: "t", url: "https://example.com", domain: "example.com", source: "s", sourceType: "forum", snippet: "s", relevanceScore: 80, opportunityScore: 80, confidence: 80, reason: "r", matchingSignals: [], suggestedAction: "a", responseDraft: "d" },
    ]);
    const response = await POST(makeRequest({ analysis: buildAnalysis() }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.opportunities).toHaveLength(1);
  });

  it("10. rejects malformed analysis with 400", async () => {
    const response = await POST(makeRequest({ analysis: { nope: true } }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(discoverOpportunitiesMock).not.toHaveBeenCalled();
  });

  it("rejects a body with no analysis field", async () => {
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const request = new NextRequest("http://localhost/api/opportunities", {
      method: "POST",
      body: "{not json",
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("11. handles a discovery failure with a safe 502, never a fabricated result", async () => {
    discoverOpportunitiesMock.mockRejectedValue(new Error("provider exploded"));
    const response = await POST(makeRequest({ analysis: buildAnalysis() }));
    const body = await response.json();
    expect(response.status).toBe(502);
    expect(body.success).toBe(false);
    expect(body.error).not.toContain("provider exploded");
  });

  it("returns success with an empty list when nothing was found (not an error)", async () => {
    discoverOpportunitiesMock.mockResolvedValue([]);
    const response = await POST(makeRequest({ analysis: buildAnalysis() }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.opportunities).toEqual([]);
  });
});
