import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { LocalDateTime } from '@/components/LocalDateTime'
import { OutreachMatch, type SignupLite } from '@/components/admin/OutreachMatch'

/**
 * /admin/analytics — founder growth dashboard (Dylan 2026-06-30).
 *
 * The main /admin page is operational (per-user table, toggles, error
 * inbox). This page answers the growth questions during the outreach
 * push: how many signed up and when, who is trialing vs paying (MRR),
 * and WHICH of the cold-outreach leads actually converted.
 *
 * Billing columns live on user_profile behind owner-scoped RLS, so
 * reading OTHER users' subscription state needs privilege. Pattern
 * matches the crons: verify the admin email on the session FIRST,
 * then use the service-role client for the read. No new migration.
 *
 * Outreach conversion: prospect emails stay OUT of the product DB —
 * the paste-box lives client-side in localStorage (sole-admin tool),
 * cross-referenced here against real signups.
 */

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export const dynamic = 'force-dynamic'

interface SummaryRow {
  user_id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  first_outreach_at: string | null
  outreach_count: number
}

interface BillingRow {
  user_id: string
  subscription_status: string | null
  subscription_price_id: string | null
  subscription_current_period_end: string | null
  last_seen_at: string | null
}

const MONTHLY_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY ?? ''
const ANNUAL_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ANNUAL ?? ''
const MONTHLY_MRR = 50
const ANNUAL_MRR = 500 / 12

function planLabel(priceId: string | null): 'monthly' | 'annual' | 'other' | null {
  if (!priceId) return null
  if (priceId === MONTHLY_ID) return 'monthly'
  if (priceId === ANNUAL_ID) return 'annual'
  return 'other'
}

