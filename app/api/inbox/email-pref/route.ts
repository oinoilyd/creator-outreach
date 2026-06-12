/**
 * POST /api/inbox/email-pref — the signed-in user toggles whether inbox
 * messages also email them (user_profile.email_opt_in, migration 0048).
 * Updates their OWN row via the authenticated client (user_profile RLS
 * allows self-update). In-app delivery is unaffected either way.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/api-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const body = await req.json().catch(() => ({}))
  const optIn = body.optIn === true

  const supabase = await createClient()
  const { error } = await supabase
    .from('user_profile')
    .update({ email_opt_in: optIn })
    .eq('user_id', auth.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, emailOptIn: optIn })
}
