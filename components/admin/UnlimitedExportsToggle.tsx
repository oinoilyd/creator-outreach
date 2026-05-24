'use client'

/**
 * UnlimitedExportsToggle — admin-only switch that flips a user's
 * unlimited_exports flag. Renders as a compact pill that shows the
 * current state and toggles on click.
 *
 * State machine:
 *   • idle       — show current value, ready to click
 *   • saving     — show spinner, button disabled
 *   • error      — show error tooltip, revert to previous value
 *
 * No optimistic update — we wait for the server to confirm before
 * flipping the visible state. The flag is rarely flipped (probably
 * single-digit times per month), so the extra ~200ms feels fine vs.
 * the risk of showing a stale value after a failed write.
 */

import { useState } from 'react'

interface Props {
  userId: string
  initial: boolean
  // Optional callback after a successful flip, so the admin page can
  // re-render any derived state. Currently unused but worth keeping
  // for future composition.
  onFlipped?: (next: boolean) => void
}

export function UnlimitedExportsToggle({ userId, initial, onFlipped }: Props) {
  const [value, setValue] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function flip() {
    if (saving) return
    const next = !value
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/unlimited-exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, value: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.detail || `Update failed (${res.status})`)
        return
      }
      setValue(next)
      onFlipped?.(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      onClick={flip}
      disabled={saving}
      title={
        error
          ? error
          : value
            ? 'Unlimited exports ON — click to revoke'
            : 'Unlimited exports OFF — click to grant'
      }
      className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider transition-colors ${
        saving
          ? 'bg-muted text-muted-foreground/60 cursor-wait'
          : error
            ? 'bg-red-500/15 text-red-700 dark:text-red-300 ring-1 ring-red-500/30'
            : value
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25'
              : 'bg-muted text-muted-foreground/80 hover:bg-muted/80 hover:text-foreground'
      }`}
    >
      {saving ? '…' : value ? 'comp' : 'off'}
    </button>
  )
}
