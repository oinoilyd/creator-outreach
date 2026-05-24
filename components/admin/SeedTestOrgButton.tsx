'use client'

/**
 * SeedTestOrgButton — admin-only one-shot button that creates a Test
 * Team org with Owner/Admin/Member fixtures + seed outreach rows.
 *
 * Returns the fixture credentials in a copyable block so Dylan can
 * sign in as each fixture to exercise role-based UI.
 *
 * Idempotent — re-running tears down the prior fixture org first.
 */

import { useState } from 'react'

interface SeedFixture {
  email: string
  role: 'owner' | 'admin' | 'member'
  password: string
}

interface SeedResult {
  organization_id: string
  organization_name: string
  fixtures: SeedFixture[]
}

export function SeedTestOrgButton() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SeedResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (running) return
    if (!confirm('Rebuild Test Team fixtures?\n\nThis deletes the prior test org (if any) + recreates 3 fixture users with new passwords.')) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/seed-test-org', {
        method: 'POST',
        headers: { 'x-confirm-seed': 'yes-rebuild-test-team' },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || `Seed failed (${res.status})`)
        return
      }
      const data = (await res.json()) as SeedResult
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Seed failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={run}
          disabled={running}
          className="text-xs rounded-md px-3 py-1.5 border border-violet-500/40 text-violet-800 dark:text-violet-200 bg-violet-500/10 hover:bg-violet-500/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {running ? 'Seeding test team…' : 'Seed test team (3 fixture users)'}
        </button>
        {error && <span className="text-xs text-red-700 dark:text-red-400">{error}</span>}
      </div>

      {result && (
        <div className="p-3 rounded-md bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40">
          <div className="text-xs font-medium text-violet-900 dark:text-violet-200 mb-2">
            Test team created: <strong>{result.organization_name}</strong>
          </div>
          <div className="text-[11px] text-violet-800 dark:text-violet-300 mb-3">
            Save these passwords — they&apos;re shown ONCE. Sign in as any of them at /auth/signin to test role-based UI.
          </div>
          <div className="space-y-1.5">
            {result.fixtures.map(f => (
              <div key={f.email} className="flex items-center gap-2 text-[11px] font-mono">
                <span className={`inline-block w-14 text-center px-1.5 py-0.5 rounded-full uppercase ${
                  f.role === 'owner' ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400'
                  : f.role === 'admin' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                  : 'bg-muted text-muted-foreground/80'
                }`}>{f.role}</span>
                <span className="text-foreground">{f.email}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-foreground select-all bg-background/50 px-1.5 py-0.5 rounded">{f.password}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
