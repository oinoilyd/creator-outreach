/**
 * Helper for the creator_enrichment durable cache.
 *
 * The Redis cache in lib/cache.ts is the hot tier (sub-10ms reads,
 * 7-day TTL, evictable). This module is the warm tier — append-only
 * Postgres snapshots that survive Redis evictions and let us share
 * resolved emails + socials across users.
 *
 * Usage today (Phase 1):
 *   - /api/enrich calls saveEnrichmentSnapshot(...) on every
 *     successful resolution. Read path is unchanged — Redis still
 *     primary.
 *
 * Usage tomorrow (Phase 2):
 *   - Read path becomes Redis → getLatestEnrichment(...) → live
 *     fetch. Postgres data carries us through Redis evictions.
 */
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Snapshot payload — mirrors the columns in creator_enrichment.
 * All fields except yt_channel_id are optional (we can write a
 * partial snapshot if a strategy resolved only some fields).
 */
export type EnrichmentSnapshot = {
  yt_channel_id: string
  channel_name?: string | null
  niche?: string | null
  email?: string | null
  email_source?: string | null
  email_bounced?: boolean
  linkedin_url?: string | null
  instagram_handle?: string | null
  twitter_handle?: string | null
  website?: string | null
  subscribers?: number | null
  avg_views?: number | null
  last_video_at?: string | null // ISO
  recent_video_dates?: string[] | null
  raw_response_json?: unknown
}

/**
 * Latest-snapshot row shape (from the creator_enrichment_latest view).
 */
export type EnrichmentLatest = EnrichmentSnapshot & {
  id: number
  fetched_at: string
}

/**
 * Service-role Supabase client. Bypasses RLS so the worker can
 * INSERT into creator_enrichment without a user session. Returns
 * null when the env vars are missing — caller must handle that.
 */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createServiceClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Bulk-insert snapshots from a search response.
 *
 * The search route doesn't run /api/enrich inline (would be 5+ min
 * for 30 results). What it DOES know: channel id, name, subs,
 * avg_views, recent video dates. So a search-time write is
 * inherently partial in those fields.
 *
 * BUT — every snapshot is append-only AND creator_enrichment_latest
 * is `DISTINCT ON (yt_channel_id) ORDER BY fetched_at DESC`. If we
 * just wrote `email = null` for a channel we've already enriched,
 * the new partial row would MASK the older fully-enriched row in
 * the latest-view. Admin DB would then show "no email" for a
 * channel that actually has one.
 *
 * Fix: before insert, batch-look-up the latest snapshot for each
 * channel. Carry forward email + socials + email_bounced from the
 * existing row, refresh subs/avg_views/recent_video_dates from the
 * search hit. The new row is ALWAYS a complete snapshot — partial
 * only for first-time channels.
 *
 * Side benefits:
 *   - subs/avg_views drift naturally without needing a re-enrich
 *   - bulk-enrich's "stale" filter reflects last-seen, not last-enriched
 *
 * Fire-and-forget. Failures log but never throw.
 */
