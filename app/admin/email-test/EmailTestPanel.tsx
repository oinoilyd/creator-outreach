'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STRATEGY_OPTIONS = [
  { key: 'web_scrape',   label: 'Website scrape',  hint: '17 paths: /, /contact, /about, …' },
  { key: 'biolink',      label: 'Linktree expand', hint: 'Linktree, Beacons, Stan, etc.' },
  { key: 'bio_pages',    label: 'Social bios',     hint: 'Twitter / IG / TikTok og:description' },
  { key: 'ddg',          label: 'DDG search',      hint: '13+ DuckDuckGo email queries' },
  { key: 'wayback',      label: 'Wayback fallback', hint: "Archive.org if live site is empty" },
  { key: 'domain_guess', label: 'Educated assumption', hint: 'For empty results: cross-references social bios + website for evidence-backed guesses' },
] as const

type Verdict = 'deliverable' | 'risky' | 'invalid'

interface VerifyResult {
  email: string
  score: number
  verdict: Verdict
  flags: string[]
  reason: string
}

interface RunResult {
  channelName: string
  channelId: string
  hasEmail: boolean
  email: string
  source: 'primary' | 'educated_assumption' | null
  confidence?: number
  evidence?: string
  durationMs: number
  verdict?: Verdict
  verifyScore?: number
  verifyReason?: string
}

interface RunResponse {
  runId: string | null
  query: string
  region: string | null
  strategy: string
  total: number
  withEmail: number
  fromPrimary: number
  fromAssumption: number
  hitRate: number
  tookMs: number
  results: RunResult[]
}

