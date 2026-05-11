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
  const isManage = variant !== 'upgrade'

  const base =
    'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[12px] font-medium transition-colors whitespace-nowrap'
  const variantClass =
    variant === 'upgrade'
      ? 'border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-200 hover:bg-purple-500/20'
      : variant === 'warn'
        ? 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-300 hover:bg-red-500/20'
        : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80'

  if (!isManage) {
    return (
      <Link href="/pricing" className={`${base} ${variantClass}`} aria-label="Upgrade">
        <SparkIcon /> {cta}
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
    >
      <SparkIcon /> {loading ? 'Opening…' : cta}
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
