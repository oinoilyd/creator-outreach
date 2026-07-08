/**
 * Integrations foundation — platform API keys (inbound) + Airtable push
 * (outbound). Server-side only: routes under /api/integrations/* and
 * /api/v1/* import from here. Backed by migration 0054.
 */

import crypto from 'crypto'
import { createClient as createSupabaseAdmin, type SupabaseClient } from '@supabase/supabase-js'

export function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createSupabaseAdmin(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ── Platform API keys (inbound /api/v1/*) ───────────────────────────
//
// Format: co_live_<40 hex>. Only the SHA-256 hash is stored; the full
// key is returned exactly once at creation. Lookup is by hash (unique
// index), so verification is a single indexed read.

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `co_live_${crypto.randomBytes(20).toString('hex')}`
  return { key, prefix: key.slice(0, 12), hash: hashApiKey(key) }
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/** Resolve an Authorization header to the owning user. Returns null on
 *  any failure (missing/malformed/revoked/unknown). Touches
 *  last_used_at fire-and-forget. */
export async function verifyApiKey(
  authHeader: string | null,
  sb: SupabaseClient,
): Promise<{ userId: string; keyId: string } | null> {
  const m = (authHeader ?? '').match(/^Bearer\s+(co_live_[a-f0-9]{40})$/i)
  if (!m) return null
  const { data, error } = await sb
    .from('api_keys')
    .select('id, user_id, revoked_at')
    .eq('key_hash', hashApiKey(m[1]))
    .maybeSingle()
  if (error || !data || data.revoked_at) return null
  void sb.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)
  return { userId: data.user_id, keyId: data.id }
}

// ── Canonical lead fields ────────────────────────────────────────────
// Shared with the client panel via lib/integrations-fields (this module
// pulls in node crypto, so the UI can't import it directly).
export { LEAD_FIELDS, VALID_STATUSES } from './integrations-fields'

// ── Airtable (outbound push) ─────────────────────────────────────────

export interface AirtableConnectionRow {
  user_id: string
  token_encrypted: string
  base_id: string
  base_name: string | null
  table_name: string
  field_map: Record<string, string> // our LEAD_FIELDS key → their column name
  merge_field: string | null        // our key used for upsert matching
  auto_sync: boolean
  last_sync_at: string | null
  last_error: string | null
}

const AIRTABLE_API = 'https://api.airtable.com/v0'

async function airtableFetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${AIRTABLE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = body?.error?.message || body?.error?.type || `HTTP ${res.status}`
    throw new Error(`Airtable: ${msg}`)
  }
  return body
}

/** List bases the token can see, and each base's tables + field names.
 *  Used by the setup UI pickers. */
export async function airtableListBases(token: string): Promise<{ id: string; name: string }[]> {
  const body = await airtableFetch(token, '/meta/bases')
  return (body.bases ?? []).map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }))
}

/** Field types Airtable computes itself — writes to these are rejected
 *  by their API (for every integration, not just ours), so we hide them
 *  from the mapping dropdowns entirely. */
const COMPUTED_FIELD_TYPES = new Set([
  'formula', 'rollup', 'count', 'lookup', 'multipleLookupValues',
  'autoNumber', 'createdTime', 'lastModifiedTime', 'createdBy',
  'lastModifiedBy', 'button', 'aiText',
])

export async function airtableListTables(
  token: string,
  baseId: string,
): Promise<{ id: string; name: string; fields: string[] }[]> {
  const body = await airtableFetch(token, `/meta/bases/${encodeURIComponent(baseId)}/tables`)
  return (body.tables ?? []).map((t: { id: string; name: string; fields?: { name: string; type?: string }[] }) => ({
    id: t.id,
    name: t.name,
    fields: (t.fields ?? [])
      .filter(f => !COMPUTED_FIELD_TYPES.has(f.type ?? ''))
      .map(f => f.name),
  }))
}

/** Upsert records into the connected table, 10 per request (Airtable
 *  max), sequential with a small delay to respect the 5 rps/base limit.
 *  `records` are already in Airtable shape ({ fields: {...} }).
 *  Returns the number of records written. */
export async function airtableUpsert(
  token: string,
  baseId: string,
  tableName: string,
  mergeColumn: string,
  records: { fields: Record<string, unknown> }[],
): Promise<number> {
  let written = 0
  for (let i = 0; i < records.length; i += 10) {
    const chunk = records.slice(i, i + 10)
    const body = await airtableFetch(
      token,
      `/${encodeURIComponent(baseId)}/${encodeURIComponent(tableName)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          performUpsert: { fieldsToMergeOn: [mergeColumn] },
          typecast: true,
          records: chunk,
        }),
      },
    )
    written += (body.records ?? []).length
    if (i + 10 < records.length) await new Promise(r => setTimeout(r, 250))
  }
  return written
}
