import { describe, expect, it } from "vitest";
import {
  AnalysisResultSchema,
  OpportunityDiscoveryRequestSchema,
  RawOpportunitySchema,
} from "../schemas";
import { baseRawOpportunity, buildAnalysis } from "./fixtures";

describe("RawOpportunitySchema", () => {
  it("2. accepts a well-formed raw opportunity", () => {
    const result = RawOpportunitySchema.safeParse(baseRawOpportunity());
    expect(result.success).toBe(true);
  });

  it("3. rejects an opportunity with an invalid URL", () => {
    const result = RawOpportunitySchema.safeParse(
      baseRawOpportunity({ url: "not-a-real-url" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a non-http(s) URL", () => {
    const result = RawOpportunitySchema.safeParse(
      baseRawOpportunity({ url: "javascript:alert(1)" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a missing title", () => {
    const result = RawOpportunitySchema.safeParse(baseRawOpportunity({ title: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects a missing source", () => {
    const result = RawOpportunitySchema.safeParse(baseRawOpportunity({ source: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects a missing reason", () => {
    const result = RawOpportunitySchema.safeParse(baseRawOpportunity({ reason: "" }));
    expect(result.success).toBe(false);
  });

  it("7. handles missing optional metadata (publishedAt, commentCount, estimatedDaysAgo)", () => {
    const raw = baseRawOpportunity();
    delete raw.publishedAt;
    delete raw.commentCount;
    delete raw.estimatedDaysAgo;
    const result = RawOpportunitySchema.safeParse(raw);
    expect(result.success).toBe(true);
  });
});

describe("AnalysisResultSchema / OpportunityDiscoveryRequestSchema", () => {
  it("accepts a real, complete AnalysisResult", () => {
    const analysis = buildAnalysis();
    expect(AnalysisResultSchema.safeParse(analysis).success).toBe(true);
    expect(
      OpportunityDiscoveryRequestSchema.safeParse({ analysis }).success
    ).toBe(true);
  });

  it("10. rejects a malformed analysis payload", () => {
    const result = OpportunityDiscoveryRequestSchema.safeParse({
      analysis: { productIntelligence: {}, websiteIntelligence: null },
    });
    expect(result.success).toBe(false);
  });

  it("10. rejects a request with no analysis field at all", () => {
    const result = OpportunityDiscoveryRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
