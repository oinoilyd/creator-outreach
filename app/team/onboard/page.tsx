/**
 * /team/onboard — collect a team name, then push the user through
 * Stripe Checkout for the $150/mo Team plan.
 *
 * No actual org row is created here — that happens in the Stripe
 * webhook once payment succeeds, so we never end up with orphan orgs
 * that "exist" without a paid subscription.
 */
import { Suspense } from 'react'
import { TeamOnboardClient } from './TeamOnboardClient'

export const dynamic = 'force-dynamic'

export default function TeamOnboardPage() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-12">
      <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
        <TeamOnboardClient />
      </Suspense>
    </main>
  )
}
