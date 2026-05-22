'use client'

/**
 * Subtle "Upgrade" / "Manage" button that sits beside the hamburger
 * menu in the app's top bar.
 *
 * • status null              → "Upgrade" → /pricing
 * • status 'trialing'        → "Pro · {days left}d trial" → portal
 * • status 'active'          → "Pro" → portal
 * • status 'past_due'        → "Past due" → portal (highlighted red)
 * • status 'canceled' / null → "Upgrade" → /pricing
 *
 * Portal redirects go through POST /api/stripe/portal which mints a
 * session URL. We show a one-line inline status next to the button
 * while loading so it doesn't feel dead.
 */

import { useState } from 'react'
import Link from 'next/link'

export type SubscriptionSnapshot = {
  status: string | null
  priceId: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  stripeCustomerId: string | null
} | null

interface UpgradeLabel {
  cta: string
  hint?: string
  variant: 'upgrade' | 'pro' | 'warn'
}

/**
 * Compute a compact mobile label from the full label. Used so the
 * UpgradeButton can show "Trial · 14d left" on desktop but just
 * "14d" on a phone — the longer string overlaps the wordmark in
 * the sticky header on narrow screens.
 */
export function computeUpgradeLabelCompact(sub: SubscriptionSnapshot): string {
  if (!sub || !sub.status || sub.status === 'canceled' || sub.status === 'incomplete_expired') {
    return 'Upgrade'
  }
  if (sub.status === 'past_due' || sub.status === 'unpaid') return 'Past due'
  if (sub.status === 'trialing') {
    const daysLeft = trialDaysLeft(sub.currentPeriodEnd)
    const tail = daysLeft != null ? `${daysLeft}d` : 'Trial'
    return sub.cancelAtPeriodEnd ? `${tail}!` : tail
  }
  if (sub.status === 'active') {
    return sub.cancelAtPeriodEnd ? 'Pro!' : 'Pro'
  }
  return sub.status
}

/**
 * Compute the visible label from subscription state. Pure function —
 * exported so the hamburger menu can render the same string.
 */
export function computeUpgradeLabel(sub: SubscriptionSnapshot): UpgradeLabel {
  if (!sub || !sub.status || sub.status === 'canceled' || sub.status === 'incomplete_expired') {
    return { cta: 'Upgrade', hint: 'Start free trial', variant: 'upgrade' }
  }
  if (sub.status === 'past_due' || sub.status === 'unpaid') {
    return { cta: 'Past due', hint: 'Fix payment', variant: 'warn' }
  }
  if (sub.status === 'trialing') {
    const daysLeft = trialDaysLeft(sub.currentPeriodEnd)
    const tail = daysLeft != null ? ` · ${daysLeft}d left` : ''
    if (sub.cancelAtPeriodEnd) {
      // User canceled during the trial — Stripe holds access until
      // trial_end then transitions to canceled. Surface the canceling
      // state with warn styling + a Reinstate hint so the user notices
      // they CAN undo before the trial ends.
      return { cta: `Trial${tail} · canceling`, hint: 'Reinstate?', variant: 'warn' }
    }
    return { cta: `Trial${tail}`, hint: 'Free trial', variant: 'pro' }
  }
  if (sub.status === 'active') {
    if (sub.cancelAtPeriodEnd) {
      return { cta: 'Pro · canceling', hint: 'Renew?', variant: 'warn' }
    }
    return { cta: 'Pro', hint: 'Manage', variant: 'pro' }
  }
  // Catch-all for less-common statuses (paused, incomplete) — surface
  // the raw status so support can debug, but route to portal.
  return { cta: sub.status, hint: 'Manage', variant: 'pro' }
}

function trialDaysLeft(periodEnd: string | null): number | null {
  if (!periodEnd) return null
  const end = new Date(periodEnd).getTime()
  if (Number.isNaN(end)) return null
  const ms = end - Date.now()
  if (ms <= 0) return 0
  return Math.ceil(ms / 86400_000)
}

export function UpgradeButton({
  subscription,
  stripeConfigured,
}: {
  subscription: SubscriptionSnapshot
  stripeConfigured: boolean
}) {
  const [loading, setLoading] = useState(false)
  if (!stripeConfigured) return null

  const { cta, variant } = computeUpgradeLabel(subscription)
  const ctaShort = computeUpgradeLabelCompact(subscription)
  const isManage = variant !== 'upgrade'

  const base =
    'inline-flex items-center gap-1.5 rounded-lg border text-[12px] font-medium transition-colors whitespace-nowrap max-sm:px-2 max-sm:py-1.5 sm:px-3 sm:py-2'
  const variantClass =
    variant === 'upgrade'
      ? 'border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-200 hover:bg-purple-500/20'
      : variant === 'warn'
        ? 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-300 hover:bg-red-500/20'
        : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80'

  // Two label spans so phones see the compact form ("14d") and
  // desktops see the full ("Trial · 14d left"). Hidden via Tailwind
  // responsive classes — no JS branching, no layout shift on resize.
  const labels = (
    <>
      <span className="max-sm:hidden">{cta}</span>
      <span className="sm:hidden">{ctaShort}</span>
    </>
  )

  if (!isManage) {
    return (
      <Link href="/pricing" className={`${base} ${variantClass}`} aria-label="Upgrade" title={cta}>
        <SparkIcon /> {labels}
      </Link>
    )
  }

  async function openPortal() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data: { url?: string; error?: string } = await res.json().catch(() => ({}))
      if (data.url) {
        window.location.href = data.url
        return
      }
      // Portal failed — fall back to pricing page so the user has a path.
      window.location.href = '/pricing'
    } catch {
      window.location.href = '/pricing'
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={openPortal}
      disabled={loading}
      className={`${base} ${variantClass} disabled:opacity-60`}
      aria-label="Manage subscription"
      title={cta}
    >
      <SparkIcon />
      {loading ? <span>Opening…</span> : labels}
    </button>
  )
}

function SparkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-3.5 h-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z"
      />
    </svg>
  )
}
