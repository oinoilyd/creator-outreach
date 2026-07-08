import { NextRequest, NextResponse } from 'next/server'
import { rateLimitRedis } from '@/lib/api-auth'
import { serviceClient, verifyApiKey, LEAD_FIELDS, VALID_STATUSES } from '@/lib/integrations'
import { clampString } from '@/lib/security'

/**
 * Public platform API — /api/v1/leads. Authenticated with a platform
 * API key (`Authorization: Bearer co_live_...`) created in the
 * Integrations panel. This is what Zapier / Airtable automations /
 * custom dashboards talk to.
 *
 *   GET  ?limit=&offset=       → list the account's leads (newest first)
 *   POST { channelName, ... }  → upsert a lead. Match order: channelUrl,
 *                                then email, then exact channelName.
 *                                Only provided fields are written.
 *
 * Field surface = LEAD_FIELDS (bounded, documented in the panel).
 */

function unauthorized() {
  return NextResponse.json(
    { error: 'Invalid or missing API key. Pass `Authorization: Bearer co_live_...`.' },
    { status: 401 },
  )
}

export async function GET(req: NextRequest) {
  const sb = serviceClient()
  if (!sb) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  const key = await verifyApiKey(req.headers.get('authorization'), sb)
  if (!key) return unauthorized()
  const limited = await rateLimitRedis(key.userId, 'v1-leads', 600)
  if (limited) return limited

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 100)
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0)

  const cols = ['id', 'added_at', ...LEAD_FIELDS.map(f => f.col)].join(', ')
  const { data, error } = await sb
    .from('outreach_entries')
    .select(cols)
    .eq('user_id', key.userId)
    .order('added_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) return NextResponse.json({ error: 'Failed to load leads' }, { status: 500 })

  const leads = (data ?? []).map((r) => {
    const row = r as unknown as Record<string, unknown>
    const out: Record<string, unknown> = { id: row.id, addedAt: row.added_at }
    for (const f of LEAD_FIELDS) out[f.key] = row[f.col] ?? ''
    return out
  })
  return NextResponse.json({ leads, limit, offset })
}

export async function POST(req: NextRequest) {
  const sb = serviceClient()
  if (!sb) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  const key = await verifyApiKey(req.headers.get('authorization'), sb)
  if (!key) return unauthorized()
  const limited = await rateLimitRedis(key.userId, 'v1-leads-write', 300)
  if (limited) return limited

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body must be a JSON object.' }, { status: 400 })
  }

  // Clamp + validate the provided fields against the bounded surface.
  const fields: Record<string, string> = {}
  for (const f of LEAD_FIELDS) {
    const v = (body as Record<string, unknown>)[f.key]
    if (v === undefined || v === null) continue
    fields[f.col] = clampString(String(v), 2000)
  }
  if (fields.status !== undefined && !VALID_STATUSES.has(fields.status)) {
    return NextResponse.json(
      { error: `Invalid status. One of: ${[...VALID_STATUSES].filter(Boolean).join(', ')}` },
      { status: 400 },
    )
  }
  const channelName = fields.channel_name
  if (!channelName) {
    return NextResponse.json({ error: 'channelName is required.' }, { status: 400 })
  }

  // Upsert match: channelUrl → email → exact channelName.
  let existingId: string | null = null
  if (fields.channel_url) {
    const { data } = await sb.from('outreach_entries').select('id')
      .eq('user_id', key.userId).eq('channel_url', fields.channel_url).limit(1).maybeSingle()
    existingId = data?.id ?? null
  }
  if (!existingId && fields.email) {
    const { data } = await sb.from('outreach_entries').select('id')
      .eq('user_id', key.userId).eq('email', fields.email).limit(1).maybeSingle()
    existingId = data?.id ?? null
  }
  if (!existingId) {
    const { data } = await sb.from('outreach_entries').select('id')
      .eq('user_id', key.userId).eq('channel_name', channelName).limit(1).maybeSingle()
    existingId = data?.id ?? null
  }

  if (existingId) {
    const { error } = await sb.from('outreach_entries').update(fields)
      .eq('id', existingId).eq('user_id', key.userId)
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    return NextResponse.json({ ok: true, id: existingId, action: 'updated' })
  }

  const rand = Math.random().toString(36).slice(2, 10)
  const channelId = `api-${Date.now()}-${rand}`
  const row = {
    id: `${channelId}-${Date.now()}`,
    user_id: key.userId,
    channel_id: channelId,
    channel_name: channelName,
    channel_url: fields.channel_url ?? '',
    description: '',
    email: fields.email ?? '',
    product: fields.product ?? '',
    favorite: false,
    reached_out: !!fields.status && fields.status !== 'Not Outreached',
    medium: '',
    medium_other: '',
    header_used: '',
    status: fields.status ?? 'Not Outreached',
    added_at: Date.now(),
    tracking_id: rand,
    notes: fields.notes ?? '',
    follow_up_date: fields.follow_up_date ?? '',
    date_reached_out: fields.date_reached_out ?? '',
    touchpoints: fields.touchpoints ?? '',
    response_date: '',
    subscribers: fields.subscribers ?? '',
    avg_views: 0,
    fit_score: 0,
    linkedin: '',
    instagram: fields.instagram ?? '',
    twitter: '',
    tiktok: '',
    website: fields.website ?? '',
    content_niche: '',
    phone: '',
    deal_value: fields.deal_value ?? '',
    contract_sent: false,
    meeting_scheduled: '',
  }
  const { error } = await sb.from('outreach_entries').insert(row)
  if (error) {
    console.error('[v1/leads] insert failed:', error.message)
    return NextResponse.json({ error: 'Create failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: row.id, action: 'created' })
}
