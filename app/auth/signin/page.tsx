'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/landing/AuthShell'

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      router.push(next)
      router.refresh()
    } catch (caught: unknown) {
      const msg = caught instanceof Error ? caught.message : 'Sign in failed.'
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm bg-card/80 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/40">
      <h1 className="text-2xl font-bold text-foreground mb-1">Sign in</h1>
      <p className="text-muted-foreground text-sm mb-6">Welcome back to Creator Outreach.</p>

      <form onSubmit={signInWithPassword} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors"
          />
        </div>

        {error && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-primary-foreground hover:opacity-90 font-semibold py-2.5 rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-xs text-muted-foreground text-center mt-4">
        <Link href="/auth/forgot-password" className="text-brand hover:text-brand/80 transition-colors">Forgot password?</Link>
      </p>

      <p className="text-xs text-muted-foreground text-center mt-3">
        Don&apos;t have an account?{' '}
        <Link href={`/auth/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-brand hover:text-brand/80 transition-colors">Sign up</Link>
      </p>
    </div>
  )
}

export default function SignInPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
        <SignInForm />
      </Suspense>
    </AuthShell>
  )
}
