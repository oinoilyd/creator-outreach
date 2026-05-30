'use client'

/**
 * Client-side CTA for the pricing page.
 *
 * Three states, derived at render time from the props passed by the
 * server component:
 *
 *   1. signed out → "Start 7-day free trial" routes to /auth/signup
 *      with next=/pricing so they land back here post-signup.
 *   2. signed in + has active subscription → "Manage subscription"
 *      POSTs /api/stripe/portal and redirects to the Portal URL.
 *   3. signed in + no active subscription → "Start 7-day free trial"
 *      POSTs /api/stripe/checkout with this card's priceId, redirects
 *      to the hosted Checkout.
 *
 * Inline error handling — fetch failures render a small red note
 * under the button instead of throwing a toast (this page has no
 * toaster mounted yet).
 */

import { useState } from 'react'
import Link from 'next/link'
import { usePromoCode } from './PromoCodeApplier'

export type PricingButtonMode = 'signed-out' | 'subscribe' | 'manage'

export function PricingCheckoutButton({
  mode,
  priceId,
  featured = false,
  signupNext = '/pricing',
  promotionCode = null,
}: {
  mode: PricingButtonMode
  priceId: string
  featured?: boolean
  signupNext?: string
  /** Optional Stripe promotion code (user-facing alias like "VIPOUTREACH").
   *  Passed through to /api/stripe/checkout which validates it against
   *  Stripe and applies it to the session. Invalid codes → inline error. */
  promotionCode?: string | null
}) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Read the user's applied promo code from PromoCodeProvider (if
  // wrapped — usePromoCode returns null when no provider above).
  // Explicit promotionCode prop always wins over the context.
  const contextPromo = usePromoCode()
  const effectivePromo = promotionCode ?? contextPromo

  const classes = `mt-auto flex w-full items-center justify-center gap-1.5 px-5 py-3 rounded-md font-semibold text-[15px] whitespace-nowrap transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
    featured
      ? 'bg-white text-[#0F1733] hover:bg-[#F2A261]'
      : 'bg-[#0F1733] text-white hover:bg-[#E85D2F]'
  }`

  if (mode === 'signed-out') {
    return (
      <Link
        href={`/auth/signup?next=${encodeURIComponent(signupNext)}`}
        className={classes}
      >
        Start 7-day free trial <span aria-hidden>→</span>
      </Link>
    )
  }

  async function go() {
    setErr(null)
    setLoading(true)
    try {
      const endpoint = mode === 'manage' ? '/api/stripe/portal' : '/api/stripe/checkout'
      const body =
        mode === 'manage'
          ? {}
          : effectivePromo
            ? { priceId, promotionCode: effectivePromo }
            : { priceId }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data: { url?: string; error?: string } = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        setErr(data.error || `Request failed (${res.status})`)
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unexpected error'
      setErr(msg)
      setLoading(false)
    }
  }

  return (
    <>
      <button type="button" onClick={go} disabled={loading} className={classes}>
        {loading
          ? mode === 'manage'
            ? 'Opening portal…'
            : 'Redirecting…'
          : mode === 'manage'
            ? 'Manage subscription'
            : 'Start 7-day free trial'}
        {!loading && <span aria-hidden>→</span>}
      </button>
      {err && (
        <p className="mt-2 text-[12px] text-red-500/90 text-center">
          {err}
        </p>
      )}
    </>
  )
}