const REGION_OPTIONS = [
  { code: '',   label: '— None —' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
  { code: 'IN', label: 'India' },
  { code: 'DE', label: 'Germany' },
]

export function EmailTestPanel() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState('')
  const [max, setMax] = useState(15)
  const [notes, setNotes] = useState('')
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    web_scrape: true, biolink: true, bio_pages: true, ddg: true, wayback: true, domain_guess: false,
  })
  const [running, setRunning] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<RunResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggle(key: string) {
    setEnabled(s => ({ ...s, [key]: !s[key] }))
  }

  function preset(name: 'all-on' | 'minimal' | 'no-ddg') {
    if (name === 'all-on') {
      setEnabled({ web_scrape: true, biolink: true, bio_pages: true, ddg: true, wayback: true, domain_guess: true })
    } else if (name === 'minimal') {
      setEnabled({ web_scrape: false, biolink: false, bio_pages: false, ddg: false, wayback: false, domain_guess: false })
    } else if (name === 'no-ddg') {
      setEnabled({ web_scrape: true, biolink: true, bio_pages: true, ddg: false, wayback: true, domain_guess: false })
    }
  }

  async function run() {
    if (!query.trim()) {
      setError('Enter a search query first.')
      return
    }
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const strategy = STRATEGY_OPTIONS.filter(o => enabled[o.key]).map(o => o.key)
      const resp = await fetch('/api/admin/email-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), region: region || undefined, max, strategy, notes: notes.trim() || undefined }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setError(data.error || 'Run failed.')
        return
      }
      if (data.error) {
        setError(data.error)
        return
      }
      setResult(data as RunResponse)
      router.refresh()
    } catch (e) {
      setError((e as Error).message || 'Network error.')
    } finally {
      setRunning(false)
    }
  }

  async function runVerification() {
    if (!result) return
    const emails = result.results.filter(r => r.hasEmail).map(r => r.email)
    if (emails.length === 0) return

    setVerifying(true)
    setError(null)
    try {
      const resp = await fetch('/api/admin/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setError(data.error || 'Verification failed.')
        return
      }
      const byEmail = new Map<string, VerifyResult>(
        (data.results as VerifyResult[]).map(v => [v.email.toLowerCase(), v]),
      )
      setResult(prev => prev && {
        ...prev,
        results: prev.results.map(r => {
          if (!r.hasEmail) return r
          const v = byEmail.get(r.email.toLowerCase())
          return v
            ? { ...r, verdict: v.verdict, verifyScore: v.score, verifyReason: v.reason }
            : r
        }),
      })
    } catch (e) {
      setError((e as Error).message || 'Network error.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Search controls */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="grid md:grid-cols-[2fr_1fr_120px] gap-3 mb-4">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search keyword (e.g. fitness coach, real estate)"
            className="px-3 py-2.5 rounded-lg bg-background border border-border focus:outline-none focus:border-purple-500 text-sm"
          />
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            className="px-3 py-2.5 rounded-lg bg-background border border-border focus:outline-none focus:border-purple-500 text-sm"
          >
            {REGION_OPTIONS.map(r => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Max</label>
            <input
              type="number"
              min={1}
              max={50}
              value={max}
              onChange={e => setMax(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-full px-2 py-2.5 rounded-lg bg-background border border-border focus:outline-none focus:border-purple-500 text-sm tabular-nums"
            />
          </div>
        </div>

        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          maxLength={200}
          placeholder="Optional note — what changed in this run? (e.g. 'tightened bio_pages regex')"
          className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:border-purple-500 text-xs mb-4"
        />

        {/* Strategy toggles */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Enrichment strategy</div>
          <div className="flex gap-1.5">
            <button onClick={() => preset('all-on')} className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors">All on</button>
            <button onClick={() => preset('no-ddg')} className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors">No DDG</button>
            <button onClick={() => preset('minimal')} className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors">Minimal</button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
          {STRATEGY_OPTIONS.map(o => (
            <label
              key={o.key}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                enabled[o.key]
                  ? 'border-purple-300 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-500/5'
                  : 'border-border bg-background hover:border-border/80'
              }`}
            >
              <input
                type="checkbox"
                checked={enabled[o.key]}
                onChange={() => toggle(o.key)}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <div className="text-sm font-medium">{o.label}</div>
                <div className="text-[10px] text-muted-foreground">{o.hint}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            YouTube About + description regex always run (free).
          </div>
          <button
            onClick={run}
            disabled={running || !query.trim()}
            className="px-5 py-2.5 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-60 disabled:cursor-wait"
          >
            {running ? `Running ${max} creators…` : 'Run test'}
          </button>
        </div>

        {error && (
          <div className="mt-4 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded px-3 py-2">
            {error}
          </div>
        )}
      </section>

      {/* Live result */}
      {result && (
        <section className="rounded-xl border border-purple-200 dark:border-purple-500/30 bg-gradient-to-br from-purple-50/60 to-blue-50/60 dark:from-purple-500/5 dark:to-blue-500/5 p-5">
          {(() => {
            const verified = result.results.filter(r => r.verdict).length
            const deliverable = result.results.filter(r => r.verdict === 'deliverable').length
            return (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                <Stat label="Total" value={result.total} />
                <Stat label="From primary" value={result.fromPrimary} />
                <Stat
                  label="From assumption"
                  value={`+${result.fromAssumption}`}
                  accent={result.fromAssumption > 0}
                  hint={result.fromAssumption > 0 ? 'lift over primary' : 'no lift'}
                />
                <Stat label="Hit rate" value={`${result.hitRate.toFixed(1)}%`} accent />
                <Stat
                  label="Deliverable"
                  value={verified > 0 ? `${deliverable}/${verified}` : '—'}
                  hint={verified > 0 ? 'after deliverability check' : 'run check below'}
                />
                <Stat label="Took" value={`${(result.tookMs / 1000).toFixed(1)}s`} />
              </div>
            )
          })()}

          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-xs text-muted-foreground">
              Each result row carries the source it came from (primary vs educated assumption).
            </div>
            <button
              onClick={runVerification}
              disabled={verifying || result.withEmail === 0}
              className="px-3 py-1.5 rounded-lg border border-purple-300 dark:border-purple-500/40 bg-card text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-500/10 text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-wait"
              title="Heuristic check: DNS MX, disposable-domain blocklist, role-address detection, freemail flag. Does NOT do an SMTP RCPT TO probe (Vercel blocks port 25)."
            >
              {verifying ? 'Checking…' : 'Run deliverability check'}
            </button>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Channel</th>
                  <th className="px-3 py-2 text-left font-medium">Email</th>
                  <th className="px-3 py-2 text-left font-medium">Source</th>
                  <th className="px-3 py-2 text-left font-medium">Verdict</th>
                  <th className="px-3 py-2 text-right font-medium">Took</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.results.map(r => (
                  <tr key={r.channelId}>
                    <td className="px-3 py-2 truncate max-w-xs">{r.channelName}</td>
                    <td className="px-3 py-2">
                      {r.hasEmail
                        ? <span className="text-emerald-700 dark:text-emerald-400 font-mono text-xs break-all">{r.email}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {r.source === 'primary' && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300">primary</span>
                      )}
                      {r.source === 'educated_assumption' && (
                        <span
                          className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300"
                          title={r.evidence ? `${r.evidence} — confidence ${(r.confidence ?? 0).toFixed(2)}` : ''}
                        >
                          assumption · {(r.confidence ?? 0).toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.verdict === 'deliverable' && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" title={r.verifyReason}>deliverable · {r.verifyScore}</span>
                      )}
                      {r.verdict === 'risky' && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-200 dark:border-yellow-500/30 bg-amber-50 dark:bg-yellow-500/10 text-amber-800 dark:text-yellow-300" title={r.verifyReason}>risky · {r.verifyScore}</span>
                      )}
                      {r.verdict === 'invalid' && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300" title={r.verifyReason}>invalid · {r.verifyScore}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground text-xs">{(r.durationMs / 1000).toFixed(1)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, accent, hint }: { label: string; value: number | string; accent?: boolean; hint?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${accent ? 'text-purple-700 dark:text-purple-300' : ''}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  )
}
