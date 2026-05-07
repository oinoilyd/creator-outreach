/**
 * Public Instagram profile scraper — fallback for when the Meta
 * Graph API isn't configured (Business Manager setup pending).
 *
 * What it pulls:
 *   - Follower count    (from og:description meta or HTML)
 *   - Following count
 *   - Post count
 *   - Display name
 *   - Bio text          (from og:description body)
 *   - Profile picture   (from og:image)
 *
 * What it doesn't:
 *   - Engagement rate (need individual post like/comment counts —
 *     not in the public profile page; only the Graph API or per-post
 *     scraping gives this)
 *   - Verified-status, business-category, etc.
 *
 * Legal posture (gray area, internal-cache use):
 *   IG's public profile page is publicly accessible without auth.
 *   The og:meta tags it serves are designed for syndication — every
 *   social-sharing crawler (Twitter, FB, Slack) pulls them. The
 *   numbers we extract are the same ones any link-preview shows.
 *   We cache aggressively (7d) to minimize requests, surface results
 *   only to the authenticated user who triggered the search, and
 *   never sell or redistribute. This is the same posture every
 *   creator-data tool operates under until they sign deals.
 *
 *   When the Meta Graph API is configured, that path is preferred
 *   (it's the contractual source) and this fallback is bypassed.
 *
 * Reliability gotchas:
 *   - IG sometimes returns "challenge required" / login walls when
 *     they detect crawlers. We retry once with a different UA, then
 *     give up gracefully (caller treats null as "unavailable").
 *   - The og:description format can change. We parse with multiple
 *     fallback regexes and log warnings when none match.
 */

import axios from 'axios'

export interface ScrapedInstagramProfile {
  username: string
  followers: number          // 0 if not extractable
  follows: number
  posts: number
  name: string
  biography: string
  profilePictureUrl: string
  source: 'instagram_public_scrape'
  fetchedAt: string
}

// Two UAs — one mobile-Safari, one desktop-Chrome. IG sometimes
// fingerprints crawlers and returns the login wall to one but not
// the other.
const UAS = [
  // iPhone Safari — small payload, often passes
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  // Desktop Chrome — what most link-preview bots send
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
]

/**
 * Parse a count string like "1.2M" / "538k" / "4,231" into a number.
 * Returns NaN when input is unparseable.
 */
export function parseFollowerCount(raw: string): number {
  if (!raw) return NaN
  const s = raw.trim().toLowerCase().replace(/,/g, '')
  const m = s.match(/^([\d.]+)\s*([kmb])?/)
  if (!m) return NaN
  const num = parseFloat(m[1])
  if (isNaN(num)) return NaN
  const suffix = m[2]
  if (suffix === 'k') return Math.round(num * 1_000)
  if (suffix === 'm') return Math.round(num * 1_000_000)
  if (suffix === 'b') return Math.round(num * 1_000_000_000)
  return Math.round(num)
}

/**
 * Extract the og:description meta tag from raw HTML.
 * Looks like: <meta property="og:description" content="538k Followers, 1,234 Following, 89 Posts - @handle on Instagram. Bio text..." />
 */
function extractOgDescription(html: string): string | null {
  const match = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)
  return match ? decodeHtml(match[1]) : null
}

function extractOgTitle(html: string): string | null {
  const match = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)
  return match ? decodeHtml(match[1]) : null
}