type SearchHit = {
  channelId: string
  channelName: string
  subscribers: string | number
  avgViews: number | null
  videoDates?: string[]
  videoTitles?: string[]
}
export async function bulkSaveSearchResults(hits: SearchHit[], niche: string): Promise<void> {
  if (!hits || hits.length === 0) return
  const sb = getServiceClient()
  if (!sb) return
  const parseSubs = (s: string | number | null): number | null => {
    if (typeof s === 'number') return Number.isFinite(s) ? Math.round(s) : null
    if (!s) return null
    const n = Number(String(s).replace(/[^0-9.]/g, ''))
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null
  }
  // Cap at 50 hits — search routes return up to ~30 today, but the
  // limit guards against accidental floods.
  const cappedHits = hits.slice(0, 50)
  const channelIds = cappedHits.map(h => h.channelId).filter(Boolean)

  // Batch-fetch existing snapshots so we can carry forward email +
  // socials. One query for the whole batch — no N-round-trip cost.
  // Failures here just mean we fall back to "no carry-forward" —
  // partial rows like the old behavior — which is no-worse-than-today.
  const existingByChannel = new Map<string, EnrichmentLatest>()
  if (channelIds.length > 0) {
    try {
      const { data, error } = await sb
        .from('creator_enrichment_latest')
        .select('*')
        .in('yt_channel_id', channelIds)
      if (error) {
        console.warn('[creator_enrichment] carry-forward lookup failed:', error.message)
      } else if (data) {
        for (const row of data as EnrichmentLatest[]) {
          if (row?.yt_channel_id) existingByChannel.set(row.yt_channel_id, row)
        }
      }
    } catch (e) {
      console.warn('[creator_enrichment] carry-forward lookup threw:', e)
    }
  }

  const rows = cappedHits.map(h => {
    const prior = existingByChannel.get(h.channelId)
    return {
      yt_channel_id: h.channelId,
      // Prefer the freshest channel name we've seen (search responses
      // can have stale display names if a channel rebranded recently;
      // the search hit is more recent than the cached snapshot).
      channel_name: h.channelName || prior?.channel_name || null,
      niche: niche || prior?.niche || null,
      // CARRY FORWARD: email + socials live in /api/enrich's domain.
      // The search route never has them, so reusing the prior row's
      // values is the only way to keep the latest-view richest.
      email: prior?.email ?? null,
      email_source: prior?.email_source ?? null,
      email_bounced: prior?.email_bounced ?? false,
      linkedin_url: prior?.linkedin_url ?? null,
      instagram_handle: prior?.instagram_handle ?? null,
      twitter_handle: prior?.twitter_handle ?? null,
      website: prior?.website ?? null,
      // REFRESH from search hit: these are the fields that change
      // over time and the search response IS the freshest source.
      subscribers: parseSubs(h.subscribers ?? null) ?? prior?.subscribers ?? null,
      avg_views:
        typeof h.avgViews === 'number' ? h.avgViews : prior?.avg_views ?? null,
      last_video_at: prior?.last_video_at ?? null,
      recent_video_dates:
        h.videoDates && h.videoDates.length
          ? h.videoDates
          : prior?.recent_video_dates ?? null,
      raw_response_json: {
        source: 'search_route',
        titles: h.videoTitles ?? [],
        carriedForwardFromPrior: !!prior,
      },
    }
  })
  try {
    const { error } = await sb.from('creator_enrichment').insert(rows)
    if (error) {
      console.warn('[creator_enrichment] bulk insert failed:', error.message)
    }
  } catch (e) {
    console.warn('[creator_enrichment] bulk insert threw:', e)
  }
}

/**
 * Window inside which we treat repeat enrichment writes as
 * redundant. If the latest snapshot is younger than this AND the
 * meaningful fields (email, socials, subs within ±2%) match, skip
 * the insert. Avoids bloating the table with identical rows when
 * a user re-enriches the same creator twice.
 */
const DEDUP_WINDOW_MS = 6 * 60 * 60 * 1000 // 6h

/**
 * Returns true when `snap` is essentially identical to the most
 * recent snapshot for the same channel — same email, same socials,
 * subscribers within 2%, and the latest snapshot is fresh enough
 * to count as "the same fetch."
 */
async function isRedundantSnapshot(snap: EnrichmentSnapshot): Promise<boolean> {
  const existing = await getLatestEnrichment(snap.yt_channel_id)
  if (!existing) return false
  const age = Date.now() - new Date(existing.fetched_at).getTime()
  if (age > DEDUP_WINDOW_MS) return false
  const same = (a: unknown, b: unknown) => (a ?? '') === (b ?? '')
  if (!same(existing.email, snap.email)) return false
  if (!same(existing.linkedin_url, snap.linkedin_url)) return false
  if (!same(existing.instagram_handle, snap.instagram_handle)) return false
  if (!same(existing.twitter_handle, snap.twitter_handle)) return false
  if (!same(existing.website, snap.website)) return false
  // Subs within ±2% (or both null).
  const a = existing.subscribers
  const b = snap.subscribers
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  const aN = Number(a)
  const bN = Number(b)
  if (!Number.isFinite(aN) || !Number.isFinite(bN)) return false
  const denom = Math.max(aN, bN, 1)
  return Math.abs(aN - bN) / denom <= 0.02
}

