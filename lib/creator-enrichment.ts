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
 * Bulk-insert partial snapshots from a search response. The search
 * route doesn't know emails or socials yet — this just records that
 * we've seen these channels in this niche, with their subs/views
 * snapshot. Useful for two things:
 *   1. Phase 2 read path can detect "already seen this channel."
 *   2. Builds the corpus quickly when users search a lot, even if
 *      they never click into per-creator enrichment.
 *
 * Fire-and-forget. Subscriber strings get coerced to BIGINT-clean
 * integers the same way saveEnrichmentSnapshot does.
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
  const rows = hits.slice(0, 50).map(h => ({
    yt_channel_id: h.channelId,
    channel_name: h.channelName || null,
    niche: niche || null,
    email: null,
    email_source: null,
    email_bounced: false,
    linkedin_url: null,
    instagram_handle: null,
    twitter_handle: null,
    website: null,
    subscribers: parseSubs(h.subscribers ?? null),
    avg_views: typeof h.avgViews === 'number' ? h.avgViews : null,
    last_video_at: null,
    recent_video_dates: h.videoDates && h.videoDates.length ? h.videoDates : null,
    raw_response_json: { source: 'search_route', titles: h.videoTitles ?? [] },
  }))
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

/**
 * Admin-page query: list latest snapshots, paginated, with
 * optional substring search across email / channel_name / handle.
 * Uses the latest-view so the admin sees one row per channel
 * (not the full append-only history).
 */
export async function listEnrichmentLatest({
  search,
  source,
  limit = 100,
  offset = 0,
}: {
  search?: string
  source?: string
  limit?: number
  offset?: number
}): Promise<{ rows: EnrichmentLatest[]; total: number }> {
  const sb = getServiceClient()
  if (!sb) return { rows: [], total: 0 }
  try {
    let q = sb.from('creator_enrichment_latest').select('*', { count: 'exact' })
    if (search) {
      // Match against email / channel_name / handles. Case-insensitive.
      const pattern = `%${search}%`
      q = q.or(
        `email.ilike.${pattern},channel_name.ilike.${pattern},instagram_handle.ilike.${pattern},twitter_handle.ilike.${pattern},linkedin_url.ilike.${pattern}`,
      )
    }
    if (source) {
      q = q.eq('email_source', source)
    }
    q = q.order('fetched_at', { ascending: false }).range(offset, offset + limit - 1)
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
