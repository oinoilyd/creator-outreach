import Link from 'next/link'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V3 / Pricing — Pipedrive-style 2-tier pricing card grid + FAQ.
 */

export const metadata = {
  title: 'Creator Outreach — Pricing',
  description: 'Free during beta. No card on file. Beta users grandfathered when paid plans launch.',
}

export default async function V3Pricing() {
  const { isAuthed } = await getLandingAuthState()

  return (
    <>
      {/* Page header */}
      <section className="px-6 pt-20 md:pt-28 pb-16">
        <div className="max-w-[800px] mx-auto text-center">
          <div className="text-[12px] uppercase tracking-[0.2em] text-[#1FBC9C] mb-4 font-bold">Pricing</div>
          <h1 className="font-bold tracking-[-0.025em]" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}>
            Simple. <span className="text-[#1FBC9C]">Free during beta.</span> Honest after.
          </h1>
          <p className="mt-7 text-[18px] text-[#162032]/70 leading-[1.55]">
            No card on file. No seat cap. No annual upsell. Beta users get grandfathered into a price announced before any tier change.
          </p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="px-6 pb-20 md:pb-28">
        <div className="max-w-[1000px] mx-auto grid md:grid-cols-2 gap-5">
          <PricingCard
            tier="Beta"
            price="$0"
            priceSub="Free while in beta"
            features={[
              'Five-platform parallel search',
              'AI plain-English fit scoring',
              'Templated outreach per channel',
              'Auto-cadence follow-ups',
              'Real Instagram metrics in queue',
              'CSV / Excel export anytime',
              'No seat cap, no usage meter',
            ]}
            cta={isAuthed ? 'Open the app →' : 'Start for free →'}
            ctaHref={isAuthed ? '/' : '/auth/signup'}
            featured
          />
          <PricingCard
            tier="Pro (coming)"
            price="TBD"
            priceSub="For heavier users + teams"
            features={[
              'Higher search volume',
              'Multi-seat workspaces',
              'Bulk email enrichment',
              'Priority support',
              'SSO + audit logs',
              'Beta users grandfathered',
            ]}
            cta="Notify me"
            ctaHref="mailto:dmeehanj@gmail.com?subject=Notify%20me%20when%20Creator%20Outreach%20Pro%20is%20ready"
          />
        </div>

        <p className="mt-10 text-center text-[13px] text-[#162032]/55 max-w-[58ch] mx-auto">
          ◆ Beta users will be grandfathered into a price announced before any tier change.{' '}
          <a href="mailto:dmeehanj@gmail.com" className="underline decoration-1 underline-offset-2 hover:text-[#1FBC9C]">Talk to the founder</a> if you want a heads-up.
        </p>
      </section>

      {/* Comparison band */}
      <section className="px-6 py-16 bg-[#F7FAFC] border-y border-[#162032]/10">
        <div className="max-w-[900px] mx-auto text-center">
          <h2 className="font-bold tracking-[-0.02em] mb-3" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>
            What you stop paying for.
          </h2>
          <p className="text-[16px] text-[#162032]/65 leading-[1.55] mb-8 max-w-[58ch] mx-auto">
            Tools you can replace with the Beta tier today.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
            <ReplaceCard tool="A spreadsheet" cost="0–???" outcome="Forgotten by Friday" />
            <ReplaceCard tool="Mid-tier CRM" cost="~$400/mo" outcome="Doesn't know IG" />
            <ReplaceCard tool="3 browser tabs" cost="Tab-bankruptcy" outcome="Status drifts" />
            <ReplaceCard tool="Cadence reminder" cost="Free but flaky" outcome="No queue context" />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-6 py-20 md:py-28 scroll-mt-32">
        <div className="max-w-[820px] mx-auto">
          <div className="text-center mb-12">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#1FBC9C] mb-4 font-bold">FAQ</div>
            <h2 className="font-bold tracking-[-0.025em]" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
              Common questions.
            </h2>
          </div>
          <div className="space-y-3">
            <FaqItem q="Do I need a credit card to start?" a="No. Beta is $0 with no card required. Sign up and start searching." />
            <FaqItem q="What happens to my data if I leave?" a="It's yours. Export to CSV or Excel anytime. Privacy isn't a setting we toggle — it's the default posture of the platform." />
            <FaqItem q="Will pricing change later?" a="Eventually, yes — when we launch paid tiers we'll announce ahead of any change. Beta users will be grandfathered." />
            <FaqItem q="Which platforms are supported today?" a="YouTube, Instagram, TikTok, X, and LinkedIn — all in one query." />
            <FaqItem q="Is this just for solo operators?" a="No. Indie operators, solo founders, growth teams, and small agencies all run on it. The Pro tier (coming) adds team-shaped features." />
            <FaqItem q="Do you have integrations?" a="The five major creator platforms are searched directly — no integration setup. Outbound (Zapier, native CRM connectors) coming on Pro." />
          </div>
        </div>
      </section>
    </>
  )
}

