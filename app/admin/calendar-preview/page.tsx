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

import CalendarPreviewClient from './CalendarPreviewClient'

// 2026-05-10: dropped the ADMIN_EMAIL gate on this page so Dylan
// can preview from any of his test accounts (5 emails / 2 unique
// users currently signed in for multi-tenant testing). The page
// is a sandbox with mock data and zero real-data exposure — no
// reason to admin-gate it. The middleware still requires the
// visitor to be authenticated, which is plenty.
export const metadata = {
  title: 'Calendar design previews',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function CalendarPreviewPage() {
  return <CalendarPreviewClient />
}
