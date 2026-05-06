'use client'

import { useState } from 'react'

export function MigrationPromptModal({
  outreachCount,
  dismissedCount,
  onMigrate,
  onSkip,
}: {
  outreachCount: number
  dismissedCount: number
  onMigrate: () => Promise<{ ok: boolean; message: string }>
  onSkip: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<string | null>(null)

  const total = outreachCount + dismissedCount

  async function handleMigrate() {
    setBusy(true)
    setError('')
    const result = await onMigrate()
    if (result.ok) {
      setDone(result.message)
      // Auto-close + reload after a brief moment so user sees confirmation
      setTimeout(() => window.location.reload(), 1200)
    } else {
      setError(result.message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 w-full max-w-md p-7" onClick={e => e.stopPropagation()}>
        <div className="text-4xl mb-3">📦</div>
        <h2 className="text-xl font-bold text-foreground mb-1">Import your saved data?</h2>
        <p className="text-muted-foreground text-sm mb-5">
          We found <span className="text-foreground font-semibold">{total}</span> item{total === 1 ? '' : 's'} in this browser
          {outreachCount > 0 && <> — <span className="text-foreground">{outreachCount}</span> outreach{outreachCount === 1 ? ' entry' : ' entries'}</>}
          {outreachCount > 0 && dismissedCount > 0 && <> and</>}
          {dismissedCount > 0 && <> <span className="text-foreground">{dismissedCount}</span> dismissed creator{dismissedCount === 1 ? '' : 's'}</>}
          . Add them to your account?
        </p>

        <div className="bg-muted/40 border border-border rounded-lg p-3 mb-5 text-xs text-muted-foreground">
          This is a one-time import. After this, all your data lives in your account so it works on any device.
        </div>

        {error && <div className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded px-3 py-2 mb-4">{error}</div>}
        {done && <div className="text-xs text-emerald-800 dark:text-green-400 bg-emerald-50 dark:bg-green-900/20 border border-emerald-200 dark:border-green-900/40 rounded px-3 py-2 mb-4">✓ {done}</div>}

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onSkip}
            disabled={busy}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Skip for now
          </button>
          <button
            onClick={handleMigrate}
            disabled={busy || !!done}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Importing…' : done ? 'Imported ✓' : `Import ${total} item${total === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
