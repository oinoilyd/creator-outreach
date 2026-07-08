'use client'

/**
 * IntegrationsModal — hamburger → Integrations. Two cards:
 *
 *   1. Airtable sync (outbound push): paste a scoped personal access
 *      token → pick base + table → map our fields to their columns
 *      (fuzzy-prefilled) → Save. "Sync now" upserts every lead into
 *      their table keyed on the merge field, so their Airtable (and
 *      anything built on it) stays current.
 *
 *   2. Platform API (inbound): per-user API keys for /api/v1/leads —
 *      Zapier, Airtable automations, or custom dashboards can create
 *      and read leads. Key shown once at creation; revocable.
 */

import { useEffect, useState } from 'react'
import { X, KeyRound, RefreshCw, Trash2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { LEAD_FIELDS } from '@/lib/integrations-fields'

interface AirtableStatus {
  connected: boolean
  baseId?: string
  baseName?: string | null
  tableName?: string
  fieldMap?: Record<string, string>
  mergeField?: string | null
  lastSyncAt?: string | null
  lastError?: string | null
}

interface KeyMeta {
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
}

/** Ready-to-paste Airtable "Run a script" automation that PULLS leads
 *  from our /api/v1/leads into their base on a schedule. Requires
 *  Airtable's Team plan (scripting) + an API key from the card below.
 *  Kept as a plain string so backticks inside stay literal. */
const AIRTABLE_PULL_SCRIPT = `// Creator Outreach → Airtable pull (scheduled automation)
// Add a secret named CREATOR_OUTREACH_KEY = your co_live_... API key
const token = input.secret.CREATOR_OUTREACH_KEY
const table = base.getTable('Leads')

let offset = 0
const all = []
while (true) {
  const res = await fetch(
    \`https://creatoroutreach.net/api/v1/leads?limit=100&offset=\${offset}\`,
    { headers: { Authorization: \`Bearer \${token}\` } },
  )
  if (!res.ok) throw new Error(\`Creator Outreach API error \${res.status}\`)
  const data = await res.json()
  const leads = data.leads || []
  all.push(...leads)
  if (leads.length < 100 || offset >= 4800) break
  offset += 100
}

const existing = await table.selectRecordsAsync({ fields: ['Channel URL'] })
const byUrl = new Map()
for (const r of existing.records) {
  const u = r.getCellValueAsString('Channel URL')
  if (u) byUrl.set(u, r.id)
}

const F = (l) => ({
  'Channel Name': l.channelName || '',
  'Channel URL': l.channelUrl || '',
  'Email': l.email || '',
  'Status': l.status || '',
  'Product': l.product || '',
  'Notes': l.notes || '',
  'Follow-up Date': l.followUpDate || null,
  'Last Contacted': l.dateReachedOut || null,
  'Touchpoints': l.touchpoints || '',
  'Deal Value': l.dealValue || '',
  'Instagram': l.instagram || '',
  'Website': l.website || '',
  'Subscribers': l.subscribers || '',
})
const creates = []
const updates = []
for (const l of all) {
  const id = l.channelUrl ? byUrl.get(l.channelUrl) : null
  if (id) updates.push({ id, fields: F(l) })
  else creates.push({ fields: F(l) })
}

for (let i = 0; i < updates.length; i += 50)
  await table.updateRecordsAsync(updates.slice(i, i + 50))
for (let i = 0; i < creates.length; i += 50)
  await table.createRecordsAsync(creates.slice(i, i + 50))

console.log(\`Synced \${all.length} — \${updates.length} updated, \${creates.length} created\`)
`

async function jfetch(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`)
  return body
}

export function IntegrationsModal({ onClose }: { onClose: () => void }) {
  // ── Airtable state ──
  const [at, setAt] = useState<AirtableStatus | null>(null)
  const [editing, setEditing] = useState(false)
  const [token, setToken] = useState('')
  const [bases, setBases] = useState<{ id: string; name: string }[]>([])
  const [baseId, setBaseId] = useState('')
  const [tables, setTables] = useState<{ id: string; name: string; fields: string[] }[]>([])
  const [tableName, setTableName] = useState('')
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({})
  const [mergeField, setMergeField] = useState('channelUrl')
  const [busy, setBusy] = useState<string | null>(null)

  // ── API keys state ──
  const [keys, setKeys] = useState<KeyMeta[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [freshKey, setFreshKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    jfetch('/api/integrations/airtable').then(setAt).catch(() => setAt({ connected: false }))
    jfetch('/api/integrations/keys').then(b => setKeys(b.keys ?? [])).catch(() => {})
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const tableFields = tables.find(t => t.name === tableName)?.fields ?? []

  async function loadBases() {
    setBusy('bases')
    try {
      const b = await jfetch('/api/integrations/airtable/meta', {
        method: 'POST', body: JSON.stringify({ token: token || undefined }),
      })
      setBases(b.bases ?? [])
      if ((b.bases ?? []).length === 0) toast.error('Token works, but no bases are shared with it.')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setBusy(null) }
  }

  async function loadTables(nextBaseId: string) {
    setBaseId(nextBaseId)
    setTableName('')
    if (!nextBaseId) return
    setBusy('tables')
    try {
      const b = await jfetch('/api/integrations/airtable/meta', {
        method: 'POST', body: JSON.stringify({ token: token || undefined, baseId: nextBaseId }),
      })
      setTables(b.tables ?? [])
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setBusy(null) }
  }

  // Fuzzy-prefill our fields → their columns by name once a table is picked.
  function pickTable(name: string) {
    setTableName(name)
    const fields = tables.find(t => t.name === name)?.fields ?? []
    const lower = new Map(fields.map(f => [f.toLowerCase().replace(/[^a-z0-9]/g, ''), f]))
    const next: Record<string, string> = {}
    for (const f of LEAD_FIELDS) {
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
      const hit = lower.get(norm(f.label)) || lower.get(norm(f.key))
      if (hit) next[f.key] = hit
    }
    setFieldMap(next)
    if (!next[mergeField]) {
      const firstMapped = Object.keys(next)[0]
      if (firstMapped) setMergeField(firstMapped)
    }
  }

  async function saveConnection() {
    setBusy('save')
    try {
      await jfetch('/api/integrations/airtable', {
        method: 'POST',
        body: JSON.stringify({
          token: token || undefined,
          baseId,
          baseName: bases.find(b => b.id === baseId)?.name ?? '',
          tableName,
          fieldMap,
          mergeField,
        }),
      })
      toast.success('Airtable connected')
      setEditing(false)
      setToken('')
      setAt(await jfetch('/api/integrations/airtable'))
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') } finally { setBusy(null) }
  }

  async function syncNow() {
    setBusy('sync')
    try {
      const b = await jfetch('/api/integrations/airtable/push', { method: 'POST' })
      toast.success(`Synced ${b.written} lead${b.written === 1 ? '' : 's'} to Airtable${b.skipped ? ` (${b.skipped} skipped — no merge value)` : ''}`)
      setAt(await jfetch('/api/integrations/airtable'))
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Sync failed') } finally { setBusy(null) }
  }

  async function disconnect() {
    setBusy('disconnect')
    try {
      await jfetch('/api/integrations/airtable', { method: 'DELETE' })
      setAt({ connected: false })
      setEditing(false)
      toast('Airtable disconnected')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setBusy(null) }
  }

  async function createKey() {
    setBusy('key')
    try {
      const b = await jfetch('/api/integrations/keys', {
        method: 'POST', body: JSON.stringify({ name: newKeyName || 'API key' }),
      })
      setFreshKey(b.key)
      setNewKeyName('')
      setKeys(await jfetch('/api/integrations/keys').then(r => r.keys ?? []))
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setBusy(null) }
  }

  async function revokeKey(id: string) {
    try {
      await jfetch(`/api/integrations/keys?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      setKeys(k => k.filter(x => x.id !== id))
      toast('Key revoked')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  const setupMode = editing || (at !== null && !at.connected)
  const inputCls = 'w-full bg-background border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50'
  const labelCls = 'block text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Integrations</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Connect Creator Outreach to the rest of your stack.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* ── Airtable ── */}
          <section className="border border-border rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="text-[14px] font-semibold text-foreground">Airtable sync</div>
              {at?.connected && !editing && (
                <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Connected</span>
              )}
            </div>
            <p className="text-[12px] text-muted-foreground mb-3">
              Pushes your leads into an Airtable table you choose, keyed on a merge field so rows update instead of duplicating. One-way: Creator Outreach → Airtable.
            </p>

            {at === null ? (
              <div className="text-[12px] text-muted-foreground">Loading…</div>
            ) : setupMode ? (
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Airtable personal access token</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={token}
                      onChange={e => setToken(e.target.value)}
                      placeholder={at.connected ? 'Leave blank to keep the saved token' : 'pat…  (airtable.com → Builder Hub → create token)'}
                      className={inputCls}
                    />
                    <button onClick={loadBases} disabled={busy === 'bases' || (!token && !at.connected)} className="shrink-0 text-[12px] font-medium px-3 py-2 rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-40 transition-opacity">
                      {busy === 'bases' ? 'Loading…' : 'Load bases'}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Scope it to just your outreach base, with data.records read+write and schema.bases read. Stored encrypted; revocable on Airtable&apos;s side anytime.</p>
                </div>

                {bases.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Base</label>
                      <select value={baseId} onChange={e => loadTables(e.target.value)} className={inputCls}>
                        <option value="">Pick a base…</option>
                        {bases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Table</label>
                      <select value={tableName} onChange={e => pickTable(e.target.value)} disabled={!baseId || busy === 'tables'} className={inputCls}>
                        <option value="">{busy === 'tables' ? 'Loading…' : 'Pick a table…'}</option>
                        {tables.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {tableName && (
                  <div>
                    <label className={labelCls}>Field mapping · ours → your Airtable column</label>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      {LEAD_FIELDS.map(f => (
                        <div key={f.key} className="flex items-center gap-2">
                          <span className="text-[11px] text-foreground/80 w-28 shrink-0 truncate" title={f.label}>{f.label}</span>
                          <select
                            value={fieldMap[f.key] ?? ''}
                            onChange={e => setFieldMap(m => {
                              const next = { ...m }
                              if (e.target.value) next[f.key] = e.target.value
                              else delete next[f.key]
                              return next
                            })}
                            className="flex-1 bg-background border border-border rounded px-1.5 py-1 text-[11px] focus:outline-none focus:border-purple-500"
                          >
                            <option value="">— skip —</option>
                            {tableFields.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] text-foreground/80">Merge on</span>
                      <select value={mergeField} onChange={e => setMergeField(e.target.value)} className="bg-background border border-border rounded px-1.5 py-1 text-[11px] focus:outline-none focus:border-purple-500">
                        {Object.keys(fieldMap).map(k => (
                          <option key={k} value={k}>{LEAD_FIELDS.find(f => f.key === k)?.label ?? k}</option>
                        ))}
                      </select>
                      <span className="text-[10px] text-muted-foreground">— the field that identifies a lead so re-syncs update, not duplicate</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={saveConnection} disabled={busy === 'save'} className="text-[12px] font-semibold px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-50">
                        {busy === 'save' ? 'Saving…' : 'Save connection'}
                      </button>
                      {at.connected && (
                        <button onClick={() => setEditing(false)} className="text-[12px] px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-[12px] text-foreground/85">
                  Pushing to <span className="font-medium">{at.baseName || at.baseId}</span> → <span className="font-medium">{at.tableName}</span>
                  {at.lastSyncAt && <span className="text-muted-foreground"> · last sync {new Date(at.lastSyncAt).toLocaleString()}</span>}
                </div>
                {at.lastError && <div className="text-[11px] text-red-600 dark:text-red-400">Last error: {at.lastError}</div>}
                <div className="flex gap-2">
                  <button onClick={syncNow} disabled={busy === 'sync'} className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${busy === 'sync' ? 'animate-spin' : ''}`} /> {busy === 'sync' ? 'Syncing…' : 'Sync now'}
                  </button>
                  <button onClick={() => { setEditing(true); setBases([]); setTables([]); setBaseId(at.baseId ?? ''); setTableName('') }} className="text-[12px] px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors">Edit setup</button>
                  <button onClick={disconnect} disabled={busy === 'disconnect'} className="text-[12px] px-3 py-1.5 rounded-lg border border-border text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors">Disconnect</button>
                </div>
              </div>
            )}
            <details className="mt-3 text-[11px] text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground transition-colors">
                Prefer Airtable to pull from us instead? Copy this automation script
              </summary>
              <div className="mt-2 space-y-1.5">
                <p>
                  Runs inside Airtable (Automations → At a scheduled time → Run a script — needs
                  Airtable&apos;s Team plan). Generate an API key in the Platform API card below,
                  add it as a script secret named <code className="font-mono">CREATOR_OUTREACH_KEY</code>,
                  and name your table <span className="font-medium">Leads</span> with the columns in the
                  script (or edit the mapping). Make Status a text column, not a select.
                </p>
                <button
                  onClick={() => { navigator.clipboard.writeText(AIRTABLE_PULL_SCRIPT).then(() => toast.success('Script copied')) }}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded border border-border text-foreground hover:bg-muted transition-colors"
                >
                  <Copy className="w-3 h-3" /> Copy script
                </button>
                <pre className="p-3 rounded-lg bg-muted/50 border border-border overflow-x-auto text-[10px] leading-relaxed max-h-48 overflow-y-auto">{AIRTABLE_PULL_SCRIPT}</pre>
              </div>
            </details>
          </section>

          {/* ── Platform API ── */}
          <section className="border border-border rounded-xl p-4">
            <div className="text-[14px] font-semibold text-foreground mb-1">Platform API</div>
            <p className="text-[12px] text-muted-foreground mb-3">
              Let external tools create and read your leads — Zapier, Airtable automations, or your own dashboard. Authenticate with an API key.
            </p>

            {freshKey && (
              <div className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
                <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 mb-1">Copy this key now — it won&apos;t be shown again.</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] font-mono break-all text-foreground">{freshKey}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(freshKey).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}
                    className="shrink-0 p-1.5 rounded border border-border hover:bg-muted transition-colors"
                    aria-label="Copy key"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-3">
              <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name (e.g. Zapier)" className={inputCls} />
              <button onClick={createKey} disabled={busy === 'key'} className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-50 transition-opacity">
                <KeyRound className="w-3.5 h-3.5" /> Generate key
              </button>
            </div>

            {keys.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {keys.map(k => (
                  <div key={k.id} className="flex items-center gap-2 text-[12px] border border-border rounded-lg px-3 py-1.5">
                    <span className="font-medium text-foreground truncate">{k.name}</span>
                    <code className="text-[11px] font-mono text-muted-foreground">{k.key_prefix}…</code>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {k.last_used_at ? `used ${new Date(k.last_used_at).toLocaleDateString()}` : 'never used'}
                    </span>
                    <button onClick={() => revokeKey(k.id)} className="p-1 rounded text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors" aria-label={`Revoke ${k.name}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <details className="text-[11px] text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground transition-colors">How to call it</summary>
              <pre className="mt-2 p-3 rounded-lg bg-muted/50 border border-border overflow-x-auto text-[10.5px] leading-relaxed">{`# Create / update a lead (upserts by channelUrl → email → name)
curl -X POST ${typeof window !== 'undefined' ? window.location.origin : 'https://creatoroutreach.net'}/api/v1/leads \\
  -H "Authorization: Bearer co_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"channelName":"MKBHD","channelUrl":"https://youtube.com/@mkbhd","email":"hi@example.com","status":"Not Outreached"}'

# List leads (newest first)
curl "${typeof window !== 'undefined' ? window.location.origin : 'https://creatoroutreach.net'}/api/v1/leads?limit=50" \\
  -H "Authorization: Bearer co_live_..."

Fields: ${LEAD_FIELDS.map(f => f.key).join(', ')}`}</pre>
            </details>
          </section>
        </div>
      </div>
    </div>
  )
}
