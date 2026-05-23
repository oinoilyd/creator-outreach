/**
 * Meta Instagram Graph API client — Business Discovery endpoint.
 *
 * What this does:
 *   Given an Instagram USERNAME (not URL, not user-id) of a Business or
 *   Creator account, returns the official Meta-side metrics: followers,
 *   bio, post count, recent media. This is the only legal way to pull
 *   arbitrary IG profile data without a paid creator-database vendor.
 *
 * What this DOESN'T do:
 *   - Search Instagram by keyword (no such endpoint exists publicly).
 *   - Resolve personal accounts (Meta only exposes Business/Creator).
 *   - Find handles you don't already have. We rely on the
 *     YouTube /about + website + biolink pipeline in /api/enrich to
 *     surface candidate IG handles, then this fills in the metrics.
 *
 * Setup chain (one-time, mostly in Meta Business Manager UI):
 *   1. Meta Business Manager account — Dylan creates this signed in
 *      to his Facebook account. Free.
 *   2. Facebook Page — required because IG Business accounts must
 *      link to a Page. Can be a placeholder (e.g. "Creator Outreach").
 *   3. Instagram Business account — switch a fresh IG account to
 *      "Business" inside the IG app, link to the Page from step 2.
 *   4. Facebook App in developer dashboard — the App ID/Secret pair
 *      we use to authenticate API calls.
 *   5. Long-lived access token — minted from the IG Business account,
 *      lasts 60 days, refreshable. We store as META_LONG_LIVED_TOKEN.
 *   6. App Review — Meta has to approve `instagram_basic` +
 *      `pages_show_list` + Business Discovery feature for non-test
 *      users to get data. ~1-2 weeks. Test users (you + me) work
 *      immediately without review.
 *
 * Required env vars (all gracefully no-op when missing):
 *   META_APP_ID                — Facebook App ID
 *   META_APP_SECRET            — Facebook App Secret (server-only!)
 *   META_LONG_LIVED_TOKEN      — Long-lived access token
 *   META_IG_BUSINESS_ID        — Our IG Business account user ID
 *                                (the asker, not the askee)
 *
 * Rate limit: 200 calls/hour total on Business Discovery. Cache
 * aggressively (Redis 7d + Postgres permanent) to stay well under.
 */

export interface InstagramGraphMetrics {
  /** The IG handle we asked about (lowercase, no @). */
  username: string
  /** Official Meta-side follower count. Source of truth. */
  followers: number
  /** Account-level engagement-rate-eligible counts. */
  follows: number
  mediaCount: number
  /** Profile bio text. */
  biography: string
  /** External URL from bio (often the creator's link tree or website). */
  website: string
  /** Profile photo URL. */
  profilePictureUrl: string
  /** Display name (vs. username). */
  name: string
  /** Recent media — last 12 posts with engagement counts. */
  recentMedia: Array<{
    id: string
    caption: string
    mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
    permalink: string
    timestamp: string
    likeCount: number
    commentsCount: number
  }>
  /** Calculated: avg likes per post over recentMedia (engagement rate proxy). */
  avgLikesPerPost: number
  /** Calculated: (avgLikes + avgComments) / followers. Industry standard. */
  engagementRate: number
  /** When we fetched this. Always set server-side. */
  fetchedAt: string
}

interface BusinessDiscoveryResponse {
  business_discovery?: {
    username: string
    followers_count: number
    follows_count: number
    media_count: number
    biography?: string
    website?: string
    profile_picture_url?: string
    name?: string
    media?: {
      data: Array<{
        id: string
        caption?: string
        media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
        permalink: string
        timestamp: string
        like_count?: number
        comments_count?: number
      }>
    }
  }
  error?: { message: string; type: string; code: number }
}

/** Returns true when all required env vars are present. */
export function isInstagramGraphConfigured(): boolean {
  return !!(
    process.env.META_APP_ID &&
    process.env.META_APP_SECRET &&
    process.env.META_LONG_LIVED_TOKEN &&
    process.env.META_IG_BUSINESS_ID
  )
}

