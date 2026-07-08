import { NextResponse } from 'next/server'
import { requireUser, rateLimitRedis } from '@/lib/api-auth'
import { serviceClient, LEAD_FIELDS, airtableUpsert } from '@/lib/integrations'
import { decryptToken } from '@/lib/email/direct/crypto'

/**
 * Push the caller's outreach entries into their connected Airtable
 * (session-authed; triggered by "Sync now" in the Integrations panel).
 *
 * Upserts via Airtable's performUpsert keyed on the connection's merge
 * column, so repeat syncs update rows instead of duplicating them.
 * Caps at the 1,000 most recent entries per run (Airtable rate limits;
 * ~100 requests at 10 records each).
 */
export async function POST() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  // 60/window — the client auto-pushes (debounced 20s) on outreach
  // changes, so active sessions call this more often than a manual
  // button would.
  const limited = await rateLimitRedis(auth.id, 'integrations-airtable-push', 60, auth.email)
  if (limited) return limited
  const sb = serviceClient()
  if (!sb) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })

  const { data: conn } = await sb
    .from('airtable_connections')
    .select('token_encrypted, base_id, table_name, field_map, merge_field')
    .eq('user_id', auth.id)
    .maybeSingle()
  if (!conn) return NextResponse.json({ error: 'Airtable is not connected.' }, { status: 400 })

  let token: string
  try {
    token = decryptToken(conn.token_encrypted)
  } catch {
    return NextResponse.json(
      { error: 'Stored token unreadable — reconnect Airtable.' },
      { status: 400 },
    )
  }

  const fieldMap = (conn.field_map ?? {}) as Record<string, string>
  const mergeKey = conn.merge_field as string | null
  const mergeColumn = mergeKey ? fieldMap[mergeKey] : null
  if (!mergeColumn) {
    return NextResponse.json({ error: 'Connection has no merge field — re-save the setup.' }, { status: 400 })
  }

  const cols = ['id', ...LEAD_FIELDS.map(f => f.col)].join(', ')
  const { data: entries, error } = await sb
    .from('outreach_entries')
    .select(cols)
    .eq('user_id', auth.id)
    .order('added_at', { ascending: false })
    .limit(1000)
  if (error) return NextResponse.json({ error: 'Failed to load leads' }, { status: 500 })

  const colByKey = new Map(LEAD_FIELDS.map(f => [f.key, f.col]))
  const records = (entries ?? [])
    .map((r) => {
      const row = r as unknown as Record<string, unknown>
      const fields: Record<string, unknown> = {}
      for (const [key, theirColumn] of Object.entries(fieldMap)) {
        const col = colByKey.get(key)
        if (!col) continue
        const v = row[col]
        if (v !== undefined && v !== null && v !== '') fields[theirColumn] = v
      }
      return { fields }
    })
    // A record with no merge value can't upsert — Airtable rejects it.
    .filter(rec => rec.fields[mergeColumn] !== undefined)

  if (records.length === 0) {
    return NextResponse.json({ ok: true, written: 0, skipped: (entries ?? []).length })
  }

  try {
    const written = await airtableUpsert(token, conn.base_id, conn.table_name, mergeColumn, records)
    await sb.from('airtable_connections')
      .update({ last_sync_at: new Date().toISOString(), last_error: null })
      .eq('user_id', auth.id)
    return NextResponse.json({ ok: true, written, skipped: (entries ?? []).length - records.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Sync failed'
    await sb.from('airtable_connections').update({ last_error: msg }).eq('user_id', auth.id)
    console.error('[integrations/airtable/push]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
