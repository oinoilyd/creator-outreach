/**
 * GET /api/unipile/thread/[id] — fetch the full email thread for an
 * outreach entry, used by the ThreadModal (Phase 4) to render the
 * back-and-forth inline.
 *
 * [id] is the outreach_entries.id. We do the entry lookup server-side
 * so the client never has to know thread_id / account_id — those are
 * private detail and the client only needs to pass the entry id it
 * already owns.
 *
 * Returns oldest-first array of messages, normalized into a UI-friendly
 * shape (no Unipile internals leaked into the client).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'
import { getThreadMessages, UnipileError } from '@/lib/unipile'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const user = auth
  const { id: entryId } = await ctx.params
  if (!entryId) return NextResponse.json({ error: 'Missing entry id' }, { status: 400 })

  const supabase = await createClient()
  const [{ data: entry, error: entryErr }, { data: profile }] = await Promise.all([
    supabase
      .from('outreach_entries')
      .select('id, unipile_thread_id, channel_name')
      .eq('id', entryId)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('user_profile')
      .select('unipile_account_id')
      .eq('user_id', user.id)
      .single(),
  ])

  if (entryErr || !entry) {
    return NextResponse.json({ error: 'Outreach entry not found' }, { status: 404 })
  }
  const accountId = profile?.unipile_account_id as string | null | undefined
  const threadId = entry.unipile_thread_id as string | null | undefined
  if (!accountId || !threadId) {
    return NextResponse.json({
      ok: true,
      messages: [],
      reason: !accountId ? 'no Unipile account connected' : 'no thread yet — this entry was never sent via Unipile',
    })
  }

  try {
    const raw = await getThreadMessages(accountId, threadId)
    // Sort oldest → newest for chronological display.
    const sorted = raw.slice().sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : 0
      const tb = b.date ? new Date(b.date).getTime() : 0
      return ta - tb
    })
    const normalized = sorted.map(m => ({
      id: m.id ?? m.provider_id ?? '',
      date: m.date ?? null,
      subject: m.subject ?? '',
      from: m.from_attendee?.identifier ?? null,
      fromName: m.from_attendee?.display_name ?? null,
      to: (m.to_attendees ?? []).map(a => a.identifier).filter(Boolean) as string[],
      bodyText: m.body_plain ?? m.body ?? '',
      providerId: m.provider_id ?? null,
    }))
    return NextResponse.json({ ok: true, messages: normalized })
  } catch (err) {
    if (err instanceof UnipileError) {
      console.error('[unipile/thread] fetch failed', err.status, err.message)
      return NextResponse.json(
        { error: err.message },
        { status: err.status === 0 ? 500 : 502 },
      )
    }
    return NextResponse.json({ error: 'Failed to fetch thread' }, { status: 500 })
  }
}