/**
 * Extract the IG handle from a URL (or pass-through if already a handle).
 * Returns lowercase handle without @ or trailing slash. Returns empty
 * string if we can't parse anything sensible.
 *
 * Examples:
 *   https://instagram.com/dylan.j.meehan/  → dylan.j.meehan
 *   instagram.com/dylan.j.meehan?utm=foo   → dylan.j.meehan
 *   @dylan.j.meehan                        → dylan.j.meehan
 *   dylan.j.meehan                         → dylan.j.meehan
 *   https://instagram.com/p/abc123/        → '' (post URL, no handle)
 */
export function extractInstagramHandle(input: string): string {
  if (!input) return ''
  const trimmed = input.trim().toLowerCase().replace(/^@/, '')

  // If it doesn't look like a URL, treat as handle.
  if (!trimmed.includes('/') && !trimmed.includes('.')) {
    return /^[a-z0-9._]{1,30}$/.test(trimmed) ? trimmed : ''
  }

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : 'https://' + trimmed)
    if (!url.hostname.includes('instagram.com')) return ''
    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length === 0) return ''
    const first = segments[0]
    // Skip non-handle paths (posts, reels, stories, explore).
    if (['p', 'reel', 'reels', 'stories', 'explore', 'tv', 'accounts'].includes(first)) {
      return ''
    }
    return /^[a-z0-9._]{1,30}$/.test(first) ? first : ''
  } catch {
    return ''
  }
}

/**
 * Discriminated result from fetchInstagramMetrics. Lets the caller
 * (e.g. /api/instagram-fetch) distinguish "this account is genuinely
 * a personal IG and won't ever return metrics" (long cache TTL is
 * fine) from "transient failure — try again in 5 min" (short TTL).
 *
 * Added 2026-05-23 to fix the fill-rate regression: the prior code
 * returned `null` for every failure and the worker cached a 24h
 * "unavailable" tombstone, so one Meta API outage / rate-limit burst
 * could poison hundreds of valid Business accounts for a full day.
 */
export type InstagramFetchResult =
  | { status: 'ok'; metrics: InstagramGraphMetrics }
  /** Confirmed personal/unauthorized account — caller may cache long. */
  | { status: 'personal'; reason: string }
  /** Confirmed not-found — caller may cache long. */
  | { status: 'not_found'; reason: string }
  /** Rate-limited by Meta. Caller should cache SHORT and retry soon. */
  | { status: 'rate_limited'; reason: string }
  /** Token expired / auth failure. Caller should cache SHORT — we
   *  need to refresh the token, not blacklist the handle. */
  | { status: 'auth_error'; reason: string }
  /** Network error / abort / unknown. Caller should cache SHORT. */
  | { status: 'transient'; reason: string }
  /** Env not configured — graceful degrade. */
  | { status: 'not_configured'; reason: string }

/**
 * Fetch IG metrics via Meta Business Discovery. Returns a
 * discriminated result so the caller can choose the right cache TTL
 * for each failure mode (see InstagramFetchResult above).
 *
 * Common Meta error codes seen in practice:
 *   - 110: "Not a valid Instagram Business or Creator Account" (personal)
 *   - 100: "Object with ID ... does not exist" (account doesn't exist)
 *   - 24:  "Application request limit reached" (rate limit)
 *   - 4:   "Application request limit reached" (rate limit, alt code)
 *   - 17:  "User request limit reached" (per-user rate limit)
 *   - 190: "Invalid OAuth access token" (refresh needed)
 *   - 102: "Session has expired"
 */
