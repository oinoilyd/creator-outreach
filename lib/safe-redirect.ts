/**
 * Same-origin redirect target validator.
 *
 * Used by /auth/callback and /auth/signin / /auth/signup to defend
 * against open-redirect attacks where ?next= can be set to an
 * attacker-controlled origin (post-auth phishing).
 *
 * Allowed inputs:
 *   - Empty / null / undefined → returns "/"
 *   - "/" → returns "/"
 *   - "/something/path" or "/something/path?with=query#hash" → returned as-is
 *
 * Blocked inputs (return "/"):
 *   - "//attacker.com/" (protocol-relative, treated as off-origin by browsers)
 *   - "https://attacker.com/" / "http://..." (absolute URLs)
 *   - "javascript:..." / "data:..." / any non-/ scheme
 *   - "/\\attacker.com/" (backslash trick)
 *   - Anything that doesn't start with a single "/"
 *
 * Caller convention: pass the raw value from `searchParams.get('next')`
 * or equivalent. Returned value is safe to pass to `router.push()` or
 * `NextResponse.redirect(\`\${origin}\${next}\`)`.
 */
export function safeNext(raw: string | null | undefined, fallback: string = '/'): string {
  if (raw == null) return fallback
  const s = String(raw).trim()
  if (s.length === 0) return fallback

  // Must start with exactly one "/" (not "//", not "/\")
  if (!s.startsWith('/')) return fallback
  if (s.startsWith('//')) return fallback
  if (s.startsWith('/\\')) return fallback

  // Defense-in-depth: if URL parsing flags this as an absolute URL,
  // it's hostile. Use a fake base so relative paths parse OK.
  try {
    const u = new URL(s, 'https://creatoroutreach.net')
    // The pathname must start with "/" and the hostname must match
    // our base — if it doesn't, it's been promoted to absolute.
    if (u.hostname !== 'creatoroutreach.net') return fallback
  } catch {
    return fallback
  }

  // Reject control characters (e.g. CR/LF that could enable header
  // splitting in unusual proxy configurations)
  if (/[\x00-\x1f]/.test(s)) return fallback

  return s
}
