'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/landing/AuthShell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  async function sendEmail() {
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
      // Send users straight to /auth/reset-password — that page
      // now does its own exchangeCodeForSession on the ?code= it
      // receives (see app/auth/reset-password/page.tsx). Going
      // direct (instead of routing through /auth/callback) avoids
      // adding a new entry to Supabase's redirect-URL allow-list.
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      setSent(true)
      // 30s cooldown to discourage rapid re-sends
      setResendCooldown(30)
      const tick = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) { clearInterval(tick); return 0 }
          return prev - 1
        })
      }, 1000)
    } catch (caught: any) {
      setError(caught?.message || 'Could not send reset email')
    } finally {
      setLoading(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await sendEmail()
  }

  return (
    <AuthShell>
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-xl shadow-purple-200/20 dark:bg-card/80 dark:backdrop-blur-md dark:border-white/10 dark:shadow-black/40">
        <h1 className="text-2xl font-bold text-foreground mb-1">Reset your password</h1>
        <p className="text-muted-foreground text-sm mb-6">
          {sent
            ? <>We sent a reset link to <span className="text-foreground font-medium break-all">{email}</span>. Click it to choose a new password.</>
            : "Enter your email and we'll send you a link to reset your password."}
        </p>

        {!sent && (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label htmlFor="forgot-email" className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
              <input
                id="forgot-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors dark:bg-white/[0.04] dark:border-white/10"
              />
            </div>

            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="text-xs text-red-700 dark:text-red-300 bg-red-500/10 border border-red-500/30 rounded px-3 py-2"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:opacity-90 font-semibold py-2.5 rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        {sent && (
          <>
            {/* Spam warning — Supabase's default sender often lands
                in spam / "dangerous" folders. Surfacing this up
                front avoids a long support tail. */}
            <div className="rounded-lg bg-amber-50 border border-amber-200/70 px-4 py-3 mb-4 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:border-amber-400/30 dark:text-amber-200">
              <div className="font-semibold mb-1 flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4" />
                  <path d="M10.36 3.5L2.13 17.85a2 2 0 0 0 1.74 3h16.26a2 2 0 0 0 1.74-3l-8.23-14.35a2 2 0 0 0-3.48 0z" />
                  <path d="M12 17h.01" />
                </svg>
                Don&apos;t see the email?
              </div>
              <ul className="list-none space-y-0.5 text-[12.5px] leading-snug">
                <li>· Check your spam / junk folder</li>
                <li>· Wait ~30 seconds — it can lag</li>
                <li>· If it&apos;s flagged as &quot;dangerous,&quot; mark as not spam — it&apos;s safe</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={sendEmail}
              disabled={loading || resendCooldown > 0}
              className="w-full bg-muted text-foreground hover:bg-muted/70 font-medium py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm dark:bg-white/[0.06] dark:hover:bg-white/[0.10]"
            >
              {loading
                ? 'Sending…'
                : resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : 'Resend the email'}
            </button>
          </>
        )}

        <p className="text-xs text-muted-foreground text-center mt-5">
          <Link href="/auth/signin" className="text-brand hover:text-brand/80 transition-colors">Back to sign in</Link>
        </p>
      </div>
    </AuthShell>
  )
}
