import Link from 'next/link'
import Image from 'next/image'
import { OperatorConsole } from '@/components/landing/OperatorConsole'
import { createClient } from '@/lib/supabase/server'

/**
 * /landing — production marketing site.
 *
 * Style: Apollo-style premium B2B prospecting. Cream-white substrate,
 * navy primary (#0F1733), single warm accent (terracotta #E85D2F).
 *
 * Hero centerpiece is OperatorConsole — an anime.js-driven console
 * visual that runs an end-to-end loop of the product (search query
 * types itself, creator cards cascade in with spring physics, fit-
 * score bars fill, score numbers tick up, side panel ticks live
 * counters and a rotating activity feed).
 *
 * Page structure (all single page — was previously split across V1/
 * V2/V3 variants on the redesign branch; consolidated to one
 * Apollo-style design per Dylan's "ship one variant tonight" call):
 *   1. Top nav with 5 sections + dual CTA
 *   2. Hero — split layout: text + dual CTA on left, OperatorConsole on right
 *   3. Customer-proof persona band
 *   4. Solutions tiles (4 personas)
 *   5. Three product narratives (Sourcing / Outreach / Analytics)
 *      each with screenshot + bullet list, alternating layout
 *   6. Stat band (rep-time-saved framing)
 *   7. Customer testimonial grid (metric badges + outcome)
 *   8. Platforms grid (5 supported)
 *   9. Pricing tiers
 *   10. Resources teaser
 *   11. Final CTA (dark, with gradient)
 *   12. Multi-column footer
 */

