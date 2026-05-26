'use client'

/**
 * TeamOnboardClient — name your team, then go to Stripe Checkout.
 *
 * Three UI states:
 *   • idle — name input + Continue button
 *   • redirecting — spinner while we hit the server to start Checkout
 *   • error — shows the failure with actionable next steps
 *
 * If the user already has an individual subscription, the server
 * returns `requiresIndividualCancel: true` and we render a "Cancel
 * first" CTA pointing to the billing portal.
 */

import { useState } from 'react'
import { TEAM_BASE_PRICE_CENTS, TEAM_BASE_SEATS, TEAM_SEAT_PRICE_CENTS, formatPriceCents } from '@/lib/team'

export function TeamOnboardClient() {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requiresCancel, setRequiresCancel] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setSubmitting(true)
    setError(null)
    setRequiresCancel(false)
    try {
      const res = await fetch('/api/team/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName: trimmed }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || `Could not start checkout (HTTP ${res.status}).`)
        setRequiresCancel(data?.requiresIndividualCancel === true)
        setSubmitting(false)
        return
      }
      const data: { url?: string } = await res.json()
      if (!data.url) {
        setError('No checkout URL returned.')
        setSubmitting(false)
        return
      }
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.')
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full p-8">
      <h1 className="text-2xl font-semibold text-foreground mb-2">Create your team</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Start the Team plan: <strong>{formatPriceCents(TEAM_BASE_PRICE_CENTS)}/mo</strong> for {TEAM_BASE_SEATS} seats, then{' '}
        <strong>{formatPriceCents(TEAM_SEAT_PRICE_CENTS)}/mo</strong> per extra seat. 7-day free trial.
      </p>

      {/* Reassurance banner — Dylan flagged 2026-05-26 that the
          original copy ("existing outreach will be migrated") was
          ambiguous. Explicit list of what carries over + confirmation
          that canceling the individual sub first is safe. */}
      <div className="mb-6 p-3 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40">
        <div className="text-xs font-semibold text-emerald-900 dark:text-emerald-100 mb-1">
          Your pipeline carries over — fully
        </div>
        <ul className="text-xs text-emerald-800 dark:text-emerald-200 space-y-0.5 ml-3 list-disc">
          <li>All <strong>outreach entries</strong> (every status, every stage)</li>
          <li>All <strong>active client engagements</strong> (budgets, contracts, notes, milestones)</li>
          <li>Favorites, dismissed creators, templates, and your scoring config</li>
        </ul>
        <div className="text-[11px] text-emerald-700 dark:text-emerald-300/90 mt-2">
          Canceling your individual subscription first <strong>does not delete any data</strong> — it just stops the individual billing. When you create the team, everything moves into the new org with you as Owner.
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Team name</span>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Ryan Gaynor Co."
            maxLength={80}
            autoFocus
            required
            disabled={submitting}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
          />
        </label>
        <p className="text-xs text-muted-foreground mt-1">
          You can change this later. Pick something your team will recognize.
        </p>

        {error && (
          <div className="mt-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            {requiresCancel && (
              <>
                <p className="text-xs text-red-700 dark:text-red-300 mt-2">
                  Your outreach + active clients are safe — they&apos;ll migrate when you create the team.
                </p>
                <a
                  href="/pricing"
                  className="inline-block mt-2 text-xs font-medium text-red-900 dark:text-red-100 underline"
                >
                  Manage individual subscription →
                </a>
              </>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="mt-6 w-full px-4 py-2.5 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Redirecting to Stripe…' : 'Continue to checkout →'}
        </button>
      </form>

      <p className="text-xs text-muted-foreground/70 mt-6">
        You&apos;ll be set as Owner. Cancel anytime from billing.
      </p>
    </div>
  )
}
