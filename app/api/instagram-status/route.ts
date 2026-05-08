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

const cacheKey = (handle: string) => `ig-metrics:v1:${handle}`

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth

  // Cap polling load — frontend polls every 3s for ~30s per handle.
  // 100/hr per user is generous: covers a 100-creator search × 12
  // poll cycles each, then some.
  const limited = rateLimit(auth.id, 'instagram-status', 100)
  if (limited) return limited

  const { searchParams } = new URL(req.url)
  const handleRaw = searchParams.get('handle') || ''
  const handle = extractInstagramHandle(handleRaw)
  if (!handle) {
    return NextResponse.json({ status: 'invalid_handle' }, { status: 400 })
  }

  // 1. Hot cache check — covers both Meta-API-written entries and
  //    prior scrape-written entries.
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

  // 2. Meta API path — if configured, the QStash worker is in flight;
  //    return 'pending' so frontend keeps polling. Worker will write
  //    to cache and the next poll will hit branch 1.
  if (isInstagramGraphConfigured()) {
    return NextResponse.json({ status: 'pending', handle })
  }

  // 3. Scrape fallback — Meta not configured. Hit IG public page
  //    inline, write the result to cache (so future polls hit branch
  //    1 in sub-10ms), return immediately. ~1-3s on first hit per
  //    handle; subsequent searches see the cached result for 7 days.
  const scraped = await scrapeInstagramProfile(handle)
  if (!scraped) {
    // Tombstone — don't retry this handle for 24h.
    await cacheSet(cacheKey(handle), { unavailable: true, fetchedAt: new Date().toISOString() }, 60 * 60 * 24)
    return NextResponse.json({
      status: 'unavailable',
      handle,
      reason: 'IG returned login wall or 404',
    })
  }

  // Cache the scrape result. Same shape as Meta cache (subset of
  // fields), 7d TTL. The frontend doesn't care which source filled
  // the cache.
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
  await cacheSet(cacheKey(handle), cacheValue, CACHE_TTL.creatorEnrichment)

  return NextResponse.json({ status: 'ready', handle, metrics: cacheValue })
}
