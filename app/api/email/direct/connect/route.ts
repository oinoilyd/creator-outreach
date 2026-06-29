/**
 * GET /api/email/direct/connect?provider=google|microsoft
 *
 * Kicks off the DIRECT OAuth flow — redirects the signed-in user to
 * Google's / Microsoft's consent screen. The callback (sibling route)
 * exchanges the returned code for tokens and stores the mailbox.
 *
 * This is the "own it" connect flow, parallel to the Unipile hosted-auth
 * flow in /api/unipile/connect. It is DARK behind DIRECT_EMAIL_ENABLED —
 * if the flag is off (or the provider has no credentials), we bounce the
 * user back to the settings page with a notice rather than starting a
 * broken flow.
 *
 * CSRF: a random state is set in an httpOnly cookie and echoed in the
 * OAuth `state` param; the callback compares them. The provider is encoded
 * into the state so the callback knows which token endpoint to hit.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { isDirectEmailEnabled, isProviderConfigured, type DirectEmailProvider } from '@/lib/email/direct/flag'
import * as google from '@/lib/email/direct/google'
import * as microsoft from '@/lib/email/direct/microsoft'

export const runtime = 'nodejs'

const STATE_COOKIE = 'de_oauth_state'

function origin(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    `${req.nextUrl.protocol}//${req.nextUrl.host}`
  )
}

export async function GET(req: NextRequest) {
  const base = origin(req)
  const settings = `${base}/settings/email`

  if (!isDirectEmailEnabled()) {
    return NextResponse.redirect(`${settings}?error=disabled`)
  }

  const provider = req.nextUrl.searchParams.get('provider')
  if (provider !== 'google' && provider !== 'microsoft') {
    return NextResponse.redirect(`${settings}?error=bad_provider`)
  }
  if (!isProviderConfigured(provider as DirectEmailProvider)) {
    return NextResponse.redirect(`${settings}?error=not_configured`)
  }

  // Must be signed in — the callback maps the grant to this user via the session.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(base)

  const redirectUri = `${base}/api/email/direct/callback`
  const state = `${randomBytes(16).toString('hex')}.${provider}`
  const authUrl =
    provider === 'google'
      ? google.authUrl({ redirectUri, state, loginHint: user.email ?? undefined })
      : microsoft.authUrl({ redirectUri, state, loginHint: user.email ?? undefined })

  const res = NextResponse.redirect(authUrl)
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax', // survives the round-trip redirect back from the provider
    path: '/api/email/direct',
    maxAge: 600, // 10 min to complete consent
  })
  return res
}
