import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

// 45s soft budget gives 15s of cleanup time before Vercel's 60s
// hard kill. Earlier 55s was too tight — when one slow new_method-
// ology channel took 12s during cleanup, the response stream was
// truncated and the client saw "Load failed."
const SOFT_BUDGET_MS = 45_000

// Per-channel hard cap. /api/enrich's new_methodology fallback
// (AI vision + Wayback multi-snapshot) can take 12-15s each. With
// concurrency=2, two slow channels can blow our budget. Hard cap
// each fetch at 25s so one stuck channel never costs more than
// that. Implementation uses AbortController.
const PER_CHANNEL_TIMEOUT_MS = 25_000

export const maxDuration = 60

type Mode = 'no-email' | 'stale' | 'bounced' | 'all'
const VALID_MODES = new Set<Mode>(['no-email', 'stale', 'bounced', 'all'])

/** Default freshness window — emails older than this are 'stale'. */
const STALE_DAYS = 90

/**
 * POST /api/admin/bulk-enrich
 *
 * Re-runs the enrichment pipeline against channels already in the
 * cache. Used to chase emails for rows that came in via search-only
 * (e.g. an early bulk-seed run with enrich=off), or to force-refresh
 * stale/bounced rows.
 *
 * Body:
 *   {
 *     mode: 'no-email' | 'stale' | 'bounced' | 'all'
 *     limit?: number       — max channels to attempt this call (cap 50)
 *     offset?: number      — starting offset into the matching list
 *     concurrency?: number — parallel /api/enrich calls (1–4, default 2)
 *     dryRun?: boolean     — if true, return the would-process list without running
 *   }
 *
 * Server runs within a 55s soft budget. Client loops calls (with
 * incrementing offsets) until totalMatching reaches the consumed
 * count — same chunked-POST pattern bulk-seed uses to avoid Vercel
 * function timeouts.
 *
 * Returns:
 *   {
 *     ok, totalMatching, processedThisCall, channelIdsProcessed[],
 *     channelIdsRemaining[], errors[], elapsedMs, timedOut
 *   }
 */
