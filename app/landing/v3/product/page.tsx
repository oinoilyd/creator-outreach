import Link from 'next/link'
import Image from 'next/image'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V3 / Product — corporate-CRM product page. Three modules, each
 * with its own narrative + screenshot. Closes with feature grid.
 */

export const metadata = {
  title: 'Creator Outreach — Product',
  description: 'A purpose-built CRM for creator partnerships. Sourcing, outreach, and analytics — every motion in one queue.',
}

export default async function V3Product() {
  const { isAuthed } = await getLandingAuthState()

  return (
    <>
      {/* Page header */}
      <section className="px-6 pt-20 md:pt-28 pb-16">
        <div className="max-w-[900px] mx-auto text-center">
          <div className="text-[12px] uppercase tracking-[0.2em] text-[#1FBC9C] mb-4 font-bold">Product</div>
          <h1 className="font-bold tracking-[-0.025em] leading-[1.0]" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}>
            Every motion in <span className="text-[#1FBC9C]">one queue.</span>
          </h1>
          <p className="mt-7 text-[18px] text-[#162032]/70 leading-[1.55]">
            Three modules — Sourcing, Outreach, Analytics — designed to fit together. Use one or all three. They share data and templates so your queue stays in one place.
          </p>
        </div>
      </section>

      {/* MODULE 1 — Sourcing */}
      <section id="sourcing" className="px-6 py-16 md:py-24 bg-[#F7FAFC] border-y border-[#162032]/10 scroll-mt-32">
        <div className="max-w-[1280px] mx-auto grid md:grid-cols-12 gap-10 md:gap-16 items-center">
          <div className="md:col-span-5">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#1FBC9C] mb-4 font-bold">01 / Sourcing</div>
            <h2 className="font-bold tracking-[-0.02em] mb-5" style={{ fontSize: 'clamp(2rem, 3.5vw, 2.75rem)' }}>
              Five platforms, one query, scored fit.
            </h2>
            <p className="text-[16px] text-[#162032]/70 leading-[1.6] mb-7">
              YouTube, Instagram, TikTok, X, and LinkedIn — searched in
              parallel. Filter by subscribers, region, last-posted, niche.
              The AI ranks every creator on fit, reach, and recency
              against criteria you describe in plain English.
            </p>
            <ul className="space-y-2.5 text-[15px] text-[#162032]/85">
              <Bullet>5-platform parallel search</Bullet>
              <Bullet>22 region filters + audience-size + recency</Bullet>
              <Bullet>AI fit scoring with editable plain-English criteria</Bullet>
              <Bullet>Real Instagram follower / post counts inline</Bullet>
            </ul>
          </div>
          <div className="md:col-span-7">
            <div className="rounded-xl overflow-hidden border border-[#162032]/10 bg-white" style={{ boxShadow: '0 30px 60px -25px rgba(31,188,156,0.20), 0 12px 24px -10px rgba(22,32,50,0.10)' }}>
              <div className="relative aspect-[16/10] bg-[#0A0E13]">
                <Image src="/screenshots/results.png" alt="Sourcing module" fill sizes="(min-width: 1280px) 700px, 100vw" className="object-cover object-top" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MODULE 2 — Outreach */}
      <section id="outreach" className="px-6 py-16 md:py-24 scroll-mt-32">
        <div className="max-w-[1280px] mx-auto grid md:grid-cols-12 gap-10 md:gap-16 items-center">
          <div className="md:col-span-7 md:order-2">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#1FBC9C] mb-4 font-bold">02 / Outreach</div>
            <h2 className="font-bold tracking-[-0.02em] mb-5" style={{ fontSize: 'clamp(2rem, 3.5vw, 2.75rem)' }}>
              The right message, channel-correct, edit-friendly.
            </h2>
            <p className="text-[16px] text-[#162032]/70 leading-[1.6] mb-7">
              One click composes the right templated message for the
              channel — DM on Instagram, Message on LinkedIn, email
              everywhere else. Auto-cadence pings you when silence hits
              your follow-up window.
            </p>
            <ul className="space-y-2.5 text-[15px] text-[#162032]/85">
              <Bullet>Channel-correct templates (DM / message / email)</Bullet>
              <Bullet>Click-to-copy templated outreach</Bullet>
              <Bullet>Auto-cadence with editable intervals</Bullet>
              <Bullet>Personalize before send</Bullet>
            </ul>
          </div>
          <div className="md:col-span-5 md:order-1">
            <div className="rounded-xl overflow-hidden border border-[#162032]/10 bg-white" style={{ boxShadow: '0 30px 60px -25px rgba(31,188,156,0.20), 0 12px 24px -10px rgba(22,32,50,0.10)' }}>
              <div className="relative aspect-[16/10] bg-[#0A0E13]">
                <Image src="/screenshots/outreach.png" alt="Outreach module" fill sizes="(min-width: 1280px) 500px, 100vw" className="object-cover object-top" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MODULE 3 — Analytics */}
      <section id="analytics" className="px-6 py-16 md:py-24 bg-[#F7FAFC] border-y border-[#162032]/10 scroll-mt-32">
        <div className="max-w-[1280px] mx-auto grid md:grid-cols-12 gap-10 md:gap-16 items-center">
          <div className="md:col-span-5">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#1FBC9C] mb-4 font-bold">03 / Analytics</div>
            <h2 className="font-bold tracking-[-0.02em] mb-5" style={{ fontSize: 'clamp(2rem, 3.5vw, 2.75rem)' }}>
              Win rate, response rate, pipeline value.
            </h2>
            <p className="text-[16px] text-[#162032]/70 leading-[1.6] mb-7">
              Out-of-the-box metrics: which channel converts, where the
              queue is leaking, what your average reply rate looks like
              by template. Customize the metric stack with no formulas.
            </p>
            <ul className="space-y-2.5 text-[15px] text-[#162032]/85">
              <Bullet>Win-rate / response-rate / pipeline-value</Bullet>
              <Bullet>Custom metrics — counts, sums, averages, percentages</Bullet>
              <Bullet>Stale-follow-up surfacing</Bullet>
              <Bullet>CSV / Excel export, anytime</Bullet>
            </ul>
          </div>
          <div className="md:col-span-7">
            <div className="rounded-xl overflow-hidden border border-[#162032]/10 bg-white" style={{ boxShadow: '0 30px 60px -25px rgba(31,188,156,0.20), 0 12px 24px -10px rgba(22,32,50,0.10)' }}>
              <div className="relative aspect-[16/10] bg-[#0A0E13]">
                <Image src="/screenshots/analytics.png" alt="Analytics module" fill sizes="(min-width: 1280px) 700px, 100vw" className="object-cover object-top" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE GRID */}
      <section className="px-6 py-20 md:py-28">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center max-w-[640px] mx-auto mb-14">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#1FBC9C] mb-4 font-bold">More features</div>
            <h2 className="font-bold tracking-[-0.025em]" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
              Everything else you might want.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureBlock title="AI fit scoring" body="Describe a great lead in plain English; we turn it into weighted criteria and re-rank every result." />
            <FeatureBlock title="Auto-cadence" body="Set the cadence you actually run — defaults to 3d, 7d, 14d, 21d, or whatever rhythm fits the deal." />
            <FeatureBlock title="CSV import + export" body="Drag in a CSV; every row, status, and note lands intact. Export back to xlsx anytime." />
            <FeatureBlock title="Privacy by design" body="Your data is yours alone. Privacy isn't a setting — it's the foundation of the platform." />
            <FeatureBlock title="Five platforms" body="One query searches YouTube, Instagram, TikTok, X, and LinkedIn in parallel." />
            <FeatureBlock title="Live IG metrics" body="Real follower + post counts inline as you flip the platform tab to Instagram." />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-20 md:pb-28">
        <div className="max-w-[900px] mx-auto rounded-2xl bg-[#162032] text-white px-8 py-12 text-center">
          <h3 className="font-bold tracking-[-0.02em] mb-4" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)' }}>
            Try it on your own outreach.
          </h3>
          <p className="text-[15px] text-white/70 mb-6">Free during beta. No card.</p>
          <Link
            href={isAuthed ? '/' : '/auth/signup'}
            className="inline-flex items-center gap-2 bg-[#1FBC9C] text-[#162032] hover:bg-white px-7 py-3.5 rounded-md font-bold text-[15px] transition-colors"
          >
            {isAuthed ? 'Open the app' : 'Try it free'} →
          </Link>
        </div>
      </section>
    </>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="text-[#1FBC9C] font-bold mt-0.5 shrink-0">✓</span>
      <span>{children}</span>
    </li>
  )
}

function FeatureBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[#162032]/10 bg-white p-6 hover:border-[#1FBC9C] transition-colors">
      <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#1FBC9C]/15 text-[#0E6E55] mb-4">
        <span className="font-bold">●</span>
      </div>
      <h3 className="text-[16px] font-bold tracking-[-0.005em] mb-2">{title}</h3>
      <p className="text-[14px] text-[#162032]/65 leading-[1.55]">{body}</p>
    </div>
  )
}
