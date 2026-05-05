/**
 * Shared security utilities for API routes.
 */

// Regex covering private/loopback/link-local IP ranges and hostnames.
// Blocks SSRF attempts targeting internal AWS metadata, localhost, LAN, etc.
const PRIVATE_HOST =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|0\.0\.0\.0|169\.254\.\d+\.\d+|::1|fc00:|fe80:|0:0:0:0:0:0:0:1)$/i

/**
 * Returns true only if the URL is safe to fetch from a server-side context.
 * Blocks private/loopback IPs, non-HTTP(S) protocols, and malformed URLs.
 */
export function isSafeExternalUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    if (PRIVATE_HOST.test(host)) return false
    return true
  } catch {
    return false
  }
}

/**
 * Clamps a string to a maximum byte length to protect AI prompts and
 * downstream parsers from oversized payloads.
 */
export function clampString(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return ''
  return value.slice(0, maxLen)
}

/**
 * Safely parse an integer from an unknown value, clamped to [min, max].
 */
export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = parseInt(String(value ?? ''), 10)
  if (isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
