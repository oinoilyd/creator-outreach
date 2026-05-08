import { NextRequest, NextResponse } from 'next/server'
import { requireUser, rateLimit } from '@/lib/api-auth'
import { forbidIfNotAdmin } from '@/lib/admin'
import { newMethodology, isPlausibleEmail, type MethodologyInput } from '@/lib/newMethodology'

// Same hard blocklist as the orchestrator. Duplicated here intentionally
// so this endpoint's response is independently safe — even if the
// orchestrator's scrub misses something, the methodology service can't
// emit a junk email at all.
const HARD_BLOCK_PATTERNS: RegExp[] = [
  /@stanwith\.me$/i, /@stan\.store$/i, /@patreon\.com$/i,
  /@buymeacoffee\.com$/i, /@ko-?fi\.com$/i,
  /@.+\.sentry\.io$/i, /@sentry\.io$/i,
  /@allmylinks\.com$/i, /@about\.me$/i, /@bio\.fm$/i,
  /@solo\.to$/i, /@pillar\.io$/i, /@lnk\.bio$/i,
  /@msha\.ke$/i, /@withkoji\.com$/i, /@campsite\.bio$/i,
  /@beehiiv\.com$/i, /@substack\.com$/i, /@convertkit\.com$/i,
  /@mailchimp\.com$/i, /@gumroad\.com$/i,
]

function isBlocked(email: string): boolean {
  if (!email) return true
  const lc = email.toLowerCase().trim()
  if (HARD_BLOCK_PATTERNS.some(re => re.test(lc))) return true
  if (!isPlausibleEmail(lc)) return true
  return false
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const forbidden = forbidIfNotAdmin(auth)
  if (forbidden) return forbidden
  const limited = rateLimit(auth.id, 'admin-new-methodology', 50)
  if (limited) return limited

  let body: MethodologyInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.channelId || !body.channelName) {
    return NextResponse.json({ error: 'channelId + channelName required' }, { status: 400 })
  }

  const result = await newMethodology(body)

  // Scrub at the source — drop any blocked email + drop any blocked
  // hits from the candidates list. Recompute the top email from
  // surviving hits.
  const cleanHits = result.hits.filter(h => !isBlocked(h.email))
  const dropped = result.hits.length - cleanHits.length
  if (dropped > 0) {
    console.warn(`[new-methodology scrub] dropped ${dropped} blocked hits, kept ${cleanHits.length}`)
  }
  const topEmail = cleanHits[0]?.email ?? null

  return NextResponse.json({
    ...result,
    email: topEmail,
    hits: cleanHits,
  })
}
