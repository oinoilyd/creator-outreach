import { NextRequest, NextResponse } from 'next/server'
import { requireUser, rateLimitRedis } from '@/lib/api-auth'
import { serviceClient, generateApiKey } from '@/lib/integrations'
import { clampString } from '@/lib/security'

/**
 * Platform API key management (session-authed; the keys themselves are
 * used by external tools against /api/v1/*).
 *
 *   GET    → list the caller's keys (prefix + metadata, never the key)
 *   POST   → create a key; returns the FULL key exactly once
 *   DELETE → revoke (soft) a key by id
 *
 * Cap: 5 active keys per user — enough for real use, low enough that a
 * leaked-account can't mint an unbounded credential pile.
 */

const MAX_ACTIVE_KEYS = 5

export async function GET() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const sb = serviceClient()
  if (!sb) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  const { data, error } = await sb
    .from('api_keys')
    .select('id, name, key_prefix, created_at, last_used_at, revoked_at')
    .eq('user_id', auth.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Failed to load keys' }, { status: 500 })
  return NextResponse.json({ keys: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const limited = await rateLimitRedis(auth.id, 'integrations-keys', 20, auth.email)
  if (limited) return limited
  const sb = serviceClient()
  if (!sb) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })

  const body = await req.json().catch(() => ({}))
  const name = clampString(body?.name, 60) || 'API key'

  const { count } = await sb
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.id)
    .is('revoked_at', null)
  if ((count ?? 0) >= MAX_ACTIVE_KEYS) {
    return NextResponse.json(
      { error: `Limit of ${MAX_ACTIVE_KEYS} active keys — revoke one first.` },
      { status: 400 },
    )
  }

  const { key, prefix, hash } = generateApiKey()
  const { data, error } = await sb
    .from('api_keys')
    .insert({ user_id: auth.id, name, key_prefix: prefix, key_hash: hash })
    .select('id, name, key_prefix, created_at')
    .single()
  if (error) return NextResponse.json({ error: 'Failed to create key' }, { status: 500 })
  // The one and only time the full key crosses the wire.
  return NextResponse.json({ key, meta: data })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const sb = serviceClient()
  if (!sb) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  const { searchParams } = new URL(req.url)
  const id = clampString(searchParams.get('id'), 60)
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { error } = await sb
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', auth.id) // ownership check — service role bypasses RLS
  if (error) return NextResponse.json({ error: 'Failed to revoke' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
