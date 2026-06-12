/**
 * creator-product.ts — durable cache for the Results "Product" column.
 *
 * Stores a short AI summary of what a creator SELLS, keyed by YouTube
 * channel id, computed once by /api/enrich/product and reused forever.
 * See migration 0049_creator_product_summary.sql for the table + RLS.
 *
 * Both helpers use the SERVICE ROLE (bypasses RLS) and fail soft —
 * read returns null on any error, write logs and swallows. The caller
 * (the product endpoint) treats a null read as "not cached yet" and a
 * failed write as "we'll just recompute next time", so a cache outage
 * degrades to "works, but no caching" rather than breaking the column.
 */
import { createClient as createServiceClient } from '@supabase/supabase-js'

export type ProductSummary = {
  sells: boolean
  summary: string
}

/**
 * Service-role Supabase client. Returns null when env vars are missing
 * — caller must handle that (treats it as "no cache available").
 * Mirrors getServiceClient() in creator-enrichment.ts.
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
 * Read the cached product summary for a channel. Returns null when
 * there's no cached row yet (or on any error / missing config), which
 * the endpoint treats as "compute it now".
 */
export async function getProductSummary(channelId: string): Promise<ProductSummary | null> {
  if (!channelId) return null
  const sb = getServiceClient()
  if (!sb) return null
  try {
    const { data, error } = await sb
      .from('creator_product_summary')
      .select('sells, summary')
      .eq('yt_channel_id', channelId)
      .maybeSingle()
    if (error || !data) return null
    return { sells: !!data.sells, summary: typeof data.summary === 'string' ? data.summary : '' }
  } catch {
    return null
  }
}

/**
 * Upsert the product summary for a channel. Fire-and-forget from the
 * caller's perspective — logs failures but never throws, so a cache
 * write problem can't break the request that produced the summary.
 */
export async function saveProductSummary(
  channelId: string,
  sells: boolean,
  summary: string,
): Promise<void> {
  if (!channelId) return
  const sb = getServiceClient()
  if (!sb) return
  try {
    const { error } = await sb
      .from('creator_product_summary')
      .upsert(
        {
          yt_channel_id: channelId,
          sells,
          summary: summary || '',
          checked_at: new Date().toISOString(),
        },
        { onConflict: 'yt_channel_id' },
      )
    if (error) {
      console.error('[saveProductSummary] upsert failed:', error.message)
    }
  } catch (err) {
    console.error('[saveProductSummary] threw:', err instanceof Error ? err.message : err)
  }
}
