/**
 * Public Instagram profile scraper — three-strategy fallback chain
 * to maximize hit-rate from server-side / datacenter IPs (Vercel),
 * which IG aggressively rate-limits / login-walls.
 *
 * Strategy order (try in sequence, stop on first success):
 *
 *   1. JSON: /api/v1/users/web_profile_info/?username={h}
 *      Headers: x-ig-app-id (the constant value the IG web app
 *      sends with every request). Returns full profile JSON
 *      — followers, follows, media count, bio, profile pic,
 *      verified flag, business category. Most reliable from
 *      datacenter IPs because it doesn't 403 the way the HTML
 *      page does.
 *
 *   2. HTML: /{handle}/  →  parse og:description meta
 *      Format: "538k Followers, 1,234 Following, 89 Posts - @handle
 *      on Instagram. Bio text..."
 *      Falls back to this when JSON returns the 401/login wall.
 *
 *   3. Embed: /{handle}/embed/   →  scrape any leaked stats from
 *      the embed iframe HTML. Lightest weight, sometimes works
 *      when both above fail.
 *
 * What it returns:
 *   - Follower count, following, post count
 *   - Display name + bio + profile picture URL
 *   - Verified flag, business-category (when JSON path succeeds)
 *
 * Legal posture (gray-area, internal-cache use):
 *   IG's profile pages are publicly accessible. The og:meta tags
 *   feed every link-preview crawler. The web_profile_info JSON is
 *   what the IG web client itself calls. We cache aggressively
 *   (7d), surface only to the authenticated user who triggered the
 *   search, and never sell or redistribute. Same posture every
 *   creator-data tool operates under prior to a signed deal.
 */

import axios from 'axios'
import { shouldSkip, recordFailure, recordSuccess, delay } from './scrape-circuit-breaker'

export interface ScrapedInstagramProfile {
  username: string
  followers: number
  follows: number
  posts: number
  name: string
  biography: string
  profilePictureUrl: string
  verified?: boolean
  category?: string
  source: 'instagram_public_scrape'
  fetchedAt: string
  /** Which strategy in the chain succeeded (for diagnostic logs). */
  strategy: 'json' | 'html' | 'embed'
}

// IG web-client app ID — public constant, same value every IG web
// client sends. Without it the JSON endpoint returns 401.
const IG_APP_ID = '936619743392459'

// Two UAs — desktop Chrome + iPhone Safari. We rotate per attempt.
const UAS = {
  desktop:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  mobile:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
}

/** Parse "1.2M" / "538k" / "4,231" → number. NaN on failure. */
export function parseFollowerCount(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') return Math.round(raw)
  if (!raw) return NaN
  const s = String(raw).trim().toLowerCase().replace(/,/g, '')
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

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

// ─── STRATEGY 1: JSON web_profile_info endpoint ────────────────────────

interface IgWebProfileInfoResponse {
  data?: {
    user?: {
      username?: string
      full_name?: string
      biography?: string
      external_url?: string
      profile_pic_url_hd?: string
      profile_pic_url?: string
      is_verified?: boolean
      category_name?: string
      edge_followed_by?: { count?: number }
      edge_follow?: { count?: number }
      edge_owner_to_timeline_media?: { count?: number }
    }
  }
}

async function tryJsonStrategy(handle: string): Promise<ScrapedInstagramProfile | null> {
  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`
  try {
    const { data, status } = await axios.get<IgWebProfileInfoResponse>(url, {
      timeout: 8000,
      headers: {
        'User-Agent': UAS.desktop,
        'x-ig-app-id': IG_APP_ID,
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Referer': `https://www.instagram.com/${handle}/`,
      },
      validateStatus: (s) => s < 500,
    })
    if (status !== 200) {
      console.log(`[ig-scrape json] status=${status} for @${handle}`)
      return null
    }
    const u = data?.data?.user
    if (!u || !u.username) {
      console.log(`[ig-scrape json] empty user payload for @${handle}`)
      return null
    }
    return {
      username: u.username,
      followers: u.edge_followed_by?.count ?? 0,
      follows: u.edge_follow?.count ?? 0,
      posts: u.edge_owner_to_timeline_media?.count ?? 0,
      name: u.full_name || '',
      biography: u.biography || '',
      profilePictureUrl: u.profile_pic_url_hd || u.profile_pic_url || '',
      verified: !!u.is_verified,
      category: u.category_name || '',
      source: 'instagram_public_scrape',
      fetchedAt: new Date().toISOString(),
      strategy: 'json',
    }
  } catch (e) {
    console.log(`[ig-scrape json] fetch error for @${handle}: ${(e as Error).message}`)
    return null
  }
}

// ─── STRATEGY 2: og:meta HTML scrape ─────────────────────────────────────

function extractMeta(html: string, prop: string): string | null {
  const re = new RegExp(`<meta\\s+property=["']${prop}["']\\s+content=["']([^"']+)["']`, 'i')
  const m = html.match(re)
  return m ? decodeHtml(m[1]) : null
}

function parseOgDescription(desc: string): { followers: number; follows: number; posts: number; bio: string } {
  const prefix = desc.match(
    /^([\d.,kmb\s]+)\s+followers?,\s*([\d.,kmb\s]+)\s+following,\s*([\d.,kmb\s]+)\s+posts?\s*(?:[-–—]|on\s+instagram)/i,
  )
  if (!prefix) return { followers: 0, follows: 0, posts: 0, bio: desc }
  const bioMatch = desc.match(/(?:on\s+instagram[\.\s]*|[-–—]\s*)([^]+)$/i)
  return {
    followers: parseFollowerCount(prefix[1]) || 0,
    follows: parseFollowerCount(prefix[2]) || 0,
    posts: parseFollowerCount(prefix[3]) || 0,
    bio: bioMatch ? bioMatch[1].trim() : '',
  }
}