function PricingCard({ tier, price, priceSub, features, cta, ctaHref, featured = false }: { tier: string; price: string; priceSub: string; features: string[]; cta: string; ctaHref: string; featured?: boolean }) {
  return (
    <div className={`rounded-2xl p-7 md:p-9 ${featured ? 'bg-[#162032] text-white' : 'bg-white border border-[#162032]/10 text-[#162032]'}`} style={featured ? { boxShadow: '0 30px 60px -25px rgba(31,188,156,0.40)' } : undefined}>
      <div className={`text-[12px] uppercase tracking-[0.18em] mb-3 font-bold ${featured ? 'text-[#1FBC9C]' : 'text-[#1FBC9C]'}`}>{tier}</div>
      <div className="font-bold tracking-[-0.025em] mb-1" style={{ fontSize: 'clamp(2.5rem, 4vw, 3.5rem)' }}>{price}</div>
      <div className={`text-[13px] mb-7 ${featured ? 'text-white/55' : 'text-[#162032]/55'}`}>{priceSub}</div>
      <ul className="space-y-2.5 mb-8 text-[14px]">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2.5">
            <span className="text-[#1FBC9C] font-bold mt-0.5 shrink-0">✓</span>
            <span className={featured ? 'text-white/90' : 'text-[#162032]/85'}>{f}</span>
          </li>
        ))}
      </ul>
      <Link href={ctaHref} className={`block text-center px-5 py-3 rounded-md font-bold text-[15px] transition-colors ${featured ? 'bg-[#1FBC9C] text-[#162032] hover:bg-white' : 'bg-[#162032] text-white hover:bg-[#1FBC9C] hover:text-[#162032]'}`}>
        {cta}
      </Link>
    </div>
  )
}

function ReplaceCard({ tool, cost, outcome }: { tool: string; cost: string; outcome: string }) {
  return (
    <div className="rounded-xl border border-[#162032]/10 bg-white p-5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#162032]/50 mb-2 font-semibold">Replaces</div>
      <div className="text-[15px] font-bold mb-2">{tool}</div>
      <div className="flex flex-col text-[12px] text-[#162032]/65 gap-0.5">
        <span><strong className="text-[#162032]">{cost}</strong></span>
        <span className="text-[#162032]/55 italic">{outcome}</span>
      </div>
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-[#162032]/10 bg-white px-6 py-5 hover:border-[#1FBC9C]/50 transition-colors">
      <summary className="flex items-center justify-between cursor-pointer list-none">
        <span className="text-[16px] font-bold pr-4">{q}</span>
        <span className="text-[#1FBC9C] text-[20px] group-open:rotate-45 transition-transform shrink-0">+</span>
      </summary>
      <p className="mt-3 text-[14px] text-[#162032]/70 leading-[1.6]">{a}</p>
    </details>
  )
}
