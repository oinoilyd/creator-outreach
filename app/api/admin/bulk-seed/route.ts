import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

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
  // Auth gate.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  }

  let body: { queries?: string[]; enrich?: boolean; concurrency?: number; maxResults?: number } = {}
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
  const concurrency = Math.max(1, Math.min(8, body.concurrency ?? 3))
  const maxResults = Math.max(5, Math.min(50, body.maxResults ?? 30))

  // We talk to ourselves over HTTP so the existing search/enrich
  // routes' caching, dual-write, and circuit-breakers all run as
  // they would for a normal user request.
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}`

  const startedAt = Date.now()
  let queriesRun = 0
  let channelsSeen = 0
  const channelIds = new Set<string>()
  const errors: string[] = []

  // Helper to run /api/search internally for one query.
  async function runOneSearch(q: string): Promise<void> {
    try {
      const url = new URL(`${baseUrl}/api/search`)
      url.searchParams.set('keyword', q)
      url.searchParams.set('maxResults', String(maxResults))
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { cookie: req.headers.get('cookie') || '' },
        cache: 'no-store',
      })
      if (!res.ok) {
        errors.push(`search "${q}" → HTTP ${res.status}`)
        return
      }
      const json = (await res.json()) as { channels?: { channelId: string }[] }
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
    while (queue.length > 0) {
      const q = queue.shift()
      if (!q) break
      await runOneSearch(q)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  // Optional enrich pass.
  let enrichesAttempted = 0
  if (enrich && channelIds.size > 0) {
    const eq = [...channelIds]
    async function enrichWorker() {
      while (eq.length > 0) {
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
  })
}
