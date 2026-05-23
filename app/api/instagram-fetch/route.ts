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

/** Cache key for IG metrics. Lowercased handle, no @.
 *
 * 2026-05-23: bumped v1 → v2 alongside the TTL-per-failure-mode
 * fix. The bump invalidates all existing 24h tombstones from the
 * legacy single-TTL code path, so users see the fill-rate
 * improvement immediately on next search rather than having to
 * wait up to 24h for the old tombstones to age out. v2 entries
 * are written by the new code with the per-mode TTLs. */
function igMetricsCacheKey(handle: string): string {
  return `ig-metrics:v2:${handle.toLowerCase()}`
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
  //
  // 2026-05-23 per Dylan: BIG fix. Previously every non-ok result
  // got a 24h "unavailable" tombstone — one Meta rate-limit burst
  // or transient outage could poison hundreds of valid Business
  // accounts for a full day, killing the fill rate. fetchInstagramMetrics
  // now returns a discriminated result so we can right-size the
  // TTL per failure mode:
  //
  //   - 'ok'             → real metrics, full creatorEnrichment TTL (7d)
  //   - 'personal'       → confirmed personal account, 7d TTL (won't
  //                        change soon — long cache is fine)
  //   - 'not_found'      → confirmed account doesn't exist, 7d TTL
  //   - 'rate_limited'   → Meta throttled us — 5 min TTL, retry soon
  //   - 'auth_error'     → our token broke — 5 min TTL, fix env then retry
  //   - 'transient'      → network / timeout / unknown — 5 min TTL
  //   - 'not_configured' → no env, skip entirely (no tombstone)
  const SHORT_FAILURE_TTL = 5 * 60        // 5 min — retry transient failures soon
  const LONG_FAILURE_TTL = 60 * 60 * 24 * 7 // 7 days — confirmed personal/not-found

  const result = await fetchInstagramMetrics(handle)

  if (result.status === 'not_configured') {
    console.log(`[ig-fetch] not configured for @${handle}, skipping (no tombstone)`)
    return NextResponse.json({ skipped: 'not configured' })
  }

  if (result.status !== 'ok') {
    const ttl =
      result.status === 'personal' || result.status === 'not_found'
        ? LONG_FAILURE_TTL
        : SHORT_FAILURE_TTL
    await cacheSet(
      cacheKey,
      {
        unavailable: true,
        reason: result.status,
        detail: result.reason,
        fetchedAt: new Date().toISOString(),
      },
      ttl,
    )
    console.log(
      `[ig-fetch] @${handle} → ${result.status} (TTL ${ttl}s): ${result.reason}`,
    )
    return NextResponse.json({ unavailable: true, reason: result.status })
  }

  const metrics = result.metrics

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
