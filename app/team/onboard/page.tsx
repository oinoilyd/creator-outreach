/**
 * /team/onboard — "Teams & Enterprise" inquiry page.
 *
 * Dylan 2026-06-10: the team feature isn't ready for self-serve
 * checkout yet, so instead of pushing users straight to Stripe we
 * pitch it as a demo / request-access flow. The inquiry posts through
 * the existing /api/contact pipeline (persists + emails Dylan). The
 * self-serve Stripe path (/api/team/checkout) is kept for when we
 * flip it back on, just not linked from here.
 */
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { TeamOnboardClient } from './TeamOnboardClient'

export const dynamic = 'force-dynamic'

export default async function TeamOnboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-12">
      <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
        <TeamOnboardClient userEmail={user?.email ?? null} />
      </Suspense>
    </main>
  )
}
