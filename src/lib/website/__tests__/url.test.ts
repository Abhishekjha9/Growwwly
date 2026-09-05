import { describe, expect, it } from "vitest";
import { assertSafeUrl, isHttpUrl, parseAndNormalizeUrl, UnsafeUrlError } from "../url";

describe("isHttpUrl", () => {
  it("accepts http and https", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
  });

  it("rejects other protocols and malformed input", () => {
    expect(isHttpUrl("ftp://example.com")).toBe(false);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("not a url")).toBe(false);
  });
});

describe("parseAndNormalizeUrl", () => {
  it("parses a valid URL", () => {
    expect(() => parseAndNormalizeUrl("https://example.com")).not.toThrow();
  });

  it("throws UnsafeUrlError for a malformed URL", () => {
    expect(() => parseAndNormalizeUrl("not a url")).toThrow(UnsafeUrlError);
  });

  it("throws UnsafeUrlError for a disallowed protocol", () => {
    expect(() => parseAndNormalizeUrl("ftp://example.com")).toThrow(UnsafeUrlError);
  });
});

describe("assertSafeUrl — SSRF protections", () => {
  it("blocks literal loopback addresses", async () => {
    await expect(assertSafeUrl("http://127.0.0.1/")).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeUrl("http://[::1]/")).rejects.toThrow(UnsafeUrlError);
  });

  it("blocks literal private-range addresses", async () => {
    await expect(assertSafeUrl("http://10.0.0.5/")).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeUrl("http://192.168.1.1/")).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeUrl("http://172.16.0.1/")).rejects.toThrow(UnsafeUrlError);
  });

  it("blocks the cloud-metadata link-local address", async () => {
    await expect(assertSafeUrl("http://169.254.169.254/")).rejects.toThrow(UnsafeUrlError);
  });

  it("blocks the localhost hostname without needing DNS", async () => {
    await expect(assertSafeUrl("http://localhost/")).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeUrl("http://foo.local/")).rejects.toThrow(UnsafeUrlError);
  });

  it("allows a literal public IP address", async () => {
    // A real, stable public IP (documentation range would also be blocked by
    // design — use one of Google's public DNS IPs, which is definitely public).
    await expect(assertSafeUrl("http://8.8.8.8/")).resolves.toBeInstanceOf(URL);
  });

  it("rejects a disallowed protocol before any network/DNS work", async () => {
    await expect(assertSafeUrl("ftp://example.com")).rejects.toThrow(UnsafeUrlError);
  });
});
