/**
 * /admin/team-preview — interactive role-view simulator for the
 * enterprise/team feature.
 *
 * Dylan 2026-06-10: the sandbox (separate logins per fixture) was too
 * fiddly to actually evaluate the team UX. This page is a pure
 * client-side SIMULATION — a pre-built team + outreach board with a
 * "View as" dropdown that re-renders the exact view each role would
 * see, in your own admin session. No auth juggling, no DB, no RLS, no
 * real data touched. Flip between Owner / Admin / Member instantly and
 * watch reassignment flow between people live.
 *
 * This mirrors the real permission rules from lib/team.ts:
 *   • Owner + Admin → see ALL rows, can reassign, filter by member.
 *   • Member       → see ONLY rows assigned to them, no reassign,
 *                    no visibility into anyone else.
 */
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { TeamPreviewClient } from './TeamPreviewClient'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export const dynamic = 'force-dynamic'

export default async function TeamPreviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) notFound()

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Team view simulator</h1>
            <p className="text-muted-foreground/80 text-sm mt-1">
              Flip between roles to see exactly what each team member sees. Pure preview — no real data.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-4 py-2 transition-colors"
          >
            ← Back to admin
          </Link>
        </div>
        <TeamPreviewClient />
      </div>
    </main>
  )
}