export default async function AdminAnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) notFound()

  // Admin verified — service-role read for cross-user billing state.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const service = url && serviceKey
    ? createServiceClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null

  const [summaryResult, billingResult] = await Promise.all([
    supabase.rpc('admin_user_summary'),
    service
      ? service.from('user_profile').select('user_id, subscription_status, subscription_price_id, subscription_current_period_end, last_seen_at')
      : Promise.resolve({ data: null, error: { message: 'SUPABASE_SERVICE_ROLE_KEY not set — billing view unavailable.' } } as const),
  ])

  const rows = ((summaryResult.data || []) as SummaryRow[])
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const billingRows = (billingResult.data ?? []) as BillingRow[]
  const billingByUser = new Map(billingRows.map(b => [b.user_id, b]))
  const billingError = billingResult.error?.message ?? null

  // ---- KPIs ----
  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000
  const total = rows.length
  const newLast7 = rows.filter(r => now - new Date(r.created_at).getTime() < 7 * DAY).length
  const activeLast7 = rows.filter(r => {
    const seen = billingByUser.get(r.user_id)?.last_seen_at ?? r.last_sign_in_at
    return seen && now - new Date(seen).getTime() < 7 * DAY
  }).length

  const withStatus = rows.map(r => ({ ...r, billing: billingByUser.get(r.user_id) }))
  const trialing = withStatus.filter(r => r.billing?.subscription_status === 'trialing')
  const paying = withStatus.filter(r => r.billing?.subscription_status === 'active')
  const atRisk = withStatus.filter(r => ['past_due', 'unpaid'].includes(r.billing?.subscription_status ?? ''))
  const canceled = withStatus.filter(r => r.billing?.subscription_status === 'canceled')

  let mrr = 0
  let mrrUnknown = 0
  for (const r of paying) {
    const plan = planLabel(r.billing?.subscription_price_id ?? null)
    if (plan === 'monthly') mrr += MONTHLY_MRR
    else if (plan === 'annual') mrr += ANNUAL_MRR
    else mrrUnknown += 1
  }

  // ---- Signups per week (last 12 weeks, oldest → newest) ----
  const WEEKS = 12
  const weekBuckets: { label: string; count: number }[] = []
  for (let i = WEEKS - 1; i >= 0; i--) {
    const start = now - (i + 1) * 7 * DAY
    const end = now - i * 7 * DAY
    const count = rows.filter(r => {
      const t = new Date(r.created_at).getTime()
      return t >= start && t < end
    }).length
    const d = new Date(end)
    weekBuckets.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, count })
  }
  const maxWeek = Math.max(1, ...weekBuckets.map(w => w.count))

  const signupsLite: SignupLite[] = withStatus.map(r => ({
    email: r.email,
    createdAt: r.created_at,
    status: r.billing?.subscription_status ?? null,
  }))

  const subscribed = withStatus.filter(r => !!r.billing?.subscription_status)

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Admin · Analytics</h1>
            <p className="text-muted-foreground/80 text-sm mt-1">Growth, revenue, and outreach conversion.</p>
          </div>
          <Link
            href="/admin"
            className="text-sm rounded-lg px-4 py-2 transition-colors border border-border text-muted-foreground hover:text-foreground"
          >
            ← Users
          </Link>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
          <Stat label="Total users" value={String(total)} />
          <Stat label="New (7d)" value={String(newLast7)} />
          <Stat label="Active (7d)" value={String(activeLast7)} sub={total > 0 ? `${Math.round((activeLast7 / total) * 100)}%` : null} />
          <Stat label="Trialing" value={String(trialing.length)} />
          <Stat label="Paying" value={String(paying.length)} sub={atRisk.length > 0 ? `+${atRisk.length} past due` : null} />
          <Stat label="MRR (est.)" value={`$${Math.round(mrr).toLocaleString()}`} sub={mrrUnknown > 0 ? `${mrrUnknown} sub${mrrUnknown === 1 ? '' : 's'} on unmapped plan` : null} />
        </div>

        {billingError && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/40 rounded-lg p-3 mb-6 text-xs text-yellow-800 dark:text-yellow-300">
            Billing view degraded: {billingError}
          </div>
        )}

        {/* Signups per week */}
        <div className="bg-card/40 border border-border rounded-xl p-5 mb-8">
          <div className="text-sm font-semibold mb-1">Signups per week</div>
          <div className="text-xs text-muted-foreground/80 mb-4">Last 12 weeks</div>
          <svg viewBox={`0 0 ${WEEKS * 56} 150`} className="w-full max-w-3xl" role="img" aria-label="Weekly signup counts, last 12 weeks">
            {weekBuckets.map((w, i) => {
              const h = Math.round((w.count / maxWeek) * 100)
              const x = i * 56 + 8
              return (
                <g key={i}>
                  <rect x={x} y={118 - h} width={40} height={Math.max(h, w.count > 0 ? 3 : 0)} rx={4} className="fill-blue-500/80" />
                  {w.count > 0 && (
                    <text x={x + 20} y={110 - h} textAnchor="middle" className="fill-current text-foreground" fontSize="12" fontWeight="600">{w.count}</text>
                  )}
                  <text x={x + 20} y={134} textAnchor="middle" className="fill-current text-muted-foreground" fontSize="10">{w.label}</text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Outreach conversion cross-reference */}
        <OutreachMatch signups={signupsLite} />

        {/* Subscription table */}
        <div className="bg-card/40 border border-border rounded-xl p-5 mb-8">
          <div className="text-sm font-semibold mb-4">Subscriptions ({subscribed.length})</div>
          {subscribed.length === 0 ? (
            <div className="text-sm text-muted-foreground/80 py-6 text-center">No one has started a trial or subscription yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Plan</th>
                    <th className="px-3 py-2 text-left font-medium">Period ends</th>
                    <th className="px-3 py-2 text-left font-medium">Signed up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subscribed.map(r => {
                    const status = r.billing?.subscription_status ?? ''
                    const plan = planLabel(r.billing?.subscription_price_id ?? null)
                    return (
                      <tr key={r.user_id}>
                        <td className="px-3 py-2 text-foreground">{r.email}</td>
                        <td className="px-3 py-2"><StatusBadge status={status} /></td>
                        <td className="px-3 py-2 text-muted-foreground">{plan ?? '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {r.billing?.subscription_current_period_end
                            ? <LocalDateTime variant="datetime-short" iso={r.billing.subscription_current_period_end} />
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          <LocalDateTime variant="datetime-short" iso={r.created_at} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {canceled.length > 0 && (
            <div className="text-xs text-muted-foreground/80 mt-3">{canceled.length} canceled subscription{canceled.length === 1 ? '' : 's'} included above.</div>
          )}
        </div>
      </div>
    </main>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="bg-card/40 border border-border rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground/80 mb-1.5">{label}</div>
      <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground/80 mt-1">{sub}</div>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'active' ? 'bg-green-500/15 text-green-700 dark:text-green-400'
    : status === 'trialing' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
    : status === 'canceled' ? 'bg-muted text-muted-foreground'
    : 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300' // past_due / unpaid / incomplete
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{status}</span>
}
