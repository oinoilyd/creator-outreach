'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/landing/AuthShell'
import { PasswordChecklist } from '@/components/PasswordChecklist'
import { validatePassword, friendlyPasswordError } from '@/lib/password'
import { safeNext } from '@/lib/safe-redirect'

function SignUpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // safeNext() blocks open-redirect attempts.
  const next = safeNext(searchParams.get('next'), '/')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function signUpWithPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Client-side check FIRST — surfaces a clean error instead of
    // letting Supabase return its character-class-dump message.
    const { valid, missing } = validatePassword(password)
    if (!valid) {
      const labels = missing.map(m => m.label.toLowerCase())
      const tail = labels.pop()
      const msg = labels.length
        ? `Your password is missing ${labels.join(', ')} and ${tail}.`
        : `Your password is missing ${tail}.`
      setError(msg)
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (err) {
      setError(friendlyPasswordError(err.message, password))
      setLoading(false)
      return
    }
    router.push(`/auth/check-email?email=${encodeURIComponent(email)}`)
  }

  /** Google OAuth signup — same provider call as sign-in. Supabase
   *  treats sign-up and sign-in as one operation for OAuth providers
   *  (the user record is auto-created on first sign-in). */
  async function signUpWithGoogle() {
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })
      if (err) {
        setError(err.message)
        setLoading(false)
      }
    } catch (caught: unknown) {
      const msg = caught instanceof Error ? caught.message : 'Google sign-up failed.'
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-xl shadow-purple-200/20 dark:bg-card/80 dark:backdrop-blur-md dark:border-white/10 dark:shadow-black/40">
      <h1 className="text-2xl font-bold text-foreground mb-1">Create your account</h1>
      <p className="text-muted-foreground text-sm mb-6">Find creators worth reaching out to — fast.</p>

      {/* Google OAuth — primary path for new users (one tap, no
          password to remember). Sits above the email/password form. */}
      <button
        type="button"
        onClick={signUpWithGoogle}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-gray-50 text-gray-800 font-medium py-2.5 rounded-lg border border-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:hover:bg-gray-100"
      >
        <GoogleIcon />
        <span>Sign up with Google</span>
      </button>

      <div className="flex items-center gap-3 my-5" aria-hidden>
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 font-medium">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={signUpWithPassword} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors dark:bg-white/[0.04] dark:border-white/10"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors dark:bg-white/[0.04] dark:border-white/10"
          />
          <PasswordChecklist password={password} />
        </div>

        {error && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-primary-foreground hover:opacity-90 font-semibold py-2.5 rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>

        {/* Tiny pre-submit hint — sets expectations so the user knows
            to look in spam BEFORE they're stranded on /check-email.
            Quiet on purpose: not an alert, just a footnote. */}
        <p className="text-[11px] text-muted-foreground/70 text-center leading-relaxed pt-1">
          You&apos;ll get a sign-in link by email — check your spam folder if
          you don&apos;t see it.
        </p>
      </form>

      <p className="text-xs text-muted-foreground text-center mt-5">
        Already have an account?{' '}
        <Link href={`/auth/signin${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-brand hover:text-brand/80 transition-colors">Sign in</Link>
      </p>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
        <SignUpForm />
      </Suspense>
    </AuthShell>
  )
}

/** Google "G" mark for the OAuth button. Same SVG as signin/page.tsx —
 *  duplicated to keep both pages standalone with no extra component
 *  file. If we add a third surface (e.g. a modal upsell), extract. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z" />
    </svg>
  )
}
