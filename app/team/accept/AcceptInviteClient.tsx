'use client'

/**
 * AcceptInviteClient — the actual invite-acceptance UX.
 *
 * On mount:
 *   1. Read token from URL.
 *   2. Check auth state. If not signed in, redirect to /auth/signin
 *      with the current URL preserved in `next` so we come back here
 *      after auth.
 *   3. POST /api/team/invitations/accept with the token.
 *   4. On success → redirect to / (team app).
 *   5. On error → show the error with actionable next steps (e.g.
 *      "your email doesn't match", "cancel individual sub first").
 */

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type State =
  | { kind: 'loading' }
  | { kind: 'redirecting_signin' }
  | { kind: 'accepting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string; requiresIndividualCancel?: boolean }

export function AcceptInviteClient() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    if (!token) {
      setState({ kind: 'error', message: 'No invitation token in URL.' })
      return
    }
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        // Bounce to signin with `next` preserving this URL.
        const next = encodeURIComponent(`/team/accept?token=${encodeURIComponent(token)}`)
        setState({ kind: 'redirecting_signin' })
        router.push(`/auth/signin?next=${next}`)
        return
      }
      setState({ kind: 'accepting' })
      try {
        const res = await fetch('/api/team/invitations/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        if (cancelled) return
        if (res.ok) {
          setState({ kind: 'success' })
          // Give the user a moment to see the success state, then redirect.
          setTimeout(() => router.push('/'), 1500)
          return
        }
        const data = await res.json().catch(() => null)
        setState({
          kind: 'error',
          message: data?.error || `Could not accept invite (HTTP ${res.status}).`,
          requiresIndividualCancel: data?.requiresIndividualCancel === true,
        })
      } catch (err) {
        if (cancelled) return
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Network error accepting invite.',
        })
      }
    })()
    return () => { cancelled = true }
  }, [token, router])

  return (
    <div className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full p-8">
      {state.kind === 'loading' && (
        <div className="text-sm text-muted-foreground text-center">Verifying invitation…</div>
      )}
      {state.kind === 'redirecting_signin' && (
        <div className="text-sm text-muted-foreground text-center">
          Redirecting you to sign in. You&apos;ll come back here automatically after.
        </div>
      )}
      {state.kind === 'accepting' && (
        <div className="text-sm text-muted-foreground text-center">Joining your team…</div>
      )}
      {state.kind === 'success' && (
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-1">You&apos;re on the team!</h1>
          <p className="text-sm text-muted-foreground">Loading the app…</p>
        </div>
      )}
      {state.kind === 'error' && (
        <div>
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/15 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-foreground text-center mb-2">Could not accept</h1>
          <p className="text-sm text-muted-foreground text-center mb-4">{state.message}</p>
          {state.requiresIndividualCancel && (
            <a
              href="/pricing"
              className="block text-center px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Cancel individual sub
            </a>
          )}
        </div>
      )}
    </div>
  )
}
