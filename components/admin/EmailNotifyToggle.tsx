'use client'

/**
 * EmailNotifyToggle — admin-only switch that flips a user's email_opt_in
 * flag (whether inbox messages also email them). Compact pill, no
 * optimistic update (waits for the server). Mirrors UnlimitedExportsToggle.
 */
import { useState } from 'react'

interface Props {
  userId: string
  initial: boolean
  onFlipped?: (next: boolean) => void
}

export function EmailNotifyToggle({ userId, initial, onFlipped }: Props) {
  const [value, setValue] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function flip() {
    if (saving) return
    const next = !value
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/email-optin', {
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
            ? 'Emails ON — this account also gets emailed. Click to make it in-app only.'
            : 'Emails OFF — in-app only. Click to also email this account.'
      }
      className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider transition-colors ${
        saving
          ? 'bg-muted text-muted-foreground/60 cursor-wait'
          : error
            ? 'bg-red-500/15 text-red-700 dark:text-red-300 ring-1 ring-red-500/30'
            : value
              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 hover:bg-blue-500/25'
              : 'bg-muted text-muted-foreground/80 hover:bg-muted/80 hover:text-foreground'
      }`}
    >
      {saving ? '…' : value ? 'Email on' : 'Email off'}
    </button>
  )
}