async function tryHtmlStrategy(handle: string): Promise<ScrapedInstagramProfile | null> {
  for (const ua of [UAS.mobile, UAS.desktop]) {
    try {
      const { data, status } = await axios.get(`https://www.instagram.com/${handle}/`, {
        timeout: 8000,
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        validateStatus: (s) => s < 500,
      })
      if (status === 404) return null
      if (typeof data !== 'string') continue

      const desc = extractMeta(data, 'og:description')
      const title = extractMeta(data, 'og:title')
      const image = extractMeta(data, 'og:image')
      if (!desc) continue

      const { followers, follows, posts, bio } = parseOgDescription(desc)
      if (followers === 0 && follows === 0 && posts === 0) continue

      const titleMatch = title ? title.match(/^(.+?)\s*\(@([\w.]+)\)/) : null
      return {
        username: titleMatch ? titleMatch[2].toLowerCase() : handle,
        name: titleMatch ? titleMatch[1].trim() : '',
        followers,
        follows,
        posts,
        biography: bio,
        profilePictureUrl: image || '',
        source: 'instagram_public_scrape',
        fetchedAt: new Date().toISOString(),
        strategy: 'html',
      }
    } catch (e) {
      console.log(`[ig-scrape html ${ua === UAS.mobile ? 'mobile' : 'desktop'}] @${handle}: ${(e as Error).message}`)
    }
  }
  return null
}

// ─── STRATEGY 3: embed page scrape ───────────────────────────────────────

async function tryEmbedStrategy(handle: string): Promise<ScrapedInstagramProfile | null> {
  try {
    const { data, status } = await axios.get(`https://www.instagram.com/${handle}/embed/`, {
      timeout: 8000,
      headers: {
        'User-Agent': UAS.desktop,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      validateStatus: (s) => s < 500,
    })
    if (status !== 200 || typeof data !== 'string') return null

    // Embed pages don't include follower count directly, but they do
    // include the username + display name + a profile pic URL we can
    // surface as a partial result. Better than nothing.
    const usernameMatch = data.match(/"owner":\s*{\s*"username":\s*"([\w.]+)"/) || data.match(/instagram\.com\/([\w.]+)\//)
    const fullNameMatch = data.match(/"owner":\s*{[^}]*"full_name":\s*"([^"]+)"/)
    const profilePicMatch = data.match(/profile_pic_url[^"]*":\s*"([^"]+)"/)
    if (!usernameMatch) return null

    return {
      username: usernameMatch[1].toLowerCase(),
      name: fullNameMatch ? decodeHtml(fullNameMatch[1].replace(/\\u0026/g, '&')) : '',
      followers: 0,    // embed doesn't expose this
      follows: 0,
      posts: 0,
      biography: '',
      profilePictureUrl: profilePicMatch ? profilePicMatch[1].replace(/\\\//g, '/').replace(/\\u0026/g, '&') : '',
      source: 'instagram_public_scrape',
      fetchedAt: new Date().toISOString(),
      strategy: 'embed',
    }
  } catch (e) {
    console.log(`[ig-scrape embed] @${handle}: ${(e as Error).message}`)
    return null
  }
}

// ─── Public entrypoint ───────────────────────────────────────────────────

export async function scrapeInstagramProfile(handle: string): Promise<ScrapedInstagramProfile | null> {
  const cleaned = handle.toLowerCase().replace(/^@/, '').trim()
  if (!cleaned || !/^[a-z0-9._]{1,30}$/.test(cleaned)) return null

  // Circuit breaker: if IG has been rate-limiting or login-walling us
  // recently, skip all strategies for the cooldown window. Saves the
  // 24s of timeout cascades per call when we already know it'll fail.
  if (shouldSkip('ig-scrape')) {
    return null
  }

  // Try strategies in order. JSON is fastest + has the richest
  // payload, so it goes first. HTML is the visual-feedback fallback.
  // Embed only ever runs if both above failed.
  const json  = await tryJsonStrategy(cleaned)
  if (json && json.followers > 0) {
    console.log(`[ig-scrape] @${cleaned} resolved via JSON: ${json.followers} followers`)
    recordSuccess('ig-scrape')
    return json
  }
  // 200ms inter-strategy delay — gives IG a beat between consecutive
  // hits from the same datacenter IP.
  await delay(200)
  const html  = await tryHtmlStrategy(cleaned)
  if (html && html.followers > 0) {
    console.log(`[ig-scrape] @${cleaned} resolved via HTML: ${html.followers} followers`)
    recordSuccess('ig-scrape')
    return html
  }
  await delay(200)
  // Last-ditch: embed only gives username + photo, but it's better
  // than tombstoning the row entirely.
  const embed = await tryEmbedStrategy(cleaned)
  if (embed) {
    console.log(`[ig-scrape] @${cleaned} resolved via EMBED (partial — no count)`)
    recordSuccess('ig-scrape')
    return embed
  }

  console.warn(`[ig-scrape] all strategies failed for @${cleaned}`)
  // Mark as a circuit-breaker failure. After 5 in 60s, skips for 10min.
  recordFailure('ig-scrape')
  return null
}
