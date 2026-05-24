'use client'

/**
 * MigrateTrialsButton — admin-only one-shot button that calls the
 * trial-length migration endpoint. Use after deploying the 14→7 day
 * trial change to force-shorten any existing 14-day trials.
 *
 * Idempotent — re-running is safe; it just re-caps already-shortened
 * trials at 7 days (no-op).
 *
 * Shows a summary toast when done.
 */

import { useState } from 'react'

interface MigrationSummary {
  total: number
  migrated: number
  unchanged: number
  errors: number
}

export function MigrateTrialsButton() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<MigrationSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (running) return
    if (!confirm('Force-shorten all active 14-day trials to 7 days?\n\nThis is idempotent — safe to re-run.')) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/migrate-trial-lengths', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || `Migration failed (${res.status})`)
        return
      }
      const data = (await res.json()) as MigrationSummary
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={running}
        className="text-xs rounded-md px-3 py-1.5 border border-amber-500/40 text-amber-800 dark:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {running ? 'Migrating trials…' : 'Migrate 14d trials → 7d'}
      </button>
      {result && (
        <span className="text-xs text-muted-foreground">
          {result.migrated} shortened · {result.unchanged} skipped · {result.errors} errors (of {result.total})
        </span>
      )}
      {error && (
        <span className="text-xs text-red-700 dark:text-red-400">{error}</span>
      )}
    </div>
  )
}
