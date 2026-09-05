import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import {
  ALLOWED_PROTOCOLS,
  BLOCKED_HOSTNAMES,
  BLOCKED_HOSTNAME_SUFFIXES,
} from "./constants";

// ---------------------------------------------------------------------------
// Treat every user-supplied URL as untrusted. This module is the single gate
// every fetch/navigation in the website pipeline must pass through — fetch.ts,
// browser.ts and lighthouse.ts all call `assertSafeUrl` before touching the
// network, so a hostile URL never reaches Playwright or Lighthouse without
// having already been rejected here.
//
// What this does NOT fully solve: DNS-rebinding (the resolved IP can change
// between this check and the actual connection). A production deployment
// would additionally pin the resolved IP for the connection itself; that's
// out of scope for this phase and is called out here rather than hidden.
// ---------------------------------------------------------------------------

export class UnsafeUrlError extends Error {}

/** Structural + protocol validation only — no network I/O. Safe to call from
 * a Zod `.refine()` or any other synchronous context. */
export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return ALLOWED_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

/** Parses and lightly normalizes a URL string. Throws `UnsafeUrlError` (a
 * safe, user-facing message) for anything structurally invalid or using a
 * disallowed protocol. No network I/O. */
export function parseAndNormalizeUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new UnsafeUrlError("That doesn't look like a valid URL.");
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    throw new UnsafeUrlError("Only http and https URLs are supported.");
  }

  return parsed;
}

function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;

  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 192 && b === 0 && parts[2] === 2) return true; // 192.0.2.0/24 TEST-NET
  if (a >= 224) return true; // multicast/reserved

  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();

  // IPv4-mapped (::ffff:a.b.c.d) — check the embedded IPv4 address.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);

  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
    return true; // fe80::/10 link-local
  }
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 unique local

  return false;
}

function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true; // not a recognizable IP — refuse rather than guess
}

function isBlockedHostname(hostname: string): boolean {
  const host = stripBrackets(hostname).toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  return BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * Full safety check: structure, protocol, hostname blocklist, AND a DNS
 * resolution to make sure every address the hostname resolves to is public.
 * Call this immediately before any actual network access (fetch, Playwright
 * navigation, Lighthouse).
 */
export async function assertSafeUrl(value: string): Promise<URL> {
  const parsed = parseAndNormalizeUrl(value);
  const hostname = stripBrackets(parsed.hostname);

  if (isBlockedHostname(hostname)) {
    throw new UnsafeUrlError("This host cannot be inspected.");
  }

  // A literal IP in the URL — check it directly, no DNS needed.
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new UnsafeUrlError("This host cannot be inspected.");
    }
    return parsed;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError("Could not resolve this domain.");
  }

  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    throw new UnsafeUrlError("This host cannot be inspected.");
  }

  return parsed;
}
