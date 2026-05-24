'use client'

/**
 * SandboxClient — fetches + displays Test Team fixtures with
 * per-role magic-link buttons.
 *
 * Load behavior:
 *   • On mount → GET /api/admin/seed-test-org
 *     - If exists: render the fixtures table with magic links
 *     - If not exists: show "Rebuild" CTA
 *   • "Rebuild sandbox" → POST → recreates from scratch, displays
 *     fresh fixtures + passwords (one-time)
 *   • "Refresh magic links" → GET again → fresh magic links without
 *     rebuilding the team
 */

import { useEffect, useState } from 'react'

interface Fixture {
  email: string
  role: 'owner' | 'admin' | 'member'
  fullName: string
  magicLink: string | null
  /** Only present on initial rebuild response — not on GET refreshes. */
  password?: string
}

interface SandboxState {
  exists: boolean
  organization_id?: string
  organization_name?: string
  fixtures?: Fixture[]
  enrichWarnings?: string[]
}

const ROLE_COPY = {
  owner: {
    label: 'Owner',
    description: 'Billing + everything. Can invite/remove anyone, see all data.',
    pillClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
    btnClass: 'border-purple-500/50 bg-purple-500/10 hover:bg-purple-500/20 text-purple-800 dark:text-purple-200',
  },
  admin: {
    label: 'Admin',
    description: 'Invite/remove members, assign outreach, see all data. Cannot touch billing.',
    pillClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
    btnClass: 'border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20 text-blue-800 dark:text-blue-200',
  },
  member: {
    label: 'Member',
    description: 'Sees only outreach assigned to them or that they created.',
    pillClass: 'bg-muted text-muted-foreground/80',
    btnClass: 'border-border bg-card hover:bg-muted text-foreground',
  },
} as const

