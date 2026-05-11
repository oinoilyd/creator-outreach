/**
 * Server-side Stripe client.
 *
 * Lazy-initialized via getStripe() so the module import never throws
 * at build time when STRIPE_SECRET_KEY isn't set (the marketing/landing
 * pages should still build cleanly in dev environments without Stripe
 * keys configured). The clear error only fires when a route actually
 * tries to USE Stripe at request time.
 *
 * apiVersion is pinned so a Stripe SDK upgrade doesn't silently change
 * behaviour. Bump deliberately when we want new Stripe features.
 */

import Stripe from 'stripe'

let cached: Stripe | null = null

export function getStripe(): Stripe {
  if (cached) return cached
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Configure it in your env (see .env.example) before using Stripe.',
    )
  }
  cached = new Stripe(secret, {
    apiVersion: '2026-04-22.dahlia',
    // Mark requests so the Stripe dashboard "Logs" view can filter
    // by source — helpful when debugging vs other tooling.
    appInfo: {
      name: 'creator-outreach',
      url: 'https://creatoroutreach.net',
    },
  })
  return cached
}

/**
 * Cheap presence check the UI can call at render time. Doesn't
 * instantiate the SDK — just checks the env var. Use this to hide
 * the upgrade button when Stripe isn't configured (dev environments,
 * preview deploys without secrets).
 */
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}
