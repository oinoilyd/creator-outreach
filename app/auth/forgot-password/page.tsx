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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      setSent(true)
    } catch (caught: any) {
      setError(caught?.message || 'Could not send reset email')
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-2xl shadow-black/10 dark:shadow-black/40">
        <h1 className="text-2xl font-bold text-foreground mb-1">Reset your password</h1>
        <p className="text-muted-foreground text-sm mb-6">
          {sent
            ? "We've sent a reset link to your email. Click it to choose a new password."
            : "Enter your email and we'll send you a link to reset your password."}
        </p>

        {!sent && (
          <form onSubmit={submit} className="space-y-3">
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

            {error && <div className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded px-3 py-2">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-foreground font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="text-xs text-muted-foreground text-center mt-5">
          <Link href="/auth/signin" className="text-blue-400 hover:text-blue-300">Back to sign in</Link>
        </p>
      </div>
    </AuthShell>
  )
}