/**
 * Insert an enrichment snapshot. Fire-and-forget by design —
 * callers shouldn't block on this. Logs failures but never throws.
 *
 * Skips the insert if a near-identical snapshot was already written
 * within the last 6 hours (see isRedundantSnapshot). Append-only
 * stays valuable for trend data, but we don't want 500 identical
 * rows when a user re-enriches the same creator a dozen times.
 */
export async function saveEnrichmentSnapshot(snap: EnrichmentSnapshot): Promise<void> {
  if (!snap.yt_channel_id) return
  const sb = getServiceClient()
  if (!sb) {
    // Service role not configured (likely local dev). Silent no-op
    // is the right move — the route still works, we just don't
    // build the durable cache locally.
    return
  }
  try {
    if (await isRedundantSnapshot(snap)) {
      // Update fetched_at on the existing row so the staleness check
      // resets, but skip the actual INSERT to keep the table clean.
      // (For now we just skip — the existing row is still recent
      // enough to count as fresh.)
      return
    }
    const { error } = await sb.from('creator_enrichment').insert({
      yt_channel_id: snap.yt_channel_id,
      channel_name: snap.channel_name ?? null,
      niche: snap.niche ?? null,
      email: snap.email ?? null,
      email_source: snap.email_source ?? null,
      email_bounced: snap.email_bounced ?? false,
      linkedin_url: snap.linkedin_url ?? null,
      instagram_handle: snap.instagram_handle ?? null,
      twitter_handle: snap.twitter_handle ?? null,
      website: snap.website ?? null,
      subscribers: snap.subscribers ?? null,
      avg_views: snap.avg_views ?? null,
      last_video_at: snap.last_video_at ?? null,
      recent_video_dates: snap.recent_video_dates ?? null,
      raw_response_json: snap.raw_response_json ?? null,
    })
    if (error) {
      console.warn('[creator_enrichment] insert failed:', error.message)
    }
  } catch (e) {
    console.warn('[creator_enrichment] insert threw:', e)
  }
}

/**
 * Read the latest snapshot for a channel from the convenience view.
 * Used by Phase 2 (read-path) — Phase 1 leaves this unused.
 */
export async function getLatestEnrichment(channelId: string): Promise<EnrichmentLatest | null> {
  if (!channelId) return null
  const sb = getServiceClient()
  if (!sb) return null
  try {
    const { data, error } = await sb
      .from('creator_enrichment_latest')
      .select('*')
      .eq('yt_channel_id', channelId)
      .maybeSingle()
    if (error) {
      console.warn('[creator_enrichment] fetch failed:', error.message)
      return null
    }
    return (data as EnrichmentLatest | null) ?? null
  } catch (e) {
    console.warn('[creator_enrichment] fetch threw:', e)
    return null
  }
}

/** Columns the admin table can sort by. Whitelist enforced
 *  server-side so URL-param injection can't introduce arbitrary
 *  ORDER BY clauses. */
export const SORTABLE_COLUMNS = [
  'channel_name',
  'email',
  'email_source',
  'subscribers',
  'avg_views',
  'fetched_at',
] as const
export type SortColumn = (typeof SORTABLE_COLUMNS)[number]

/**
 * Admin-page query: list latest snapshots, paginated, with
 * optional substring search across email / channel_name / handle,
 * filterable by source, and sortable by any whitelisted column.
 */
