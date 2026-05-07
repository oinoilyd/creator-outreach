import Link from 'next/link'
import Image from 'next/image'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V3 / Home — Pipedrive-style corporate B2B home page.
 * Clean white substrate, lime-green accent, content-rich hero,
 * persona tiles, mid-page CTA card.
 */

export const metadata = {
  title: 'Creator Outreach — Sales CRM for creator partnerships',
  description: 'A modern CRM for sourcing and pitching creators across YouTube, Instagram, TikTok, X, and LinkedIn. Built for indie operators and growth teams.',
}

export default async function V3Home() {
  const { isAuthed } = await getLandingAuthState()

  return (
    <>
      {/* HERO */}
      <section className="px-6 pt-20 md:pt-28 pb-16 md:pb-20">
        <div className="max-w-[1280px] mx-auto grid md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1FBC9C]/10 border border-[#1FBC9C]/30 text-[12px] text-[#0E6E55] mb-7 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1FBC9C]" />
              The CRM for creator partnerships
            </div>
            <h1
              className="font-bold tracking-[-0.035em] leading-[0.97]"
              style={{ fontSize: 'clamp(2.5rem, 6.5vw, 5.75rem)' }}
            >
              Source and pitch creators{' '}
              <span className="text-[#1FBC9C]">without the spreadsheet.</span>
            </h1>
            <p className="mt-7 text-[18px] md:text-[19px] text-[#162032]/70 leading-[1.55] max-w-[58ch]">
              A purpose-built CRM for sourcing, scoring, and pitching
              creator partnerships across five platforms. Replaces a
              spreadsheet, a CRM, and a follow-up reminder — without
              the four-tab workflow.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href={isAuthed ? '/' : '/auth/signup'}
                className="inline-flex items-center gap-2 bg-[#1FBC9C] text-[#162032] hover:bg-[#19A688] px-7 py-3.5 rounded-md font-bold text-[15px] transition-colors"
              >
                {isAuthed ? 'Open the app' : 'Try it free'}
              </Link>
              <a
                href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20demo"
                className="inline-flex items-center gap-2 bg-white text-[#162032] hover:bg-[#162032] hover:text-white border border-[#162032]/15 hover:border-[#162032] px-7 py-3.5 rounded-md font-bold text-[15px] transition-colors"
              >
                Get a demo
              </a>
            </div>
            <p className="mt-5 text-[13px] text-[#162032]/55">
              Free during beta · No credit card · Cancel anytime
            </p>
          </div>

          <div className="md:col-span-5">
            <div className="rounded-2xl overflow-hidden border border-[#162032]/10 bg-white" style={{ boxShadow: '0 30px 60px -25px rgba(31,188,156,0.30), 0 12px 24px -10px rgba(22,32,50,0.12)' }}>
              <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#162032]/10 bg-[#F7FAFC]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#162032]/15" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#162032]/15" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#162032]/15" />
                <span className="ml-3 text-[11px] text-[#162032]/45 font-medium">creatoroutreach.net</span>
              </div>
              <div className="relative aspect-[16/10] bg-[#0A0E13]">
                <Image src="/screenshots/results.png" alt="Creator Outreach product" fill priority sizes="(min-width: 1280px) 600px, 100vw" className="object-cover object-top" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="bg-[#F7FAFC] border-y border-[#162032]/10">
        <div className="max-w-[1280px] mx-auto px-6 py-10">
          <div className="text-center text-[12px] uppercase tracking-[0.2em] text-[#162032]/55 mb-6 font-bold">
            Built for the people running their own outreach
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-3 text-[15px] text-[#162032]/65 font-bold">
            <span>Indie operators</span>
            <span aria-hidden className="text-[#1FBC9C]">●</span>
            <span>Solo founders</span>
            <span aria-hidden className="text-[#1FBC9C]">●</span>
            <span>Growth teams</span>
            <span aria-hidden className="text-[#1FBC9C]">●</span>
            <span>Solo agencies</span>
            <span aria-hidden className="text-[#1FBC9C]">●</span>
            <span>RevOps consultants</span>
          </div>
        </div>
      </section>

      {/* PERSONA TILES */}
      <section className="px-6 py-20 md:py-28">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center max-w-[700px] mx-auto mb-14">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#1FBC9C] mb-4 font-bold">Built for</div>
            <h2 className="font-bold tracking-[-0.025em]" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              The team running outreach.
            </h2>
            <p className="mt-5 text-[16px] text-[#162032]/65 leading-[1.55]">
              Whether you&apos;re sourcing from scratch or working a list, Creator Outreach handles it without the spreadsheet detour.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <PersonaTile
              tag="For sales"
              title="Replace the spreadsheet."
              body="Move pipeline tracking out of Sheets. Status, channel, follow-up — one row, one queue."
            />
            <PersonaTile
              tag="For growth"
              title="Run multi-channel."
              body="Five platforms in parallel. Same scoring, same templates, same queue. Stop juggling tabs."
            />
            <PersonaTile
              tag="For founders"
              title="$400/mo CRM, removed."
              body="Beta is $0 with no seat cap. Run the whole pipeline on the cheapest line item in your stack."
            />
            <PersonaTile
              tag="For agencies"
              title="Multiple pipelines."
              body="Run separate pipelines per client without per-seat fees. Export when the engagement ends."
            />
          </div>
        </div>
      </section>

      {/* MID-PAGE CTA — see product / see pricing */}
      <section className="px-6 pb-20 md:pb-28">
        <div className="max-w-[1100px] mx-auto rounded-3xl bg-[#162032] text-white px-8 py-14 md:py-16 text-center relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 60% 50% at 80% 30%, rgba(31,188,156,0.25) 0%, transparent 60%)' }}
          />
          <div className="relative">
            <h2 className="font-bold tracking-[-0.025em] mx-auto max-w-[24ch] mb-4" style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)' }}>
              The shortest path from search to signed.
            </h2>
            <p className="max-w-[58ch] mx-auto text-[16px] text-white/70 leading-[1.55] mb-8">
              See the full product, every feature, every screenshot — or jump straight to pricing.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/landing/v3/product"
                className="inline-flex items-center gap-2 bg-[#1FBC9C] text-[#162032] hover:bg-white px-7 py-3.5 rounded-md font-bold text-[15px] transition-colors"
              >
                Tour the product →
              </Link>
              <Link
                href="/landing/v3/pricing"
                className="inline-flex items-center gap-2 bg-transparent text-white hover:bg-white hover:text-[#162032] border border-white/40 hover:border-white px-7 py-3.5 rounded-md font-bold text-[15px] transition-colors"
              >
                See pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function PersonaTile({ tag, title, body }: { tag: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[#162032]/10 bg-white p-6 hover:border-[#1FBC9C] hover:-translate-y-1 transition-all">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#1FBC9C] mb-3 font-bold">{tag}</div>
      <h3 className="text-[18px] font-bold tracking-[-0.01em] mb-3">{title}</h3>
      <p className="text-[14px] text-[#162032]/65 leading-[1.55]">{body}</p>
    </div>
  )
}
