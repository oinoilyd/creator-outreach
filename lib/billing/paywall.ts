/**
 * Paywall gating — decides whether a given user needs to start a
 * subscription before they can use the app.
 *
 * Two ways to be exempt:
 *   1. Email is on the BYPASS_PAYWALL_EMAILS allowlist (comma-separated
 *      env var). Dylan + Ryan stay here permanently — they never see the
 *      paywall regardless of subscription state. Cleaner than hard-coding
 *      emails in the codebase.
 *   2. subscription_status is one of {trialing, active, past_due, unpaid} —
 *      "past_due"/"unpaid" still grant access because Stripe will retry
 *      the charge automatically and we don't want to lock paying customers
 *      out the moment a card expires; the portal nudges them to fix it.
 *
 * Everyone else (no sub OR canceled/incomplete) gets redirected to
 * /pricing?required=1 by the middleware.
 *
 * Per Dylan 2026-05-13: no grandfather window. Existing users without a
 * sub get the paywall the moment this ships — same as new signups. Only
 * the bypass list saves anyone (you + Ryan).
 */

// Permanent paywall bypass: the owner + the comped demo account (Dylan
// wants dewalker hardcoded to never hit the paywall). Comp anyone ELSE via
// the BYPASS_PAYWALL_EMAILS env var rather than adding more emails here.
const FALLBACK_BYPASS = [
  'dmeehanj@gmail.com',
  'heydeewakar@gmail.com', // comped demo — hardcoded paywall pass per Dylan
]

/** Subscription statuses that grant app access. */
const LIVE_SUB_STATUSES = new Set(['trialing', 'active', 'past_due', 'unpaid'])

/** Read + normalize the bypass list once per request. */
export function getBypassEmails(): Set<string> {
  const raw = process.env.BYPASS_PAYWALL_EMAILS ?? ''
  const parsed = raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
  // Merge env list with the hardcoded fallback so Dylan never locks
  // himself out even if the env var is misconfigured or missing.
  const combined = new Set([...FALLBACK_BYPASS.map(e => e.toLowerCase()), ...parsed])
  return combined
}

export function isPaywallBypassed(email: string | null | undefined): boolean {
  if (!email) return false
  return getBypassEmails().has(email.toLowerCase())
}

export function hasLiveSubscription(status: string | null | undefined): boolean {
  if (!status) return false
  return LIVE_SUB_STATUSES.has(status)
}

/**
 * Returns true if the user can use the app. False = redirect them to
 * /pricing?required=1.
 */
export function isAllowedInApp(
  email: string | null | undefined,
  status: string | null | undefined,
): boolean {
  return isPaywallBypassed(email) || hasLiveSubscription(status)
}
