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
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-7" onClick={e => e.stopPropagation()}>
        <div className="text-4xl mb-3">📦</div>
        <h2 className="text-xl font-bold text-white mb-1">Import your saved data?</h2>
        <p className="text-gray-400 text-sm mb-5">
          We found <span className="text-white font-semibold">{total}</span> item{total === 1 ? '' : 's'} in this browser
          {outreachCount > 0 && <> — <span className="text-white">{outreachCount}</span> outreach{outreachCount === 1 ? ' entry' : ' entries'}</>}
          {outreachCount > 0 && dismissedCount > 0 && <> and</>}
          {dismissedCount > 0 && <> <span className="text-white">{dismissedCount}</span> dismissed creator{dismissedCount === 1 ? '' : 's'}</>}
          . Add them to your account?
        </p>

        <div className="bg-gray-800/40 border border-gray-800 rounded-lg p-3 mb-5 text-xs text-gray-400">
          This is a one-time import. After this, all your data lives in your account so it works on any device.
        </div>

        {error && <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded px-3 py-2 mb-4">{error}</div>}
        {done && <div className="text-xs text-green-400 bg-green-900/20 border border-green-900/40 rounded px-3 py-2 mb-4">✓ {done}</div>}

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onSkip}
            disabled={busy}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
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
