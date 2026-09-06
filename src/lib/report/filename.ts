/**
 * Filename sanitization for the generated PDF's `Content-Disposition` header.
 * The product name in an analysis result is founder-supplied, untrusted text
 * — never interpolated into a filename or header without stripping anything
 * that isn't a safe filename character.
 */

const MAX_SLUG_LENGTH = 60;
const COMBINING_MARKS = /[̀-ͯ]/g;

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

/** "growwwly-growth-report.pdf", or "growwwly-[product-name]-growth-report.pdf"
 * when the product name yields a safe, non-empty slug. */
export function buildReportFilename(productName: string | null | undefined): string {
  const slug = productName ? slugify(productName) : "";
  return slug
    ? `growwwly-${slug}-growth-report.pdf`
    : "growwwly-growth-report.pdf";
}

/** RFC 5987-safe `Content-Disposition` header value for a given filename. */
export function contentDispositionFor(filename: string): string {
  return `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
