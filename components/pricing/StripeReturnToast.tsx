'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

/**
 * Fires a toast when the user returns to /pricing from a CANCELED Stripe
 * Checkout (cancel_url = /pricing?stripe=canceled). Without it the user
 * lands back on pricing with zero feedback at the most sensitive moment of
 * the funnel — unsure whether they were charged.
 *
 * The ?stripe=success case is handled on the app home (app/page.tsx),
 * where a now-subscribed user lands; a canceled (still-unsubscribed) user
 * is bounced here by the paywall, so the cancel half must live on /pricing.
 *
 * Renders nothing. MUST be wrapped in <Suspense> by the parent because it
 * calls useSearchParams() (Next App Router requirement).
 */
export function StripeReturnToast() {
  const params = useSearchParams()
  useEffect(() => {
    if (params.get('stripe') !== 'canceled') return
    // Strip the param so a refresh / shared link doesn't replay the toast.
    const url = new URL(window.location.href)
    url.searchParams.delete('stripe')
    window.history.replaceState({}, '', url.pathname + url.search + url.hash)
    toast('Checkout canceled — no charge was made.', {
      description: 'You can start your trial whenever you’re ready.',
    })
  }, [params])
  return null
}
