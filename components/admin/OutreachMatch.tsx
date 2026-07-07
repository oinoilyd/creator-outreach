'use client'

/**
 * OutreachMatch — cross-references the founder's cold-outreach lead list
 * against real signups, answering "which of my outreach leads converted?"
 *
 * The lead emails are pasted once and persisted in localStorage — they
 * deliberately never touch the product database (no migration, no PII
 * stored server-side for people who never signed up). Sole-admin tool;
 * localStorage is the right durability for it.
 *
 * Paste anything — the raw column from the tracker, comma lists, full
 * "Name <email>" lines — emails are extracted by regex.
 */
import { useEffect, useMemo, useState } from 'react'

export interface SignupLite {
  email: string
  createdAt: string
  status: string | null
}

const LS_KEY = 'co.admin.outreach-leads.v1'
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

function extractEmails(text: string): string[] {
  const found = text.match(EMAIL_RE) ?? []
  return Array.from(new Set(found.map(e => e.trim().toLowerCase())))
}

export function OutreachMatch({ signups }: { signups: SignupLite[] }) {
  const [raw, setRaw] = useState('')
  const [editing, setEditing] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LS_KEY)
      if (saved) setRaw(saved)
      else setEditing(true)
    } catch { setEditing(true) }
    setLoaded(true)
  }, [])

  function save(next: string) {
    setRaw(next)
    try { window.localStorage.setItem(LS_KEY, next) } catch { /* private mode */ }
  }

  const leads = useMemo(() => extractEmails(raw), [raw])
  const matches = useMemo(() => {
    if (leads.length === 0) return []
    const leadSet = new Set(leads)
    return signups.filter(s => leadSet.has(s.email.trim().toLowerCase()))
  }, [leads, signups])

  if (!loaded) return null

  const convPct = leads.length > 0 ? ((matches.length / leads.length) * 100).toFixed(1) : '0'

  return (
    <div className="bg-card/40 border border-border rounded-xl p-5 mb-8">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-semibold">Outreach → signup conversion</div>
        <button
          onClick={() => setEditing(e => !e)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {editing ? 'Done' : leads.length > 0 ? `Edit lead list (${leads.length})` : 'Add lead list'}
        </button>
      </div>
      <div className="text-xs text-muted-foreground/80 mb-4">
        Paste your cold-outreach emails once — stored only in this browser — and signups get matched against them automatically.
      </div>

      {editing && (
        <textarea
          value={raw}
          onChange={e => save(e.target.value)}
          rows={5}
          placeholder={'Paste emails in any format — one per line, comma-separated, or whole rows from the tracker.'}
          className="w-full mb-4 rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/20"
        />
      )}

      {leads.length === 0 ? (
        <div className="text-sm text-muted-foreground/80 py-4 text-center">No lead list yet — paste your outreach emails above.</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <MiniStat label="Leads contacted" value={String(leads.length)} />
            <MiniStat label="Signed up" value={String(matches.length)} accent={matches.length > 0} />
            <MiniStat label="Conversion" value={`${convPct}%`} />
          </div>
          {matches.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Converted lead</th>
                    <th className="px-3 py-2 text-left font-medium">Signed up</th>
                    <th className="px-3 py-2 text-left font-medium">Subscription</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {matches.map(m => (
                    <tr key={m.email}>
                      <td className="px-3 py-2 text-foreground">{m.email}</td>
                      <td className="px-3 py-2 text-muted-foreground">{new Date(m.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-muted-foreground">{m.status ?? 'no trial yet'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${accent ? 'text-green-700 dark:text-green-400' : 'text-foreground'}`}>{value}</div>
    </div>
  )
}
