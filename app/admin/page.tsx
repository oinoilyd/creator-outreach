import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { AuditMenu } from '@/components/admin/AuditMenu'
import { LocalDateTime } from '@/components/LocalDateTime'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

interface UserRow {
  user_id: string
  email: string
  full_name: string
  linkedin_url: string
  pitch_line: string
  onboarded: boolean
  created_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  first_outreach_at: string | null
  outreach_count: number
  dismissed_count: number
}

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) notFound()

  const { data, error } = await supabase.rpc('admin_user_summary')
  const rows = (data || []) as UserRow[]

  // Unread contact messages — for the inbox badge in the header.
  const { count: unresolvedContact } = await supabase
    .from('contact_messages')
    .select('id', { count: 'exact', head: true })
    .eq('resolved', false)

  // Per-user IANA timezones (auto-detected on each sign-in via
  // app/page.tsx). admin_user_summary doesn't return this column,
  // so fetch it separately and merge by user_id at render time.
  // NULL = pre-migration user / hasn't signed in since 0015.
  const { data: tzRows } = await supabase
    .from('user_profile')
    .select('user_id, timezone')
  const tzByUserId = new Map<string, string | null>(
    (tzRows ?? []).map(r => [r.user_id as string, (r.timezone as string | null) ?? null]),
  )
  const tzKnownCount = Array.from(tzByUserId.values()).filter(Boolean).length

  // ---- Aggregates ----
  const now = Date.now()
  const DAY_MS = 24 * 60 * 60 * 1000
  const sevenDaysAgo = now - 7 * DAY_MS

  const total = rows.length
  const verified = rows.filter(r => !!r.email_confirmed_at).length
  const activeLast7 = rows.filter(r =>
    r.last_sign_in_at && new Date(r.last_sign_in_at).getTime() > sevenDaysAgo
  ).length
  const totalOutreach = rows.reduce((s, r) => s + (r.outreach_count || 0), 0)
  const totalDismissed = rows.reduce((s, r) => s + (r.dismissed_count || 0), 0)

  // Funnel: signed up → confirmed → onboarded → first outreach added
  const onboardedCount = rows.filter(r => r.onboarded).length
  const firstOutreachCount = rows.filter(r => !!r.first_outreach_at).length

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Admin · Users</h1>
            <p className="text-muted-foreground/80 text-sm mt-1">
              {total} user{total === 1 ? '' : 's'} signed up.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/contacts"
              className="text-sm rounded-lg px-4 py-2 transition-colors flex items-center gap-2 border border-border text-muted-foreground hover:border-border hover:text-foreground"
            >
              📇 Contacts
            </Link>
            <Link
              href="/admin/email-test"
              className="text-sm rounded-lg px-4 py-2 transition-colors flex items-center gap-2 border border-border text-muted-foreground hover:border-border hover:text-foreground"
            >
              📧 Email-test
            </Link>
            <Link
              href="/admin/contact"
              className={`text-sm rounded-lg px-4 py-2 transition-colors flex items-center gap-2 border ${
                (unresolvedContact ?? 0) > 0
                  ? 'border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10'
                  : 'border-border text-muted-foreground hover:border-border hover:text-foreground'
              }`}
            >
              <span>📨 Contact</span>
              {(unresolvedContact ?? 0) > 0 && (
                <span className="text-xs font-mono bg-yellow-500/20 px-1.5 py-0.5 rounded">{unresolvedContact}</span>
              )}
            </Link>
            <AuditMenu />
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground border border-border hover:border-border rounded-lg px-4 py-2 transition-colors">
              Back to app
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg p-4 mb-6">
            <div className="text-sm text-red-800 dark:text-red-300 font-medium mb-1">Could not load user summary</div>
            <div className="text-xs text-red-700/80 dark:text-red-400/80 mb-2">{error.message}</div>
            <div className="text-xs text-muted-foreground">
              Run <code className="text-foreground/90">supabase/migrations/0003_admin_summary_v2.sql</code> in the Supabase SQL editor to enable this view.
            </div>
          </div>
        )}

        {!error && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
              <Stat label="Total users" value={total} />
              <Stat label="Email verified" value={verified} sub={total > 0 ? `${pct(verified, total)}%` : null} />
              <Stat label="Active last 7d" value={activeLast7} sub={total > 0 ? `${pct(activeLast7, total)}%` : null} />
              <Stat label="Timezone known" value={tzKnownCount} sub={total > 0 ? `${pct(tzKnownCount, total)}%` : null} />
              <Stat label="Outreach (all)" value={totalOutreach} />
              <Stat label="Dismissed (all)" value={totalDismissed} />
            </div>

            {/* Funnel */}
            <div className="bg-card/40 border border-border rounded-xl p-5 mb-8">
              <div className="text-sm font-semibold text-foreground mb-4">Activation funnel</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <FunnelStep label="Signed up" value={total} ofTotal={total} />
                <FunnelStep label="Confirmed email" value={verified} ofTotal={total} />
                <FunnelStep label="Completed onboarding" value={onboardedCount} ofTotal={total} />
                <FunnelStep label="Added first outreach" value={firstOutreachCount} ofTotal={total} />
              </div>
            </div>
          </>
        )}

        {!error && rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-card text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-center font-medium">Profile</th>
                  <th className="px-4 py-3 text-left font-medium">Timezone</th>
                  <th className="px-4 py-3 text-left font-medium">Signed up</th>
                  <th className="px-4 py-3 text-left font-medium">Last sign in</th>
                  <th className="px-4 py-3 text-left font-medium">Idle</th>
                  <th className="px-4 py-3 text-left font-medium">Time → 1st outreach</th>
                  <th className="px-4 py-3 text-center font-medium">Conf.</th>
                  <th className="px-4 py-3 text-right font-medium">Outreach</th>
                  <th className="px-4 py-3 text-right font-medium">Dismissed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {rows.map(r => {
                  const profileFields = [r.full_name, r.linkedin_url, r.pitch_line].map(s => !!s.trim())
                  const profileFilled = profileFields.filter(Boolean).length
                  const idle = r.last_sign_in_at ? daysSince(r.last_sign_in_at) : null
                  const ttv = r.first_outreach_at && r.created_at
                    ? formatDuration(new Date(r.first_outreach_at).getTime() - new Date(r.created_at).getTime())
                    : null
                  return (
                    <tr key={r.user_id} className="hover:bg-card/40 transition-colors">
                      <td className="px-4 py-2.5 text-foreground">{r.email}</td>
                      <td className="px-4 py-2.5 text-foreground/90">{r.full_name || <span className="text-muted-foreground/60">—</span>}</td>
                      <td className="px-4 py-2.5 text-center" title={`Name ${profileFields[0] ? '✓' : '✗'} · LinkedIn ${profileFields[1] ? '✓' : '✗'} · Pitch ${profileFields[2] ? '✓' : '✗'}`}>
                        <span className={`inline-flex items-center justify-center w-9 h-6 rounded text-[11px] font-mono ${
                          profileFilled === 3 ? 'bg-green-500/15 text-green-400'
                          : profileFilled >= 1 ? 'bg-yellow-500/15 text-yellow-400'
                          : 'bg-gray-700/40 text-muted-foreground/80'
                        }`}>{profileFilled}/3</span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground/90 text-xs">
                        {(() => {
                          const tz = tzByUserId.get(r.user_id)
                          if (!tz) return <span className="text-muted-foreground/50 italic">unknown</span>
                          // Show last segment for skim-readability — "America/Chicago" → "Chicago".
                          // Full IANA name is available in the title tooltip.
                          const parts = tz.split('/')
                          const short = (parts[parts.length - 1] || tz).replace(/_/g, ' ')
                          return <span title={tz}>{short}</span>
                        })()}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        <LocalDateTime variant="datetime-short" iso={r.created_at} />
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {r.last_sign_in_at
                          ? <LocalDateTime variant="datetime-short" iso={r.last_sign_in_at} />
                          : <span className="text-muted-foreground/60">never</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {idle === null ? <span className="text-muted-foreground/60">—</span>
                         : idle === 0 ? <span className="text-green-400">today</span>
                         : <span className={idle > 30 ? 'text-red-400' : idle > 7 ? 'text-yellow-400' : 'text-foreground/90'}>{idle}d</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{ttv ?? <span className="text-muted-foreground/60">—</span>}</td>
                      <td className="px-4 py-2.5 text-center">
                        {r.email_confirmed_at
                          ? <span className="text-green-400">✓</span>
                          : <span className="text-yellow-500">·</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-foreground font-mono">{r.outreach_count}</td>
                      <td className="px-4 py-2.5 text-right text-foreground font-mono">{r.dismissed_count}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!error && rows.length === 0 && (
          <div className="border border-dashed border-border rounded-xl py-16 text-center text-muted-foreground/80 text-sm">
            No users yet.
          </div>
        )}
      </div>
    </main>
  )
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string | null }) {
  return (
    <div className="bg-card/40 border border-border rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground/80 mb-1.5">{label}</div>
      <div className="text-2xl font-bold text-foreground tabular-nums">{value.toLocaleString()}</div>
      {sub && <div className="text-[11px] text-muted-foreground/80 mt-1">{sub}</div>}
    </div>
  )
}

function FunnelStep({ label, value, ofTotal }: { label: string; value: number; ofTotal: number }) {
  const pctVal = ofTotal > 0 ? (value / ofTotal) * 100 : 0
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground/80 tabular-nums">{value} ({Math.round(pctVal)}%)</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: `${pctVal}%` }} />
      </div>
    </div>
  )
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000))
}

function formatDuration(ms: number): string {
  if (ms < 0) return '—'
  const min = Math.round(ms / 60_000)
  if (min < 60) return `${min}m`
  const hr = Math.round(min / 60)
  if (hr < 48) return `${hr}h`
  const d = Math.round(hr / 24)
  return `${d}d`
}

function pct(num: number, denom: number): number {
  return denom > 0 ? Math.round((num / denom) * 100) : 0
}
