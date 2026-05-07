/**
 * Backend cache layer (Upstash Redis via Vercel KV integration).
 *
 * Why this exists:
 *   /api/search runs 30+ youtubei.js queries (15-40s) and /api/enrich
 *   runs DDG scraping per creator (5-12s). Repeat searches today
 *   re-run the entire pipeline because we have no caching. This
 *   wrapper turns hot reads into sub-10ms cache hits.
 *
 * Why we use the KV_REST_API_URL/TOKEN env names:
 *   The Vercel marketplace integration provisions Upstash but
 *   injects vars under Vercel's `KV_*` aliases (legacy from when
 *   Vercel had its own KV product, now resold Upstash). The
 *   @upstash/redis SDK's `Redis.fromEnv()` auto-detects either
 *   the upstream UPSTASH_REDIS_* names OR Vercel's KV_REST_API_*
 *   names, so we don't need to hand-wire the constructor.
 *
 * Graceful degrade:
 *   If the env vars are missing (e.g. local dev without `vercel env
 *   pull`), all cache calls become no-ops and the route falls
 *   through to the live pipeline. This keeps the app working
 *   without Redis configured.
 */

import { Redis } from '@upstash/redis'

let _client: Redis | null = null
function getClient(): Redis | null {
  if (_client) return _client
  // Detect both naming conventions
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  _client = new Redis({ url, token })
  return _client
}

/** TTL constants (seconds). */
export const CACHE_TTL = {
  /** Search-result cache — 24 hours. Same query within a day reuses
   *  the prior search. Beyond that the world's moved on enough that
   *  fresh results are likely worth the wait. */
  searchResults: 60 * 60 * 24,
  /** Per-creator enrichment cache — 7 days. Email + about + socials
   *  rarely change. If a creator goes private/deletes, the cache
   *  expires within a week. */
  creatorEnrichment: 60 * 60 * 24 * 7,
  /** AI-scored creator (per scoring weights) — 24 hours. Score
   *  formula is deterministic given inputs, but we cache anyway to
   *  skip the AI call. Drops when weights change (key includes hash). */
  scoredCreator: 60 * 60 * 24,
  /** Channel metadata (subs, last-video) — 1 hour. Faster decay than
   *  enrichment because subs/last-video do change. */
  channelMeta: 60 * 60,
} as const

/**
 * Read a JSON value from cache. Returns null on miss, on parse
 * failure, or when Redis isn't configured. Logs hits/misses with a
 * stable prefix so we can grep Vercel logs to measure hit rate.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getClient()
  if (!client) return null
  try {
    const raw = await client.get<T>(key)
    if (raw === null || raw === undefined) {
      console.log(`[cache MISS] ${key}`)
      return null
    }
    console.log(`[cache HIT]  ${key}`)
    return raw
  } catch (e) {
    console.warn(`[cache ERROR] ${key}:`, e)
    return null
  }
}

/**
 * Write a JSON value to cache with a TTL. Fire-and-forget on errors —
 * we never want a Redis hiccup to break the route.
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const client = getClient()
  if (!client) return
  try {
    await client.set(key, value, { ex: ttlSeconds })
  } catch (e) {
    console.warn(`[cache SET error] ${key}:`, e)
  }
}

/**
 * Delete a cache entry. Used when we want to invalidate (e.g. user
 * marks a deep-search complete and we want fresh data next time).
 */
export async function cacheDel(key: string): Promise<void> {
  const client = getClient()
  if (!client) return
  try {
    await client.del(key)
  } catch (e) {
    console.warn(`[cache DEL error] ${key}:`, e)
  }
}

/**
 * Build a stable cache key from a search query + filters. Sorts
 * filter object keys before stringifying so {a:1,b:2} and {b:2,a:1}
 * produce the same key.
 */
export function searchCacheKey(query: string, filters: Record<string, unknown> = {}): string {
  const normalized = query.trim().toLowerCase()
  const filterString = JSON.stringify(filters, Object.keys(filters).sort())
  return `search:v1:${normalized}|${filterString}`
}

/** Per-creator cache key — channelId is the natural unique identifier. */
export function enrichmentCacheKey(channelId: string): string {
  return `enrich:v1:${channelId}`
}
