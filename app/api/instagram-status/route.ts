/**
 * Frontend-facing IG metrics lookup.
 *
 * GET /api/instagram-status?handle=somehandle
 *
 * Returns:
 *   { status: 'ready', metrics: {...} }     — Redis hit, fresh data
 *   { status: 'pending' }                   — no cache yet, job in flight
 *   { status: 'unavailable', reason: '...' }— tombstoned (personal acct,
 *                                             not found, rate-limited)
 *   { status: 'unconfigured' }              — Meta env vars not set
 *
 * The frontend polls this every ~3-5s for ~20s after a search to
 * progressively fill in IG metrics columns. After 20s without a
 * resolution, fall back to whatever scraped/estimated data the
 * existing /api/enrich payload already returned.
 *
 * Auth: requires a valid Supabase session (don't expose to randos).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { cacheGet } from '@/lib/cache'
import { isInstagramGraphConfigured, extractInstagramHandle } from '@/lib/instagram-graph'

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const handleRaw = searchParams.get('handle') || ''
  const handle = extractInstagramHandle(handleRaw)
  if (!handle) {
    return NextResponse.json({ status: 'invalid_handle' }, { status: 400 })
  }

  if (!isInstagramGraphConfigured()) {
    return NextResponse.json({ status: 'unconfigured' })
  }

  const cacheKey = `ig-metrics:v1:${handle}`
  const cached = await cacheGet<{ unavailable?: boolean; followers?: number }>(cacheKey)

  if (!cached) {
    return NextResponse.json({ status: 'pending', handle })
  }

  if ('unavailable' in cached && cached.unavailable) {
    return NextResponse.json({
      status: 'unavailable',
      handle,
      reason: 'not a Business or Creator account, or not found',
    })
  }

  return NextResponse.json({ status: 'ready', handle, metrics: cached })
}
