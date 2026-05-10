'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

/**
 * Client half of the check-email flow. Renders the static "we sent a
 * link" copy plus a Resend button that calls supabase.auth.resend.
 *
 * Resend cooldown: Supabase enforces ~60s between resends per email
 * server-side. We mirror that with a local 30s soft-disable so the
 * user can't spam-click the button before the server reply arrives.
 */
export function CheckEmailCard({ email }: { email: string | null }) {
  const [state, setState] = useState<
    | { kind: 'idle' }
    | { kind: 'sending' }
    | { kind: 'sent' }
    | { kind: 'error'; message: string }
    | { kind: 'cooling'; until: number }
  >({ kind: 'idle' })

  async function handleResend() {
    if (!email) return
    if (state.kind === 'sending' || state.kind === 'cooling') return
    setState({ kind: 'sending' })
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({ type: 'signup', email })
      if (error) {
        // Supabase rate limits resends — treat that as "cool down" UX
        // rather than a hard error so the user knows to wait.
        const isRate = /rate|too many/i.test(error.message)
        if (isRate) {
          setState({ kind: 'cooling', until: Date.now() + 30_000 })
          setTimeout(() => setState({ kind: 'idle' }), 30_000)
          return
        }
        setState({ kind: 'error', message: error.message })
        return
      }
      setState({ kind: 'sent' })
      // Auto-clear the success state after a few seconds so the
      // button comes back if the resent email also missed.
      setTimeout(() => setState({ kind: 'idle' }), 8_000)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Resend failed.'
      setState({ kind: 'error', message: msg })
    }
  }

  const resendDisabled =
    !email || state.kind === 'sending' || state.kind === 'cooling' || state.kind === 'sent'

  return (
    <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-xl shadow-purple-200/20 dark:bg-card/80 dark:backdrop-blur-md dark:border-white/10 dark:shadow-black/40">
      {/* Mail-icon SVG (replaces 📬 emoji per anti-emoji house rule) */}
      <div className="flex items-center justify-center mb-5">
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand/10 text-brand">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </span>
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-2 text-center">
        Check your email
      </h1>
      <p className="text-muted-foreground text-sm mb-5 text-center">
        We sent a sign-in link to{' '}
        {email
          ? <span className="text-foreground font-medium break-all">{email}</span>
          : 'your inbox'}.
      </p>

      {/* Subtle "didn't get it? resend / check spam" footer note.
          Replaces the older amber banner — that felt like an error.
          This sits below the main message as a quiet helper, with
          the live Resend action inline. */}
      <div className="text-xs text-muted-foreground/85 text-center leading-relaxed mb-5">
        Didn&apos;t get it?{' '}
        <button
          type="button"
          onClick={handleResend}
          disabled={resendDisabled}
          className="text-brand hover:text-brand/80 transition-colors font-medium underline-offset-2 hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:no-underline disabled:hover:text-brand"
        >
          {state.kind === 'sending' ? 'Sending…'
            : state.kind === 'sent' ? 'Sent ✓'
            : state.kind === 'cooling' ? 'Wait 30s…'
            : 'Resend it'}
        </button>{' '}
        or check your spam folder — Supabase mail sometimes lands there.
        {state.kind === 'error' && (
          <div className="mt-1.5 text-red-600 dark:text-red-400">{state.message}</div>
        )}
      </div>

      <p className="text-xs text-muted-foreground/80 text-center">
        Used a typo?{' '}
        <Link
          href="/auth/signup"
          className="text-brand hover:text-brand/80 transition-colors font-medium"
        >
          Try again
        </Link>
        {' '}·{' '}
        <Link
          href="/auth/signin"
          className="text-brand hover:text-brand/80 transition-colors font-medium"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