export async function listEnrichmentLatest({
  search,
  source,
  sort = 'fetched_at',
  dir = 'desc',
  limit = 100,
  offset = 0,
}: {
  search?: string
  source?: string
  sort?: SortColumn
  dir?: 'asc' | 'desc'
  limit?: number
  offset?: number
}): Promise<{ rows: EnrichmentLatest[]; total: number }> {
  const sb = getServiceClient()
  if (!sb) return { rows: [], total: 0 }
  try {
    let q = sb.from('creator_enrichment_latest').select('*', { count: 'exact' })
    if (search) {
      const pattern = `%${search}%`
      q = q.or(
        `email.ilike.${pattern},channel_name.ilike.${pattern},instagram_handle.ilike.${pattern},twitter_handle.ilike.${pattern},linkedin_url.ilike.${pattern}`,
      )
    }
    if (source) {
      q = q.eq('email_source', source)
    }
    // Whitelist sort col — fall back to fetched_at on anything funky.
    const sortCol = (SORTABLE_COLUMNS as readonly string[]).includes(sort) ? sort : 'fetched_at'
    const ascending = dir === 'asc'
    // NULLS LAST in both directions so rows-with-values float to the
    // top — when sorting by email asc, the operator wants channels
    // WITH emails first, not pages of nulls before any data.
    q = q.order(sortCol, { ascending, nullsFirst: false })
    q = q.range(offset, offset + limit - 1)
    const { data, count, error } = await q
    if (error) {
      console.warn('[creator_enrichment] list failed:', error.message)
      return { rows: [], total: 0 }
    }
    return { rows: (data ?? []) as EnrichmentLatest[], total: count ?? 0 }
  } catch (e) {
    console.warn('[creator_enrichment] list threw:', e)
    return { rows: [], total: 0 }
  }
}

/**
 * Health check — does the creator_enrichment table exist + can the
 * service-role client write to it? Used by /admin/contacts to
 * surface a clear error banner when migration 0011 hasn't been
 * run yet (instead of silently writing nothing and leaving Dylan
 * wondering where his rows went).
 */
export async function checkEnrichmentHealth(): Promise<{
  ok: boolean
  tableExists: boolean
  serviceRoleConfigured: boolean
  error: string | null
  /** Total row count (only meaningful when ok=true). */
  rowCount: number | null
}> {
  const sb = getServiceClient()
  if (!sb) {
    return {
      ok: false,
      tableExists: false,
      serviceRoleConfigured: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY not configured — required to write to the cache. Set it in Vercel envs.',
      rowCount: null,
    }
  }
  try {
    const { count, error } = await sb
      .from('creator_enrichment')
      .select('id', { count: 'exact', head: true })
    if (error) {
      const msg = error.message || ''
      const tableMissing = /relation .* does not exist|table .* (not found|does not exist)/i.test(msg)
      return {
        ok: false,
        tableExists: !tableMissing,
        serviceRoleConfigured: true,
        error: tableMissing
          ? "Table creator_enrichment doesn't exist. Run migration 0011_creator_enrichment.sql in Supabase SQL editor."
          : msg,
        rowCount: null,
      }
    }
    return {
      ok: true,
      tableExists: true,
      serviceRoleConfigured: true,
      error: null,
      rowCount: count ?? 0,
    }
  } catch (e: any) {
    return {
      ok: false,
      tableExists: false,
      serviceRoleConfigured: true,
      error: `Health check threw: ${e?.message || e}`,
      rowCount: null,
    }
  }
}

/**
 * Aggregate stats for the admin dashboard header card.
 */
