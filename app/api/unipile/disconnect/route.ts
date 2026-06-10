/**
 * POST /api/unipile/disconnect — sever the link between this user
 * and their connected Gmail account.
 *
 * Two-step disconnect:
 *   1. DELETE the account at Unipile so they stop holding the OAuth
 *      token (and stop billing us for it on paid tiers).
 *   2. NULL out the three unipile_* columns on user_profile so the
 *      UI immediately reflects "not connected."
 *
 * If step 1 fails (account already revoked, Unipile API hiccup), we
 * still proceed with step 2 — the source of truth for "is this user
 * connected" is our own DB, not Unipile. A best-effort delete leaves
 * no worse a state than the user just revoking the OAuth grant from
 * their Google account settings.
 */

import { NextResponse } from 'next/server'
import { requireUser, rateLimit } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'
import { disconnectAccount, UnipileError } from '@/lib/unipile'

export const runtime = 'nodejs'

export async function POST() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const user = auth

  const limited = rateLimit(user.id, 'unipile-disconnect', 20, user.email)
  if (limited) return limited

  const supabase = await createClient()
  const { data: profile, error: readErr } = await supabase
    .from('user_profile')
    .select('unipile_account_id')
    .eq('user_id', user.id)
    .single()
  if (readErr) {
    console.error('[unipile/disconnect] profile read failed', readErr)
    return NextResponse.json({ error: 'Could not load profile' }, { status: 500 })
  }

  const accountId = profile?.unipile_account_id as string | null | undefined
  let remoteDeleteWarning: string | null = null

  if (accountId) {
    try {
      await disconnectAccount(accountId)
    } catch (err) {
      // Don't block local cleanup on remote failure — surface it so
      // the user sees what happened and can also revoke via Google
      // if needed.
      if (err instanceof UnipileError) {
        // 404 from Unipile = already deleted; not actually an error.
        if (err.status !== 404) {
          remoteDeleteWarning = err.message
          console.warn('[unipile/disconnect] remote delete failed', err.message)
        }
      } else {
        remoteDeleteWarning = (err as Error).message
      }
    }
  }

  const { error: updateErr } = await supabase
    .from('user_profile')
    .update({
      unipile_account_id: null,
      unipile_account_email: null,
      unipile_connected_at: null,
    })
    .eq('user_id', user.id)
  if (updateErr) {
    console.error('[unipile/disconnect] profile update failed', updateErr)
    return NextResponse.json({ error: 'Could not clear profile link' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, warning: remoteDeleteWarning })
}
