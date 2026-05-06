'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/landing/AuthShell'

function SignUpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function signUpWithPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
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
      setError(err.message)
      setLoading(false)
      return
    }
    router.push(`/auth/check-email?email=${encodeURIComponent(email)}`)
  }

  return (
    <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-2xl shadow-black/10 dark:shadow-black/40">
      <h1 className="text-2xl font-bold text-foreground mb-1">Create your account</h1>
      <p className="text-muted-foreground text-sm mb-6">Find creators worth reaching out to — fast.</p>

      <form onSubmit={signUpWithPassword} className="space-y-3">
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
            minLength={6}
            className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm focus:outline-none focus:border-blue-500"
          />
          <p className="text-[11px] text-muted-foreground/70 mt-1">At least 6 characters.</p>
        </div>

        {error && <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded px-3 py-2">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-foreground font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-xs text-muted-foreground text-center mt-5">
        Already have an account?{' '}
        <Link href={`/auth/signin${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-blue-400 hover:text-blue-300">Sign in</Link>
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
