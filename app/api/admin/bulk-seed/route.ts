import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

// Vercel function timeout — 60s on hobby tier. Set the soft budget
// to 55s so we have time to flush the response before the platform
// kills us with a partial body (which the client then can't parse →
// "The string did not match the expected pattern" error).
const SOFT_BUDGET_MS = 55_000

// Bigger ceiling for Pro tier when env supports it. Setting
// maxDuration tells Vercel "I want longer" — silently capped to
// the plan's max if it exceeds.
export const maxDuration = 60

/**
 * POST /api/admin/bulk-seed — fan out a list of search queries
 * and seed creator_enrichment with whatever each search returns.
 *
 * Body:
 *   {
 *     queries: string[]      — list of search keywords (one per line)
 *     enrich: boolean        — also call /api/enrich for each result
 *                              (slower; finds emails)
 *     concurrency?: number   — how many queries to run in parallel (default 3)
 *     maxResults?: number    — cap per query (default 30)
 *   }
 *
 * Strategy:
 *   - Run queries with bounded concurrency
 *   - Each query hits /api/search internally → channels are saved
 *     to Postgres via the existing dual-write path
 *   - If enrich=true, call /api/enrich for each unique channel
 *     (also dual-writes to Postgres). De-dupe across queries so
 *     the same channel isn\\'t enriched twice.
 *   - Returns summary stats: queries run, channels seen, enrichments
 *     attempted, errors.
 *
 * Why this is admin-only:
 *   The enrich path runs DDG scraping + multi-source email lookups
 *   which are expensive + rate-limited externally. Limiting to the
 *   admin user keeps the bulk-seed harness from being abused.
 */
export async function POST(req: NextRequest) {
  // Auth gate. Two acceptable paths:
  //   1. Admin user cookie (browser request from the bulk-seed UI)
  //   2. Internal server-to-server call from /api/admin/bulk-job/tick
  //      (the QStash-driven background worker) bearing a shared secret
  //      via the X-Internal-Bulk-Secret header. The tick handler is
  //      itself QStash-signature-verified, so it acts as a trusted
  //      caller — but we still require the secret defense-in-depth so
  //      randos who somehow trigger this route can't bypass auth.
  //
  // To enable the background-job path, set INTERNAL_BULK_SECRET to a
  // strong random string in Vercel envs. Without it, only browser
  // requests work.
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

  let body: {
    queries?: string[]
    enrich?: boolean
    concurrency?: number
    maxResults?: number
    region?: string
  } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  const queries = (body.queries || [])
    .map(q => (typeof q === 'string' ? q.trim() : ''))
    .filter(Boolean)
    .slice(0, 100) // sanity cap — runner could DDoS itself otherwise

  if (queries.length === 0) {
    return NextResponse.json({ error: 'no queries provided' }, { status: 400 })
  }

  const enrich = !!body.enrich

  // Region passed through to /api/search via ?gl=. Empty string = no
  // region targeting (default global YouTube). Sanity-checked
  // against the alphanumeric ISO-3166 shape the search route
  // expects; anything else gets dropped silently.
  const regionRaw = (body.region || '').trim().toUpperCase()
  const region = /^[A-Z]{2}$/.test(regionRaw) ? regionRaw : ''
  // Lower defaults than before — bulk runs were hitting Vercel's
  // 60s timeout. Concurrency 2 + maxResults 15 gives us headroom
  // to process ~5–8 queries per call before timeout. Client now
  // chunks queries across multiple calls so big batches still
  // complete without hitting platform limits.
  const concurrency = Math.max(1, Math.min(4, body.concurrency ?? 2))
  const maxResults = Math.max(5, Math.min(30, body.maxResults ?? 15))

  // We talk to ourselves over HTTP so the existing search/enrich
  // routes' caching, dual-write, and circuit-breakers all run as
  // they would for a normal user request.
  let baseUrl: string
  try {
    const host = req.headers.get('host')
    const raw = process.env.NEXT_PUBLIC_SITE_URL || (host ? `https://${host}` : '')
    if (!raw) throw new Error('no host header and no NEXT_PUBLIC_SITE_URL configured')
    // Validate via URL constructor — throws "Invalid URL" if malformed
    new URL(raw)
    baseUrl = raw.replace(/\/+$/, '')
  } catch (e: any) {
    return NextResponse.json({ error: `bad base URL: ${e?.message || e}` }, { status: 500 })
  }

  const startedAt = Date.now()
  let queriesRun = 0
  let channelsSeen = 0
  const channelIds = new Set<string>()
  const errors: string[] = []
  let timedOut = false

  // Helper to run /api/search internally for one query.
  async function runOneSearch(q: string): Promise<void> {
    if (Date.now() - startedAt > SOFT_BUDGET_MS) {
      timedOut = true
      return
    }
    try {
      const url = new URL(`${baseUrl}/api/search`)
      url.searchParams.set('keyword', q)
      url.searchParams.set('maxResults', String(maxResults))
      // Bulk-seed always wants fresh discovery, never the 10-min
      // search-results cache. Otherwise re-runs of the same preset
      // would just re-return the same channels.
      url.searchParams.set('fresh', 'true')
      if (region) url.searchParams.set('gl', region)
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { cookie: req.headers.get('cookie') || '' },
        cache: 'no-store',
      })
      if (!res.ok) {
        errors.push(`search "${q}" → HTTP ${res.status}`)
        return
      }
      // Read the response carefully — we've seen Vercel return HTML
      // error pages on timeout that JSON.parse() chokes on.
      const text = await res.text()
      let json: { channels?: { channelId: string }[] }
      try {
        json = JSON.parse(text)
      } catch {
        errors.push(`search "${q}" → non-JSON response (${text.slice(0, 80)})`)
        return
      }
      const list = json.channels || []
      channelsSeen += list.length
      for (const c of list) {
        if (c.channelId) channelIds.add(c.channelId)
      }
    } catch (e: any) {
      errors.push(`search "${q}" → ${e?.message || e}`)
    } finally {
      queriesRun++
    }
  }

  // Concurrency-bounded queue.
  const queue = [...queries]
  async function worker() {
    while (queue.length > 0 && !timedOut) {
      const q = queue.shift()
      if (!q) break
      await runOneSearch(q)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  // Optional enrich pass — gated by remaining time budget.
  let enrichesAttempted = 0
  if (enrich && channelIds.size > 0 && !timedOut) {
    const eq = [...channelIds]
    async function enrichWorker() {
      while (eq.length > 0 && Date.now() - startedAt < SOFT_BUDGET_MS) {
        const id = eq.shift()
        if (!id) break
        enrichesAttempted++
        try {
          const u = new URL(`${baseUrl}/api/enrich`)
          u.searchParams.set('channelId', id)
          await fetch(u.toString(), {
            method: 'GET',
            headers: { cookie: req.headers.get('cookie') || '' },
            cache: 'no-store',
          })
        } catch (e: any) {
          errors.push(`enrich ${id} → ${e?.message || e}`)
        }
      }
      if (eq.length > 0) timedOut = true
    }
    await Promise.all(Array.from({ length: concurrency }, () => enrichWorker()))
  }

  const elapsedMs = Date.now() - startedAt
  return NextResponse.json({
    ok: true,
    queriesRun,
    channelsSeen,
    uniqueChannels: channelIds.size,
    enrichesAttempted,
    errors: errors.slice(0, 20),
    elapsedMs,
    timedOut,
    queriesRemaining: queue.length,
  })
}
