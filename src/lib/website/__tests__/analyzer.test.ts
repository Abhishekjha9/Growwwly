import { afterEach, describe, expect, it, vi } from "vitest";
import type { CrawlEvidence, PerformanceEvidence, SeoEvidence, VisualEvidence, WebsiteInterpretation } from "../types";
import { WebsiteIntelligenceSchema } from "../types";

const fetchHtmlMock = vi.fn();
const extractSeoEvidenceMock = vi.fn();
const captureScreenshotsMock = vi.fn();
const runLighthouseAuditMock = vi.fn();
const interpretWebsiteMock = vi.fn();

vi.mock("../fetch", () => ({ fetchHtml: (...args: unknown[]) => fetchHtmlMock(...args) }));
vi.mock("../extract", () => ({ extractSeoEvidence: (...args: unknown[]) => extractSeoEvidenceMock(...args) }));
vi.mock("../browser", () => ({ captureScreenshots: (...args: unknown[]) => captureScreenshotsMock(...args) }));
vi.mock("../lighthouse", () => ({ runLighthouseAudit: (...args: unknown[]) => runLighthouseAuditMock(...args) }));
vi.mock("../gemini", () => ({ interpretWebsite: (...args: unknown[]) => interpretWebsiteMock(...args) }));

const { analyzeWebsite } = await import("../analyzer");

const OK_CRAWL: CrawlEvidence = {
  status: "ok",
  requestedUrl: "https://example.com",
  finalUrl: "https://example.com/",
  statusCode: 200,
  responseTimeMs: 100,
  redirected: false,
  error: null,
};

const SEO: SeoEvidence = {
  title: "Example",
  titleLength: 7,
  metaDescription: "A description",
  metaDescriptionLength: 14,
  canonical: null,
  robotsMeta: null,
  viewport: null,
  lang: "en",
  faviconPresent: true,
  headings: { h1: ["Example"], h2: [], h3: [] },
  h1Count: 1,
  images: { total: 0, missingAlt: 0 },
  links: { total: 0, internal: 0, external: 0 },
  formCount: 0,
  ctaCount: 0,
  navItemCount: 0,
  hasPricingLink: false,
  hasSignupLink: false,
  hasLoginLink: false,
  structuredData: { present: false, types: [] },
  socialMeta: { openGraphPresent: false, twitterCardPresent: false },
  wordCount: 100,
};

const MEASURED_PERFORMANCE: PerformanceEvidence = {
  status: "measured",
  performance: 90,
  accessibility: 90,
  bestPractices: 90,
  seo: 90,
  reason: null,
};

const UNAVAILABLE_PERFORMANCE: PerformanceEvidence = {
  status: "unavailable",
  performance: null,
  accessibility: null,
  bestPractices: null,
  seo: null,
  reason: "timed out",
};

const CAPTURED_VISUAL: VisualEvidence = {
  desktop: { captured: true, width: 1280, height: 800, screenshotDataUrl: "data:image/jpeg;base64,AAAA" },
  mobile: { captured: true, width: 390, height: 844, screenshotDataUrl: "data:image/jpeg;base64,BBBB" },
};

