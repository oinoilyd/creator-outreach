/**
 * POST /api/unipile/connect-linkedin — generate a hosted-auth URL for
 * LinkedIn (separate route so the connect flow can ship its own
 * success+failure URLs, redirects, and analytics).
 *
 * LinkedIn uses Unipile's same /api/v1/hosted/accounts/link endpoint
 * — only the `providers: ['LINKEDIN']` differs. Each user can have
 * one LinkedIn account connected concurrently with their Gmail.
 *
 * NOTE: LinkedIn DOES restrict automated activity at the account
 * level. Heavy usage (>~50 connection requests/day, >~30 DMs/day)
 * triggers their anti-automation flags and can restrict the account.
 * Phase 6 (this file) only does the connect — outbound LinkedIn
 * activity (sendDM, connection requests) is gated behind an
 * explicit per-action button so usage stays human-paced.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUser, rateLimit } from '@/lib/api-auth'
import { createHostedAuthLink, UnipileError } from '@/lib/unipile'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const user = auth

  const limited = rateLimit(user.id, 'unipile-connect-linkedin', 10)
  if (limited) return limited

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    `${req.nextUrl.protocol}//${req.nextUrl.host}`

  try {
    const link = await createHostedAuthLink({
      userId: user.id,
      providers: ['LINKEDIN'],
      successRedirectUrl: `${origin}/unipile/connected?status=success&provider=linkedin`,
      failureRedirectUrl: `${origin}/unipile/connected?status=fail&provider=linkedin`,
      notifyUrl: `${origin}/api/unipile/webhook`,
      expiresInMinutes: 15,
    })
    return NextResponse.json({ url: link.url })
  } catch (err) {
    if (err instanceof UnipileError) {
      console.error('[unipile/connect-linkedin] error', err.status, err.message)
      return NextResponse.json(
        { error: err.message },
        { status: err.status === 0 ? 500 : 502 },
      )
    }
    return NextResponse.json({ error: 'Failed to generate LinkedIn auth link' }, { status: 500 })
  }
}
