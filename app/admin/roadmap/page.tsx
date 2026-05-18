/**
 * /admin/roadmap — internal feature-status dashboard.
 *
 * NOT the public /roadmap page. This is Dylan's bookkeeping surface
 * for tracking which features are live, which are dormant (waiting on
 * a blocker — usually paid Unipile), and which are planned but not
 * yet built. The goal is "what's running, what's frozen, why?" at a
 * single glance, so a feature like the auto-follow-up cron doesn't
 * silently rot in a corner.
 *
 * Content is hardcoded in the FEATURES array below — no DB, no
 * editing UI yet. Edit the file to change the list. Promotion path
 * to a Supabase-backed CMS is intentionally deferred until there's
 * actual editing pain (Reading C of the original spec).
 *
 * Admin-gated by ADMIN_EMAIL like every /admin/* surface.
 */

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

type FeatureStatus = 'active' | 'dormant' | 'planned'

interface FeatureItem {
  title: string
  /** One-line description of what the feature does. */
  body: string
  status: FeatureStatus
  /** Dormant + Planned only — what unblocks this from moving to Active. */
  unblock?: string
  /** Optional source file path so you remember where the code lives. */
  code?: string
  /** Optional dashboard URL — external service relevant to this feature. */
  externalUrl?: string
}

const FEATURES: FeatureItem[] = [
  // ── ACTIVE ────────────────────────────────────────────────────────
  {
    title: 'Stripe subscription paywall',
    body: 'Authenticated users without an active subscription get redirected to /pricing?required=1. Bypass list via BYPASS_PAYWALL_EMAILS env var. dmeehanj@gmail.com hardcoded as fallback so the founder never gets locked out.',
    status: 'active',
    code: 'lib/supabase/middleware.ts + lib/billing/paywall.ts',
  },
  {
    title: '/pricing FAQ + sharper plan cards',
    body: '6 inline Q&As (charge timing, cancellation, data retention, search caps, etc.) + "Most popular" badge on Annual + effective per-month meta line. Public — anyone can view without auth.',
    status: 'active',
    code: 'app/pricing/page.tsx',
  },
  {
    title: '5-platform creator search',
    body: 'Unified search across YouTube, Instagram, TikTok, X, LinkedIn. Public-data only.',
    status: 'active',
    code: 'app/api/search/',
  },
  {
    title: 'AI fit score',
    body: 'Every search result scored 0–100 against your ICP criteria. Breaks into audience, content, brand fit components.',
    status: 'active',
    code: 'app/api/score/',
  },
  {
    title: 'Manual follow-up workflow',
    body: 'Click email icon in a row → Gmail compose URL opens with template pre-filled → user sends in Gmail → user clicks "Followed up" in app to stamp cadence + status. Cadence ladder: 3d → 3d → 7d → 14d → 21d.',
    status: 'active',
    code: 'components/follow-ups/FollowUpRow.tsx',
  },
  {
    title: 'CRM (status, notes, follow-up cadence)',
    body: 'Built-in pipeline tracking. Status pills, notes per row, configurable follow-up dates with ghosting threshold at 30 days.',
    status: 'active',
    code: 'components/outreach/',
  },
  {
    title: 'Custom analytics + CSV/Excel export',
    body: '30+ default metrics + user-defined metric builder. Exports raw outreach data as CSV or Excel.',
    status: 'active',
    code: 'components/outreach/OutreachAnalytics.tsx',
  },
  {
    title: 'Auto-spotlight on theme pick',
    body: 'Picking Rain / Drift / Fireworks / Tornado fires the spotlight burst automatically. 15s default, theme-specific durations for one-shot themes.',
    status: 'active',
    code: 'app/page.tsx · handleBackdropThemeChange',
  },
  {
    title: 'Build-stamp footer (deploy diagnostic)',
    body: 'Landing page footer shows the deploy SHA so future "the update isn\'t showing for me" reports can be diagnosed in 10 seconds. Currently empty in prod — see Planned: fix VERCEL_GIT_COMMIT_SHA.',
    status: 'active',
    code: 'app/landing/page.tsx (build-stamp section)',
  },

  // ── DORMANT (waiting on Unipile paid plan) ────────────────────────
  {
    title: 'Auto Follow-up cron',
    body: 'Per-row toggle that auto-sends the follow-up email when the date hits. Cron runs every 15min, caps 50 global / 10 per user. Code is intact, UI checkbox self-disables when Unipile is not connected.',
    status: 'dormant',
    unblock: 'Re-subscribe to Unipile at $200 MRR. Then reconnect Gmail via Profile → checkbox unlocks → cron starts firing again.',
    code: 'app/api/cron/send-followups/route.ts',
    externalUrl: 'https://dashboard.unipile.com',
  },
  {
    title: 'Programmatic email send + preview modal',
    body: 'Path B sending — emails go out via Unipile API instead of opening Gmail compose URL. Lets us track sends, opens, and link clicks. Path A (Gmail compose passthrough) is the active fallback for users without Unipile.',
    status: 'dormant',
    unblock: 'Unipile paid plan. Without it the modal opens but the actual send fails at the Unipile API layer.',
    code: 'lib/unipile.ts',
    externalUrl: 'https://dashboard.unipile.com',
  },
  {
    title: 'AI reply classification (auto-status flip)',
    body: 'Inbound replies hit Unipile webhook → routed through AI classifier → status auto-flips to Successful / Open / Replied based on confidence. Currently requires the user to manually update status when replies land.',
    status: 'dormant',
    unblock: 'Unipile paid plan (depends on inbound webhook). Webhook code in app/api/unipile/webhook/route.ts.',
    code: 'app/api/unipile/webhook/route.ts',
    externalUrl: 'https://dashboard.unipile.com',
  },
  {
    title: 'Instagram DM send via Unipile',
    body: 'Push IG DMs from inside the app. Today the IG cell click copies the template to clipboard + opens the IG profile — user pastes manually.',
    status: 'dormant',
    unblock: 'Unipile paid plan + connected IG account.',
    externalUrl: 'https://dashboard.unipile.com',
  },
  {
    title: 'LinkedIn DM send via Unipile',
    body: 'Push LinkedIn DMs from inside the app. Today LinkedIn cells open the profile in a new tab.',
    status: 'dormant',
    unblock: 'Unipile paid plan + connected LinkedIn account.',
    externalUrl: 'https://dashboard.unipile.com',
  },
  {
    title: 'Open + click tracking',
    body: 'Detect when a recipient opens the email or clicks a link. Surfaces engagement signal before any reply lands.',
    status: 'dormant',
    unblock: 'Unipile paid plan (open/click events are part of their tracking package).',
    externalUrl: 'https://dashboard.unipile.com',
  },

  // ── PLANNED (not built yet) ───────────────────────────────────────
  {
    title: 'VIPOUTREACH coupon redemption UI',
    body: '"Have a code?" input under the Subscribe button on /pricing. POST to /api/stripe/checkout with body.couponCode → Stripe validates → applied to the checkout session.',
    status: 'planned',
    unblock: 'Create VIPOUTREACH coupon in Stripe Dashboard first, then build the UI + checkout-route change.',
    externalUrl: 'https://dashboard.stripe.com/coupons',
  },
  {
    title: 'Fix empty VERCEL_GIT_COMMIT_SHA on production',
    body: 'Build-stamp footer currently renders empty because the env var isn\'t exposed at runtime. Fix: enable "Automatically expose System Environment Variables" in Vercel project settings.',
    status: 'planned',
    unblock: 'Toggle in Vercel → Project → Settings → Environment Variables, then redeploy.',
    externalUrl: 'https://vercel.com/dashboard',
  },
  {
    title: 'Meta Graph API for official IG metrics',
    body: 'Replaces the public-scrape fallback with official Meta-sourced IG follower/post counts. Integration code already exists in lib/instagram-graph.ts.',
    status: 'planned',
    unblock: 'Four env vars (META_APP_ID, META_APP_SECRET, META_LONG_LIVED_TOKEN, META_IG_BUSINESS_ID) + Meta Business Manager + Facebook App + Meta App Review (~1-2 weeks).',
    code: 'lib/instagram-graph.ts',
    externalUrl: 'https://developers.facebook.com',
  },
  {
    title: 'Sequence editor v1 — custom cadence templates',
    body: 'Let users define their own follow-up cadence + templates per campaign instead of the hardcoded 3/3/7/14/21 ladder.',
    status: 'planned',
    unblock: 'Customer pull — defer until ~$10K MRR (per docs/next-steps.md roadmap discipline).',
  },
  {
    title: 'Supabase Pro upgrade',
    body: 'Free tier has 50K row / 500MB / 2GB egress limit. Pro lifts to 8GB / 250GB egress + adds daily backups + 7-day PITR.',
    status: 'planned',
    unblock: 'Upgrade in Supabase Dashboard ($25/mo). Do before first paying customer so the upgrade isn\'t blocking a transaction.',
    externalUrl: 'https://supabase.com/dashboard',
  },
  {
    title: 'Stripe trial-end reminder email',
    body: '/pricing FAQ claims "Stripe emails you 3 days before the trial ends." Verify the Dashboard toggle is ON so the claim is real.',
    status: 'planned',
    unblock: 'Stripe Dashboard → Settings → Billing → Subscriptions and emails → toggle "Email customers when their trial is about to end" ON.',
    externalUrl: 'https://dashboard.stripe.com/settings/billing/automatic',
  },
  {
    title: 'Demo video (3-5 min)',
    body: 'Walk through AI fit score, 5-platform search, outreach send, CRM, custom analytics. Linked in every warm intro.',
    status: 'planned',
    unblock: 'Dylan record + edit, 2-4 hrs.',
  },
  {
    title: 'Warm-intro email template + follow-up sequence',
    body: 'Ryan\'s 100-lead push. Template lives in docs/templates/warm-intro.md (not yet written). Follow-up sequence: first reply + 2-3 touches.',
    status: 'planned',
    unblock: 'Dylan write, 15-30 min.',
  },
  {
    title: 'Founder story video (2-4 min)',
    body: 'Ryan tells his story — industry experience, why this product, what it means to him. Linked in warm intro next to the demo video.',
    status: 'planned',
    unblock: 'Ryan record + edit, 1-2 days.',
  },
]

