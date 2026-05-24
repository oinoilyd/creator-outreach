/**
 * /team/accept — entry point for invitation links.
 *
 * URL: /team/accept?token=<base64url>
 *
 * Renders an AcceptInviteClient that:
 *   1. If not signed in → redirects to /auth/signin?next=/team/accept?token=…
 *      (preserves the token across the auth round-trip)
 *   2. If signed in → POSTs to /api/team/invitations/accept and shows
 *      success/error based on the response.
 *
 * Server-side wrapper is dead-simple — just renders the client.
 */
import { Suspense } from 'react'
import { AcceptInviteClient } from './AcceptInviteClient'

export const dynamic = 'force-dynamic'

export default function AcceptInvitePage() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-12">
      <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
        <AcceptInviteClient />
      </Suspense>
    </main>
  )
}
