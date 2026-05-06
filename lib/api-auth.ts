import { NextResponse } from 'next/server'
import { createClient } from './supabase/server'

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

// In-memory sliding-window rate limiter. Per-instance state — good enough for
// abuse protection on AI/scrape endpoints (Anthropic + axios cost). A single
// abusive user is bounded to LIMIT*N where N = warm Vercel instances.
const buckets = new Map<string, number[]>()
const WINDOW_MS = 60 * 60 * 1000 // 1 hour

/**
 * Returns null if the user is under the limit (and records this hit).
 * Returns a 429 NextResponse if they're over.
 */
export function rateLimit(userId: string, endpoint: string, limitPerHour: number) {
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
