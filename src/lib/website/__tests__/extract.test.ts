import { describe, expect, it } from "vitest";
import { extractSeoEvidence } from "../extract";

const FULL_PAGE = `<!doctype html>
<html lang="en">
<head>
  <title>Example — Ship faster</title>
  <meta name="description" content="Example helps teams ship faster with less overhead every day." />
  <link rel="canonical" href="https://example.com/" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" href="/favicon.ico" />
  <meta property="og:title" content="Example" />
  <meta name="twitter:card" content="summary" />
  <script type="application/ld+json">{"@type": "Organization", "name": "Example"}</script>
</head>
<body>
  <nav><a href="/pricing">Pricing</a><a href="/docs">Docs</a></nav>
  <h1>Ship faster with Example</h1>
  <h2>Features</h2>
  <h2>Pricing</h2>
  <img src="/a.png" alt="A screenshot" />
  <img src="/b.png" />
  <a href="/signup" class="cta">Sign up free</a>
  <a href="https://external.com">External link</a>
  <form><input /></form>
  <p>Some visible paragraph text that should be counted toward the word count total.</p>
</body>
</html>`;

describe("6. HTML extraction", () => {
  const evidence = extractSeoEvidence(FULL_PAGE, "https://example.com/");

  it("extracts title, meta description, canonical, viewport, lang, favicon", () => {
    expect(evidence.title).toBe("Example — Ship faster");
    expect(evidence.metaDescription).toContain("ship faster");
    expect(evidence.canonical).toBe("https://example.com/");
    expect(evidence.viewport).toContain("width=device-width");
    expect(evidence.lang).toBe("en");
    expect(evidence.faviconPresent).toBe(true);
  });

  it("extracts headings", () => {
    expect(evidence.h1Count).toBe(1);
    expect(evidence.headings.h1).toEqual(["Ship faster with Example"]);
    expect(evidence.headings.h2).toEqual(["Features", "Pricing"]);
  });

  it("counts internal vs external links", () => {
    expect(evidence.links.internal).toBeGreaterThanOrEqual(3); // nav x2 + signup
    expect(evidence.links.external).toBe(1);
  });

  it("detects structured data, Open Graph and Twitter card", () => {
    expect(evidence.structuredData.present).toBe(true);
    expect(evidence.structuredData.types).toContain("Organization");
    expect(evidence.socialMeta.openGraphPresent).toBe(true);
    expect(evidence.socialMeta.twitterCardPresent).toBe(true);
  });

  it("detects a CTA-like link and a form", () => {
    expect(evidence.ctaCount).toBeGreaterThanOrEqual(1);
    expect(evidence.formCount).toBe(1);
    expect(evidence.hasSignupLink).toBe(true);
    expect(evidence.hasPricingLink).toBe(true);
  });

  it("counts words from visible body text", () => {
    expect(evidence.wordCount).toBeGreaterThan(5);
  });
});

describe("7. Missing meta description", () => {
  it("returns null and length 0 when no meta description tag exists", () => {
    const html = "<html><head><title>No Meta</title></head><body><h1>Hi</h1></body></html>";
    const evidence = extractSeoEvidence(html, "https://example.com/");
    expect(evidence.metaDescription).toBeNull();
    expect(evidence.metaDescriptionLength).toBe(0);
  });
});

describe("8. Missing H1", () => {
  it("returns h1Count 0 and an empty h1 array when there is no H1", () => {
    const html = "<html><head><title>No H1</title></head><body><h2>Only H2</h2></body></html>";
    const evidence = extractSeoEvidence(html, "https://example.com/");
    expect(evidence.h1Count).toBe(0);
    expect(evidence.headings.h1).toEqual([]);
  });
});

describe("9. Missing alt attributes", () => {
  it("counts images missing alt text, including empty alt", () => {
    const html = `<html><body>
      <img src="/a.png" alt="Has alt" />
      <img src="/b.png" />
      <img src="/c.png" alt="" />
    </body></html>`;
    const evidence = extractSeoEvidence(html, "https://example.com/");
    expect(evidence.images.total).toBe(3);
    expect(evidence.images.missingAlt).toBe(2);
  });
});
