import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchHtml } from "../fetch";

// A literal IP address so `assertSafeUrl` never needs a real DNS lookup —
// keeps this test fully offline per AGENTS.md Phase 3 §21.
const TEST_URL = "http://8.8.8.8/";

function fakeResponse(init: { status: number; body?: string; headers?: Record<string, string> }): Response {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(init.body ?? "");
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  return new Response(stream, { status: init.status, headers: init.headers });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("4. Website fetch success", () => {
  it("returns crawl status 'ok' and the response body as html", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(fakeResponse({ status: 200, body: "<html><body>hi</body></html>" }))
    );

    const result = await fetchHtml(TEST_URL);
    expect(result.crawl.status).toBe("ok");
    expect(result.crawl.statusCode).toBe(200);
    expect(result.html).toContain("<body>hi</body>");
  });
});

describe("5. Website fetch failure", () => {
  it("returns crawl status 'unreachable' when the network request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND")));

    const result = await fetchHtml(TEST_URL);
    expect(result.crawl.status).toBe("unreachable");
    expect(result.html).toBeNull();
    expect(result.crawl.error).not.toMatch(/ENOTFOUND/); // never leak raw network internals
  });

  it("returns crawl status 'http_error' on a non-2xx, non-redirect response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse({ status: 500 })));

    const result = await fetchHtml(TEST_URL);
    expect(result.crawl.status).toBe("http_error");
    expect(result.crawl.statusCode).toBe(500);
    expect(result.html).toBeNull();
  });

  it("returns crawl status 'invalid_url' without ever calling fetch, for a disallowed protocol", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchHtml("javascript:alert(1)");
    expect(result.crawl.status).toBe("invalid_url");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("follows a same-safety redirect and reports redirected: true", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse({ status: 302, headers: { location: "http://8.8.8.8/next" } }))
      .mockResolvedValueOnce(fakeResponse({ status: 200, body: "<html>final</html>" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchHtml(TEST_URL);
    expect(result.crawl.status).toBe("ok");
    expect(result.crawl.redirected).toBe(true);
    expect(result.html).toContain("final");
  });
});
