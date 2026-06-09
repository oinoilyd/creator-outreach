'use client'

/**
 * ErrorInbox — admin-only widget that surfaces silent save failures
 * across every user of the app.
 *
 * Why (Dylan 2026-06-08, post-data-loss incident):
 * Migration 0033 sat unapplied on prod for 16 days. Every save during
 * that window failed with PGRST204 and was buried in browsers'
 * `console.error`. This inbox is the central place where ANY save
 * failure — for any user — gets surfaced to admin so the same kind
 * of silent regression can never go undetected again.
 *
 * Reads from `client_error_log` (migration 0037). RLS restricts SELECT
 * + UPDATE to dmeehanj@gmail.com only.
 *
 * Behavior:
 *   • Shows the unresolved error count as a colored badge — green when
 *     0, amber 1-5, red 6+.
 *   • Expandable list of recent errors with timestamp / user / fn /
 *     error code + message.
 *   • Click "Mark resolved" to set resolved=true (stays in table for
 *     history but drops out of the active inbox).
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ErrorRow {
  id: number
  occurred_at: string
  user_id: string | null
  user_email: string | null
  function_name: string
  error_code: string | null
  error_message: string
  error_details: string | null
  error_hint: string | null
  payload_keys: string[] | null
  resolved: boolean
}

export function ErrorInbox() {
  const [errors, setErrors] = useState<ErrorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [resolvingId, setResolvingId] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('client_error_log')
      .select('*')
      .eq('resolved', false)
      .order('occurred_at', { ascending: false })
      .limit(50)
    if (error) {
      // Most likely cause: migration 0037 not applied yet. We don't
      // alert here — admin can apply it via the same flow as 0033.
      console.warn('[ErrorInbox] could not load:', error.message)
      setErrors([])
    } else {
      setErrors((data as ErrorRow[]) ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // Poll every 30s so newly-logged errors appear without a refresh.
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [])

  async function markResolved(id: number) {
    setResolvingId(id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('client_error_log')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id ?? null,
      })
      .eq('id', id)
    if (error) {
      console.error('[ErrorInbox] resolve failed:', error.message)
    } else {
      setErrors(prev => prev.filter(e => e.id !== id))
    }
    setResolvingId(null)
  }

  const count = errors.length
  const badgeColor =
    count === 0
      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
      : count <= 5
        ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
        : 'bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-300'

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-8">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-base font-semibold text-foreground">Error Inbox</span>
          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${badgeColor}`}>
            {loading ? '…' : count === 0 ? 'All clear' : `${count} unresolved`}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {expanded ? 'Hide' : count === 0 ? 'View history' : 'View errors'}
        </span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-2">
          {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
          {!loading && errors.length === 0 && (
            <div className="text-xs text-muted-foreground">
              No unresolved save failures. Silent regressions across any user will appear here.
            </div>
          )}
          {!loading && errors.map(e => (
            <div key={e.id} className="border border-border rounded-lg p-3 text-xs">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="font-medium text-foreground">
                    {e.function_name}
                    {e.error_code && (
                      <span className="ml-2 text-[10px] text-muted-foreground font-mono">
                        {e.error_code}
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    {e.user_email ?? '(no user)'} · {new Date(e.occurred_at).toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => markResolved(e.id)}
                  disabled={resolvingId === e.id}
                  className="shrink-0 text-[10px] font-medium px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-50"
                >
                  {resolvingId === e.id ? '…' : 'Mark resolved'}
                </button>
              </div>
              <div className="text-foreground/80 break-words">{e.error_message}</div>
              {e.error_details && (
                <div className="mt-1 text-muted-foreground">Details: {e.error_details}</div>
              )}
              {e.error_hint && (
                <div className="mt-1 text-muted-foreground">Hint: {e.error_hint}</div>
              )}
              {e.payload_keys && e.payload_keys.length > 0 && (
                <div className="mt-1 text-muted-foreground/80 font-mono text-[10px]">
                  Payload keys: {e.payload_keys.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