export async function POST(req: NextRequest) {
  // Auth gate. Two acceptable paths (see bulk-seed for the same
  // pattern + rationale):
  //   1. Admin user cookie (browser request)
  //   2. Internal call from /api/admin/bulk-job/tick with a valid
  //      X-Internal-Bulk-Secret header.
  const internalSecret = req.headers.get('x-internal-bulk-secret')
  const expectedSecret = process.env.INTERNAL_BULK_SECRET
  const isInternal = !!(
    internalSecret &&
    expectedSecret &&
    internalSecret === expectedSecret
  )
  if (!isInternal) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
    }
  }

  let body: { mode?: Mode; limit?: number; offset?: number; concurrency?: number; dryRun?: boolean } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  const mode: Mode = body.mode && VALID_MODES.has(body.mode) ? body.mode : 'no-email'
  const limit = Math.max(1, Math.min(50, body.limit ?? 10))
  const offset = Math.max(0, body.offset ?? 0)
  const concurrency = Math.max(1, Math.min(4, body.concurrency ?? 2))
  const dryRun = !!body.dryRun

  // Service-role client to read the latest view (admin already
  // gated above; we just need the elevated read perms to count
  // freshly).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  }
  const sb = createServiceClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Build the filter for the chosen mode against
  // creator_enrichment_latest.
  //
  // Every mode also excludes synthetic test/smoke-check rows
  // (yt_channel_id starting with UC_TEST_, mock_, fake_) — those
  // exist for service-role health checks but aren't real YouTube
  // channels, so /api/enrich would 400 on them.
  function applyFilter<T extends { eq: any; is: any; lt: any; not: any }>(q: T): T {
    const staleCutoffIso = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString()
    let filtered: any = q.not('yt_channel_id', 'ilike', 'UC_TEST_%').not('yt_channel_id', 'ilike', 'mock_%').not('yt_channel_id', 'ilike', 'fake_%')
    if (mode === 'no-email') {
      // No email AND not bounced (bounced gets its own bucket)
      filtered = filtered.is('email', null).eq('email_bounced', false)
    } else if (mode === 'stale') {
      // Has email, not bounced, fetched longer than STALE_DAYS ago.
      filtered = filtered.eq('email_bounced', false).lt('fetched_at', staleCutoffIso)
    } else if (mode === 'bounced') {
      filtered = filtered.eq('email_bounced', true)
    }
    // 'all' falls through with just the test-row exclusion
    return filtered as T
  }

  // Step 1 — count matching rows for the UI.
  let totalMatching: number | null = 0
  try {
    let countQ = sb.from('creator_enrichment_latest').select('yt_channel_id', { count: 'exact', head: true })
    countQ = applyFilter(countQ)
    const { count, error } = await countQ
    if (error) {
      return NextResponse.json({ error: `count failed: ${error.message}` }, { status: 500 })
    }
    totalMatching = count ?? 0
  } catch (e: any) {
    return NextResponse.json({ error: `count threw: ${e?.message || e}` }, { status: 500 })
  }

  // Step 2 — fetch this page of channelIds.
  let pageIds: string[] = []
  try {
    let pageQ = sb.from('creator_enrichment_latest').select('yt_channel_id').range(offset, offset + limit - 1)
    pageQ = applyFilter(pageQ)
    const { data, error } = await pageQ
    if (error) {
      return NextResponse.json({ error: `page fetch failed: ${error.message}` }, { status: 500 })
    }
    pageIds = (data ?? []).map(r => r.yt_channel_id).filter(Boolean) as string[]
  } catch (e: any) {
    return NextResponse.json({ error: `page fetch threw: ${e?.message || e}` }, { status: 500 })
  }

  // Step 3 — dry run returns the list without enriching.
  if (dryRun) {
    return NextResponse.json({
      ok: true,
      mode,
      totalMatching,
      processedThisCall: 0,
      channelIdsProcessed: [],
      channelIdsRemaining: pageIds,
      errors: [],
      elapsedMs: 0,
      timedOut: false,
    })
  }

  // Step 4 — enrich each channel.
  let baseUrl: string
  try {
    const host = req.headers.get('host')
    const raw = process.env.NEXT_PUBLIC_SITE_URL || (host ? `https://${host}` : '')
    if (!raw) throw new Error('no host header and no NEXT_PUBLIC_SITE_URL')
    new URL(raw)
    baseUrl = raw.replace(/\/+$/, '')
  } catch (e: any) {
    return NextResponse.json({ error: `bad base URL: ${e?.message || e}` }, { status: 500 })
  }

  const startedAt = Date.now()
  const errors: string[] = []
  const processed: string[] = []
  let timedOut = false

  // For 'no-email'/'stale'/'bounced' modes, /api/enrich's L2 read
  // path may return the cached row instead of running fresh. Force
  // a real re-fetch by bypassing both Redis + Postgres via
  // ?aggressive=true. That triggers the skipCache branch which
  // skips both layers and runs the live pipeline.
  const forceFresh = mode !== 'all' || true // always force re-fetch on bulk-enrich

  const queue = [...pageIds]
  async function worker() {
    while (queue.length > 0 && !timedOut) {
      if (Date.now() - startedAt > SOFT_BUDGET_MS) {
        timedOut = true
        break
      }
      const id = queue.shift()
      if (!id) break
      // Per-channel timeout — abort the fetch if /api/enrich takes
      // longer than PER_CHANNEL_TIMEOUT_MS. Stops one slow channel
      // from eating the entire bulk budget.
      const controller = new AbortController()
      const timeoutHandle = setTimeout(() => controller.abort(), PER_CHANNEL_TIMEOUT_MS)
      try {
        const u = new URL(`${baseUrl}/api/enrich`)
        u.searchParams.set('channelId', id)
        if (forceFresh) u.searchParams.set('aggressive', 'true')
        const res = await fetch(u.toString(), {
          method: 'GET',
          headers: { cookie: req.headers.get('cookie') || '' },
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) {
          errors.push(`${id} → HTTP ${res.status}`)
        } else {
          processed.push(id)
        }
      } catch (e: any) {
        // AbortError when our timeout fires; surface that distinctly
        // so the operator can see whether channels are timing out.
        const msg = e?.name === 'AbortError'
          ? `timed out after ${PER_CHANNEL_TIMEOUT_MS / 1000}s`
          : e?.message || String(e)
        errors.push(`${id} → ${msg}`)
      } finally {
        clearTimeout(timeoutHandle)
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  return NextResponse.json({
    ok: true,
    mode,
    totalMatching,
    processedThisCall: processed.length,
    channelIdsProcessed: processed,
    channelIdsRemaining: queue, // anything we couldn't get to
    errors: errors.slice(0, 20),
    elapsedMs: Date.now() - startedAt,
    timedOut,
  })
}
