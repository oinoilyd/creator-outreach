/**
 * /pricing — public pricing page.
 *
 * Server component. Reads price info from env so the price displayed
 * on the page always matches what Stripe will charge:
 *   NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY        — the Stripe price ID
 *   NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_DISPLAY   — e.g. "$49/mo"
 *   NEXT_PUBLIC_STRIPE_PRICE_ID_ANNUAL         — annual plan price ID
 *   NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_DISPLAY    — e.g. "$490/yr"
 *
 * Auth state determines the CTA:
 *   • signed out → "Start 14-day free trial" → /auth/signup?next=/pricing
 *   • signed in + active sub → "Manage subscription" → Stripe Portal
 *   • signed in + no sub → "Start 14-day free trial" → Stripe Checkout
 *
 * When env vars aren't set we degrade gracefully — the page still
 * renders with a "Pricing not configured yet" badge so dev/preview
 * builds don't 500.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PricingCheckoutButton } from '@/components/pricing/PricingCheckoutButton'

export const metadata: Metadata = {
  title: 'Pricing — Creator Outreach',
  description:
    'Start with a 14-day free trial. Unlimited creator search across YouTube, Instagram, TikTok, X, and LinkedIn. AI fit scoring, follow-up automation, full CRM.',
  alternates: { canonical: 'https://creatoroutreach.net/pricing' },
  openGraph: {
    title: 'Creator Outreach — Pricing',
    description: 'Start with a 14-day free trial. Full feature set on every plan.',
    url: 'https://creatoroutreach.net/pricing',
  },
}

/** Statuses that mean "user has a live subscription". 'past_due' and
 *  'unpaid' still count because the user already has a payment method
 *  on file and the portal is the right destination for them, not
 *  Checkout. */
const LIVE_SUB_STATUSES = new Set([
  'trialing',
  'active',
  'past_due',
  'incomplete',
  'unpaid',
  'paused',
])

interface Plan {
  id: 'monthly' | 'annual'
  tier: string
  priceId: string | null
  display: string | null
  priceSub: string
  features: string[]
  featured: boolean
}

