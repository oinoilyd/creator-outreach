import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { forbidIfNotAdmin } from '@/lib/admin'
import { createClient } from '@/lib/supabase/server'
import { todayIso, isoDaysFromNow } from '@/lib/dates'
import type { Creator, OutreachEntry } from '@/lib/types'

// Same 8-keyword preset the original in-app `seedTestData()` (in
// app/page.tsx) used. Moving the work server-side so the admin
// dashboard can trigger it without dragging the function chain through
// the HamburgerMenu prop ladder.
const SEED_KEYWORDS = [
  'fitness coach',
  'cooking',
  'gardening',
  'tech founder',
  'travel vlogger',
  'gaming',
  'finance content creator',
  'photography',
]

const TARGET_TOTAL = 100
const PER_KEYWORD = 15
const TAKE_PER_KEYWORD = 14

// Vercel hobby tier caps function duration at 60s. Eight keywords each
// hitting /api/search internally is the slowest part — give ourselves
// a soft budget so we flush a partial response cleanly instead of
// dying mid-stream.
const SOFT_BUDGET_MS = 55_000
export const maxDuration = 60

/**
 * POST /api/admin/seed-test-data — admin-only. Seeds the caller's
 * outreach with ~100 real creators across 8 preset keywords, with
 * randomized statuses + dates for testing the Follow-ups view, the
 * Outreach table, and the analytics widgets.
 *
 * Cleanup: every seeded row has notes = '[seed]'. The admin UI surfaces
 * this so it's easy to filter + bulk-delete later.
 *
 * Migrated from in-app `seedTestData()` (HamburgerMenu admin-only
 * button) on 2026-05-11 — Dylan wanted the affordance off the user
 * menu and onto the /admin dashboard since it's purely a dev tool.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const forbid = forbidIfNotAdmin(auth)
  if (forbid) return forbid
  const user = auth

  const supabase = await createClient()

  // We re-use the existing /api/search route over HTTP — same pattern
  // as bulk-seed — so caching, scoring, and circuit-breakers all run
  // exactly as they would for a normal user request.
  let baseUrl: string
  try {
    const host = req.headers.get('host')
    const raw = process.env.NEXT_PUBLIC_SITE_URL || (host ? `https://${host}` : '')
    if (!raw) throw new Error('no host header and no NEXT_PUBLIC_SITE_URL configured')
    new URL(raw)
    baseUrl = raw.replace(/\/+$/, '')
  } catch (e: any) {
    return NextResponse.json({ error: `bad base URL: ${e?.message || e}` }, { status: 500 })
  }

  // Existing outreach so we can de-dupe by channelId — same constraint
  // the client used to apply.
  const { data: existingRows } = await supabase
    .from('outreach_entries')
    .select('channel_id')
    .eq('user_id', user.id)
  const seenIds = new Set<string>((existingRows ?? []).map(r => r.channel_id as string))

  const newEntries: OutreachEntry[] = []
  let added = 0
  const startedAt = Date.now()
  const now = Date.now()
  const errors: string[] = []

  for (const kw of SEED_KEYWORDS) {
    if (added >= TARGET_TOTAL) break
    if (Date.now() - startedAt > SOFT_BUDGET_MS) {
      errors.push(`stopped after "${kw}" — soft budget exceeded`)
      break
    }
    try {
      const url = new URL(`${baseUrl}/api/search`)
      url.searchParams.set('keyword', kw)
      url.searchParams.set('maxResults', String(PER_KEYWORD))
      url.searchParams.set('minViews', '0')
      url.searchParams.set('maxViews', '999999999')
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { cookie: req.headers.get('cookie') || '' },
        cache: 'no-store',
      })
      if (!res.ok) {
        errors.push(`search "${kw}" → HTTP ${res.status}`)
        continue
      }
      const text = await res.text()
      let data: { channels?: Creator[] }
      try {
        data = JSON.parse(text)
      } catch {
        errors.push(`search "${kw}" → non-JSON response`)
        continue
      }
      const channels = (data.channels ?? []) as Creator[]
      if (channels.length === 0) continue

      for (const c of channels.slice(0, TAKE_PER_KEYWORD)) {
        if (seenIds.has(c.channelId) || added >= TARGET_TOTAL) continue
        seenIds.add(c.channelId)
        newEntries.push(buildSeedEntry(c, kw, now, added))
        added++
      }
    } catch (err: any) {
      errors.push(`"${kw}" errored: ${err?.message || err}`)
    }
  }

  if (newEntries.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'No creators returned by any search', errors },
      { status: 502 },
    )
  }

  // Bulk insert. Conflict on id is impossible (we generate fresh IDs
  // from `now + added`), but onConflict: 'id' is defensive — if the
  // user runs this twice in a row by mistake, the second run will be
  // a no-op rather than a 23505.
  const rows = newEntries.map(e => outreachToRow(e, user.id))
  const { error: upErr } = await supabase
    .from('outreach_entries')
    .upsert(rows, { onConflict: 'id' })

  if (upErr) {
    return NextResponse.json(
      { ok: false, error: `persist failed: ${upErr.message}`, errors },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    added: newEntries.length,
    elapsedMs: Date.now() - startedAt,
    errors,
  })
}

/** Build one seed OutreachEntry with the same randomized status /
 *  follow-up / response-date distribution the client-side seeder used.
 *  Kept in sync with app/page.tsx::seedTestData() — if you change the
 *  distribution there, change it here too (or factor into a shared
 *  helper). */
