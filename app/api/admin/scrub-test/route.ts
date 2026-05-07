import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPlausibleEmail } from '@/lib/newMethodology'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

// Diagnostic endpoint: visit /api/admin/scrub-test?email=friends@stanwith.me
// to verify the deploy is running the latest filter code. If the
// response says "blocked": true, the deploy is correct and any
// junk you're seeing is browser cache. If "blocked": false, the
// deploy hasn't propagated and we need to force-redeploy.

const NUCLEAR_SUBSTRINGS = [
  'stanwith', 'stan.store',
  'patreon.com', 'sentry.io',
  'buymeacoffee', 'ko-fi', 'kofi',
  'allmylinks', 'lnk.bio', 'bio.fm',
  'beehiiv', 'substack', 'mailchimp',
  'campsite.bio', 'about.me', 'msha.ke',
  'gumroad', 'convertkit',
]

const HARD_BLOCK_PATTERNS: RegExp[] = [
  /@stanwith\.me$/i, /@stan\.store$/i, /@patreon\.com$/i,
  /@.+\.sentry\.io$/i, /@sentry\.io$/i,
]

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const email = (searchParams.get('email') || 'friends@stanwith.me').toLowerCase().trim()

  const reasons: Record<string, boolean | string> = {
    email,
    contains_nuclear_substring: NUCLEAR_SUBSTRINGS.some(s => email.includes(s)),
    matched_nuclear_substring: NUCLEAR_SUBSTRINGS.find(s => email.includes(s)) || null as unknown as string,
    matches_hard_pattern: HARD_BLOCK_PATTERNS.some(re => re.test(email)),
    is_plausible: isPlausibleEmail(email),
    blocked: NUCLEAR_SUBSTRINGS.some(s => email.includes(s))
            || HARD_BLOCK_PATTERNS.some(re => re.test(email))
            || !isPlausibleEmail(email),
  }

  return NextResponse.json(reasons)
}
