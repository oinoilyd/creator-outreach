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
    console.log('[signin] env URL=', !!process.env.NEXT_PUBLIC_SUPABASE_URL, 'KEY=', !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    try {
      const supabase = createClient()
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
      console.log('[signin] result:', { hasSession: !!data?.session, errMessage: err?.message })
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      router.push(next)
      router.refresh()
    } catch (caught: any) {
      console.error('[signin] threw:', caught)
      setError(caught?.message || 'Sign in failed (see browser console)')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-2xl shadow-black/10 dark:shadow-black/40">
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
            className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {error && <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded px-3 py-2">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-foreground font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-xs text-muted-foreground text-center mt-4">
        <Link href="/auth/forgot-password" className="text-blue-400 hover:text-blue-300">Forgot password?</Link>
      </p>

      <p className="text-xs text-muted-foreground text-center mt-3">
        Don&apos;t have an account?{' '}
        <Link href={`/auth/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-blue-400 hover:text-blue-300">Sign up</Link>
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
