import { Suspense } from 'react'
import { AuthShell } from '@/components/landing/AuthShell'
import { CheckEmailCard } from './CheckEmailCard'

/**
 * Post-signup landing page. Shows the email we sent the link to plus
 * a subtle "didn't get it? resend / check spam" line. The actual
 * resend button is a client component (CheckEmailCard) so we can call
 * supabase.auth.resend().
 *
 * Why subtle: a loud amber warning makes the new user feel like
 * something already went wrong. The reality — Supabase's default mail
 * sender lands in spam often — needs to be surfaced, but as a quiet
 * helpful note, not a big yellow banner.
 */
export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  return (
    <AuthShell>
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading…</div>}>
        <CheckEmailCard email={email ?? null} />
      </Suspense>
    </AuthShell>
  )
}
