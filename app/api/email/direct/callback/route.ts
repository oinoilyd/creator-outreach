/**
 * GET /api/email/direct/callback?code=…&state=…
 *
 * OAuth redirect target. Verifies the CSRF state, exchanges the code for
 * tokens, resolves the mailbox address, encrypts the tokens, and upserts
 * the connection into direct_email_accounts. Then bounces the user back
 * to the settings page.
 *
 * Runs in the user's session (same-site redirect from the provider keeps
 * cookies), so we map the grant to the signed-in user directly — no need
 * to trust anything in the state beyond the CSRF nonce + provider.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDirectEmailEnabled, type DirectEmailProvider } from '@/lib/email/direct/flag'
import { encryptToken } from '@/lib/email/direct/crypto'
import * as google from '@/lib/email/direct/google'
import * as microsoft from '@/lib/email/direct/microsoft'

export const runtime = 'nodejs'

const STATE_COOKIE = 'de_oauth_state'
const ACCOUNTS = 'direct_email_accounts'

function origin(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    `${req.nextUrl.protocol}//${req.nextUrl.host}`
  )
}

export async function GET(req: NextRequest) {
  const base = origin(req)
  const settings = `${base}/settings/email`

  if (!isDirectEmailEnabled()) return NextResponse.redirect(`${settings}?error=disabled`)

  const params = req.nextUrl.searchParams
  const error = params.get('error')
  if (error) return NextResponse.redirect(`${settings}?error=${encodeURIComponent(error)}`)

  const code = params.get('code')
  const state = params.get('state')
  const cookieState = req.cookies.get(STATE_COOKIE)?.value
  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${settings}?error=state_mismatch`)
  }

  const provider = state.split('.')[1] as DirectEmailProvider
  if (provider !== 'google' && provider !== 'microsoft') {
    return NextResponse.redirect(`${settings}?error=bad_provider`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(base)

  const redirectUri = `${base}/api/email/direct/callback`
  const mod = provider === 'google' ? google : microsoft

  try {
    const tokens = await mod.exchangeCode(code, redirectUri)
    // Resolve the mailbox address (and Gmail's starting historyId) — the
    // id_token email is a fallback; getIdentity is authoritative.
    const identity = await mod.getIdentity(tokens.accessToken)
    const email = identity.email || tokens.email
    if (!email) return NextResponse.redirect(`${settings}?error=no_email`)

    if (!tokens.refreshToken) {
      // No refresh token → we can't sync long-term. Happens if the user
      // previously granted without revoking; prompt=consent should avoid it.
      return NextResponse.redirect(`${settings}?error=no_refresh_token`)
    }

    // Upsert: one row per (user, provider, mailbox). Reconnect updates in place.
    const { data: existing } = await supabase
      .from(ACCOUNTS)
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .eq('email', email)
      .maybeSingle<{ id: string }>()

    const row = {
      user_id: user.id,
      provider,
      email,
      access_token_enc: encryptToken(tokens.accessToken),
      refresh_token_enc: encryptToken(tokens.refreshToken),
      token_expires_at: new Date(tokens.expiresAt).toISOString(),
      scopes: tokens.scope ?? null,
      // Seed Gmail's cursor at "now" so the first sync doesn't back-fill
      // the entire mailbox. Microsoft seeds its delta on first sync.
      history_id: provider === 'google' ? identity.historyId ?? null : null,
      delta_link: null,
      status: 'active' as const,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      await supabase.from(ACCOUNTS).update(row).eq('id', existing.id)
    } else {
      await supabase.from(ACCOUNTS).insert(row)
    }

    const res = NextResponse.redirect(`${settings}?connected=${provider}`)
    res.cookies.delete(STATE_COOKIE)
    return res
  } catch (e) {
    console.error('[email/direct/callback] failed', (e as Error).message)
    return NextResponse.redirect(`${settings}?error=exchange_failed`)
  }
}
