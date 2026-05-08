import Link from 'next/link'
import Image from 'next/image'
import { OperatorConsole } from '@/components/landing/OperatorConsole'
import { LandingTopNav } from '@/components/landing/LandingTopNav'
import { ScreenshotZoom } from '@/components/landing/ScreenshotZoom'
import { PLATFORM_MARKS } from '@/components/landing/PlatformBrandMarks'
import { StatBandSpotlight } from '@/components/landing/StatBandSpotlight'
import { WhyThisExists } from '@/components/landing/WhyThisExists'
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
  title: 'Creator Outreach — Search, score, and reach out in one queue',
  description: 'Click a niche bucket, search YouTube/IG/TikTok/X/LinkedIn in parallel, score every result against criteria you wrote in plain English, and reach out from one board. Free during beta.',
}

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthed = !!user

  return (
    <main
      className="min-h-screen overflow-x-clip text-[#0F1733] dark:text-white font-[family-name:var(--font-geist-sans)] bg-[#FCFAF6] dark:bg-[#0A0E15]"
    >
      <LandingTopNav isAuthed={isAuthed} />

      {/* HERO — split layout: copy + dual CTA on left, OperatorConsole on right */}
      <section className="px-6 pt-14 md:pt-20 pb-12 md:pb-16">
        <div className="max-w-[1320px] mx-auto grid md:grid-cols-12 gap-10 md:gap-12 items-center">
          <div className="md:col-span-5">
            {/* (Changelog link removed — it read as a fake release note
                rather than something useful for a brand-new visitor.) */}
            <h1
              className="font-semibold tracking-[-0.035em] leading-[0.97]"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5rem)' }}
            >
              The modern way to source and pitch creators.
            </h1>
            <p className="mt-7 max-w-[54ch] text-[17px] md:text-[18px] text-[#0F1733]/70 dark:text-white/70 leading-[1.55]">
              Lead sourcing by occupation with an AI fit score that
              ranks every result against your criteria. Email + social
              handles inline. Templated outreach for the platform you
              actually target. Follow-up reminders so nothing slips.
              All free while in beta.
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
                className="inline-flex items-center gap-2 bg-white text-[#0F1733] hover:bg-[#0F1733] hover:text-white px-7 py-3.5 rounded-md font-semibold text-[15px] border border-[#0F1733]/15 dark:border-white/15 hover:border-[#0F1733] transition-colors"
              >
                Talk to the founder
              </a>
            </div>
            <div className="mt-10 pt-7 border-t border-[#0F1733]/10 dark:border-white/10">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[#0F1733]/45 dark:text-white/45 mb-3 font-semibold">
                Built for anyone reaching out to creators
              </div>
              {/* Persona list — single paragraph with inline middle-
                  dot separators. Items can wrap naturally; only the
                  separator span has whitespace-nowrap so a "·" never
                  ends up alone at line-start. The whole list flows as
                  natural prose at any viewport width. */}
              <p className="text-[14px] text-[#0F1733]/60 dark:text-white/60 font-medium leading-[1.7]">
                {[
                  'Podcasters',
                  'Editors',
                  'Videographers',
                  'Marketing teams',
                  'Consultants',
                  'Talent managers',
                  'Solo agencies',
                  'Solo founders',
                  'Indie operators',
                ].map((label, i, arr) => (
                  <span key={label}>
                    {label}
                    {i < arr.length - 1 && (
                      <span aria-hidden className="mx-2 text-[#0F1733]/20 dark:text-white/20">
                        ·
                      </span>
                    )}
                  </span>
                ))}
              </p>
            </div>
          </div>

          <div className="md:col-span-7">
            <ScreenshotZoom caption="Live Results table — click anywhere to zoom out, ESC to close.">
              <OperatorConsole />
            </ScreenshotZoom>
          </div>
        </div>
      </section>

      {/* SOLUTIONS — restructured 2026-05-08 to match the original
          site's 4-step funnel framing per Dylan: Results → Fit Score
          → Outreach → Follow-ups. Each tile is a real step in the
          operator's workflow. The KPI/analytics callouts that lived
          here previously moved into the Analytics product narrative
          (#analytics) where they belong. */}
      <section id="solutions" className="px-6 py-20 md:py-28 bg-white dark:bg-[#131826] border-y border-[#0F1733]/8 dark:border-white/10">
        <div className="max-w-[1280px] mx-auto">
          <div className="max-w-[680px] mb-12 md:mb-16">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">The four-step loop</div>
            <h2 className="font-semibold tracking-[-0.025em]" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              Sourcing. Fit score. Outreach. Follow-ups.
            </h2>
            <p className="mt-5 text-[17px] text-[#0F1733]/65 dark:text-white/65 leading-[1.55]">
              Find leads by occupation. Score them with a customizable
              AI fit score. Reach out from a built-in CRM with
              templated messages for the platform you target. Stay on
              cadence with follow-up reminders.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <SolutionTile
              step="01"
              icon={
                /* Search — Step 1: lead sourcing */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.5" y2="16.5" />
                </svg>
              }
              title="Lead sourcing"
              body="Search by occupation, industry, or field — fitness coaches, financial advisors, podcast hosts, anything. Each result lands with email and social handles already attached. Filter by region, audience size, and last-posted recency."
            />
            <SolutionTile
              step="02"
              icon={
                /* Target — Step 2: AI fit score */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="5" />
                  <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                </svg>
              }
              title="AI fit score"
              body="Describe your ideal creator in plain English and the AI scores every result against it. Fully customizable — any criteria you can name and measure becomes a weighted dimension. Strong / Possible / Weak labels per row, re-tunable per platform."
            />
            <SolutionTile
              step="03"
              icon={
                /* Inbox — Step 3: outreach */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M22 12h-6l-2 3h-4l-2-3H2" />
                  <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                </svg>
              }
              title="Outreach"
              body="A built-in CRM tuned for creators. One row per contact: status, channel, notes. Click an Instagram handle and an opener template lands in your clipboard."
            />
            <SolutionTile
              step="04"
              icon={
                /* Clock — Step 4: follow-ups */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 7 12 12 15.5 14" />
                </svg>
              }
              title="Follow-ups"
              body="Auto-cadence reminders so silence doesn&apos;t leak pipeline. Dedicated Follow-ups sub-tab to triage what needs a nudge today. Mark followed-up with a click and the cadence resets."
            />
          </div>
        </div>
      </section>

      {/* WHAT'S UNDER THE HOOD — AI fit score feature spotlight.
          Moved here (was after Product Narratives) so the dial reads
          as the proof point right after Solutions has named the four
          steps. Everything in this section is in the StatBandSpotlight
          client component (interactive chip-cloud → explanation
          panels). */}
      <StatBandSpotlight />

      {/* PRODUCT NARRATIVES (3 stages with screenshots).
          Each div has its own #anchor (sourcing/outreach/analytics)
          so the hamburger menu can deep-link directly to that
          stage. scroll-mt-24 leaves room for the sticky header. */}
      <section id="product" className="scroll-mt-24">
        {/* 1 — Sourcing */}
        <div id="sourcing" className="px-6 pt-20 md:pt-28 pb-12 md:pb-16 scroll-mt-24">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div>
              <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">01 / Sourcing</div>
              <h3 className="font-semibold tracking-[-0.02em] mb-5" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
                Lead sourcing by occupation, scored on fit.
              </h3>
              <p className="text-[16px] text-[#0F1733]/70 dark:text-white/70 leading-[1.6] mb-6">
                Search any occupation, industry, or field. Each result
                comes back with email + social handles attached and a
                fit score that explains itself in plain English (Strong
                / Possible / Weak), based on criteria you describe in
                a sentence.
              </p>
              <CustomizableChip />
              <ul className="space-y-2.5 text-[15px] text-[#0F1733]/85 dark:text-white/85">
                <Bullet>Customizable AI fit score — any criteria you can name and measure</Bullet>
                <Bullet>Email + LinkedIn + Instagram handles inline per result</Bullet>
                <Bullet>Filter by region, audience size, last-posted recency, follower count</Bullet>
                <Bullet>Source from YouTube, Instagram, TikTok, X, and LinkedIn — focus on the platform you actually target</Bullet>
              </ul>
            </div>
            <ScreenshotZoom caption="Results — click to zoom; ESC to close.">
              <div
                className="relative rounded-xl overflow-hidden border border-[#0F1733]/10 dark:border-white/10 bg-[#0E121C]"
                style={{
                  // Aspect ratio of the actual screenshot file so it
                  // fits without cropping. results.png is 2472×1182.
                  aspectRatio: '2472 / 1182',
                  boxShadow: '0 30px 60px -25px rgba(15,23,51,0.20)',
                }}
              >
                <Image
                  src="/screenshots/results.png"
                  alt="Sourcing view"
                  fill
                  sizes="(min-width: 1280px) 600px, 100vw"
                  className="object-contain"
                />
              </div>
            </ScreenshotZoom>
          </div>
        </div>

        {/* 2 — Outreach */}
        <div id="outreach" className="px-6 py-12 md:py-16 scroll-mt-24">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="md:order-2">
              <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">02 / Outreach</div>
              <h3 className="font-semibold tracking-[-0.02em] mb-5" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
                Every conversation in one queue.
              </h3>
              <p className="text-[16px] text-[#0F1733]/70 dark:text-white/70 leading-[1.6] mb-6">
                The Outreach board collects every creator you&apos;ve pitched —
                channel, email, product, status, medium. Status pills track
                Successful / Open / Rejected. Sub-tabs split out Favorites,
                Follow-ups, and Analytics. The whole pipeline lives in one row
                per creator.
              </p>
              <CustomizableChip />
              <ul className="space-y-2.5 text-[15px] text-[#0F1733]/85 dark:text-white/85">
                <Bullet>Customizable status pills, mediums, and pipeline stages</Bullet>
                <Bullet>Status: Successful · Open · Rejected · No Response (rename or add your own)</Bullet>
                <Bullet>Medium tracker per row (Email / LinkedIn / Other — add your own channel)</Bullet>
                <Bullet>Favorites + Follow-ups sub-tabs · reached-out indicator · product + notes per creator</Bullet>
              </ul>
            </div>
            <ScreenshotZoom className="md:order-1" caption="Outreach board — click to zoom; ESC to close.">
              <div
                className="relative rounded-xl overflow-hidden border border-[#0F1733]/10 dark:border-white/10 bg-[#0E121C]"
                style={{
                  // outreach.png is 2784×1122 — aspect 2.48
                  aspectRatio: '2784 / 1122',
                  boxShadow: '0 30px 60px -25px rgba(15,23,51,0.20)',
                }}
              >
                <Image
                  src="/screenshots/outreach.png"
                  alt="Outreach view"
                  fill
                  sizes="(min-width: 1280px) 600px, 100vw"
                  className="object-contain"
                />
              </div>
            </ScreenshotZoom>
          </div>
        </div>

        {/* 3 — Analytics */}
        <div id="analytics" className="px-6 py-12 md:py-16 scroll-mt-24">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div>
              <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">03 / Analytics</div>
              <h3 className="font-semibold tracking-[-0.02em] mb-5" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
                Win rate, response rate, pipeline value.
              </h3>
              <p className="text-[16px] text-[#0F1733]/70 dark:text-white/70 leading-[1.6] mb-6">
                Seven default KPIs across the top — In Pipeline, Reached
                Out, Response Received, Response Rate, Win Rate, Pipeline $,
                Stale Follow-ups. Plus 30+ customizable metrics you can plug
                into the dashboard. Status breakdown bar, outreach-by-medium
                split, velocity card.
              </p>
              <CustomizableChip />
              <ul className="space-y-2.5 text-[15px] text-[#0F1733]/85 dark:text-white/85">
                <Bullet>7 default KPI cards · 30+ customizable metrics — pin whichever ones matter to you</Bullet>
                <Bullet>Status breakdown bar (Successful / Open / No Response / Rejected)</Bullet>
                <Bullet>Outreach-by-medium split (Email / LinkedIn / Other)</Bullet>
                <Bullet>Velocity card tracks the last 7 days · build your own custom metric, no formulas</Bullet>
              </ul>
            </div>
            <ScreenshotZoom caption="Analytics — click to zoom; ESC to close.">
              <div
                className="relative rounded-xl overflow-hidden border border-[#0F1733]/10 dark:border-white/10 bg-[#0E121C]"
                style={{
                  // analytics.png is 2822×1088 — aspect 2.59
                  aspectRatio: '2822 / 1088',
                  boxShadow: '0 30px 60px -25px rgba(15,23,51,0.20)',
                }}
              >
                <Image
                  src="/screenshots/analytics.png"
                  alt="Analytics view"
                  fill
                  sizes="(min-width: 1280px) 600px, 100vw"
                  className="object-contain"
                />
              </div>
            </ScreenshotZoom>
          </div>
        </div>

        {/* 4 — Follow-ups */}
        <div id="followups" className="px-6 py-12 md:py-16 pb-20 md:pb-28 scroll-mt-24">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="md:order-2">
              <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">04 / Follow-ups</div>
              <h3 className="font-semibold tracking-[-0.02em] mb-5" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
                Cadenced reminders so silence doesn&apos;t leak pipeline.
              </h3>
              <p className="text-[16px] text-[#0F1733]/70 dark:text-white/70 leading-[1.6] mb-6">
                Set a reminder cadence per creator the moment you reach out.
                The Follow-ups tab surfaces every contact that&apos;s due
                today, sorted by who&apos;s gone cold longest. Mark
                followed-up with a click and the cadence resets — no spreadsheet
                of dates, no calendar manual entry.
              </p>
              <CustomizableChip />
              <ul className="space-y-2.5 text-[15px] text-[#0F1733]/85 dark:text-white/85">
                <Bullet>Customizable cadence per creator (3 / 7 / 14 / 30 days, or your own interval)</Bullet>
                <Bullet>Dedicated Follow-ups sub-tab — only what&apos;s due today / overdue</Bullet>
                <Bullet>Reset on click — marks the contact as followed-up + restarts the cadence</Bullet>
                <Bullet>Stale Follow-ups KPI in Analytics shows where pipeline is leaking</Bullet>
              </ul>
            </div>
            {/* Real followups.png screenshot, rendered at its natural
                aspect ratio (2810x1234 → 2.28) inside a dark frame
                with object-contain so nothing is distorted or
                cropped. The earlier 'looks weird' issue was a
                wrong aspect ratio. Verified pixel-correct here. */}
            <ScreenshotZoom className="md:order-1" caption="Follow-ups view — click to zoom; ESC to close.">
              <div
                className="relative rounded-xl overflow-hidden border border-[#0F1733]/10 dark:border-white/10 bg-[#0E121C]"
                style={{
                  aspectRatio: '2810 / 1234',
                  boxShadow: '0 30px 60px -25px rgba(15,23,51,0.20)',
                }}
              >
                <Image
                  src="/screenshots/followups.png"
                  alt="Follow-ups view"
                  fill
                  sizes="(min-width: 1280px) 600px, 100vw"
                  className="object-contain"
                />
              </div>
            </ScreenshotZoom>
          </div>
        </div>
      </section>

      {/* (Stat band moved up — was here, now appears between Solutions
          and Product Narratives via <StatBandSpotlight />.) */}

      {/* "WHY THIS EXISTS" — rebuilt as a graphic feature spotlight
          per Dylan ('greater bigger better graphic exciting and
          aligned/fitted'). Each card now has an inline-SVG before/
          after visual: 4 chaotic browser-tabs collapsing into one
          row, generic gauge → custom-criteria fit score, crossed-out
          CRMs → unified outreach row. Lives in the WhyThisExists
          client component (intersection-observed reveal animations). */}
      <WhyThisExists />

      {/* (Platform tiles section removed 2026-05-08 — felt redundant
          after the niche/parallel deemphasis pass; the supported
          platforms are already named in the Hero subhead and the
          Sourcing narrative.) */}

      {/* PRICING — eyebrow ("Pricing") removed; the $0 in the card
          and the headline do the labelling, no need to also chip it. */}
      <section id="pricing" className="px-6 pb-20 md:pb-28 scroll-mt-24 bg-white dark:bg-[#131826] border-y border-[#0F1733]/8 dark:border-white/10">
        <div className="max-w-[1100px] mx-auto pt-20 md:pt-28">
          <div className="text-center mb-12">
            <h2 className="font-semibold tracking-[-0.025em] mb-5" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              Free during beta.
            </h2>
            <p className="max-w-[58ch] mx-auto text-[17px] text-[#0F1733]/65 dark:text-white/65 leading-[1.55]">
              No card on file. No seat cap. The full feature set, on the house, while we&apos;re still polishing.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5 max-w-[820px] mx-auto items-stretch">
            <PricingCard
              tier="Beta"
              price="$0"
              priceSub="Free while in beta · no card · no seat cap"
              features={[
                'Lead sourcing across YouTube, Instagram, TikTok, X, LinkedIn',
                'Customizable AI fit score — any criteria you can name and measure',
                'Built-in CRM: status pills, medium tracker, follow-up cadence',
                'Templated outreach per channel + Instagram DM auto-composer',
                'Customizable analytics — 7 default KPIs, 30+ custom metrics',
                'CSV / Excel export — your data, anytime',
              ]}
              cta={isAuthed ? 'Open the app' : 'Start for free'}
              ctaHref={isAuthed ? '/' : '/auth/signup'}
              featured
            />
            <PricingCard
              tier="Coming soon"
              price="TBD"
              priceSub="For heavier users + teams"
              features={[
                'Higher search + enrichment quotas',
                'Multi-seat workspaces',
                'Bulk email enrichment via Meta Graph API',
                'Priority support',
                'Custom scoring presets shareable across teams',
              ]}
              cta="Notify me"
              ctaHref="mailto:dmeehanj@gmail.com?subject=Notify%20me%20when%20Creator%20Outreach%20Pro%20is%20ready"
            />
          </div>
        </div>
      </section>

      {/* (Roadmap moved to its own dedicated page at /roadmap and
          surfaced via the hamburger menu only — was an inline
          section here, but Dylan wanted it lifted off the landing
          flow so the page reads tighter.) */}

      {/* (Final CTA section removed 2026-05-08 — the dark
          'One query. Five platforms. One queue.' banner felt like a
          tacked-on second pricing section. The Beta pricing card
          above already carries the primary CTA.) */}

      {/* FOOTER — wordmark only (the rounded "C" tile in the nav was
          already a generic Stripe-Notion-Linear placeholder; doubling
          it in the footer made the brand read as not-yet-designed).
          Footer keeps just the wordmark with a thin terracotta
          underscore that matches the section accent. */}
      <footer className="bg-white dark:bg-[#131826] border-t border-[#0F1733]/10 dark:border-white/10 px-6 py-14">
        <div className="max-w-[1280px] mx-auto grid md:grid-cols-6 gap-8">
          <div className="md:col-span-2">
            <Link href="/landing" className="inline-block mb-4">
              <span className="font-semibold tracking-[-0.01em] text-[18px] text-[#0F1733] dark:text-white border-b-2 border-[#E85D2F] pb-0.5">
                Creator Outreach
              </span>
            </Link>
            <p className="text-[13px] text-[#0F1733]/60 dark:text-white/60 leading-[1.55] max-w-[36ch]">
              The modern way to source, score, and pitch creators. Built for the operators who actually send the messages.
            </p>
            <div className="mt-6 text-[12px] text-[#0F1733]/50 dark:text-white/50">© 2026 Creator Outreach</div>
          </div>
          <FooterCol heading="Product"   links={[['Overview','#product'],['Solutions','#solutions'],['Pricing','#pricing'],['Customers','#customers']]} />
          {/* Resources column — every entry currently says "Coming
              soon" because none of the long-form content (guides,
              playbooks, changelog) is published yet. Honest framing
              beats four mailto: links pretending to be real pages. */}
          <FooterColPlaceholder heading="Resources" labels={['Guides', 'Playbooks', 'Changelog']} />
          <FooterCol heading="Company"   links={[['About','#'],['Contact','mailto:dmeehanj@gmail.com'],['Talk to us','mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20demo']]} />
          <FooterCol heading="Legal"     links={[['Privacy','/privacy'],['Terms','/terms']]} />
        </div>
      </footer>
    </main>
  )
}