function buildPlans(): Plan[] {
  return [
    {
      id: 'monthly',
      tier: 'Pro · Monthly',
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY ?? null,
      display: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_DISPLAY ?? null,
      priceSub: '14-day free trial · cancel anytime',
      features: [
        'Unlimited creator search across 5 platforms',
        'AI fit scoring against your own criteria',
        'Email outreach + Instagram DM composer',
        'Follow-up automation',
        'Full CRM: status pills, notes, follow-up cadence',
        'Custom analytics — 30+ metrics + CSV export',
      ],
      featured: false,
    },
    {
      id: 'annual',
      tier: 'Pro · Annual',
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ANNUAL ?? null,
      display: process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_DISPLAY ?? null,
      priceSub: '14-day free trial · save ~17% vs monthly',
      features: [
        'Everything in Monthly',
        'Two months free (paid annually)',
        'Priority email support',
        'Early access to new features',
      ],
      featured: true,
    },
  ]
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<{ required?: string }>
}) {
  // ?required=1 is set by the paywall middleware when an
  // authenticated-but-unsubscribed user tries to reach the app. We
  // surface a clear banner so they know why they were redirected here
  // and what to do about it (pick a plan, start the trial).
  const params = (await searchParams) ?? {}
  const isPaywallRedirect = params.required === '1'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let hasLiveSub = false
  if (user) {
    const { data: profileRow } = await supabase
      .from('user_profile')
      .select('subscription_status, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (
      profileRow?.stripe_customer_id &&
      profileRow?.subscription_status &&
      LIVE_SUB_STATUSES.has(profileRow.subscription_status)
    ) {
      hasLiveSub = true
    }
  }

  const isAuthed = !!user
  const plans = buildPlans()
  const anyPriceConfigured = plans.some(p => p.priceId)

  return (
    <main className="min-h-screen bg-white dark:bg-[#0B1020] text-[#0F1733] dark:text-white">
      {/* Lightweight top bar — just brand + back-to-app. No nav clutter
          since the pricing page is its own moment. Brand mark MUST
          match LandingTopNav.tsx and AuthShell.tsx — purple→blue
          gradient tile + 16px wordmark. */}
      <header className="border-b border-[#0F1733]/10 dark:border-white/10">
        <div className="max-w-[1100px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-2 text-primary-foreground text-[14px] font-bold">
              C
            </span>
            <span className="font-semibold tracking-[-0.01em] text-[16px]">
              Creator Outreach
            </span>
          </Link>
          <Link
            href={isAuthed ? '/' : '/auth/signin'}
            className="text-[13px] text-[#0F1733]/70 dark:text-white/70 hover:text-[#0F1733] dark:hover:text-white transition-colors"
          >
            {isAuthed ? 'Back to app' : 'Sign in'}
          </Link>
        </div>
      </header>

      <section className="px-6 pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="max-w-[1100px] mx-auto">
          {isPaywallRedirect && (
            <div className="max-w-[700px] mx-auto mb-10 rounded-xl border border-[#E85D2F]/40 bg-[#E85D2F]/8 dark:bg-[#F2A261]/8 dark:border-[#F2A261]/40 px-5 py-4 flex items-start gap-3">
              <span aria-hidden className="mt-0.5 inline-flex w-5 h-5 items-center justify-center rounded-full bg-[#E85D2F] text-white text-[11px] font-bold shrink-0">!</span>
              <div className="text-[14px] text-[#9C3D1F] dark:text-[#F2A261] leading-[1.5]">
                <strong className="font-semibold">Start your free trial to continue.</strong>{' '}
                Creator Outreach requires an active subscription. Pick a plan
                below — the 14-day trial means you won&apos;t be charged today,
                and you can cancel anytime.
              </div>
            </div>
          )}

          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 mb-5 px-2.5 py-1 rounded-full bg-[#E85D2F]/10 border border-[#E85D2F]/30 text-[10px] uppercase tracking-[0.18em] font-bold text-[#9C3D1F] dark:text-[#F2A261] dark:bg-[#F2A261]/10 dark:border-[#F2A261]/30">
              Pricing
            </div>
            <h1
              className="font-semibold tracking-[-0.025em] mb-5"
              style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}
            >
              Start with a 14-day free trial.
            </h1>
            <p className="max-w-[58ch] mx-auto text-[17px] text-[#0F1733]/65 dark:text-white/65 leading-[1.55]">
              No charges until your trial ends. Cancel anytime from the customer portal.
            </p>
          </div>

          {!anyPriceConfigured && (
            <div className="max-w-[640px] mx-auto mb-8 rounded-lg border border-[#E85D2F]/40 bg-[#E85D2F]/5 px-4 py-3 text-[13px] text-[#9C3D1F] dark:text-[#F2A261]">
              Pricing isn&apos;t fully configured in this environment yet. Set the{' '}
              <code className="text-[12px] font-mono">NEXT_PUBLIC_STRIPE_PRICE_ID_*</code>{' '}
              env vars to enable Checkout.
            </div>
          )}

          {hasLiveSub && (
            <div className="max-w-[640px] mx-auto mb-8 rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-[13px] text-emerald-700 dark:text-emerald-300 text-center">
              You&apos;re already subscribed. Use the &ldquo;Manage subscription&rdquo; button below to update payment or change plans.
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-5 max-w-[820px] mx-auto items-stretch">
            {plans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isAuthed={isAuthed}
                hasLiveSub={hasLiveSub}
              />
            ))}
          </div>

          <div className="mt-12 text-center text-[12px] text-[#0F1733]/50 dark:text-white/50">
            Questions?{' '}
            <a
              href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20pricing%20question"
              className="underline underline-offset-2 hover:text-[#E85D2F]"
            >
              dmeehanj@gmail.com
            </a>
            {' · '}
            <Link href="/refunds" className="underline underline-offset-2 hover:text-[#E85D2F]">
              Refund policy
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

/** PlanCard — single plan tile. CTA varies based on auth + sub state.
 *  Layout mirrors the Beta/Coming-soon cards on /landing so the visual
 *  language stays consistent. */
function PlanCard({
  plan,
  isAuthed,
  hasLiveSub,
}: {
  plan: Plan
  isAuthed: boolean
  hasLiveSub: boolean
}) {
  const priceMissing = !plan.priceId || !plan.display
  const buttonMode = !isAuthed ? 'signed-out' : hasLiveSub ? 'manage' : 'subscribe'

  return (
    <div
      className={`rounded-2xl p-7 md:p-8 flex flex-col border ${
        plan.featured
          ? 'bg-[#0F1733] text-white border-transparent'
          : 'bg-white dark:bg-[#131826] border-[#0F1733]/10 dark:border-white/10'
      }`}
      style={
        plan.featured ? { boxShadow: '0 30px 60px -30px rgba(15,23,51,0.4)' } : undefined
      }
    >
      <div
        className={`text-[13px] uppercase tracking-[0.18em] mb-3 font-semibold ${
          plan.featured ? 'text-[#F2A261]' : 'text-[#E85D2F]'
        }`}
      >
        {plan.tier}
      </div>
      <div
        className="font-semibold tracking-[-0.025em] mb-1"
        style={{ fontSize: 'clamp(2.25rem, 4vw, 3rem)' }}
      >
        {plan.display ?? '—'}
      </div>
      <div
        className={`text-[13px] mb-6 ${
          plan.featured ? 'text-white/55' : 'text-[#0F1733]/55 dark:text-white/55'
        }`}
      >
        {plan.priceSub}
      </div>
      <ul className="space-y-2.5 mb-7 text-[14px] flex-1">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-2.5">
            <span
              className={
                plan.featured
                  ? 'text-[#F2A261] font-bold mt-0.5 shrink-0'
                  : 'text-[#E85D2F] font-bold mt-0.5 shrink-0'
              }
            >
              ✓
            </span>
            <span
              className={
                plan.featured
                  ? 'text-white/90'
                  : 'text-[#0F1733]/85 dark:text-white/85'
              }
            >
              {f}
            </span>
          </li>
        ))}
      </ul>
      {priceMissing ? (
        <div
          className={`mt-auto flex w-full items-center justify-center px-5 py-3 rounded-md text-[13px] ${
            plan.featured
              ? 'bg-white/10 text-white/60'
              : 'bg-[#0F1733]/5 dark:bg-white/5 text-[#0F1733]/50 dark:text-white/50'
          }`}
        >
          Not yet available
        </div>
      ) : (
        <PricingCheckoutButton
          mode={buttonMode}
          priceId={plan.priceId!}
          featured={plan.featured}
        />
      )}
    </div>
  )
}
