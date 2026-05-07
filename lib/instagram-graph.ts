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
 * Fetch IG metrics via Meta Business Discovery. Returns null when:
 *   - env vars missing (graceful degrade)
 *   - target account is personal (Meta returns no business_discovery)
 *   - target account doesn't exist
 *   - API error (logged, not thrown)
 *
 * Caller should treat null as "no metrics available, skip storage."
 */
export async function fetchInstagramMetrics(handle: string): Promise<InstagramGraphMetrics | null> {
  if (!isInstagramGraphConfigured()) {
    return null
  }
  const cleaned = extractInstagramHandle(handle)
  if (!cleaned) return null

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

  let json: BusinessDiscoveryResponse
  try {
    const res = await fetch(url, { method: 'GET' })
    json = await res.json()
  } catch (e) {
    console.warn(`[ig-graph] fetch failed for @${cleaned}:`, (e as Error).message)
    return null
  }

  if (json.error) {
    // Common errors:
    //   - code 110: "Not a valid Instagram Business or Creator Account" (personal acct)
    //   - code 24: "Application request limit reached" (rate limit)
    //   - code 190: "Invalid OAuth access token" (expired token, refresh)
    console.warn(`[ig-graph] API error @${cleaned} code=${json.error.code} msg="${json.error.message}"`)
    return null
  }

  const bd = json.business_discovery
  if (!bd) {
    console.log(`[ig-graph] no business_discovery for @${cleaned} (personal account or not found)`)
    return null
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
  }
}