export async function getEnrichmentStats(): Promise<{
  total: number
  withEmail: number
  bouncedCount: number
  fetchedLast7d: number
  fetchedLast24h: number
}> {
  const sb = getServiceClient()
  if (!sb) return { total: 0, withEmail: 0, bouncedCount: 0, fetchedLast7d: 0, fetchedLast24h: 0 }
  try {
    const now = Date.now()
    const day = 24 * 60 * 60 * 1000
    const since7 = new Date(now - 7 * day).toISOString()
    const since24 = new Date(now - day).toISOString()

    const [totalR, withEmailR, bouncedR, last7R, last24R] = await Promise.all([
      sb.from('creator_enrichment_latest').select('id', { count: 'exact', head: true }),
      sb.from('creator_enrichment_latest').select('id', { count: 'exact', head: true }).not('email', 'is', null),
      sb.from('creator_enrichment_latest').select('id', { count: 'exact', head: true }).eq('email_bounced', true),
      sb.from('creator_enrichment').select('id', { count: 'exact', head: true }).gte('fetched_at', since7),
      sb.from('creator_enrichment').select('id', { count: 'exact', head: true }).gte('fetched_at', since24),
    ])

    return {
      total: totalR.count ?? 0,
      withEmail: withEmailR.count ?? 0,
      bouncedCount: bouncedR.count ?? 0,
      fetchedLast7d: last7R.count ?? 0,
      fetchedLast24h: last24R.count ?? 0,
    }
  } catch (e) {
    console.warn('[creator_enrichment] stats threw:', e)
    return { total: 0, withEmail: 0, bouncedCount: 0, fetchedLast7d: 0, fetchedLast24h: 0 }
  }
}

/**
 * Channel-id prefixes used by service-role smoke checks + automated
 * tests. /api/admin/bulk-enrich filters these out of normal modes
 * so they never hit the live enrichment pipeline (those endpoints
 * 400 on synthetic IDs). The /admin/test-data tab surfaces them in
 * isolation so Dylan can audit what's been seeded for testing.
 */
export const TEST_CHANNEL_PREFIXES = ['UC_TEST_', 'mock_', 'fake_'] as const

/**
 * List synthetic test rows from the latest-view. Mirrors the shape
 * of listEnrichmentLatest but filters TO test rows instead of
 * filtering them out.
 */
export async function listTestEnrichmentRows({
  limit = 100,
  offset = 0,
}: {
  limit?: number
  offset?: number
} = {}): Promise<{ rows: EnrichmentLatest[]; total: number }> {
  const sb = getServiceClient()
  if (!sb) return { rows: [], total: 0 }
  try {
    // Build an OR across the test prefixes against the latest-view.
    // PostgREST supports `.or('a.ilike.%,b.ilike.%')` for ANY-match
    // semantics — same pattern listEnrichmentLatest uses for search.
    const orFilter = TEST_CHANNEL_PREFIXES.map(
      p => `yt_channel_id.ilike.${p}%`,
    ).join(',')
    const q = sb
      .from('creator_enrichment_latest')
      .select('*', { count: 'exact' })
      .or(orFilter)
      .order('fetched_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)
    const { data, count, error } = await q
    if (error) {
      console.warn('[creator_enrichment] test-rows list failed:', error.message)
      return { rows: [], total: 0 }
    }
    return { rows: (data ?? []) as EnrichmentLatest[], total: count ?? 0 }
  } catch (e) {
    console.warn('[creator_enrichment] test-rows list threw:', e)
    return { rows: [], total: 0 }
  }
}

/**
 * Per-prefix counts for the test-data tab summary. Returns
 * { 'UC_TEST_': 3, 'mock_': 0, 'fake_': 1 }-shape map. Useful for
 * the operator to see at a glance whether automated checks are
 * actively seeding rows or whether the table just has stale leftovers.
 */
export async function getTestRowCounts(): Promise<Record<string, number>> {
  const sb = getServiceClient()
  const out: Record<string, number> = {}
  for (const p of TEST_CHANNEL_PREFIXES) out[p] = 0
  if (!sb) return out
  try {
    await Promise.all(
      TEST_CHANNEL_PREFIXES.map(async p => {
        const { count } = await sb
          .from('creator_enrichment_latest')
          .select('id', { count: 'exact', head: true })
          .ilike('yt_channel_id', `${p}%`)
        out[p] = count ?? 0
      }),
    )
  } catch (e) {
    console.warn('[creator_enrichment] test-row counts threw:', e)
  }
  return out
}
