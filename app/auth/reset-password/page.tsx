'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/landing/AuthShell'

/**
 * Choose-a-new-password page.
 *
 * Lifecycle:
 *   1. /auth/forgot-password sends a Supabase reset email with
 *      redirectTo = /auth/callback?next=/auth/reset-password.
 *   2. User clicks the email link → Supabase /auth/v1/verify
 *      validates the recovery token → 302 to redirectTo + ?code=XXX.
 *   3. /auth/callback runs exchangeCodeForSession(code) on the
 *      server, sets the auth cookie, then 302 to /auth/reset-password.
 *   4. This page mounts WITH a real session → form renders → user
 *      submits a new password → updateUser({ password }) succeeds.
 *
 * Defense-in-depth: if for any reason a ?code= still ends up here
 * directly (legacy email, manual nav), we exchange it inline before
 * deciding the link is invalid. That way no flow is dead-ended.
 */
export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  // null = still resolving session, false = no session, true = ready
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function resolveSession() {
      // Defense-in-depth: if a `?code=` snuck through (legacy email,
      // manual nav, or the user reloaded the verify URL), exchange
      // it here too before reading the session.
      const code = searchParams?.get('code')
      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code)
          // Strip the code from the URL so a refresh doesn't try to
          // re-exchange (which would error — codes are single-use).
          if (typeof window !== 'undefined') {
            const cleanUrl = window.location.pathname
            window.history.replaceState({}, '', cleanUrl)
          }
        } catch {
          // Swallow — getSession below will detect the missing
          // session and we'll show the "invalid / expired" UI.
        }
      }

      const { data } = await supabase.auth.getSession()
      if (!cancelled) setHasSession(!!data.session)
    }

    void resolveSession()

    // Also subscribe to auth state changes — the SIGNED_IN /
    // PASSWORD_RECOVERY events fire when the cookie lands, even if
    // getSession() returned null on the first read.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      if (session) setHasSession(true)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [searchParams])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      setDone(true)
      setTimeout(() => router.push('/'), 1500)
    } catch (caught: any) {
      setError(caught?.message || 'Could not update password')
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-xl shadow-purple-200/20 dark:bg-card/80 dark:backdrop-blur-md dark:border-white/10 dark:shadow-black/40">
        <h1 className="text-2xl font-bold text-foreground mb-1">Choose a new password</h1>
        <p className="text-muted-foreground text-sm mb-6">
          {done
            ? 'Password updated. Redirecting…'
            : hasSession === null
              ? 'Verifying your reset link…'
              : hasSession === false
                ? 'This reset link looks invalid or expired. Request a new one below.'
                : 'Pick a new password for your account.'}
        </p>

        {/* Resolving state — small spinner so the page doesn't look frozen */}
        {hasSession === null && !done && (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-brand/30 border-t-brand rounded-full animate-spin" aria-label="Loading" />
          </div>
        )}

        {hasSession && !done && (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">New password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoFocus
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors dark:bg-white/[0.04] dark:border-white/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                minLength={6}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors dark:bg-white/[0.04] dark:border-white/10"
              />
            </div>

            {error && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:opacity-90 font-semibold py-2.5 rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}

        {hasSession === false && !done && (
          <Link
            href="/auth/forgot-password"
            className="block w-full text-center bg-primary text-primary-foreground hover:opacity-90 font-semibold py-2.5 rounded-lg transition-opacity mt-3"
          >
            Request a new reset link
          </Link>
        )}

        <p className="text-xs text-muted-foreground text-center mt-5">
          <Link href="/auth/signin" className="text-brand hover:text-brand/80 transition-colors">Back to sign in</Link>
        </p>
      </div>
    </AuthShell>
  )
}
