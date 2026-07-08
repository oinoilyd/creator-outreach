import { NextRequest, NextResponse } from 'next/server'
import { requireUser, rateLimitRedis } from '@/lib/api-auth'
import { serviceClient, LEAD_FIELDS, type AirtableConnectionRow } from '@/lib/integrations'
import { encryptToken } from '@/lib/email/direct/crypto'
import { clampString } from '@/lib/security'

/**
 * Airtable connection management (session-authed).
 *   GET    → connection status (never the token)
 *   POST   → save/update the connection. Token optional on update.
 *   DELETE → disconnect (row removed; token gone with it).
 */

export async function GET() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const sb = serviceClient()
  if (!sb) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  const { data } = await sb
    .from('airtable_connections')
    .select('base_id, base_name, table_name, field_map, merge_field, auto_sync, last_sync_at, last_error')
    .eq('user_id', auth.id)
    .maybeSingle()
  if (!data) return NextResponse.json({ connected: false })
  return NextResponse.json({
    connected: true,
    baseId: data.base_id,
    baseName: data.base_name,
    tableName: data.table_name,
    fieldMap: data.field_map ?? {},
    mergeField: data.merge_field,
    autoSync: !!data.auto_sync,
    lastSyncAt: data.last_sync_at,
    lastError: data.last_error,
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const limited = await rateLimitRedis(auth.id, 'integrations-airtable', 30, auth.email)
  if (limited) return limited
  const sb = serviceClient()
  if (!sb) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })

  const body = await req.json().catch(() => ({}))
  const token = clampString(body?.token, 200)
  const baseId = clampString(body?.baseId, 40)
  const baseName = clampString(body?.baseName, 120)
  const tableName = clampString(body?.tableName, 120)
  const mergeField = clampString(body?.mergeField, 60)
  const autoSync = !!body?.autoSync
  const rawMap = (body?.fieldMap && typeof body.fieldMap === 'object') ? body.fieldMap : {}

  if (!baseId || !tableName) {
    return NextResponse.json({ error: 'baseId and tableName are required.' }, { status: 400 })
  }
  // Whitelist the map to our bounded field surface.
  const validKeys = new Set(LEAD_FIELDS.map(f => f.key))
  const fieldMap: Record<string, string> = {}
  for (const [k, v] of Object.entries(rawMap as Record<string, unknown>)) {
    if (validKeys.has(k) && typeof v === 'string' && v.trim()) fieldMap[k] = clampString(v, 120)
  }
  if (Object.keys(fieldMap).length === 0) {
    return NextResponse.json({ error: 'Map at least one field.' }, { status: 400 })
  }
  if (!mergeField || !fieldMap[mergeField]) {
    return NextResponse.json(
      { error: 'mergeField must be one of the mapped fields (it prevents duplicate rows).' },
      { status: 400 },
    )
  }

  const { data: existing } = await sb
    .from('airtable_connections')
    .select('user_id')
    .eq('user_id', auth.id)
    .maybeSingle()

  let tokenEncrypted: string | null = null
  if (token) {
    try {
      tokenEncrypted = encryptToken(token)
    } catch (e) {
      console.error('[integrations/airtable] encryption unavailable:', e instanceof Error ? e.message : e)
      return NextResponse.json(
        { error: 'Server encryption key not configured — contact support.' },
        { status: 503 },
      )
    }
  } else if (!existing) {
    return NextResponse.json({ error: 'An Airtable token is required to connect.' }, { status: 400 })
  }

  const row: Partial<AirtableConnectionRow> & { user_id: string } = {
    user_id: auth.id,
    base_id: baseId,
    base_name: baseName || null,
    table_name: tableName,
    field_map: fieldMap,
    merge_field: mergeField,
    auto_sync: autoSync,
    last_error: null,
    ...(tokenEncrypted ? { token_encrypted: tokenEncrypted } : {}),
  }
  const { error } = await sb.from('airtable_connections').upsert(row, { onConflict: 'user_id' })
  if (error) {
    console.error('[integrations/airtable] save failed:', error.message)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const sb = serviceClient()
  if (!sb) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  const { error } = await sb.from('airtable_connections').delete().eq('user_id', auth.id)
  if (error) return NextResponse.json({ error: 'Disconnect failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
