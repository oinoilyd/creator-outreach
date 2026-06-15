import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { AuditMenu } from '@/components/admin/AuditMenu'
import { CacheStatsPanel, type CacheStats } from '@/components/admin/CacheStatsPanel'
import { ConnectionStatusPanel } from '@/components/admin/ConnectionStatusPanel'
import { ErrorInbox } from '@/components/admin/ErrorInbox'
import { UnlimitedExportsToggle } from '@/components/admin/UnlimitedExportsToggle'
import { EmailNotifyToggle } from '@/components/admin/EmailNotifyToggle'
import { AdminLoadStat } from '@/components/admin/AdminLoadStat'
import { LocalDateTime } from '@/components/LocalDateTime'
import { ThemeToggle } from '@/components/ThemeToggle'

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
  const renderStart = Date.now()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) notFound()

  // Fan out every independent fetch in a single Promise.all so they
  // run in parallel. Previously these were sequential awaits and the
  // admin page felt chunky as the dataset grew. Dylan 2026-06-08.
  const now7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const now24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [
    summaryResult,
    contactResult,
    profileExtrasResult,
    cacheTotal,
    cacheWithEmail,
    cacheBounced,
    cacheLast7,
    cacheLast24,
  ] = await Promise.all([
    supabase.rpc('admin_user_summary'),
    supabase.from('contact_messages').select('id', { count: 'exact', head: true }).eq('resolved', false),
    // Profile extras come through a SECURITY DEFINER RPC so admin can
    // see other users' timezone + last_seen_at. The direct SELECT path
    // was RLS-filtered to admin's own row, hiding Ryan's data. Backed
    // by migration 0038 (Dylan 2026-06-08).
    supabase.rpc('admin_user_profile_extras'),
    // Cache-stats counts MUST be `exact`. `estimated` (the planner's row
    // estimate) is wildly wrong for the creator_enrichment_latest
    // DISTINCT ON view — it guessed ~7.6k vs the real ~13k, AND guessed
    // the email-filtered count ≈ total, rendering a bogus 100% email
    // coverage (Dylan caught this 2026-06-12). Exact is ~350ms here and
    // runs in PARALLEL in this Promise.all — it was never the admin-page
    // lag (that was the 10-service health-check ping, now deferred).
    // Accuracy wins over ~350ms.
    supabase.from('creator_enrichment_latest').select('id', { count: 'exact', head: true }),
    supabase.from('creator_enrichment_latest').select('id', { count: 'exact', head: true }).not('email', 'is', null),
    supabase.from('creator_enrichment_latest').select('id', { count: 'exact', head: true }).eq('email_bounced', true),
    supabase.from('creator_enrichment').select('id', { count: 'exact', head: true }).gte('fetched_at', now7),
    supabase.from('creator_enrichment').select('id', { count: 'exact', head: true }).gte('fetched_at', now24),
  ])
  const { data, error } = summaryResult
  const rows = (data || []) as UserRow[]
  const unresolvedContact = contactResult.count
  const cacheStats: CacheStats = {
    total: cacheTotal.count ?? 0,
    withEmail: cacheWithEmail.count ?? 0,
    bouncedCount: cacheBounced.count ?? 0,
    fetchedLast7d: cacheLast7.count ?? 0,
    fetchedLast24h: cacheLast24.count ?? 0,
  }

  // Per-user activity + timezone, returned by admin_user_profile_extras
  // (migration 0038) so admin sees every user's row — not just their
  // own (RLS would gate a direct SELECT to auth.uid()=user_id).
  //
  // last_seen_at: bumped on every page load by app/page.tsx (0016).
  // We use this — NOT auth.last_sign_in_at — for the Idle and
  // "Active last 7d" metrics, because last_sign_in_at only moves
  // when a user re-authenticates, while sessions stay valid for
  // weeks.
  //
  // timezone: IANA name (0015). NULL = pre-migration user.
  // terms_privacy_*: GDPR Art. 7 consent audit trail (0027).
  // unlimited_exports: 0034. Per-user export paywall bypass.
  type ProfileExtras = {
    timezone: string | null
    last_seen_at: string | null
    terms_privacy_agreed_at: string | null
    terms_privacy_version: string | null
    unlimited_exports: boolean
    email_opt_in: boolean
  }
  type ExtraRow = {
    user_id: string
    timezone: string | null
    last_seen_at: string | null
    terms_privacy_agreed_at: string | null
    terms_privacy_version: string | null
    unlimited_exports: boolean | null
    email_opt_in: boolean | null
  }
  const profileExtraRows = (profileExtrasResult.data as unknown as ExtraRow[] | null) ?? []
  if (profileExtrasResult.error) {
    // Likely cause: migration 0038 not yet applied. Falls back to an
    // empty map, which means timezone + last_seen_at will be null for
    // every user (admin page shows the last_sign_in_at fallback).
    // Apply 0038 SQL in Supabase to fix.
    console.warn('[admin] admin_user_profile_extras failed:', profileExtrasResult.error.message)
  }
  const profileExtras = new Map<string, ProfileExtras>(
    profileExtraRows.map(r => [
      r.user_id,
      {
        timezone: r.timezone ?? null,
        last_seen_at: r.last_seen_at ?? null,
        terms_privacy_agreed_at: r.terms_privacy_agreed_at ?? null,
        terms_privacy_version: r.terms_privacy_version ?? null,
        unlimited_exports: r.unlimited_exports === true,
        email_opt_in: r.email_opt_in !== false, // default on
      },
    ]),
  )
  const tzKnownCount = Array.from(profileExtras.values()).filter(p => !!p.timezone).length
  const consentCount = Array.from(profileExtras.values()).filter(p => !!p.terms_privacy_agreed_at).length

  // Best-available "last active" timestamp per row: prefer the real
  // page-load bump (last_seen_at), fall back to auth's last_sign_in_at
  // for users who haven't loaded the app since 0016 was applied.
  function lastActiveAt(r: UserRow): string | null {
    return profileExtras.get(r.user_id)?.last_seen_at ?? r.last_sign_in_at
  }

  // ---- Aggregates ----
  const now = Date.now()
  const DAY_MS = 24 * 60 * 60 * 1000
  const sevenDaysAgo = now - 7 * DAY_MS

  const total = rows.length
  const verified = rows.filter(r => !!r.email_confirmed_at).length
  const activeLast7 = rows.filter(r => {
    const seen = lastActiveAt(r)
    return seen && new Date(seen).getTime() > sevenDaysAgo
  }).length
  const totalOutreach = rows.reduce((s, r) => s + (r.outreach_count || 0), 0)
  const totalDismissed = rows.reduce((s, r) => s + (r.dismissed_count || 0), 0)

  // Funnel: signed up → confirmed → onboarded → first outreach added
  const onboardedCount = rows.filter(r => r.onboarded).length
  const firstOutreachCount = rows.filter(r => !!r.first_outreach_at).length

  // Server-side data-fetch + render time, surfaced in the admin-only
  // AdminLoadStat badge so we can localize any "laggy to open" feeling.
  const serverMs = Date.now() - renderStart

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
            {/* Renamed from "Contacts" → "Database" 2026-05-12. The
                route still lives at /admin/contacts; only the label
                changed so it reads as the canonical creator database
                rather than a contact picker. */}
            <Link
              href="/admin/contacts"
              className="text-sm rounded-lg px-4 py-2 transition-colors flex items-center gap-2 border border-border text-muted-foreground hover:border-border hover:text-foreground"
            >
              <span aria-hidden>🗄️</span>Database
            </Link>
            <Link
              href="/admin/legal"
              className="text-sm rounded-lg px-4 py-2 transition-colors flex items-center gap-2 border border-border text-muted-foreground hover:border-border hover:text-foreground"
            >
              <span aria-hidden>📜</span>Legal
            </Link>
            <Link
              href="/admin/roadmap"
              className="text-sm rounded-lg px-4 py-2 transition-colors flex items-center gap-2 border border-border text-muted-foreground hover:border-border hover:text-foreground"
            >
              <span aria-hidden>🗺️</span>Roadmap
            </Link>
            <Link
              href="/admin/tutorial-preview"
              className="text-sm rounded-lg px-4 py-2 transition-colors flex items-center gap-2 border border-border text-muted-foreground hover:border-border hover:text-foreground"
            >
              <span aria-hidden>📚</span>Tutorials
            </Link>
            <Link
              href="/admin/contact"
              className={`text-sm rounded-lg px-4 py-2 transition-colors flex items-center gap-2 border ${
                (unresolvedContact ?? 0) > 0
                  ? 'border-yellow-500/50 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-500/10'
                  : 'border-border text-muted-foreground hover:border-border hover:text-foreground'
              }`}
            >
              <span><span aria-hidden>📨</span> Contact</span>
              {(unresolvedContact ?? 0) > 0 && (
                <span className="text-xs font-mono bg-yellow-500/20 text-yellow-800 dark:text-yellow-200 px-1.5 py-0.5 rounded" aria-label={`${unresolvedContact} unresolved`}>{unresolvedContact}</span>
              )}
            </Link>
            {/* Two-way inbox composer — broadcast site-wide updates or
                DM individual users (migration 0042). */}
            <Link
              href="/admin/messages"
              className="text-sm rounded-lg px-4 py-2 transition-colors flex items-center gap-2 border border-border text-muted-foreground hover:border-border hover:text-foreground"
            >
              <span aria-hidden>📣</span>Messages
            </Link>
            {/* Email-test + Seed-test-data moved into AuditMenu
                2026-05-12 — both are dev/diagnostic tools, not
                production surfaces, so they belong behind the
                audit dropdown next to Inbound-debug + Test-data. */}
            <AuditMenu />
            <ThemeToggle />
            <AdminLoadStat serverMs={serverMs} />
          </div>
        </div>

        {/* Live connection status — Dylan 2026-05-23: "track all
            connections such as the HTML changing risk you mentioned
            for insta so I can notify you when something breaks."
            Pings every external integration in parallel on mount +
            every 60s, flags fragile ones (HTML scraping etc) so
            Dylan can tell at a glance when something needs attention
            and what kind of break it is. */}
        <div className="mb-6">
          <ConnectionStatusPanel />
        </div>

        {/* Creator enrichment cache stats — the SaaS moat. Surfaces
            the size + freshness so Dylan can see the network effect
            grow over time. Added 2026-06-08 after Dylan noticed his
            cache hit 10k. */}
        <CacheStatsPanel stats={cacheStats} />

        {/* Central inbox for silent save failures across any user.
            Built 2026-06-08 after the 16-day data-loss incident where
            migration 0033 wasn't applied and every save returned
            PGRST204 to nowhere. The inbox is empty 99% of the time —
            when it isn't, it means a regression slipped past code
            review or a migration didn't get applied. Investigate
            immediately. */}
        <ErrorInbox />

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
              <Stat label="ToS + Privacy" value={consentCount} sub={total > 0 ? `${pct(consentCount, total)}%` : null} />
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

            {/* Enterprise test harnesses (sandbox + team preview)
                removed 2026-06-10 — Dylan will dogfood the team feature
                with real accounts (himself + Ryan + one tester) before
                public launch. The actual team feature code is intact. */}
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
                  <th className="px-4 py-3 text-left font-medium">Last seen</th>
                  <th className="px-4 py-3 text-left font-medium">Idle</th>
                  <th className="px-4 py-3 text-left font-medium">Time → 1st outreach</th>
                  <th className="px-4 py-3 text-center font-medium">Conf.</th>
                  <th className="px-4 py-3 text-center font-medium" title="Terms of Service + Privacy Policy consent timestamp (GDPR Article 7 audit trail). Recorded when the user checked the consent box at signup. NULL = pre-checkbox user — implicit accept via account creation.">ToS</th>
                  <th className="px-4 py-3 text-right font-medium">Outreach</th>
                  <th className="px-4 py-3 text-right font-medium">Dismissed</th>
                  <th
                    className="px-4 py-3 text-center font-medium"
                    title="Unlimited exports flag — when 'comp', this user bypasses the $50 export paywall and monthly free-tier limit entirely. Toggle on/off per-user; used for VIPs / partners / our own internal accounts."
                  >
                    Exports
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(r => {
                  const profileFields = [r.full_name, r.linkedin_url, r.pitch_line].map(s => !!s.trim())
                  const profileFilled = profileFields.filter(Boolean).length
                  const seenAt = lastActiveAt(r)
                  const idle = seenAt ? daysSince(seenAt) : null
                  const ttv = r.first_outreach_at && r.created_at
                    ? formatDuration(new Date(r.first_outreach_at).getTime() - new Date(r.created_at).getTime())
                    : null
                  const tz = profileExtras.get(r.user_id)?.timezone ?? null
                  return (
                    <tr key={r.user_id} className="hover:bg-card/40 transition-colors">
                      <td className="px-4 py-2.5 text-foreground">{r.email}</td>
                      <td className="px-4 py-2.5 text-foreground/90">{r.full_name || <span className="text-muted-foreground/60">—</span>}</td>
                      <td className="px-4 py-2.5 text-center" title={`Name ${profileFields[0] ? '✓' : '✗'} · LinkedIn ${profileFields[1] ? '✓' : '✗'} · Pitch ${profileFields[2] ? '✓' : '✗'}`}>
                        <span className={`inline-flex items-center justify-center w-9 h-6 rounded text-[11px] font-mono ${
                          profileFilled === 3 ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                          : profileFilled >= 1 ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300'
                          : 'bg-muted text-muted-foreground/80'
                        }`}>{profileFilled}/3</span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground/90 text-xs">
                        {tz
                          ? (() => {
                              // Show last segment for skim-readability —
                              // "America/Chicago" → "Chicago". Full IANA
                              // name is available in the title tooltip.
                              const parts = tz.split('/')
                              const short = (parts[parts.length - 1] || tz).replace(/_/g, ' ')
                              return <span title={tz}>{short}</span>
                            })()
                          : <span className="text-muted-foreground/50 italic">unknown</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        <LocalDateTime variant="datetime-short" iso={r.created_at} />
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {seenAt
                          ? <LocalDateTime variant="datetime-short" iso={seenAt} />
                          : <span className="text-muted-foreground/60">never</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {idle === null ? <span className="text-muted-foreground/60">—</span>
                         : idle === 0 ? <span className="text-green-700 dark:text-green-400 font-medium">today</span>
                         : <span className={
                              idle > 30 ? 'text-red-700 dark:text-red-400'
                              : idle > 7 ? 'text-yellow-700 dark:text-yellow-300'
                              : 'text-foreground/90'
                            }>{idle}d</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{ttv ?? <span className="text-muted-foreground/60">—</span>}</td>
                      <td className="px-4 py-2.5 text-center">
                        {r.email_confirmed_at
                          ? <span className="text-green-700 dark:text-green-400 font-bold">✓</span>
                          : <span className="text-yellow-600 dark:text-yellow-400 font-bold">·</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {(() => {
                          const extras = profileExtras.get(r.user_id)
                          const agreedAt = extras?.terms_privacy_agreed_at ?? null
                          const version = extras?.terms_privacy_version ?? null
                          if (!agreedAt) {
                            return (
                              <span
                                className="text-muted-foreground/50 text-[10px]"
                                title="No explicit ToS+Privacy consent on file — pre-checkbox user. Implicit accept via account creation (Contract lawful basis, GDPR Art. 6(1)(b))."
                              >
                                —
                              </span>
                            )
                          }
                          return (
                            <span
                              className="inline-flex items-center justify-center w-9 h-6 rounded text-[10px] font-mono bg-green-500/15 text-green-700 dark:text-green-400 cursor-help"
                              title={`Agreed to ToS + Privacy on ${new Date(agreedAt).toLocaleString()}${version ? ` (version ${version})` : ''}.`}
                            >
                              ✓ {version ?? ''}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-2.5 text-right text-foreground font-mono">{r.outreach_count}</td>
                      <td className="px-4 py-2.5 text-right text-foreground font-mono">{r.dismissed_count}</td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          <UnlimitedExportsToggle
                            userId={r.user_id}
                            initial={profileExtras.get(r.user_id)?.unlimited_exports ?? false}
                          />
                          <EmailNotifyToggle
                            userId={r.user_id}
                            initial={profileExtras.get(r.user_id)?.email_opt_in ?? true}
                          />
                        </div>
                      </td>
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
