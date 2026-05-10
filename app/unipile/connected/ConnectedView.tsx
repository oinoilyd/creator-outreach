'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Phase = 'polling' | 'connected' | 'timeout' | 'failed'

/**
 * Client view for /unipile/connected. The parent page.tsx wraps this in
 * a Suspense boundary because useSearchParams() forces dynamic
 * rendering, which Next.js wants explicit about.
 */
export default function ConnectedView() {
  const params = useSearchParams()
  const router = useRouter()
  const status = params.get('status')
  const [phase, setPhase] = useState<Phase>(status === 'fail' ? 'failed' : 'polling')
  const [email, setEmail] = useState<string | null>(null)
  const [pollCount, setPollCount] = useState(0)

  useEffect(() => {
    if (phase !== 'polling') return
    let cancelled = false
    const POLL_MS = 1500
    const MAX_ATTEMPTS = 14 // ≈ 21s before showing "still pending"

    async function tick(attempt: number) {
      if (cancelled) return
      try {
        const resp = await fetch('/api/unipile/me', { cache: 'no-store' })
        if (resp.ok) {
          const data = (await resp.json()) as { connected?: boolean; email?: string | null }
          if (data.connected) {
            if (!cancelled) {
              setEmail(data.email ?? null)
              setPhase('connected')
            }
            return
          }
        }
      } catch {
        // network blip — keep polling
      }
      if (attempt >= MAX_ATTEMPTS) {
        if (!cancelled) setPhase('timeout')
        return
      }
      setPollCount(attempt + 1)
      setTimeout(() => tick(attempt + 1), POLL_MS)
    }
    tick(0)
    return () => {
      cancelled = true
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'connected') return
    const t = setTimeout(() => router.push('/?gmail_connected=1'), 1800)
    return () => clearTimeout(t)
  }, [phase, router])

  return (
    <div className="max-w-md w-full rounded-2xl border border-border bg-card/40 p-8 text-center shadow-sm">
      {phase === 'polling' && (
        <>
          <div className="text-4xl mb-3" aria-hidden>⏳</div>
          <h1 className="text-lg font-semibold mb-2">Finishing up…</h1>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Linking your Gmail account. This usually takes a second or two — Unipile
            is sending us the final handshake.
          </p>
          <div className="text-[11px] text-muted-foreground/70 font-mono">
            attempt {pollCount + 1}
          </div>
        </>
      )}
      {phase === 'connected' && (
        <>
          <div className="text-4xl mb-3" aria-hidden>✅</div>
          <h1 className="text-lg font-semibold mb-2">Gmail connected</h1>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            {email ? (
              <>Linked <span className="font-mono text-foreground">{email}</span>. Returning to the app…</>
            ) : (
              <>Your Gmail is linked. Returning to the app…</>
            )}
          </p>
        </>
      )}
      {phase === 'timeout' && (
        <>
          <div className="text-4xl mb-3" aria-hidden>🤔</div>
          <h1 className="text-lg font-semibold mb-2">Still pending</h1>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Unipile said the OAuth finished, but the connection hasn&apos;t shown up on
            our side yet. This sometimes lags by a minute. Reload or open the app and
            check your profile in a moment.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => {
                setPhase('polling')
                setPollCount(0)
              }}
              className="text-sm rounded-lg border border-border px-4 py-2 hover:border-foreground/60 transition-colors"
            >
              Check again
            </button>
            <Link
              href="/"
              className="text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 transition-colors"
            >
              Back to app
            </Link>
          </div>
        </>
      )}
      {phase === 'failed' && (
        <>
          <div className="text-4xl mb-3" aria-hidden>⚠️</div>
          <h1 className="text-lg font-semibold mb-2">Connection failed</h1>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            The Gmail OAuth flow was cancelled or hit an error. No changes were made on
            your end. You can try again any time from your profile.
          </p>
          <Link
            href="/"
            className="inline-block text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 transition-colors"
          >
            Back to app
          </Link>
        </>
      )}
    </div>
  )
}
