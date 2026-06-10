/**
 * Frontend-facing IG metrics lookup.
 *
 * GET /api/instagram-status?handle=somehandle
 *
 * Returns:
 *   { status: 'ready', metrics: {...} }     — fresh data (Meta API or scrape)
 *   { status: 'pending' }                   — Meta job in flight, poll again
 *   { status: 'unavailable', reason: '...' }— couldn't resolve from any source
 *   { status: 'invalid_handle' }            — couldn't parse the handle
 *
 * Source resolution order:
 *   1. Hot cache (Redis 7d TTL) — populated by either Meta worker or
 *      this route's own scrape fallback. Always preferred.
 *   2. Meta Graph API — when configured AND the QStash worker has
 *      written to cache. We don't hit Meta inline; it goes through
 *      the worker.
 *   3. Public IG profile scrape — fallback when Meta isn't configured
 *      yet (Business Manager setup pending). Runs inline, ~1-3s,
 *      caches result for 7d.
 *
 * Auth: requires a valid Supabase session.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireUser, rateLimit } from '@/lib/api-auth'
import { cacheGet, cacheSet, CACHE_TTL } from '@/lib/cache'
import { isInstagramGraphConfigured, extractInstagramHandle } from '@/lib/instagram-graph'
import { scrapeInstagramProfile } from '@/lib/instagram-scrape'

interface CacheEntryReady {
  username: string
  followers: number
  follows?: number
  mediaCount?: number
  posts?: number
  biography?: string
  name?: string
  profilePictureUrl?: string
  engagementRate?: number
  avgLikesPerPost?: number
  source?: string
  fetchedAt?: string
}

interface CacheEntryUnavailable {
  unavailable: true
  fetchedAt: string
}

// MUST stay in sync with /api/instagram-fetch's igMetricsCacheKey.
// 2026-05-23: bumped v1 → v2 alongside the per-failure-mode TTL fix
// in the worker. Catastrophic if these drift — the writer would
// write to one key and the reader would check the other, producing
// a 0% fill rate (Dylan caught this within minutes of the deploy).
const cacheKey = (handle: string) => `ig-metrics:v2:${handle.toLowerCase()}`

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth

  // Cap polling load — frontend polls every 3s for ~30s per handle.
  // 100/hr per user is generous: covers a 100-creator search × 12
  // poll cycles each, then some.
  const limited = rateLimit(auth.id, 'instagram-status', 100, auth.email)
  if (limited) return limited

  const { searchParams } = new URL(req.url)
  const handleRaw = searchParams.get('handle') || ''
  const handle = extractInstagramHandle(handleRaw)
  if (!handle) {
    return NextResponse.json({ status: 'invalid_handle' }, { status: 400 })
  }

  // 1. Hot cache check — covers Meta-API-written entries, prior
  //    scrape-written entries, and short-TTL tombstones.
  const cached = await cacheGet<CacheEntryReady | CacheEntryUnavailable>(cacheKey(handle))
  if (cached) {
    if ('unavailable' in cached && cached.unavailable) {
      return NextResponse.json({
        status: 'unavailable',
        handle,
        reason: 'not resolvable from public IG page or Meta Graph API',
      })
    }
    return NextResponse.json({ status: 'ready', handle, metrics: cached })
  }

  // 2. INLINE SCRAPE — Dylan 2026-05-23 v4 ("instagram metrics are
  //    still not pulling in at all... 90% success rate").
  //
  //    Previously this path only ran when Meta Graph wasn't configured.
  //    That meant: if Meta IS configured but the QStash worker is
  //    broken / slow / its env keys rotated / its credit ran out,
  //    we'd return 'pending' forever, the frontend would poll a
  //    handful of times, give up, and the row stays empty. Result:
  //    apparent fill rate at the mercy of QStash health.
  //
  //    Fix: always attempt the scrape on first poll, regardless of
  //    Meta config. The scrape gives us the headline numbers
  //    (followers, follows, posts, bio) — exactly the fields the
  //    Outreach table renders. If Meta IS configured, the QStash
  //    worker still runs in the background and writes the richer
  //    payload (engagement rate, recent media) which overwrites the
  //    scrape cache when it lands. The user gets data on the FIRST
  //    poll, not when QStash decides to deliver.
  //
  //    Cache TTL choice (15 min for scrape data): short enough that
  //    the Meta worker's 7-day write can take over cleanly when it
  //    completes, long enough that re-searches within the session
  //    don't re-scrape unnecessarily.
  const scraped = await scrapeInstagramProfile(handle)
  if (scraped) {
    const cacheValue: CacheEntryReady = {
      username: scraped.username,
      followers: scraped.followers,
      follows: scraped.follows,
      posts: scraped.posts,
      mediaCount: scraped.posts,         // alias for Meta-shape parity
      biography: scraped.biography,
      name: scraped.name,
      profilePictureUrl: scraped.profilePictureUrl,
      source: scraped.source,
      fetchedAt: scraped.fetchedAt,
    }
    // 15-min TTL for scrape — gives the Meta worker (if configured)
    // a window to overwrite with richer data. The Meta worker writes
    // with CACHE_TTL.creatorEnrichment (7 days).
    const scrapeTTL = isInstagramGraphConfigured() ? 15 * 60 : CACHE_TTL.creatorEnrichment
    await cacheSet(cacheKey(handle), cacheValue, scrapeTTL)
    return NextResponse.json({ status: 'ready', handle, metrics: cacheValue })
  }

  // 3. Scrape failed AND Meta is configured — the worker might still
  //    succeed (different code path, has token auth). Return 'pending'
  //    so the frontend polls again; worker should land within ~10s.
  if (isInstagramGraphConfigured()) {
    return NextResponse.json({ status: 'pending', handle })
  }

  // 4. Truly unavailable — scrape failed AND no Meta to fall back on.
  //    5-min tombstone so we retry quickly (login walls are usually
  //    a few-minute throttle, not permanent).
  await cacheSet(
    cacheKey(handle),
    {
      unavailable: true,
      reason: 'scrape_failed',
      detail: 'IG returned login wall or 404',
      fetchedAt: new Date().toISOString(),
    },
    5 * 60,
  )
  return NextResponse.json({
    status: 'unavailable',
    handle,
    reason: 'not resolvable — scrape returned login wall or 404',
  })
}
