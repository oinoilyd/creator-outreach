'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/landing/AuthShell'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session)
    })
  }, [])

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
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-2xl shadow-black/10 dark:shadow-black/40">
        <h1 className="text-2xl font-bold text-foreground mb-1">Choose a new password</h1>
        <p className="text-muted-foreground text-sm mb-6">
          {done
            ? 'Password updated. Redirecting…'
            : hasSession === false
              ? 'This reset link looks invalid or expired. Request a new one.'
              : 'Pick a new password for your account.'}
        </p>

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
                className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm focus:outline-none focus:border-blue-500"
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
                className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            {error && <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded px-3 py-2">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-foreground font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}

        {hasSession === false && (
          <p className="text-xs text-muted-foreground text-center mt-5">
            <Link href="/auth/forgot-password" className="text-blue-400 hover:text-blue-300">Request a new reset link</Link>
          </p>
        )}
      </div>
    </AuthShell>
  )
}
