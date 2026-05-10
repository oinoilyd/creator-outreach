/**
 * GET /api/unipile/me — returns this user's Unipile connection state.
 *
 * Used by the ProfileModal "Connect Gmail" section to show:
 *   • "Not connected" with a Connect button
 *   • "Connected as: foo@gmail.com — Disconnect" once linked
 *
 * Also used by the /unipile/connected landing page to poll until
 * the webhook fires (CREATION_SUCCESS races the redirect — the
 * webhook may not have arrived by the time the user lands back
 * on our app).
 */

import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const user = auth

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_profile')
    .select(
      'unipile_account_id, unipile_account_email, unipile_connected_at, unipile_linkedin_account_id, unipile_linkedin_username, unipile_linkedin_connected_at',
    )
    .eq('user_id', user.id)
    .single()

  if (error) {
    console.error('[unipile/me] read failed', error)
    return NextResponse.json({ error: 'Could not load profile' }, { status: 500 })
  }

  return NextResponse.json({
    connected: !!data?.unipile_account_id,
    accountId: data?.unipile_account_id ?? null,
    email: data?.unipile_account_email ?? null,
    connectedAt: data?.unipile_connected_at ?? null,
    linkedinConnected: !!data?.unipile_linkedin_account_id,
    linkedinAccountId: data?.unipile_linkedin_account_id ?? null,
    linkedinUsername: data?.unipile_linkedin_username ?? null,
    linkedinConnectedAt: data?.unipile_linkedin_connected_at ?? null,
  })
}
