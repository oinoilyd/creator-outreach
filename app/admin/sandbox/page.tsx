/**
 * /admin/sandbox — multi-role enterprise testing dashboard.
 *
 * Lists the 5 fixture users in the Test Team org with one-click
 * "Open as <role>" magic links. The intended workflow is:
 *
 *   1. Click "Rebuild sandbox" once — provisions a fresh Test Team
 *      with Owner / Admin / 3 Members.
 *   2. For each role you want to test, right-click "Open as Owner"
 *      → "Open Link in Incognito Window". Each incognito window
 *      has its own auth context — you stay signed in as yourself
 *      in the main window.
 *   3. Switch between windows to see role-based UI in parallel.
 *
 * Magic links are short-lived (Supabase default ~1 hour). Click
 * "Refresh magic links" any time to regenerate without rebuilding
 * the team.
 */
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SandboxClient } from './SandboxClient'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export const dynamic = 'force-dynamic'

export default async function SandboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) notFound()

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Enterprise sandbox</h1>
            <p className="text-muted-foreground text-sm mt-1">
              5-user Test Team. Open each role in an incognito window for parallel multi-role testing.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-4 py-2 transition-colors"
          >
            ← Admin
          </Link>
        </div>
        <SandboxClient />
      </div>
    </main>
  )
}
