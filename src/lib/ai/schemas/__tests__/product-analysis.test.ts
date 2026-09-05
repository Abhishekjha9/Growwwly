import { describe, expect, it } from "vitest";
import { ProductAnalysisRequestSchema } from "../product-analysis";

const MINIMAL = { name: "PDFParse", description: "Converts PDFs to JSON." };

describe("1. Valid URL validation", () => {
  it("accepts a valid https URL", () => {
    const result = ProductAnalysisRequestSchema.safeParse({ ...MINIMAL, url: "https://example.com" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid http URL", () => {
    const result = ProductAnalysisRequestSchema.safeParse({ ...MINIMAL, url: "http://example.com/path" });
    expect(result.success).toBe(true);
  });
});

describe("2. Invalid URL", () => {
  it("rejects a malformed URL", () => {
    const result = ProductAnalysisRequestSchema.safeParse({ ...MINIMAL, url: "not a url" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-http(s) protocol", () => {
    for (const url of ["ftp://example.com", "javascript:alert(1)", "file:///etc/passwd"]) {
      const result = ProductAnalysisRequestSchema.safeParse({ ...MINIMAL, url });
      expect(result.success, `expected ${url} to be rejected`).toBe(false);
    }
  });
});

describe("3. Missing URL", () => {
  it("validates successfully with no url field at all", () => {
    const result = ProductAnalysisRequestSchema.safeParse(MINIMAL);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.url).toBeUndefined();
    }
  });
});