export function SandboxClient() {
  const [state, setState] = useState<SandboxState | null>(null)
  const [loading, setLoading] = useState(true)
  const [rebuilding, setRebuilding] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  // Passwords are returned ONCE on rebuild. We keep them client-side
  // so the user can copy them across re-renders, but they disappear
  // on page reload.
  const [passwords, setPasswords] = useState<Record<string, string>>({})

  async function loadState() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/seed-test-org')
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
        setErrorDetail(data.detail || null)
        return
      }
      setState(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }

  async function rebuild() {
    if (!confirm('Rebuild the sandbox?\n\nThis deletes the current Test Team (and the 5 fixture users) and creates fresh ones.')) return
    setRebuilding(true)
    setError(null)
    setErrorDetail(null)
    try {
      const res = await fetch('/api/admin/seed-test-org', {
        method: 'POST',
        headers: { 'x-confirm-seed': 'yes-rebuild-test-team' },
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || `HTTP ${res.status}`)
        setErrorDetail(data.detail || data.hint || null)
        return
      }
      // Stash passwords by email.
      const pwMap: Record<string, string> = {}
      for (const f of data.fixtures as Fixture[]) {
        if (f.password) pwMap[f.email] = f.password
      }
      setPasswords(pwMap)
      setState({
        exists: true,
        organization_id: data.organization_id,
        organization_name: data.organization_name,
        fixtures: data.fixtures,
        enrichWarnings: data.enrichWarnings,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rebuild failed')
    } finally {
      setRebuilding(false)
    }
  }

  async function refreshLinks() {
    setRefreshing(true)
    await loadState()
    setRefreshing(false)
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      // tiny inline confirm — could replace with toast if you've got one
      const el = document.activeElement as HTMLElement | null
      if (el) {
        const original = el.textContent
        el.textContent = `✓ Copied ${label}`
        setTimeout(() => { if (el.textContent?.startsWith('✓')) el.textContent = original }, 1200)
      }
    } catch {
      alert(`Copy failed. Manual copy:\n\n${text}`)
    }
  }

  useEffect(() => {
    void loadState()
  }, [])

  if (loading) {
    return (
      <div className="text-center text-sm text-muted-foreground py-16">
        Loading sandbox state…
      </div>
    )
  }

  // No sandbox yet → show CTA to create.
  if (!state?.exists) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <h2 className="text-lg font-semibold text-foreground mb-2">No sandbox yet</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          Create a Test Team with 5 fixture users to manually test the enterprise role-based UI without using a real Stripe subscription.
        </p>
        <button
          onClick={rebuild}
          disabled={rebuilding}
          className="px-5 py-2.5 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {rebuilding ? 'Building sandbox…' : 'Create sandbox'}
        </button>
        {error && (
          <div className="mt-6 p-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-left max-w-lg mx-auto">
            <div className="text-sm font-medium text-red-900 dark:text-red-200">{error}</div>
            {errorDetail && (
              <div className="text-xs text-red-700 dark:text-red-300 mt-2 font-mono break-all">{errorDetail}</div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Sandbox exists → show fixtures table.
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border border-border rounded-xl p-5">
        <div>
          <div className="text-sm text-muted-foreground">Sandbox</div>
          <div className="text-xl font-bold text-foreground">{state.organization_name}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {(state.fixtures ?? []).length} fixture {(state.fixtures ?? []).length === 1 ? 'user' : 'users'} · billing comp&apos;d
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refreshLinks}
            disabled={refreshing || rebuilding}
            className="text-xs rounded-md px-3 py-2 border border-border text-foreground bg-card hover:bg-muted transition-colors disabled:opacity-50"
          >
            {refreshing ? 'Refreshing…' : 'Refresh magic links'}
          </button>
          <button
            onClick={rebuild}
            disabled={rebuilding || refreshing}
            className="text-xs rounded-md px-3 py-2 border border-amber-500/40 text-amber-800 dark:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
          >
            {rebuilding ? 'Rebuilding…' : 'Rebuild sandbox'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40">
          <div className="text-sm font-medium text-red-900 dark:text-red-200">{error}</div>
          {errorDetail && (
            <div className="text-xs text-red-700 dark:text-red-300 mt-2 font-mono break-all">{errorDetail}</div>
          )}
        </div>
      )}

      {state.enrichWarnings && state.enrichWarnings.length > 0 && (
        <div className="p-4 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-100">
          <div className="font-semibold mb-1">Org created with warnings:</div>
          <ul className="list-disc ml-4 space-y-0.5">
            {state.enrichWarnings.map((w, i) => <li key={i} className="font-mono">{w}</li>)}
          </ul>
        </div>
      )}

      <div className="p-4 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 text-sm text-blue-900 dark:text-blue-100">
        <div className="font-semibold mb-1">How to use parallel role testing:</div>
        <ol className="list-decimal ml-5 space-y-0.5 text-xs leading-relaxed">
          <li><strong>Right-click</strong> any &quot;Open as ___&quot; button → <strong>&quot;Open Link in Incognito Window&quot;</strong></li>
          <li>Each incognito window has its own auth context — you stay signed in as yourself here</li>
          <li>Repeat for each role to have multiple windows open in parallel</li>
          <li>Magic links expire after ~1 hour. Click <strong>Refresh magic links</strong> to regenerate.</li>
        </ol>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-card text-muted-foreground text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left font-medium">User</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">Open as</th>
              <th className="px-4 py-3 text-left font-medium">Fallback (email + pw)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(state.fixtures ?? []).map(f => {
              const copy = ROLE_COPY[f.role]
              const pw = passwords[f.email]
              return (
                <tr key={f.email}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{f.fullName}</div>
                    <div className="text-xs text-muted-foreground font-mono">{f.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono uppercase ${copy.pillClass}`} title={copy.description}>
                      {copy.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {f.magicLink ? (
                      <a
                        href={f.magicLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${copy.btnClass}`}
                        title="Right-click → Open Link in Incognito Window for an isolated session"
                      >
                        Open as {copy.label} →
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">link failed — use fallback</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => copyToClipboard(f.email, 'email')}
                      className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors mr-2"
                    >
                      copy email
                    </button>
                    {pw ? (
                      <button
                        onClick={() => copyToClipboard(pw, 'password')}
                        className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                      >
                        copy pw
                      </button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/60 italic">pw shown only on rebuild</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
