/**
 * /admin/calendar-preview — sandbox for 4 alternative follow-up
 * calendar designs. Admin-only (gated by ADMIN_EMAIL like every other
 * /admin/* page). Renders mock follow-up data through 4 distinct
 * design directions so Dylan can pick which one to ship as the
 * production calendar.
 *
 * The four designs (in toggle order):
 *   A — Current (Month grid)     baseline, what's live today
 *   B — Agenda timeline          vertical, day-by-day stack, info-dense
 *   C — Heatmap (multi-month)    GitHub-style density grid, 3 months
 *   D — Bento today-first        editorial layout with hero "today" card
 *   E — Kanban buckets           Today / This week / Later columns
 *
 * Mock data lives in the client component so we don't need a DB
 * round-trip. Once a winner is picked, that design replaces
 * components/FollowUpCalendar inside the real Follow-ups tab.
 */

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CalendarPreviewClient from './CalendarPreviewClient'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export const metadata = {
  title: 'Admin · Calendar previews',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function CalendarPreviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) notFound()

  return <CalendarPreviewClient />
}
