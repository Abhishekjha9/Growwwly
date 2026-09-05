import { afterEach, describe, expect, it, vi } from "vitest";

const TEST_URL = "http://8.8.8.8/";

const launchMock = vi.fn();
const killMock = vi.fn();
const lighthouseMock = vi.fn();

vi.mock("chrome-launcher", () => ({
  launch: (...args: unknown[]) => launchMock(...args),
}));

vi.mock("lighthouse", () => ({
  default: (...args: unknown[]) => lighthouseMock(...args),
}));

vi.mock("playwright", () => ({
  chromium: { executablePath: () => "/fake/chromium" },
}));

// Imported after the mocks are registered so `lighthouse.ts` picks them up.
const { runLighthouseAudit } = await import("../lighthouse");

afterEach(() => {
  vi.clearAllMocks();
});

describe("10. Lighthouse unavailable/failure", () => {
  it("returns 'unavailable' when chrome-launcher fails to launch a browser", async () => {
    launchMock.mockRejectedValue(new Error("no chrome found"));

    const result = await runLighthouseAudit(TEST_URL);
    expect(result.status).toBe("unavailable");
    expect(result.performance).toBeNull();
    expect(result.reason).toBeTruthy();
  });

  it("returns 'unavailable' when the lighthouse run itself throws", async () => {
    launchMock.mockResolvedValue({ port: 1234, kill: killMock });
    lighthouseMock.mockRejectedValue(new Error("audit crashed"));

    const result = await runLighthouseAudit(TEST_URL);
    expect(result.status).toBe("unavailable");
    expect(killMock).toHaveBeenCalled();
  });

  it("returns measured scores (0-100) when lighthouse succeeds", async () => {
    launchMock.mockResolvedValue({ port: 1234, kill: killMock });
    lighthouseMock.mockResolvedValue({
      lhr: {
        categories: {
          performance: { score: 0.87 },
          accessibility: { score: 0.94 },
          "best-practices": { score: 0.92 },
          seo: { score: 0.78 },
        },
      },
    });

    const result = await runLighthouseAudit(TEST_URL);
    expect(result.status).toBe("measured");
    expect(result.performance).toBe(87);
    expect(result.accessibility).toBe(94);
    expect(result.bestPractices).toBe(92);
    expect(result.seo).toBe(78);
    expect(killMock).toHaveBeenCalled();
  });

  it("never invents a score for a category lighthouse didn't return", async () => {
    launchMock.mockResolvedValue({ port: 1234, kill: killMock });
    lighthouseMock.mockResolvedValue({ lhr: { categories: { performance: { score: 0.5 } } } });

    const result = await runLighthouseAudit(TEST_URL);
    expect(result.performance).toBe(50);
    expect(result.seo).toBeNull();
  });

  it("returns 'unavailable' for a disallowed URL without launching a browser", async () => {
    const result = await runLighthouseAudit("http://127.0.0.1/");
    expect(result.status).toBe("unavailable");
    expect(launchMock).not.toHaveBeenCalled();
  });
});