const STATUS_META: Record<FeatureStatus, { label: string; tone: string; description: string }> = {
  active: {
    label: 'Active',
    tone: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
    description: 'Live in production. Users see + interact with these today.',
  },
  dormant: {
    label: 'Dormant',
    tone: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
    description: 'Code exists but isn\'t running. Waiting on an external unblock (usually a paid Unipile plan).',
  },
  planned: {
    label: 'Planned',
    tone: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    description: 'Not built yet. Each has a concrete unblock so it\'s not vague backlog.',
  },
}

export const dynamic = 'force-dynamic'

export default async function AdminRoadmapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) notFound()

  const grouped = {
    active: FEATURES.filter(f => f.status === 'active'),
    dormant: FEATURES.filter(f => f.status === 'dormant'),
    planned: FEATURES.filter(f => f.status === 'planned'),
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Admin · Roadmap</h1>
            <p className="text-muted-foreground/80 text-sm mt-1">
              Internal feature-status tracker. {grouped.active.length} active · {grouped.dormant.length} dormant · {grouped.planned.length} planned.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:text-foreground border border-border hover:border-border rounded-lg px-4 py-2 transition-colors"
            >
              Back to admin
            </Link>
          </div>
        </div>

        {/* Summary cards — at-a-glance counts so you can eyeball the
            distribution without reading the lists. */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {(['active', 'dormant', 'planned'] as const).map(s => (
            <div
              key={s}
              className={`rounded-xl p-4 border ${STATUS_META[s].tone}`}
            >
              <div className="text-[11px] uppercase tracking-wider opacity-80 mb-1.5">{STATUS_META[s].label}</div>
              <div className="text-2xl font-bold tabular-nums">{grouped[s].length}</div>
              <div className="text-[11px] opacity-75 mt-2 leading-snug">{STATUS_META[s].description}</div>
            </div>
          ))}
        </div>

        {(['active', 'dormant', 'planned'] as const).map(status => (
          <section key={status} className="mb-10">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                {STATUS_META[status].label}{' '}
                <span className="text-muted-foreground/70 font-normal text-sm">
                  · {grouped[status].length} item{grouped[status].length === 1 ? '' : 's'}
                </span>
              </h2>
            </div>
            <div className="space-y-2">
              {grouped[status].map(item => (
                <FeatureCard key={item.title} item={item} />
              ))}
              {grouped[status].length === 0 && (
                <div className="text-muted-foreground/60 text-sm italic">None.</div>
              )}
            </div>
          </section>
        ))}

        <div className="mt-12 text-[11px] text-muted-foreground/60 leading-relaxed">
          Edit this list in <code className="font-mono text-foreground/80">app/admin/roadmap/page.tsx</code> (FEATURES array).
          When the list outgrows file-based editing, promote to a Supabase{' '}
          <code className="font-mono text-foreground/80">roadmap_items</code> table with admin CRUD UI.
        </div>
      </div>
    </main>
  )
}

function FeatureCard({ item }: { item: FeatureItem }) {
  return (
    <div className="bg-card/40 border border-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-[15px] font-semibold text-foreground leading-snug">{item.title}</h3>
        {item.externalUrl && (
          <a
            href={item.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[11px] font-mono text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 transition-colors"
            title={item.externalUrl}
          >
            open ↗
          </a>
        )}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
      {item.unblock && (
        <div className="mt-3 text-[13px] text-foreground/85 bg-muted/40 border border-border rounded-lg px-3 py-2">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-semibold mr-2">Unblocks when</span>
          {item.unblock}
        </div>
      )}
      {item.code && (
        <div className="mt-2 text-[11px] font-mono text-muted-foreground/70">
          {item.code}
        </div>
      )}
    </div>
  )
}
