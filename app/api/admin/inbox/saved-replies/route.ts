/**
 * Admin canned responses — list / create / delete.
 * Admin-gated. Backed by inbox_saved_replies (migration 0046).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/api-auth'
import { forbidIfNotAdmin } from '@/lib/admin'
import type { SavedReply } from '@/lib/inbox-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const forbid = forbidIfNotAdmin(auth)
  if (forbid) return forbid
  const supabase = await createClient()
  const { data } = await supabase
    .from('inbox_saved_replies')
    .select('id, title, body')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  const replies: SavedReply[] = ((data ?? []) as Array<{ id: string; title: string; body: string }>)
    .map(r => ({ id: r.id, title: r.title, body: r.body }))
  return NextResponse.json({ replies })
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const forbid = forbidIfNotAdmin(auth)
  if (forbid) return forbid
  const payload = await req.json().catch(() => ({}))
  const title = (payload.title || '').toString().trim().slice(0, 120)
  const body = (payload.body || '').toString().trim().slice(0, 10000)
  if (!body) return NextResponse.json({ error: 'Body is required.' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inbox_saved_replies')
    .insert({ title: title || body.slice(0, 40), body })
    .select('id, title, body')
    .single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Could not save.' }, { status: 500 })
  return NextResponse.json({ reply: data })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const forbid = forbidIfNotAdmin(auth)
  if (forbid) return forbid
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required.' }, { status: 400 })
  const supabase = await createClient()
  const { error } = await supabase.from('inbox_saved_replies').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