const INTERPRETATION: WebsiteInterpretation = {
  positioning: { targetCustomerClarity: 70, problemClarity: 70, differentiationClarity: 70, summary: "ok" },
  hero: { headlineClarity: 70, ctaClarity: 70, visualHierarchyClarity: 70, messageProductAlignment: 70, summary: "ok" },
  conversion: {
    valuePropositionClarity: 70,
    ctaProminence: 70,
    trustSignalStrength: 70,
    socialProofStrength: 70,
    pricingVisibility: 70,
    signupFriction: 30,
    summary: "ok",
  },
  informationArchitecture: { navigationClarity: 70, contentOrganization: 70, keyPageDiscoverability: 70, summary: "ok" },
  visualHierarchy: {
    hierarchyClarity: 70,
    density: "balanced",
    readability: 70,
    ctaCompetesWithOtherElements: false,
    attentionSummary: "AI-estimated visual attention on the hero.",
    summary: "ok",
  },
  mobile: { mobileHierarchyClarity: 70, ctaVisibility: 70, navigationUsability: 70, layoutIssues: [], summary: "ok" },
  strengths: ["Clear CTA"],
  weaknesses: [],
  opportunities: [],
  confidence: { overall: 80, reasoning: "Good evidence." },
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("12. Website Intelligence schema validation", () => {
  it("produces output that validates against WebsiteIntelligenceSchema when everything succeeds", async () => {
    fetchHtmlMock.mockResolvedValue({ crawl: OK_CRAWL, html: "<html></html>" });
    extractSeoEvidenceMock.mockReturnValue(SEO);
    captureScreenshotsMock.mockResolvedValue(CAPTURED_VISUAL);
    runLighthouseAuditMock.mockResolvedValue(MEASURED_PERFORMANCE);
    interpretWebsiteMock.mockResolvedValue(INTERPRETATION);

    const result = await analyzeWebsite("https://example.com");
    expect(() => WebsiteIntelligenceSchema.parse(result)).not.toThrow();
    expect(result.status).toBe("complete");
  });

  it("produces valid output even in the fully-unavailable path", async () => {
    fetchHtmlMock.mockResolvedValue({
      crawl: { ...OK_CRAWL, status: "unreachable", finalUrl: null, error: "The site could not be reached." },
      html: null,
    });

    const result = await analyzeWebsite("https://example.com");
    expect(() => WebsiteIntelligenceSchema.parse(result)).not.toThrow();
    expect(result.status).toBe("unavailable");
    expect(result.seo).toBeNull();
    expect(result.interpretation).toBeNull();
  });
});

describe("Website inspection failure handling (§15)", () => {
  it("marks status 'unavailable' when the crawl fails, without calling downstream tools", async () => {
    fetchHtmlMock.mockResolvedValue({
      crawl: { ...OK_CRAWL, status: "timeout", finalUrl: null, error: "The site took too long to respond." },
      html: null,
    });

    const result = await analyzeWebsite("https://example.com");
    expect(result.status).toBe("unavailable");
    expect(captureScreenshotsMock).not.toHaveBeenCalled();
    expect(runLighthouseAuditMock).not.toHaveBeenCalled();
    expect(interpretWebsiteMock).not.toHaveBeenCalled();
  });

  it("marks status 'partial' when Lighthouse is unavailable but everything else succeeds", async () => {
    fetchHtmlMock.mockResolvedValue({ crawl: OK_CRAWL, html: "<html></html>" });
    extractSeoEvidenceMock.mockReturnValue(SEO);
    captureScreenshotsMock.mockResolvedValue(CAPTURED_VISUAL);
    runLighthouseAuditMock.mockResolvedValue(UNAVAILABLE_PERFORMANCE);
    interpretWebsiteMock.mockResolvedValue(INTERPRETATION);

    const result = await analyzeWebsite("https://example.com");
    expect(result.status).toBe("partial");
    expect(result.seo).not.toBeNull();
    expect(result.interpretation).not.toBeNull();
  });

  it("marks status 'partial' when the Gemini interpretation fails but facts are still returned", async () => {
    fetchHtmlMock.mockResolvedValue({ crawl: OK_CRAWL, html: "<html></html>" });
    extractSeoEvidenceMock.mockReturnValue(SEO);
    captureScreenshotsMock.mockResolvedValue(CAPTURED_VISUAL);
    runLighthouseAuditMock.mockResolvedValue(MEASURED_PERFORMANCE);
    interpretWebsiteMock.mockResolvedValue(null);

    const result = await analyzeWebsite("https://example.com");
    expect(result.status).toBe("partial");
    expect(result.interpretation).toBeNull();
    expect(result.seo).not.toBeNull();
  });

  it("marks status 'partial' when a screenshot capture fails", async () => {
    fetchHtmlMock.mockResolvedValue({ crawl: OK_CRAWL, html: "<html></html>" });
    extractSeoEvidenceMock.mockReturnValue(SEO);
    captureScreenshotsMock.mockResolvedValue({
      desktop: { captured: false, width: 1280, height: 800, screenshotDataUrl: null },
      mobile: CAPTURED_VISUAL.mobile,
    });
    runLighthouseAuditMock.mockResolvedValue(MEASURED_PERFORMANCE);
    interpretWebsiteMock.mockResolvedValue(INTERPRETATION);

    const result = await analyzeWebsite("https://example.com");
    expect(result.status).toBe("partial");
  });
});
