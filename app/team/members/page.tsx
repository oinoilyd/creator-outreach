/**
 * /team/members — Team management dashboard.
 *
 * Visible to anyone in an org. Content is role-gated:
 *   • Owner/Admin: see member list with role pills, pending invites,
 *     "Invite teammate" form, remove buttons (with role rules).
 *   • Member: see member list (read-only). Invite UI hidden.
 *
 * Non-org users get redirected to /team/onboard so they can create
 * a team first.
 */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTeamContextForUser } from '@/lib/team-context'
import { TeamMembersClient } from './TeamMembersClient'

export const dynamic = 'force-dynamic'

export default async function TeamMembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin?next=/team/members')

  const ctx = await getTeamContextForUser(user.id)
  if (ctx.mode === 'individual') {
    redirect('/team/onboard')
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{ctx.organization?.name ?? 'Team'}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage members + invitations
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-4 py-2 transition-colors"
          >
            ← Back to app
          </Link>
        </div>

        <TeamMembersClient
          yourRole={ctx.role!}
          organizationId={ctx.organization!.id}
          subscriptionStatus={ctx.organization!.subscriptionStatus}
          memberCountForBilling={undefined /* client fetches fresh */}
        />
      </div>
    </main>
  )
}