/* ─── primitives ─── */


function SolutionTile({ icon, title, body, step }: { icon: React.ReactNode; title: string; body: string; step?: string }) {
  return (
    <div className="group relative rounded-xl border border-[#0F1733]/10 dark:border-white/10 bg-white dark:bg-[#1A2034] p-6 hover:-translate-y-1 transition-transform overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(15,23,51,0.05)' }}>
      {/* Hover affordance — arrow appears top-right on hover. Different
          from the platform-tile left-stripe and the resource-card
          chevron-trail; each card type has its own hover reveal so the
          page doesn't read as one repeated -translate-y-1 lift. */}
      <span
        aria-hidden
        className="absolute top-4 right-4 text-[#E85D2F] opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="7" y1="17" x2="17" y2="7" />
          <polyline points="7 7 17 7 17 17" />
        </svg>
      </span>
      <div className="flex items-center gap-3 mb-4">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#E85D2F]/10 text-[#E85D2F] [&>svg]:w-5 [&>svg]:h-5">
          {icon}
        </span>
        {step && (
          <span className="text-[11px] uppercase tracking-[0.2em] text-[#0F1733]/40 dark:text-white/40 font-bold font-mono">
            Step {step}
          </span>
        )}
      </div>
      <h3 className="text-[18px] font-semibold tracking-[-0.01em] mb-2">{title}</h3>
      <p className="text-[14px] text-[#0F1733]/65 dark:text-white/65 leading-[1.55]">{body}</p>
    </div>
  )
}