function buildSeedEntry(c: Creator, kw: string, now: number, idx: number): OutreachEntry {
  const r1 = Math.random()
  const status: OutreachEntry['status'] =
    r1 < 0.15 ? 'Not Outreached' :
    r1 < 0.45 ? 'Open' :
    r1 < 0.70 ? 'No Response' :
    r1 < 0.85 ? 'Successful' : 'Rejected'

  const tps = status === 'Not Outreached' ? 0 : Math.min(5, Math.floor(Math.random() * 6))
  const reachedDaysAgo = Math.floor(Math.random() * 90)
  const dateReachedOut = status === 'Not Outreached' ? '' : isoDaysFromNow(-reachedDaysAgo)

  let followUpDate = ''
  if (status === 'Open') {
    const r2 = Math.random()
    if (r2 < 0.20) followUpDate = isoDaysFromNow(-(1 + Math.floor(Math.random() * 10)))
    else if (r2 < 0.30) followUpDate = todayIso()
    else if (r2 < 0.65) followUpDate = isoDaysFromNow(1 + Math.floor(Math.random() * 7))
    else followUpDate = isoDaysFromNow(8 + Math.floor(Math.random() * 30))
  } else if (status === 'No Response') {
    followUpDate = Math.random() < 0.5
      ? isoDaysFromNow(-(1 + Math.floor(Math.random() * 14)))
      : isoDaysFromNow(1 + Math.floor(Math.random() * 14))
  }
  const responseDate = (status === 'Successful' || status === 'Rejected')
    ? isoDaysFromNow(-Math.floor(Math.random() * 30)) : ''

  const dealValue = Math.random() > 0.70 ? `$${200 + Math.floor(Math.random() * 4800)}` : ''
  const medium: OutreachEntry['medium'] = (() => {
    const r3 = Math.random()
    return r3 < 0.50 ? 'Email' : r3 < 0.80 ? 'LinkedIn' : r3 < 0.90 ? 'Other' : ''
  })()

  return {
    id: `${c.channelId}-seed-${now + idx}`,
    channelId: c.channelId,
    channelName: c.channelName,
    channelUrl: c.channelUrl,
    description: c.description || '',
    email: c.email || '',
    product: '',
    favorite: Math.random() < 0.20,
    reachedOut: status !== 'Not Outreached',
    medium,
    mediumOther: '',
    headerUsed: status === 'Not Outreached' ? '' : 'Quick question about your channel',
    status,
    addedAt: now - Math.floor(Math.random() * 120 * 86400000),
    notes: '[seed]',
    followUpDate,
    dateReachedOut,
    touchpoints: tps === 0 ? '' : String(tps),
    responseDate,
    subscribers: c.subscribers || '',
    avgViews: c.avgViews || 0,
    fitScore: 50 + Math.floor(Math.random() * 50),
    linkedin: c.linkedin || '',
    instagram: c.instagram || '',
    twitter: c.twitter || '',
    tiktok: c.tiktok || '',
    website: c.website || '',
    contentNiche: kw,
    phone: '',
    dealValue,
    contractSent: status === 'Successful' && !!dealValue,
    meetingScheduled: '',
  }
}

/** Server-side mirror of lib/storage.ts::outreachToRow(). Inlined here
 *  because the storage module is client-only (relies on
 *  lib/supabase/client). Both have to agree — if you add a column to
 *  OutreachEntry, add it to BOTH this row builder and the one in
 *  storage.ts. */
function outreachToRow(e: OutreachEntry, uid: string) {
  return {
    id: e.id,
    user_id: uid,
    channel_id: e.channelId,
    channel_name: e.channelName,
    channel_url: e.channelUrl,
    description: e.description,
    email: e.email,
    product: e.product,
    favorite: e.favorite,
    reached_out: e.reachedOut,
    medium: e.medium,
    medium_other: e.mediumOther,
    header_used: e.headerUsed,
    status: e.status,
    notes: e.notes,
    follow_up_date: e.followUpDate,
    date_reached_out: e.dateReachedOut,
    touchpoints: e.touchpoints,
    response_date: e.responseDate,
    subscribers: e.subscribers,
    avg_views: e.avgViews,
    fit_score: e.fitScore,
    linkedin: e.linkedin,
    instagram: e.instagram,
    twitter: e.twitter,
    tiktok: e.tiktok,
    website: e.website,
    content_niche: e.contentNiche,
    phone: e.phone,
    deal_value: e.dealValue,
    contract_sent: e.contractSent,
    meeting_scheduled: e.meetingScheduled,
    added_at: e.addedAt,
  }
}