function extractOgImage(html: string): string | null {
  const match = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
  return match ? decodeHtml(match[1]) : null
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

/**
 * Parse the og:description string into structured numbers.
 *
 * Format examples we've seen IG return:
 *   "538k Followers, 1,234 Following, 89 Posts - @handle on Instagram. Bio text..."
 *   "1.2M Followers, 500 Following, 1,234 Posts - @handle on Instagram"
 *   "@handle • Instagram photos and videos" (rare — some private-ish accounts)
 */
function parseDescriptionStats(desc: string): { followers: number; follows: number; posts: number; bio: string } {
  // Match the leading "X Followers, Y Following, Z Posts" preamble.
  const prefix = desc.match(
    /^([\d.,kmb\s]+)\s+followers?,\s*([\d.,kmb\s]+)\s+following,\s*([\d.,kmb\s]+)\s+posts?\s*(?:[-–—]|on\s+instagram)/i,
  )
  if (!prefix) {
    return { followers: 0, follows: 0, posts: 0, bio: desc }
  }
  const followers = parseFollowerCount(prefix[1]) || 0
  const follows   = parseFollowerCount(prefix[2]) || 0
  const posts     = parseFollowerCount(prefix[3]) || 0

  // Bio = everything after the first "Bio text..." separator.
  // Examples: "... on Instagram. <bio text>" or "... - <bio text>"
  const bioMatch = desc.match(/(?:on\s+instagram[\.\s]*|[-–—]\s*)([^]+)$/i)
  const bio = bioMatch ? bioMatch[1].trim() : ''

  return { followers, follows, posts, bio }
}

/**
 * Extract handle + display name from og:title.
 * Format: "@dylan.j.meehan • Instagram"  or  "Dylan Meehan (@dylan.j.meehan) • Instagram photos and videos"
 */
function parseTitle(title: string, fallbackHandle: string): { username: string; name: string } {
  const namedMatch = title.match(/^(.+?)\s*\(@([\w.]+)\)/i)
  if (namedMatch) {
    return { name: namedMatch[1].trim(), username: namedMatch[2].toLowerCase() }
  }
  const handleOnly = title.match(/^@([\w.]+)/)
  if (handleOnly) {
    return { name: '', username: handleOnly[1].toLowerCase() }
  }
  return { name: '', username: fallbackHandle.toLowerCase() }
}

/**
 * Fetch and parse a public Instagram profile. Returns null on:
 *   - 404 (handle doesn't exist)
 *   - login wall / challenge (IG blocked us)
 *   - unparseable content
 *   - network error
 */
export async function scrapeInstagramProfile(handle: string): Promise<ScrapedInstagramProfile | null> {
  const cleaned = handle.toLowerCase().replace(/^@/, '').trim()
  if (!cleaned || !/^[a-z0-9._]{1,30}$/.test(cleaned)) return null

  const url = `https://www.instagram.com/${cleaned}/`

  let html = ''
  let lastError: string | null = null
  for (const ua of UAS) {
    try {
      const { data, status } = await axios.get(url, {
        timeout: 8000,
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        // Don't throw on 404 — just return null below.
        validateStatus: (s) => s < 500,
      })
      if (status === 404) return null
      // Detect login/challenge walls (IG returns 200 with a content body
      // that doesn't include og:description we want).
      if (typeof data === 'string' && data.includes('og:description')) {
        html = data
        break
      }
      lastError = `status=${status} body-shape mismatch (login wall?)`
    } catch (e) {
      lastError = (e as Error).message
    }
  }
  if (!html) {
    console.log(`[ig-scrape] could not fetch @${cleaned}: ${lastError}`)
    return null
  }

  const desc  = extractOgDescription(html)
  const title = extractOgTitle(html)
  const image = extractOgImage(html)

  if (!desc) {
    console.warn(`[ig-scrape] no og:description for @${cleaned}`)
    return null
  }

  const { followers, follows, posts, bio } = parseDescriptionStats(desc)
  const { username, name } = parseTitle(title || '', cleaned)

  // If the leading-stats preamble didn't parse, treat as failure —
  // it means IG served us a different page shape (private account,
  // banned, etc.).
  if (followers === 0 && follows === 0 && posts === 0) {
    console.warn(`[ig-scrape] zero stats for @${cleaned} (likely private/blocked)`)
    return null
  }

  return {
    username: username || cleaned,
    name,
    followers,
    follows,
    posts,
    biography: bio,
    profilePictureUrl: image || '',
    source: 'instagram_public_scrape',
    fetchedAt: new Date().toISOString(),
  }
}