export async function fetchInstagramMetrics(handle: string): Promise<InstagramFetchResult> {
  if (!isInstagramGraphConfigured()) {
    return { status: 'not_configured', reason: 'Meta env vars missing' }
  }
  const cleaned = extractInstagramHandle(handle)
  if (!cleaned) {
    return { status: 'not_found', reason: `could not extract handle from "${handle}"` }
  }

  const igBusinessId = process.env.META_IG_BUSINESS_ID!
  const token = process.env.META_LONG_LIVED_TOKEN!

  // Business Discovery query — nested in our IG Business account's node.
  // Fields list: handle metadata + last 12 media items with engagement.
  const fields =
    `business_discovery.username(${cleaned}){` +
    `username,followers_count,follows_count,media_count,biography,website,profile_picture_url,name,` +
    `media.limit(12){id,caption,media_type,permalink,timestamp,like_count,comments_count}` +
    `}`

  const url = `https://graph.facebook.com/v22.0/${igBusinessId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`

  // 2026-05-23 per Dylan: IG metrics fill rate regressed from 90%+
  // to a lower rate. Most likely cause: Meta Graph API requests
  // hang under rate-pressure (the QStash worker has its own
  // timeout, but without a fetch-level abort the response never
  // resolves and the worker times out without writing a result).
  // Adding a 10s AbortController timeout so the fetch always
  // resolves — either with data or a clean failure — and the
  // worker can log/skip and move on instead of hanging.
  let json: BusinessDiscoveryResponse
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)
    let res: Response
    try {
      res = await fetch(url, { method: 'GET', signal: controller.signal })
    } finally {
      clearTimeout(timeoutId)
    }
    json = await res.json()
  } catch (e) {
    const msg = (e as Error).message
    const isAbort = (e as Error).name === 'AbortError'
    console.warn(
      `[ig-graph] fetch ${isAbort ? 'timed out (10s)' : 'failed'} for @${cleaned}:`,
      msg,
    )
    return { status: 'transient', reason: isAbort ? 'fetch timed out (10s)' : `network error: ${msg}` }
  }

  if (json.error) {
    const code = json.error.code
    const msg = json.error.message
    console.warn(`[ig-graph] API error @${cleaned} code=${code} msg="${msg}"`)

    // Rate limit family — short cache so we retry within minutes,
    // not days. Meta gives us 200 calls/hour total on Business
    // Discovery, but bursty workloads can throttle individual
    // handles even when we're under the global cap.
    if (code === 4 || code === 17 || code === 24 || code === 32 || code === 613) {
      return { status: 'rate_limited', reason: `Meta rate limit (code ${code}): ${msg}` }
    }
    // Auth — also short cache because we need to fix our token,
    // not blacklist the handle.
    if (code === 102 || code === 190) {
      return { status: 'auth_error', reason: `auth error (code ${code}): ${msg}` }
    }
    // Account doesn't exist (code 100 is the typical "does not
    // exist" object-not-found family).
    if (code === 100) {
      return { status: 'not_found', reason: `not found (code 100): ${msg}` }
    }
    // Confirmed personal / unauthorized account.
    if (code === 110) {
      return { status: 'personal', reason: `personal IG account (code 110)` }
    }
    // Unknown error code — treat as transient so we retry instead
    // of locking the handle in for a day.
    return { status: 'transient', reason: `API error code=${code}: ${msg}` }
  }

  const bd = json.business_discovery
  if (!bd) {
    // No error AND no business_discovery — usually means the user
    // is private/personal but Meta didn't return error code 110.
    // Cache as 'personal' so we don't retry forever.
    console.log(`[ig-graph] no business_discovery for @${cleaned} (likely personal account or private)`)
    return { status: 'personal', reason: 'no business_discovery in response' }
  }

  const recentMedia = (bd.media?.data || []).map(m => ({
    id: m.id,
    caption: m.caption || '',
    mediaType: m.media_type,
    permalink: m.permalink,
    timestamp: m.timestamp,
    likeCount: m.like_count || 0,
    commentsCount: m.comments_count || 0,
  }))

  const totalLikes = recentMedia.reduce((sum, m) => sum + m.likeCount, 0)
  const totalComments = recentMedia.reduce((sum, m) => sum + m.commentsCount, 0)
  const avgLikesPerPost = recentMedia.length > 0 ? totalLikes / recentMedia.length : 0
  const avgEngagementPerPost =
    recentMedia.length > 0 ? (totalLikes + totalComments) / recentMedia.length : 0
  const engagementRate =
    bd.followers_count > 0 ? avgEngagementPerPost / bd.followers_count : 0

  return {
    status: 'ok',
    metrics: {
      username: bd.username,
      followers: bd.followers_count,
      follows: bd.follows_count,
      mediaCount: bd.media_count,
      biography: bd.biography || '',
      website: bd.website || '',
      profilePictureUrl: bd.profile_picture_url || '',
      name: bd.name || '',
      recentMedia,
      avgLikesPerPost,
      engagementRate,
      fetchedAt: new Date().toISOString(),
    },
  }
}