export const metadata = {
  title: 'Creator Outreach — Modern B2B prospecting for creator partnerships',
  description: 'Source, score, and pitch creators across YouTube, Instagram, TikTok, X, and LinkedIn. Built for indie operators and growth teams running their own GTM.',
}

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthed = !!user

  return (
    <main className="min-h-screen text-[#0F1733] font-[family-name:var(--font-geist-sans)]" style={{ backgroundColor: '#FCFAF6' }}>
      {/* TOP NAV */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-[#0F1733]/8">
        <div className="max-w-[1280px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <Link href="/landing" className="flex items-center gap-2.5 shrink-0">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#0F1733] text-[#F2A261] text-[14px] font-bold">C</span>
            <span className="font-semibold tracking-[-0.01em] text-[16px]">Creator Outreach</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-[14px] text-[#0F1733]/70 font-medium">
            <a href="#product"   className="hover:text-[#0F1733] transition-colors">Product</a>
            <a href="#solutions" className="hover:text-[#0F1733] transition-colors">Solutions</a>
            <a href="#customers" className="hover:text-[#0F1733] transition-colors">Customers</a>
            <a href="#pricing"   className="hover:text-[#0F1733] transition-colors">Pricing</a>
            <a href="mailto:dmeehanj@gmail.com" className="hover:text-[#0F1733] transition-colors">Resources</a>
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            {!isAuthed && (
              <Link href="/auth/signin" className="hidden sm:inline-flex text-[14px] text-[#0F1733]/70 hover:text-[#0F1733] px-3 py-2 font-medium transition-colors">
                Sign in
              </Link>
            )}
            <a
              href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20demo"
              className="hidden lg:inline-flex items-center text-[14px] text-[#0F1733] hover:text-[#E85D2F] px-3 py-2 font-medium transition-colors"
            >
              Talk to founder
            </a>
            <Link
              href={isAuthed ? '/' : '/auth/signup'}
              className="inline-flex items-center gap-1.5 bg-[#0F1733] text-white hover:bg-[#E85D2F] px-4 py-2 rounded-md text-[14px] font-semibold transition-colors"
            >
              {isAuthed ? 'Open app' : 'Start free'}
            </Link>
          </div>
        </div>
      </header>

      {/* HERO — split layout: copy + dual CTA on left, OperatorConsole on right */}
      <section className="px-6 pt-14 md:pt-20 pb-12 md:pb-16">
        <div className="max-w-[1320px] mx-auto grid md:grid-cols-12 gap-10 md:gap-12 items-center">
          <div className="md:col-span-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E85D2F]/10 border border-[#E85D2F]/20 text-[12px] text-[#9C3D1F] mb-7 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E85D2F]" />
              <span>Now live: real Instagram metrics in your queue</span>
            </div>
            <h1
              className="font-semibold tracking-[-0.035em] leading-[0.97]"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5rem)' }}
            >
              The modern way to source and pitch creators.
            </h1>
            <p className="mt-7 max-w-[52ch] text-[17px] md:text-[18px] text-[#0F1733]/70 leading-[1.55]">
              Search five platforms in one query. Score every creator in
              plain English. Pitch with the right templated message per
              channel. Track every reply in one queue.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href={isAuthed ? '/' : '/auth/signup'}
                className="inline-flex items-center gap-2 bg-[#0F1733] text-white hover:bg-[#1F2A52] px-7 py-3.5 rounded-md font-semibold text-[15px] transition-colors"
              >
                {isAuthed ? 'Open the app' : 'Start free — no card'}
                <span aria-hidden>→</span>
              </Link>
              <a
                href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20demo"
                className="inline-flex items-center gap-2 bg-white text-[#0F1733] hover:bg-[#0F1733] hover:text-white px-7 py-3.5 rounded-md font-semibold text-[15px] border border-[#0F1733]/15 hover:border-[#0F1733] transition-colors"
              >
                Talk to the founder
              </a>
            </div>
            <div className="mt-10 pt-7 border-t border-[#0F1733]/10">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[#0F1733]/45 mb-3 font-semibold">
                Built for the people running their own outreach
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] text-[#0F1733]/60 font-medium">
                <span>Indie operators</span>
                <span aria-hidden className="text-[#0F1733]/15">·</span>
                <span>Solo founders</span>
                <span aria-hidden className="text-[#0F1733]/15">·</span>
                <span>Growth teams</span>
                <span aria-hidden className="text-[#0F1733]/15">·</span>
                <span>Solo agencies</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-7">
            <OperatorConsole />
          </div>
        </div>
      </section>

      {/* SOLUTIONS — built for personas (4-up) */}
      <section id="solutions" className="px-6 py-20 md:py-28 bg-white border-y border-[#0F1733]/8">
        <div className="max-w-[1280px] mx-auto">
          <div className="max-w-[680px] mb-12 md:mb-16">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">Solutions</div>
            <h2 className="font-semibold tracking-[-0.025em]" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              One tool, every outreach motion.
            </h2>
            <p className="mt-5 text-[17px] text-[#0F1733]/65 leading-[1.55]">
              Whether you&apos;re sourcing creators from scratch, working a list of warm leads, or running a multi-channel cadence, Creator Outreach handles it without the spreadsheet detour.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <SolutionTile icon="◇" title="Sourcing teams"  body="Search five platforms in one query. AI scores every result on fit so the top of the queue is the queue you should be working." />
            <SolutionTile icon="◆" title="Solo founders"   body="Replace a spreadsheet, three browser tabs, and a CRM you couldn't justify. Run the whole pipeline from one screen." />
            <SolutionTile icon="◐" title="Growth teams"    body="Standardize templated outreach per channel. Auto-cadence handles silence. Analytics surface what's converting." />
            <SolutionTile icon="◑" title="Solo agencies"   body="Run multiple client pipelines side-by-side without per-seat CRM bills. Export anytime." />
          </div>
        </div>
      </section>

      {/* PRODUCT NARRATIVES (3 stages with screenshots) */}
      <section id="product" className="scroll-mt-24">
        {/* 1 — Sourcing */}
        <div className="px-6 pt-20 md:pt-28 pb-12 md:pb-16">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div>
              <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">01 / Sourcing</div>
              <h3 className="font-semibold tracking-[-0.02em] mb-5" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
                Five platforms, one query, scored fit.
              </h3>
              <p className="text-[16px] text-[#0F1733]/70 leading-[1.6] mb-6">
                YouTube, Instagram, TikTok, X, LinkedIn — searched in
                parallel. Filter by subscribers, region, last-posted, niche.
                The AI ranks every creator on fit, reach, and recency
                against criteria you describe in plain English.
              </p>
              {/* Bullets aligned with what's literally visible in
                  results.png: the table columns (Channel / Fit Score /
                  Avg Views / Subscribers / Last Video / Email /
                  LinkedIn / Instagram). Earlier "Real IG follower
                  counts inline" bullet was removed because that data
                  doesn't appear in this screenshot. */}
              <ul className="space-y-2.5 text-[15px] text-[#0F1733]/85">
                <Bullet>One query → results across all five platforms</Bullet>
                <Bullet>Fit score with plain-English label per row (Strong / Possible / Weak)</Bullet>
                <Bullet>Email + LinkedIn + Instagram links inline per creator</Bullet>
                <Bullet>22 region filters + audience-size + last-posted recency</Bullet>
              </ul>
            </div>
            <div className="rounded-xl overflow-hidden border border-[#0F1733]/10 bg-white" style={{ boxShadow: '0 30px 60px -25px rgba(15,23,51,0.20)' }}>
              <div className="relative aspect-[16/10] bg-[#0A0E13]">
                <Image src="/screenshots/results.png" alt="Sourcing view" fill sizes="(min-width: 1280px) 600px, 100vw" className="object-cover object-top" />
              </div>
            </div>
          </div>
        </div>

        {/* 2 — Outreach */}
        <div className="px-6 py-12 md:py-16">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="md:order-2">
              <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">02 / Outreach</div>
              <h3 className="font-semibold tracking-[-0.02em] mb-5" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
                Every conversation in one queue.
              </h3>
              <p className="text-[16px] text-[#0F1733]/70 leading-[1.6] mb-6">
                The Outreach board collects every creator you&apos;ve pitched —
                channel, email, product, status, medium. Status pills track
                Successful / Open / Rejected. Sub-tabs split out Favorites,
                Follow-ups, and Analytics. The whole pipeline lives in one row
                per creator.
              </p>
              {/* Bullets aligned with what outreach.png literally shows:
                  the CRM-style outreach board (status pills, medium
                  selector, reached-out indicators, sub-tabs). */}
              <ul className="space-y-2.5 text-[15px] text-[#0F1733]/85">
                <Bullet>Status pills: Successful · Open · Rejected · No Response</Bullet>
                <Bullet>Medium tracker per row (Email / LinkedIn / Other)</Bullet>
                <Bullet>Favorites + Follow-ups sub-tabs for fast triage</Bullet>
                <Bullet>Reached-out indicator + product + notes per creator</Bullet>
              </ul>
            </div>
            <div className="md:order-1 rounded-xl overflow-hidden border border-[#0F1733]/10 bg-white" style={{ boxShadow: '0 30px 60px -25px rgba(15,23,51,0.20)' }}>
              <div className="relative aspect-[16/10] bg-[#0A0E13]">
                <Image src="/screenshots/outreach.png" alt="Outreach view" fill sizes="(min-width: 1280px) 600px, 100vw" className="object-cover object-top" />
              </div>
            </div>
          </div>
        </div>

        {/* 3 — Analytics */}
        <div className="px-6 py-12 md:py-16 pb-20 md:pb-28">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div>
              <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">03 / Analytics</div>
              <h3 className="font-semibold tracking-[-0.02em] mb-5" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
                Win rate, response rate, pipeline value.
              </h3>
              <p className="text-[16px] text-[#0F1733]/70 leading-[1.6] mb-6">
                Out-of-the-box: 7 KPIs across the top — In Pipeline, Reached
                Out, Response Received, Response Rate, Win Rate, Pipeline $,
                Stale Follow-ups. Status breakdown bar shows where the queue
                is sitting. Velocity card tracks the last 7 days.
              </p>
              {/* Bullets aligned with what analytics.png literally shows. */}
              <ul className="space-y-2.5 text-[15px] text-[#0F1733]/85">
                <Bullet>7 KPI cards: In Pipeline · Reached · Responses · Rate · Win % · Pipeline $ · Stale</Bullet>
                <Bullet>Status breakdown bar (Successful / Open / No Response / Rejected)</Bullet>
                <Bullet>Outreach-by-medium split (Email / LinkedIn / Other)</Bullet>
                <Bullet>Customize the metric stack — no formulas</Bullet>
              </ul>
            </div>
            <div className="rounded-xl overflow-hidden border border-[#0F1733]/10 bg-white" style={{ boxShadow: '0 30px 60px -25px rgba(15,23,51,0.20)' }}>
              <div className="relative aspect-[16/10] bg-[#0A0E13]">
                <Image src="/screenshots/analytics.png" alt="Analytics view" fill sizes="(min-width: 1280px) 600px, 100vw" className="object-cover object-top" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STAT BAND */}
      <section className="px-6 pb-20 md:pb-28">
        <div className="max-w-[1280px] mx-auto bg-[#0F1733] rounded-3xl px-8 py-14 md:py-20 text-white">
          <div className="text-center max-w-[680px] mx-auto mb-12">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#F2A261] mb-3 font-semibold">By the numbers</div>
            <h2 className="font-semibold tracking-[-0.02em] leading-[1.1]" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>
              Replace a spreadsheet, a CRM, three tabs, and a follow-up reminder.
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-6">
            <Stat n="5" label="platforms searched in parallel" />
            <Stat n="~30s" label="search → scored result list" />
            <Stat n="$0" label="while in beta · no card" />
            <Stat n="~8h" label="estimated hours/week per rep" />
          </div>
        </div>
      </section>

      {/* CUSTOMERS */}
      <section id="customers" className="px-6 pb-20 md:pb-28 scroll-mt-24 bg-white border-y border-[#0F1733]/8">
        <div className="max-w-[1280px] mx-auto pt-20 md:pt-28">
          <div className="text-center mb-12 md:mb-16">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">Customers</div>
            <h2 className="font-semibold tracking-[-0.025em] mx-auto max-w-[24ch]" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              The folks who actually run their own outreach.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            <Testimonial
              quote="The spreadsheet was a graveyard. The CRM was a museum. This is the only tool I&apos;ve used that didn&apos;t make me wish I was using something else."
              attribution="Indie operator"
              context="Fishing-conditions product · Solo GTM"
              outcome="Replaced 3 tabs + Notion"
            />
            <Testimonial
              quote="Two CRMs were too expensive for one person and didn&apos;t know what an Instagram handle was. This does."
              attribution="Solo founder"
              context="Content-led GTM · DTC"
              outcome="$0 vs. $400/mo CRM"
            />
            <Testimonial
              quote="The auto-cadence alone is worth it. I stopped forgetting follow-ups that were sitting on day-7."
              attribution="Growth lead"
              context="Pre-seed B2B · Two-person team"
              outcome="3× more follow-ups sent"
            />
          </div>
        </div>
      </section>

      {/* PLATFORMS */}
      <section className="px-6 py-20 md:py-28">
        <div className="max-w-[1280px] mx-auto text-center">
          <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">Platforms supported</div>
          <h2 className="font-semibold tracking-[-0.025em] mb-5" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>
            Five platforms, in one queue.
          </h2>
          <p className="max-w-[58ch] mx-auto text-[16px] text-[#0F1733]/65 leading-[1.6] mb-12">
            All five major creator platforms are searched in parallel and ranked against the same criteria. No tab-juggling.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 max-w-[900px] mx-auto">
            {[
              { name: 'YouTube',  bg: '#FFE5E5', dot: '#FF0000' },
              { name: 'Instagram',bg: '#FFE9F0', dot: '#E85D2F' },
              { name: 'TikTok',   bg: '#EFEFEF', dot: '#1A1F2E' },
              { name: 'X',        bg: '#EFEFEF', dot: '#0F1733' },
              { name: 'LinkedIn', bg: '#E5F0FA', dot: '#1B6FB5' },
            ].map(p => (
              <div key={p.name} className="rounded-xl border border-[#0F1733]/10 bg-white px-4 py-6 hover:-translate-y-1 transition-transform" style={{ boxShadow: '0 1px 3px rgba(15,23,51,0.05)' }}>
                <div className="w-10 h-10 mx-auto rounded-lg mb-3 flex items-center justify-center" style={{ backgroundColor: p.bg }}>
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.dot }} />
                </div>
                <div className="text-[14px] font-semibold">{p.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="px-6 pb-20 md:pb-28 scroll-mt-24 bg-white border-y border-[#0F1733]/8">
        <div className="max-w-[1100px] mx-auto pt-20 md:pt-28">
          <div className="text-center mb-12">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">Pricing</div>
            <h2 className="font-semibold tracking-[-0.025em] mb-5" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              Free during beta. Grandfathered when it isn&apos;t.
            </h2>
            <p className="max-w-[58ch] mx-auto text-[17px] text-[#0F1733]/65 leading-[1.55]">
              No card on file, no seat cap, no annual upsell. Beta users will be looked after when paid plans launch.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5 max-w-[820px] mx-auto">
            <PricingCard
              tier="Beta"
              price="$0"
              priceSub="Free while in beta"
              features={[
                'Five-platform search + AI scoring',
                'Templated outreach per channel',
                'Auto-cadence follow-ups',
                'Real Instagram metrics in queue',
                'CSV / Excel export anytime',
              ]}
              cta={isAuthed ? 'Open the app' : 'Start for free'}
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
                'Beta users grandfathered',
              ]}
              cta="Notify me"
              ctaHref="mailto:dmeehanj@gmail.com?subject=Notify%20me%20when%20Creator%20Outreach%20Pro%20is%20ready"
            />
          </div>
        </div>
      </section>

      {/* RESOURCES */}
      <section className="px-6 py-20 md:py-28">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-3 font-semibold">Resources</div>
              <h2 className="font-semibold tracking-[-0.025em]" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>
                Notes from one operator to another.
              </h2>
            </div>
            <a href="mailto:dmeehanj@gmail.com" className="text-[14px] font-semibold text-[#E85D2F] hover:underline">
              View all →
            </a>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <ResourceCard tag="GUIDE"     title="The 4-step outreach methodology"   body="Search → Score → Pitch → Track. The minimum viable creator-outreach loop and how to run it without a CRM." />
            <ResourceCard tag="POST"      title="Why the spreadsheet is a graveyard" body="Specific failure modes I hit running a 73-creator pipeline by hand, and how the tool replaces each one." />
            <ResourceCard tag="PLAYBOOK"  title="Per-channel template anatomy"       body="What an Instagram DM, a LinkedIn message, and a creator email each need to feel different and still convert." />
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-6 pb-20 md:pb-28">
        <div className="max-w-[1100px] mx-auto rounded-3xl bg-[#0F1733] text-white px-8 py-14 md:py-20 text-center relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 60% 50% at 80% 30%, rgba(232,93,47,0.30) 0%, transparent 60%)' }}
          />
          <div className="relative">
            <h2 className="font-semibold tracking-[-0.025em] mx-auto max-w-[24ch] mb-6" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              Stop running outreach in <span className="text-[#F2A261]">spreadsheets.</span>
            </h2>
            <p className="max-w-[52ch] mx-auto text-[16px] text-white/70 leading-[1.55] mb-9">
              Free while in beta. No card. Built by one operator who got sick of the spreadsheet.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href={isAuthed ? '/' : '/auth/signup'}
                className="inline-flex items-center gap-2 bg-white text-[#0F1733] hover:bg-[#F2A261] px-7 py-3.5 rounded-md font-semibold text-[15px] transition-colors"
              >
                {isAuthed ? 'Open the app' : 'Start for free'}
                <span aria-hidden>→</span>
              </Link>
              <a
                href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20demo"
                className="inline-flex items-center gap-2 border border-white/30 hover:border-white px-7 py-3.5 rounded-md font-semibold text-[15px] transition-colors"
              >
                Talk to founder
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-[#0F1733]/10 px-6 py-14">
        <div className="max-w-[1280px] mx-auto grid md:grid-cols-6 gap-8">
          <div className="md:col-span-2">
            <Link href="/landing" className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#0F1733] text-[#F2A261] text-[14px] font-bold">C</span>
              <span className="font-semibold tracking-tight text-[16px]">Creator Outreach</span>
            </Link>
            <p className="text-[13px] text-[#0F1733]/60 leading-[1.55] max-w-[36ch]">
              The modern way to source, score, and pitch creators. Built for the operators who actually send the messages.
            </p>
            <div className="mt-6 text-[12px] text-[#0F1733]/50">© 2026 Creator Outreach</div>
          </div>
          <FooterCol heading="Product"   links={[['Overview','#product'],['Solutions','#solutions'],['Pricing','#pricing'],['Customers','#customers']]} />
          <FooterCol heading="Resources" links={[['Guides','mailto:dmeehanj@gmail.com'],['Playbooks','mailto:dmeehanj@gmail.com'],['Changelog','mailto:dmeehanj@gmail.com']]} />
          <FooterCol heading="Company"   links={[['About','#'],['Contact','mailto:dmeehanj@gmail.com'],['Talk to us','mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20demo']]} />
          <FooterCol heading="Legal"     links={[['Privacy','/privacy'],['Terms','/terms']]} />
        </div>
      </footer>
    </main>
  )
}

/* ─── primitives ─── */

function SolutionTile({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[#0F1733]/10 bg-white p-6 hover:-translate-y-1 transition-transform" style={{ boxShadow: '0 1px 3px rgba(15,23,51,0.05)' }}>
      <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#E85D2F]/10 text-[#E85D2F] text-[18px] mb-4">{icon}</span>
      <h3 className="text-[18px] font-semibold tracking-[-0.01em] mb-2">{title}</h3>
      <p className="text-[14px] text-[#0F1733]/65 leading-[1.55]">{body}</p>
    </div>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="text-[#E85D2F] font-bold mt-0.5 shrink-0">✓</span>
      <span>{children}</span>
    </li>
  )
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-semibold tracking-[-0.025em] text-white mb-1.5" style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)' }}>{n}</div>
      <div className="text-[13px] text-white/60 leading-[1.4]">{label}</div>
    </div>
  )
}

function Testimonial({ quote, attribution, context, outcome }: { quote: string; attribution: string; context: string; outcome: string }) {
  return (
    <figure className="rounded-xl border border-[#0F1733]/10 bg-white p-6 md:p-7 flex flex-col">
      <span className="text-[#E85D2F] text-[28px] mb-3 leading-none">“</span>
      <blockquote className="text-[15px] md:text-[16px] text-[#0F1733]/85 leading-[1.55] mb-6 flex-1" dangerouslySetInnerHTML={{ __html: quote }} />
      <div className="border-t border-[#0F1733]/10 pt-4">
        <div className="text-[14px] font-semibold mb-1">{attribution}</div>
        <div className="text-[12px] text-[#0F1733]/55 mb-2">{context}</div>
        <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-[#E85D2F] font-semibold">→ {outcome}</div>
      </div>
    </figure>
  )
}

function PricingCard({ tier, price, priceSub, features, cta, ctaHref, featured = false }: { tier: string; price: string; priceSub: string; features: string[]; cta: string; ctaHref: string; featured?: boolean }) {
  return (
    <div className={`rounded-2xl p-7 md:p-8 ${featured ? 'bg-[#0F1733] text-white' : 'bg-white border border-[#0F1733]/10'}`} style={featured ? { boxShadow: '0 30px 60px -30px rgba(15,23,51,0.4)' } : undefined}>
      <div className={`text-[13px] uppercase tracking-[0.18em] mb-3 font-semibold ${featured ? 'text-[#F2A261]' : 'text-[#E85D2F]'}`}>{tier}</div>
      <div className="font-semibold tracking-[-0.025em] mb-1" style={{ fontSize: 'clamp(2.25rem, 4vw, 3rem)' }}>{price}</div>
      <div className={`text-[13px] mb-6 ${featured ? 'text-white/55' : 'text-[#0F1733]/55'}`}>{priceSub}</div>
      <ul className="space-y-2.5 mb-7 text-[14px]">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2.5">
            <span className={featured ? 'text-[#F2A261] font-bold mt-0.5 shrink-0' : 'text-[#E85D2F] font-bold mt-0.5 shrink-0'}>✓</span>
            <span className={featured ? 'text-white/90' : 'text-[#0F1733]/85'}>{f}</span>
          </li>
        ))}
      </ul>
      <Link href={ctaHref} className={`block text-center px-5 py-3 rounded-md font-semibold text-[15px] transition-colors ${featured ? 'bg-white text-[#0F1733] hover:bg-[#F2A261]' : 'bg-[#0F1733] text-white hover:bg-[#E85D2F]'}`}>
        {cta} <span aria-hidden>→</span>
      </Link>
    </div>
  )
}

function ResourceCard({ tag, title, body }: { tag: string; title: string; body: string }) {
  return (
    <article className="rounded-xl border border-[#0F1733]/10 bg-white p-6 hover:-translate-y-1 transition-transform" style={{ boxShadow: '0 1px 3px rgba(15,23,51,0.05)' }}>
      <div className="text-[10px] uppercase tracking-[0.22em] text-[#E85D2F] font-semibold mb-3">{tag}</div>
      <h3 className="text-[18px] font-semibold tracking-[-0.01em] mb-2.5">{title}</h3>
      <p className="text-[14px] text-[#0F1733]/65 leading-[1.55]">{body}</p>
    </article>
  )
}

function FooterCol({ heading, links }: { heading: string; links: [string, string][] }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#0F1733]/50 mb-4 font-semibold">{heading}</div>
      <ul className="space-y-2">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-[13px] text-[#0F1733]/70 hover:text-[#0F1733] transition-colors">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
