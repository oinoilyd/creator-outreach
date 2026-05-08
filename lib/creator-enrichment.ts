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
 * Insert an enrichment snapshot. Fire-and-forget by design —
 * callers shouldn't block on this. Logs failures but never throws.
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
