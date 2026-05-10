'use client'

/**
 * ThreadModal — full email conversation history for an outreach entry.
 *
 * Phase 4. Renders the back-and-forth between user and creator as a
 * timeline. Each message shows date, from/to, subject (if changed),
 * and the plain-text body. No HTML rendering — we explicitly want
 * "what you'd see in Gmail with formatting stripped" because (a) it's
 * safe (no script injection), (b) it's compact, and (c) the user
 * already has Gmail if they want to see formatting.
 *
 * Reads from /api/unipile/thread/[entryId] — server resolves the
 * thread_id and Unipile account from the entry, calls Unipile, and
 * returns normalized messages.
 */

import { useEffect, useRef, useState } from 'react'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

interface ThreadMessage {
  id: string
  date: string | null
  subject: string
  from: string | null
  fromName: string | null
  to: string[]
  bodyText: string
  providerId: string | null
}

interface Props {
  entryId: string
  /** Display label for the modal header — channel name etc. */
  recipientLabel?: string
  /** The currently-logged-in user's email so we can highlight their messages. */
  userEmail: string | null
  onClose: () => void
}

export function ThreadModal({ entryId, recipientLabel, userEmail, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, true)
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const resp = await fetch(`/api/unipile/thread/${encodeURIComponent(entryId)}`, {
          cache: 'no-store',
        })
        const data = await resp.json()
        if (cancelled) return
        if (!resp.ok) {
          setError(data.error || `HTTP ${resp.status}`)
        } else {
          setMessages(data.messages || [])
          setReason(data.reason ?? null)
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [entryId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="thread-modal-title"
        className="relative bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 w-full max-w-3xl p-6 focus:outline-none max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4 gap-3 shrink-0">
          <div>
            <h2 id="thread-modal-title" className="text-lg font-bold text-foreground">
              Conversation
              {recipientLabel ? <span className="text-muted-foreground font-normal"> · {recipientLabel}</span> : null}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Full email thread from Unipile, oldest first.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground text-lg leading-none w-7 h-7 inline-flex items-center justify-center rounded hover:bg-muted/40 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
          {loading && (
            <div className="text-center py-10 text-sm text-muted-foreground">Loading conversation…</div>
          )}
          {!loading && error && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          {!loading && !error && messages && messages.length === 0 && (
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-6 text-center">
              <div className="text-sm font-medium text-foreground mb-1">No conversation yet</div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                {reason || 'Send an email via the Send button to start the thread — replies and follow-ups will appear here automatically.'}
              </div>
            </div>
          )}
          {!loading && !error && messages && messages.length > 0 && messages.map((m) => {
            const isFromMe = userEmail && m.from && m.from.toLowerCase() === userEmail.toLowerCase()
            const dateStr = m.date
              ? new Date(m.date).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : ''
            return (
              <article
                key={m.id}
                className={`rounded-xl border p-4 ${
                  isFromMe
                    ? 'border-blue-500/30 bg-blue-500/5'
                    : 'border-emerald-500/30 bg-emerald-500/5'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div className="text-xs">
                    <span className={`font-semibold ${isFromMe ? 'text-blue-700 dark:text-blue-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                      {isFromMe ? 'You' : (m.fromName || m.from || '(unknown)')}
                    </span>
                    {!isFromMe && m.from && (
                      <span className="text-muted-foreground/80 font-mono ml-2">{m.from}</span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{dateStr}</span>
                </div>
                {m.subject && (
                  <div className="text-xs text-foreground font-medium mb-2">{m.subject}</div>
                )}
                <pre className="text-xs text-foreground/90 whitespace-pre-wrap break-words font-sans leading-relaxed">
                  {m.bodyText || '(empty body)'}
                </pre>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
