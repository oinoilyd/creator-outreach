import { NextRequest, NextResponse } from 'next/server'
import { requireUser, rateLimitRedis } from '@/lib/api-auth'
import { serviceClient, airtableListBases, airtableListTables } from '@/lib/integrations'
import { decryptToken } from '@/lib/email/direct/crypto'
import { clampString } from '@/lib/security'

/**
 * Airtable discovery for the setup UI (session-authed).
 * POST { token?, baseId? } →
 *   without baseId: { bases: [{id,name}] }
 *   with baseId:    { tables: [{id,name,fields}] }
 * Uses the provided token (pre-save flow) or falls back to the stored
 * connection's token. The token never round-trips back to the client.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const limited = await rateLimitRedis(auth.id, 'integrations-airtable-meta', 60, auth.email)
  if (limited) return limited
  const sb = serviceClient()
  if (!sb) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })

  const body = await req.json().catch(() => ({}))
  let token = clampString(body?.token, 200)
  const baseId = clampString(body?.baseId, 40)

  if (!token) {
    const { data } = await sb
      .from('airtable_connections')
      .select('token_encrypted')
      .eq('user_id', auth.id)
      .maybeSingle()
    if (data?.token_encrypted) {
      try { token = decryptToken(data.token_encrypted) } catch { /* fall through */ }
    }
  }
  if (!token) return NextResponse.json({ error: 'No Airtable token available.' }, { status: 400 })

  try {
    if (baseId) {
      const tables = await airtableListTables(token, baseId)
      return NextResponse.json({ tables })
    }
    const bases = await airtableListBases(token)
    return NextResponse.json({ bases })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Airtable request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