/**
 * CustomizableChip — small "Fully customizable" pill chip used in
 * each product narrative to call out that the feature isn't fixed.
 * Sits above the bullet list so the customizability story reads at
 * a glance without burying it inside copy.
 */
function CustomizableChip() {
  return (
    <div className="inline-flex items-center gap-1.5 mb-5 px-2.5 py-1 rounded-full bg-[#E85D2F]/10 border border-[#E85D2F]/30 text-[10px] uppercase tracking-[0.18em] font-bold text-[#9C3D1F] dark:text-[#F2A261] dark:bg-[#F2A261]/10 dark:border-[#F2A261]/30">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2 L14.5 9.5 L22 12 L14.5 14.5 L12 22 L9.5 14.5 L2 12 L9.5 9.5 Z" />
      </svg>
      Fully customizable
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

function PricingCard({ tier, price, priceSub, features, cta, ctaHref, featured = false }: { tier: string; price: string; priceSub: string; features: string[]; cta: string; ctaHref: string; featured?: boolean }) {
  // flex column with the features ul flex-1 ensures the CTA button
  // sits at the bottom of every card regardless of bullet count —
  // the Beta and Coming-soon cards have different feature counts,
  // and the CTAs need to align horizontally across both.
  return (
    <div
      className={`rounded-2xl p-7 md:p-8 flex flex-col ${
        featured
          ? 'bg-[#0F1733] text-white'
          : 'bg-white dark:bg-[#131826] border border-[#0F1733]/10 dark:border-white/10'
      }`}
      style={featured ? { boxShadow: '0 30px 60px -30px rgba(15,23,51,0.4)' } : undefined}
    >
      <div className={`text-[13px] uppercase tracking-[0.18em] mb-3 font-semibold ${featured ? 'text-[#F2A261]' : 'text-[#E85D2F]'}`}>{tier}</div>
      <div className="font-semibold tracking-[-0.025em] mb-1" style={{ fontSize: 'clamp(2.25rem, 4vw, 3rem)' }}>{price}</div>
      <div className={`text-[13px] mb-6 ${featured ? 'text-white/55' : 'text-[#0F1733]/55 dark:text-white/55'}`}>{priceSub}</div>
      <ul className="space-y-2.5 mb-7 text-[14px] flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2.5">
            <span className={featured ? 'text-[#F2A261] font-bold mt-0.5 shrink-0' : 'text-[#E85D2F] font-bold mt-0.5 shrink-0'}>✓</span>
            <span className={featured ? 'text-white/90' : 'text-[#0F1733]/85 dark:text-white/85'}>{f}</span>
          </li>
        ))}
      </ul>
      <Link href={ctaHref} className={`mt-auto flex w-full items-center justify-center gap-1.5 px-5 py-3 rounded-md font-semibold text-[15px] whitespace-nowrap transition-colors ${featured ? 'bg-white text-[#0F1733] hover:bg-[#F2A261]' : 'bg-[#0F1733] text-white hover:bg-[#E85D2F]'}`}>
        {cta} <span aria-hidden>→</span>
      </Link>
    </div>
  )
}


function FooterCol({ heading, links }: { heading: string; links: [string, string][] }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#0F1733]/50 dark:text-white/50 mb-4 font-semibold">{heading}</div>
      <ul className="space-y-2">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-[13px] text-[#0F1733]/70 dark:text-white/70 hover:text-[#0F1733] transition-colors">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * FooterColPlaceholder — same visual shape as FooterCol but each
 * entry is rendered as plain text with a "Coming soon" affix instead
 * of a hyperlink. Used for Resources where nothing is published yet.
 */
function FooterColPlaceholder({ heading, labels }: { heading: string; labels: string[] }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#0F1733]/50 dark:text-white/50 mb-4 font-semibold">{heading}</div>
      <ul className="space-y-2">
        {labels.map(label => (
          <li key={label} className="text-[13px] text-[#0F1733]/55 dark:text-white/55">
            {label}
            <span className="ml-1.5 text-[11px] uppercase tracking-[0.14em] text-[#0F1733]/40 dark:text-white/40">— soon</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
