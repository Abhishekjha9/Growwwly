import { describe, expect, it } from "vitest";
import { buildReportFilename, contentDispositionFor } from "../filename";

describe("buildReportFilename", () => {
  it("falls back to a generic filename with no product name", () => {
    expect(buildReportFilename(null)).toBe("growwwly-growth-report.pdf");
    expect(buildReportFilename(undefined)).toBe("growwwly-growth-report.pdf");
    expect(buildReportFilename("")).toBe("growwwly-growth-report.pdf");
  });

  it("slugifies a normal product name", () => {
    expect(buildReportFilename("PDFParse")).toBe("growwwly-pdfparse-growth-report.pdf");
    expect(buildReportFilename("Wed Invite AI")).toBe(
      "growwwly-wed-invite-ai-growth-report.pdf"
    );
  });

  it("strips special characters and path-traversal segments", () => {
    const filename = buildReportFilename("../../etc/passwd");
    expect(filename).not.toContain("..");
    expect(filename).not.toContain("/");
    expect(filename).toMatch(/^growwwly-[a-z0-9-]+-growth-report\.pdf$/);
  });

  it("strips HTML/script-like content safely", () => {
    const filename = buildReportFilename('<script>alert(1)</script>');
    expect(filename).not.toContain("<");
    expect(filename).not.toContain(">");
    expect(filename).toMatch(/^growwwly-[a-z0-9-]+-growth-report\.pdf$/);
  });

  it("truncates very long product names", () => {
    const filename = buildReportFilename("A".repeat(500));
    expect(filename.length).toBeLessThan(120);
    expect(filename).toMatch(/^growwwly-a+-growth-report\.pdf$/);
  });

  it("handles accented and unicode characters", () => {
    const filename = buildReportFilename("Café Növa™ 🚀");
    expect(filename).toMatch(/^growwwly-[a-z0-9-]+-growth-report\.pdf$/);
  });

  it("is deterministic for the same input", () => {
    expect(buildReportFilename("PDFParse")).toBe(buildReportFilename("PDFParse"));
  });
});

describe("contentDispositionFor", () => {
  it("includes both plain and UTF-8 encoded filename forms", () => {
    const header = contentDispositionFor("growwwly-pdfparse-growth-report.pdf");
    expect(header).toContain('attachment; filename="growwwly-pdfparse-growth-report.pdf"');
    expect(header).toContain("filename*=UTF-8''growwwly-pdfparse-growth-report.pdf");
  });
});
