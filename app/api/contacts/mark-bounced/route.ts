import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { cacheDel, enrichmentCacheKey } from '@/lib/cache'
import { getLatestEnrichment } from '@/lib/creator-enrichment'

/**
 * POST /api/contacts/mark-bounced
 *
 * User-driven: when an outreach email bounces or the user otherwise
 * confirms the address is bad, this flips email_bounced=true on the
 * latest creator_enrichment snapshot. Effects:
 *   1. The /api/enrich Phase 2 read path treats the row as
 *      unusable and forces a live re-fetch on the next enrichment.
 *   2. The /admin/contacts UI shows the email red-strikethrough.
 *   3. Phase-3 follow-up: source-quality stats can use bounce rate
 *      to weight strategies.
 *
 * Body: { channelId: string, email?: string }
 *   - channelId is required (natural key)
 *   - email is optional context (logged for debugging)
 *
 * Auth: any authenticated user. Email-bounce signal is contributed
 * to the shared corpus across users.
 */
export async function POST(req: NextRequest) {
  // Auth gate — must be signed in.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { channelId?: string; email?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }
  const channelId = (body.channelId || '').trim()
  if (!channelId) {
    return NextResponse.json({ error: 'channelId required' }, { status: 400 })
  }

  // Service-role client — only this can write to creator_enrichment
  // (RLS only allows authenticated SELECT).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  }
  const sb = createServiceClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Strategy: insert a NEW snapshot rather than UPDATE the latest
  // existing row. The table is append-only — every state change is
  // a snapshot. Latest-view picks up the bounced=true row
  // automatically.
  //
  // We pull the latest existing snapshot first so the new bounced
  // row carries the same email/socials context (otherwise the
  // bounce row would have null email + everyone wonders what
  // bounced).
  const existing = await getLatestEnrichment(channelId)

  const { error } = await sb.from('creator_enrichment').insert({
    yt_channel_id: channelId,
    channel_name: existing?.channel_name ?? null,
    niche: existing?.niche ?? null,
    email: body.email || existing?.email || null,
    email_source: existing?.email_source ?? null,
    email_bounced: true,
    linkedin_url: existing?.linkedin_url ?? null,
    instagram_handle: existing?.instagram_handle ?? null,
    twitter_handle: existing?.twitter_handle ?? null,
    website: existing?.website ?? null,
    subscribers: existing?.subscribers ?? null,
    avg_views: existing?.avg_views ?? null,
    last_video_at: existing?.last_video_at ?? null,
    recent_video_dates: existing?.recent_video_dates ?? null,
    raw_response_json: { source: 'user_marked_bounced', markedBy: user.email },
  })
  if (error) {
    console.warn('[mark-bounced] insert failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Bust the Redis hot cache so the next /api/enrich call falls
  // through to L2 (which will see the bounced row and force a
  // live re-fetch).
  void cacheDel(enrichmentCacheKey(channelId))

  return NextResponse.json({ ok: true })
}
