import { NextResponse } from 'next/server'
import { createClient } from './supabase/server'
import { cacheIncrWindow } from './cache'

/**
 * Verify the request has a valid Supabase session.
 * Returns either the authenticated user or a 401 NextResponse to short-circuit.
 *
 * Usage:
 *   const auth = await requireUser()
 *   if (auth instanceof NextResponse) return auth
 *   const user = auth
 *   // ...handler logic, with `user.id` available for scoping
 */
export async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return user
}

// Admin emails that bypass rate limits entirely. Mirrors the
// FALLBACK_BYPASS pattern in lib/billing/paywall.ts. Critical because
// bulk admin operations (seed, enrich) authenticate AS Dylan and
// each one of those internal /api/search calls consumes his hourly
// quota — meaning a single bulk-seed run locks him out of his own
// app for ~52 minutes. Dylan 2026-06-09 post-incident.
const RATE_LIMIT_BYPASS_EMAILS = new Set([
  'dmeehanj@gmail.com', // owner only — bulk admin ops (seed/enrich) run as Dylan
])

// In-memory sliding-window rate limiter. Per-instance state — good enough for
// abuse protection on AI/scrape endpoints (Anthropic + axios cost). A single
// abusive user is bounded to LIMIT*N where N = warm Vercel instances.
const buckets = new Map<string, number[]>()
const WINDOW_MS = 60 * 60 * 1000 // 1 hour

/**
 * Returns null if the user is under the limit (and records this hit).
 * Returns a 429 NextResponse if they're over.
 *
 * Admin emails on RATE_LIMIT_BYPASS_EMAILS skip the check entirely.
 * Pass `userEmail` so the bypass can fire — without it the caller
 * is treated as a regular user.
 */
export function rateLimit(
  userId: string,
  endpoint: string,
  limitPerHour: number,
  userEmail?: string | null,
) {
  if (userEmail && RATE_LIMIT_BYPASS_EMAILS.has(userEmail)) {
    return null // admin bypass — no bucket write, no 429
  }
  const key = `${userId}:${endpoint}`
  const now = Date.now()
  const cutoff = now - WINDOW_MS
  const hits = (buckets.get(key) || []).filter(t => t > cutoff)
  if (hits.length >= limitPerHour) {
    const oldestInWindow = hits[0]
    const retryAfterSec = Math.max(1, Math.ceil((oldestInWindow + WINDOW_MS - now) / 1000))
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${Math.ceil(retryAfterSec / 60)} min.` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    )
  }
  hits.push(now)
  buckets.set(key, hits)
  return null
}

/**
 * Cross-instance rate limit, backed by Redis (Upstash/Vercel KV).
 *
 * Use this for the HIGH-VOLUME cost endpoints (search / enrich / product /
 * video-descs / instagram-status) — the ones called many times per search.
 * The in-memory `rateLimit` above stores counts per-Vercel-instance, so
 * under a traffic spike (many warm lambdas) the effective cap balloons to
 * `limit × instanceCount` exactly when you'd want it to bind — a direct
 * path to a runaway Anthropic/scraping bill. A shared Redis counter is the
 * same regardless of how many instances are warm.
 *
 * Fails OPEN to the per-instance limiter when Redis is unconfigured/down,
 * so a Redis hiccup degrades to today's behaviour rather than locking
 * everyone out. Async — callers MUST await.
 */
export async function rateLimitRedis(
  userId: string,
  endpoint: string,
  limitPerHour: number,
  userEmail?: string | null,
) {
  if (userEmail && RATE_LIMIT_BYPASS_EMAILS.has(userEmail)) {
    return null // owner bypass — no count, no 429
  }
  const count = await cacheIncrWindow(`rl:${userId}:${endpoint}`, WINDOW_MS / 1000)
  if (count == null) {
    // Redis unavailable → fall back to the per-instance limiter (no worse
    // than before; there's still SOME cap).
    return rateLimit(userId, endpoint, limitPerHour, userEmail)
  }
  if (count > limitPerHour) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in a bit.' },
      { status: 429, headers: { 'Retry-After': '600' } },
    )
  }
  return null
}
