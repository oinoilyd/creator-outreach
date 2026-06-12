/**
 * POST /api/admin/email-optin — flip a user's email_opt_in flag (whether
 * inbox messages also email them). Admin-only. Body: { user_id, value }.
 * Uses the service role since user_profile RLS hides other users' rows.
 * Mirrors /api/admin/unlimited-exports.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createServiceClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  let body: { user_id?: string; value?: boolean } = {}
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json body' }, { status: 400 }) }
  const targetUserId = (body.user_id || '').trim()
  const value = body.value === true
  if (!targetUserId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const sb = getServiceClient()
  if (!sb) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })

  const { error } = await sb.from('user_profile').update({ email_opt_in: value }).eq('user_id', targetUserId)
  if (error) {
    console.error('[admin/email-optin] update failed', targetUserId, error)
    return NextResponse.json({ error: 'update failed', detail: error.message }, { status: 500 })
  }
  console.info('[admin/email-optin] flip', { actor: user.email, target: targetUserId, value })
  return NextResponse.json({ ok: true, user_id: targetUserId, email_opt_in: value })
}
