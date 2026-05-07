/**
 * QStash worker — receives a {handle, ytChannelId?} job, hits Meta
 * Graph API, writes the result to Redis (hot cache) + Postgres
 * (permanent historical log).
 *
 * This route is called by QStash, not by the browser. The
 * upstash-signature header is verified to keep randos from triggering
 * Meta API calls or polluting our cache.
 *
 * Idempotency: the same handle hitting this route within
 * INSTAGRAM_FETCH_DEDUP_WINDOW seconds is a no-op (we just keep the
 * existing snapshot). QStash also dedups via Upstash-Deduplication-Id
 * at publish time but defense-in-depth here is cheap.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { fetchInstagramMetrics, isInstagramGraphConfigured } from '@/lib/instagram-graph'
import { verifyQStashSignature } from '@/lib/qstash'
import { cacheGet, cacheSet, CACHE_TTL } from '@/lib/cache'

interface JobPayload {
  handle: string
  ytChannelId?: string
}

/** Cache key for IG metrics. Lowercased handle, no @. */
function igMetricsCacheKey(handle: string): string {
  return `ig-metrics:v1:${handle.toLowerCase()}`
}

/** Service-role Supabase client. Bypasses RLS — only the worker uses this. */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createServiceClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function POST(req: NextRequest) {
  // 1. Read raw body (we need it for signature verification).
  const rawBody = await req.text()

  // 2. Verify QStash signature unless we're in dev mode.
  //    In local dev without QStash signing keys, allow unsigned for
  //    manual testing — protected by the env-guarded no-op everywhere.
  if (process.env.NODE_ENV === 'production') {
    const sig = req.headers.get('upstash-signature')
    const url = `${req.nextUrl.origin}${req.nextUrl.pathname}`
    if (!verifyQStashSignature(rawBody, sig, url)) {
      console.warn('[ig-fetch] invalid QStash signature, rejecting')
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
    }
  }

  // 3. Parse the job payload.
  let payload: JobPayload
  try {
    payload = JSON.parse(rawBody) as JobPayload
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const handle = (payload.handle || '').toLowerCase().replace(/^@/, '').trim()
  if (!handle) {
    return NextResponse.json({ error: 'missing handle' }, { status: 400 })
  }

  // 4. Skip if Meta isn't configured (graceful degrade — useful while
  //    we're still in the App Review wait period and don't want jobs
  //    piling up).
  if (!isInstagramGraphConfigured()) {
    console.log('[ig-fetch] Meta Graph not configured, skipping')
    return NextResponse.json({ skipped: 'meta not configured' })
  }

  // 5. Dedup window — if we have a fresh snapshot in Redis already,
  //    skip the Meta call. Postgres is the long-term store; Redis is
  //    the short-circuit.
  const cacheKey = igMetricsCacheKey(handle)
  const existing = await cacheGet<unknown>(cacheKey)
  if (existing) {
    console.log(`[ig-fetch] cache hit for @${handle}, skipping fetch`)
    return NextResponse.json({ skipped: 'cache fresh' })
  }

  // 6. Hit Meta Graph API.
  const metrics = await fetchInstagramMetrics(handle)
  if (!metrics) {
    // Personal account, doesn't exist, rate-limited, or token expired.
    // Cache a tombstone for 1 day so we don't retry on every search.
    await cacheSet(cacheKey, { unavailable: true, fetchedAt: new Date().toISOString() }, 60 * 60 * 24)
    console.log(`[ig-fetch] no metrics for @${handle} (likely personal account)`)
    return NextResponse.json({ unavailable: true })
  }

  // 7. Write to Redis (hot cache, 7d TTL).
  await cacheSet(cacheKey, metrics, CACHE_TTL.creatorEnrichment)

  // 8. Append to Postgres (permanent historical log).
  const supabase = getServiceClient()
  if (supabase) {
    const { error } = await supabase.from('creator_ig_metrics').insert({
      ig_username: metrics.username.toLowerCase(),
      yt_channel_id: payload.ytChannelId || null,
      followers: metrics.followers,
      follows: metrics.follows,
      media_count: metrics.mediaCount,
      engagement_rate: metrics.engagementRate,
      avg_likes_per_post: metrics.avgLikesPerPost,
      biography: metrics.biography,
      display_name: metrics.name,
      website: metrics.website,
      profile_picture_url: metrics.profilePictureUrl,
      recent_media_json: metrics.recentMedia,
      source: 'meta_graph',
      raw_response_json: metrics,
    })
    if (error) {
      console.warn(`[ig-fetch] Postgres insert failed for @${handle}:`, error.message)
    } else {
      console.log(`[ig-fetch] persisted @${handle} (${metrics.followers} followers, ER ${(metrics.engagementRate * 100).toFixed(2)}%)`)
    }
  } else {
    console.log(`[ig-fetch] no service client — skipping Postgres write for @${handle}`)
  }

  return NextResponse.json({ ok: true, handle: metrics.username, followers: metrics.followers })
}

// Allow GET for health checks (no Meta call, just status).
export async function GET() {
  return NextResponse.json({
    ok: true,
    metaGraphConfigured: isInstagramGraphConfigured(),
  })
}
