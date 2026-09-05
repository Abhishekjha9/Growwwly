import { afterEach, describe, expect, it, vi } from "vitest";

const TEST_URL = "http://8.8.8.8/";

const launchMock = vi.fn();

vi.mock("playwright", () => ({
  chromium: { launch: (...args: unknown[]) => launchMock(...args) },
  devices: { "iPhone 13": { viewport: { width: 390, height: 844 }, isMobile: true } },
}));

const { captureScreenshots } = await import("../browser");

afterEach(() => {
  vi.clearAllMocks();
});

function fakeBrowser(pageOverrides: Partial<{ goto: () => Promise<void>; screenshot: () => Promise<Buffer> }> = {}) {
  const page = {
    goto: pageOverrides.goto ?? vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    screenshot: pageOverrides.screenshot ?? vi.fn().mockResolvedValue(Buffer.from("fake-jpeg-bytes")),
  };
  const context = {
    setDefaultTimeout: vi.fn(),
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    newContext: vi.fn().mockResolvedValue(context),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

describe("11. Playwright failure", () => {
  it("returns both viewports uncaptured when the browser fails to launch", async () => {
    launchMock.mockRejectedValue(new Error("no chromium binary"));

    const result = await captureScreenshots(TEST_URL);
    expect(result.desktop.captured).toBe(false);
    expect(result.mobile.captured).toBe(false);
    expect(result.desktop.screenshotDataUrl).toBeNull();
  });

  it("captures the viewports that succeed and marks a failing one uncaptured", async () => {
    let call = 0;
    launchMock.mockResolvedValue(
      fakeBrowser({
        goto: vi.fn().mockImplementation(() => {
          call += 1;
          if (call === 2) throw new Error("navigation timeout");
          return Promise.resolve();
        }),
      })
    );

    const result = await captureScreenshots(TEST_URL);
    // One of the two viewports navigates fine, the other times out — exactly
    // one should come back captured.
    const capturedCount = [result.desktop.captured, result.mobile.captured].filter(Boolean).length;
    expect(capturedCount).toBe(1);
  });

  it("returns a base64 data URI for a successful capture", async () => {
    launchMock.mockResolvedValue(fakeBrowser());

    const result = await captureScreenshots(TEST_URL);
    expect(result.desktop.captured).toBe(true);
    expect(result.desktop.screenshotDataUrl).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("never launches a browser for a disallowed URL", async () => {
    const result = await captureScreenshots("http://127.0.0.1/");
    expect(result.desktop.captured).toBe(false);
    expect(launchMock).not.toHaveBeenCalled();
  });
});
