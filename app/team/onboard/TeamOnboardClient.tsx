'use client'

/**
 * TeamOnboardClient — "Teams & Enterprise" inquiry form.
 *
 * Dylan 2026-06-10: pivoted from self-serve Stripe checkout to a
 * sales-led "request a demo" flow while the team feature is finished
 * + dogfooded. Submits through /api/contact (persists to
 * contact_messages + emails Dylan via Resend), tagged as an
 * enterprise inquiry so it's easy to spot in the inbox.
 */

import { useState } from 'react'

const FEATURES = [
  'One shared pipeline — your whole team\'s outreach in a single board',
  'Roles that fit how you work — Owner, Admin, and Member',
  'Assign creators + active-client engagements to the right teammate',
  'Owners & Admins see everything and reassign work; Members focus on just theirs',
  'Centralized billing — one subscription, seats added as you grow',
]

export function TeamOnboardClient({ userEmail }: { userEmail: string | null }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState(userEmail ?? '')
  const [company, setCompany] = useState('')
  const [teamSize, setTeamSize] = useState('2–5')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      setError('Please add your name and a work email.')
      return
    }
    setSubmitting(true)
    setError(null)
    // Compose a structured message so the inquiry reads clearly in
    // Dylan's inbox / contact_messages table.
    const composed =
      `ENTERPRISE / TEAM INQUIRY\n` +
      `Company / team: ${company.trim() || '—'}\n` +
      `Team size: ${teamSize}\n` +
      `\n${message.trim() || '(no additional message)'}`
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: composed }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || `Could not send (HTTP ${res.status}). Try again.`)
        setSubmitting(false)
        return
      }
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.')
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">Thanks — we&apos;ll be in touch</h1>
        <p className="text-sm text-muted-foreground">
          We&apos;ll reach out within a day or two to walk you through a demo and get your team set up.
          Keep using your individual account in the meantime.
        </p>
        <a href="/" className="inline-block mt-6 text-sm font-medium text-foreground underline underline-offset-2">
          ← Back to the app
        </a>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl shadow-xl max-w-lg w-full p-8">
      <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] font-bold text-purple-700 dark:text-purple-300 bg-purple-500/10 border border-purple-500/30 rounded-full px-2.5 py-1 mb-3">
        Teams & Enterprise · early access
      </div>
      <h1 className="text-2xl font-semibold text-foreground mb-2">Run outreach as a team</h1>
      <p className="text-sm text-muted-foreground mb-5">
        Bring your whole team into one shared pipeline with roles, assignments, and centralized billing.
        We&apos;re onboarding teams hands-on right now — tell us a bit about yours and we&apos;ll set up a demo.
      </p>

      <ul className="space-y-1.5 mb-6">
        {FEATURES.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px] text-foreground/85">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" aria-hidden>
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-foreground/80">Your name</span>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Jane Smith" required disabled={submitting}
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-foreground/80">Work email</span>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com" required disabled={submitting}
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
            />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-foreground/80">Company / team</span>
            <input
              type="text" value={company} onChange={e => setCompany(e.target.value)}
              placeholder="Acme Creators" disabled={submitting}
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-foreground/80">Team size</span>
            <select
              value={teamSize} onChange={e => setTeamSize(e.target.value)} disabled={submitting}
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
            >
              <option>2–5</option>
              <option>6–10</option>
              <option>11–25</option>
              <option>25+</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-foreground/80">Anything else? <span className="text-muted-foreground/70">(optional)</span></span>
          <textarea
            value={message} onChange={e => setMessage(e.target.value)} rows={3}
            placeholder="What are you hoping to do with a team account?"
            disabled={submitting}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none disabled:opacity-60"
          />
        </label>

        {error && (
          <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-sm text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !name.trim() || !email.trim()}
          className="w-full px-4 py-2.5 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Sending…' : 'Request a demo →'}
        </button>
      </form>

      <p className="text-xs text-muted-foreground/70 mt-5 text-center">
        No charge today. We&apos;ll set up pricing + seats together on the call.
      </p>
    </div>
  )
}
