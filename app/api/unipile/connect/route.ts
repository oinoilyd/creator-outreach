/**
 * POST /api/unipile/connect — generate a Unipile hosted-auth URL.
 *
 * Called by the "Connect Gmail" button in the ProfileModal. We mint a
 * short-lived (15 min) hosted-auth link that takes the user through
 * Unipile's OAuth flow with Google, then redirects them back to
 * /unipile/connected on success or failure.
 *
 * On Unipile's side, completing the flow fires a webhook to
 * /api/unipile/webhook with { account_id, name: user.id, status }.
 * That webhook is what actually writes unipile_account_id into the
 * user_profile row — this route just returns the URL.
 *
 * Auth: requires a signed-in Supabase session. The user.id is
 * embedded as `name` in the hosted link so the webhook can map
 * the returned account_id back to the right user.
 *
 * Rate-limited: 10 connection attempts per user per hour. Generous
 * but not unlimited — keeps a runaway client-side bug from spamming
 * Unipile (and our quota).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUser, rateLimit } from '@/lib/api-auth'
import { createHostedAuthLink, UnipileError } from '@/lib/unipile'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const user = auth

  const limited = rateLimit(user.id, 'unipile-connect', 10, user.email)
  if (limited) return limited

  // Determine the public origin we'll redirect Unipile back to.
  // Prefer the explicit env var (set on Vercel for prod), fall back
  // to the request origin so localhost dev still works.
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    `${req.nextUrl.protocol}//${req.nextUrl.host}`

  try {
    const link = await createHostedAuthLink({
      userId: user.id,
      providers: ['GOOGLE'],
      successRedirectUrl: `${origin}/unipile/connected?status=success`,
      failureRedirectUrl: `${origin}/unipile/connected?status=fail`,
      notifyUrl: `${origin}/api/unipile/webhook`,
      expiresInMinutes: 15,
    })
    return NextResponse.json({ url: link.url })
  } catch (err) {
    if (err instanceof UnipileError) {
      console.error('[unipile/connect] Unipile error', err.status, err.message, err.payload)
      return NextResponse.json(
        { error: err.message, hint: err.status === 0 ? 'Check that UNIPILE_API_KEY is set on Vercel and redeploy.' : undefined },
        { status: err.status === 0 ? 500 : 502 },
      )
    }
    console.error('[unipile/connect] unexpected', err)
    return NextResponse.json({ error: 'Failed to generate Unipile auth link' }, { status: 500 })
  }
}
