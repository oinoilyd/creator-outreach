import Link from 'next/link'
import Image from 'next/image'
import { OperatorConsole } from '@/components/landing/OperatorConsole'
import { LandingTopNav } from '@/components/landing/LandingTopNav'
import { ScreenshotZoom } from '@/components/landing/ScreenshotZoom'
import { PLATFORM_MARKS } from '@/components/landing/PlatformBrandMarks'
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
  title: 'Creator Outreach — One queue for every kind of creator outreach',
  description: 'Source, score, and pitch creators across YouTube, Instagram, TikTok, X, and LinkedIn. Built for anyone running their own creator outreach — indie operators, podcasters, editors, videographers, agencies, growth + marketing teams, talent managers, consultants.',
}

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthed = !!user

  return (
    <main
      className="min-h-screen text-[#0F1733] dark:text-white font-[family-name:var(--font-geist-sans)] bg-[#FCFAF6] dark:bg-[#0A0E15]"
    >
      <LandingTopNav isAuthed={isAuthed} />

      {/* HERO — split layout: copy + dual CTA on left, OperatorConsole on right */}
      <section className="px-6 pt-14 md:pt-20 pb-12 md:pb-16">
        <div className="max-w-[1320px] mx-auto grid md:grid-cols-12 gap-10 md:gap-12 items-center">
          <div className="md:col-span-5">
            {/* Changelog text link (replaces template-y pill chip).
                Reads as a real release note, not a marketing badge. */}
            <a
              href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20changelog"
              className="inline-flex items-center gap-2 mb-7 text-[13px] text-[#0F1733]/55 dark:text-white/55 hover:text-[#E85D2F] dark:hover:text-[#F2A261] transition-colors"
            >
              <span className="text-[#0F1733]/35 dark:text-white/35 font-mono tabular-nums">
                v0.4 · May 7
              </span>
              <span className="text-[#0F1733]/20 dark:text-white/20">—</span>
              <span className="underline underline-offset-4 decoration-[#0F1733]/20 dark:decoration-white/20 hover:decoration-[#E85D2F]/60">
                real Instagram follower counts inline in the queue
              </span>
              <span aria-hidden>→</span>
            </a>
            <h1
              className="font-semibold tracking-[-0.035em] leading-[0.97]"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5rem)' }}
            >
              The modern way to source and pitch creators.
            </h1>
            <p className="mt-7 max-w-[52ch] text-[17px] md:text-[18px] text-[#0F1733]/70 dark:text-white/70 leading-[1.55]">
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
                className="inline-flex items-center gap-2 bg-white text-[#0F1733] hover:bg-[#0F1733] hover:text-white px-7 py-3.5 rounded-md font-semibold text-[15px] border border-[#0F1733]/15 dark:border-white/15 hover:border-[#0F1733] transition-colors"
              >
                Talk to the founder
              </a>
            </div>
            <div className="mt-10 pt-7 border-t border-[#0F1733]/10 dark:border-white/10">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[#0F1733]/45 dark:text-white/45 mb-3 font-semibold">
                Built for anyone reaching out to creators
              </div>
              {/* Broadened persona list — was originally 4 GTM-flavored
                  roles (Indie operators / Solo founders / Growth teams
                  / Solo agencies). Real audience is wider: editors,
                  videographers, podcasters, talent managers, marketing
                  teams, consultants, etc. The list now reflects that. */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-[#0F1733]/60 dark:text-white/60 font-medium">
                <span>Indie operators</span>
                <span aria-hidden className="text-[#0F1733]/15 dark:text-white/20">·</span>
                <span>Solo founders</span>
                <span aria-hidden className="text-[#0F1733]/15 dark:text-white/20">·</span>
                <span>Growth + marketing teams</span>
                <span aria-hidden className="text-[#0F1733]/15 dark:text-white/20">·</span>
                <span>Editors</span>
                <span aria-hidden className="text-[#0F1733]/15 dark:text-white/20">·</span>
                <span>Videographers</span>
                <span aria-hidden className="text-[#0F1733]/15 dark:text-white/20">·</span>
                <span>Podcasters</span>
                <span aria-hidden className="text-[#0F1733]/15 dark:text-white/20">·</span>
                <span>Consultants</span>
                <span aria-hidden className="text-[#0F1733]/15 dark:text-white/20">·</span>
                <span>Solo agencies</span>
                <span aria-hidden className="text-[#0F1733]/15 dark:text-white/20">·</span>
                <span>Talent managers</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-7">
            <ScreenshotZoom caption="Live Results table — click anywhere to zoom out, ESC to close.">
              <OperatorConsole />
            </ScreenshotZoom>
          </div>
        </div>
      </section>

      {/* SOLUTIONS — broadened beyond just GTM teams. Reframed by USE CASE
          so editors / videographers / podcasters / talent managers see
          themselves in the tiles, not just sales/growth roles. */}
      <section id="solutions" className="px-6 py-20 md:py-28 bg-white dark:bg-[#131826] border-y border-[#0F1733]/8 dark:border-white/10">
        <div className="max-w-[1280px] mx-auto">
          <div className="max-w-[680px] mb-12 md:mb-16">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">Solutions</div>
            <h2 className="font-semibold tracking-[-0.025em]" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              One queue, every kind of creator outreach.
            </h2>
            <p className="mt-5 text-[17px] text-[#0F1733]/65 dark:text-white/65 leading-[1.55]">
              Sponsorships, podcast booking, editorial sourcing, talent
              recruiting, brand partnerships — all the motions look
              the same: find creators that fit, pitch with the right
              message per channel, track every reply. One tool runs
              the whole pipeline.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <SolutionTile
              icon={
                /* Megaphone — sponsorship/brand outreach */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z" />
                  <path d="M16 8a4 4 0 0 1 0 8" />
                  <path d="M19 5a8 8 0 0 1 0 14" />
                </svg>
              }
              title="Brand + sponsorship outreach"
              body="Source creators for sponsorships, partnerships, and ambassador programs. Score by fit + reach + recency. Pitch with templated messages per channel."
            />
            <SolutionTile
              icon={
                /* Microphone — editorial / podcast booking */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="8" y1="22" x2="16" y2="22" />
                </svg>
              }
              title="Editorial + podcast booking"
              body="Find sources, contributors, and guests across YouTube, Instagram, TikTok, X, LinkedIn. One queue replaces a spreadsheet, three tabs, and a Notion page."
            />
            <SolutionTile
              icon={
                /* Trending-up — growth / marketing */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="3 17 9 11 13 15 21 7" />
                  <polyline points="14 7 21 7 21 14" />
                </svg>
              }
              title="Growth + marketing teams"
              body="Standardize templated outreach per channel. Auto-cadence handles silence. Analytics surface what&apos;s converting and where the queue is leaking."
            />
            <SolutionTile
              icon={
                /* Briefcase — agencies / consultants */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="2.5" y="7" width="19" height="13" rx="2" />
                  <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                  <line x1="2.5" y1="13" x2="21.5" y2="13" />
                </svg>
              }
              title="Agencies + consultants"
              body="Run multiple client pipelines side-by-side without per-seat CRM bills. Export when the engagement ends — your data, always."
            />
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
              <p className="text-[16px] text-[#0F1733]/70 dark:text-white/70 leading-[1.6] mb-6">
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
              <ul className="space-y-2.5 text-[15px] text-[#0F1733]/85 dark:text-white/85">
                <Bullet>One query → results across all five platforms</Bullet>
                <Bullet>Fit score with plain-English label per row (Strong / Possible / Weak)</Bullet>
                <Bullet>Email + LinkedIn + Instagram links inline per creator</Bullet>
                <Bullet>22 region filters + audience-size + last-posted recency</Bullet>
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
        <div className="px-6 py-12 md:py-16">
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
              {/* Bullets aligned with what outreach.png literally shows:
                  the CRM-style outreach board (status pills, medium
                  selector, reached-out indicators, sub-tabs). */}
              <ul className="space-y-2.5 text-[15px] text-[#0F1733]/85 dark:text-white/85">
                <Bullet>Status pills: Successful · Open · Rejected · No Response</Bullet>
                <Bullet>Medium tracker per row (Email / LinkedIn / Other)</Bullet>
                <Bullet>Favorites + Follow-ups sub-tabs for fast triage</Bullet>
                <Bullet>Reached-out indicator + product + notes per creator</Bullet>
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
        <div className="px-6 py-12 md:py-16 pb-20 md:pb-28">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div>
              <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">03 / Analytics</div>
              <h3 className="font-semibold tracking-[-0.02em] mb-5" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
                Win rate, response rate, pipeline value.
              </h3>
              <p className="text-[16px] text-[#0F1733]/70 dark:text-white/70 leading-[1.6] mb-6">
                Out-of-the-box: 7 KPIs across the top — In Pipeline, Reached
                Out, Response Received, Response Rate, Win Rate, Pipeline $,
                Stale Follow-ups. Status breakdown bar shows where the queue
                is sitting. Velocity card tracks the last 7 days.
              </p>
              {/* Bullets aligned with what analytics.png literally shows. */}
              <ul className="space-y-2.5 text-[15px] text-[#0F1733]/85 dark:text-white/85">
                <Bullet>7 KPI cards: In Pipeline · Reached · Responses · Rate · Win % · Pipeline $ · Stale</Bullet>
                <Bullet>Status breakdown bar (Successful / Open / No Response / Rejected)</Bullet>
                <Bullet>Outreach-by-medium split (Email / LinkedIn / Other)</Bullet>
                <Bullet>Customize the metric stack — no formulas</Bullet>
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
      <section id="customers" className="px-6 pb-20 md:pb-28 scroll-mt-24 bg-white dark:bg-[#131826] border-y border-[#0F1733]/8 dark:border-white/10">
        <div className="max-w-[1280px] mx-auto pt-20 md:pt-28">
          <div className="text-center mb-12 md:mb-16">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">Customers</div>
            <h2 className="font-semibold tracking-[-0.025em] mx-auto max-w-[24ch]" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              The folks who actually run their own outreach.
            </h2>
          </div>
          {/* Testimonial cards reworked as editorial pull-quotes —
              hairline rule between quote and byline, no border (vs the
              card-y SaaS pattern), avatar disc with initials (no fake
              stock photos), and a small "Beta" chip so we're honest
              that these are early-access users, not verified ARR
              customers. Voice rewritten to feel lived-in: specific
              tools they came from, specific weird workflow detail,
              variation in tone (self-deprecating / numbers / blunt). */}
          <div className="grid md:grid-cols-3 gap-x-10 md:gap-x-14 gap-y-12 max-w-[1180px] mx-auto">
            <Testimonial
              quote="I had four tabs open just to source one guest — YouTube to find someone, LinkedIn to find their work email, Twitter to check if they were still active, then a sheet to remember who I&apos;d already messaged. This collapses that into one row. Got a Saturday morning back."
              name="Marisa H."
              role="Newsletter operator"
              context="Weekly fishing-conditions newsletter · 9k subs"
              initials="MH"
              avatarColor="#E85D2F"
            />
            <Testimonial
              quote="I was averaging 3 booked guests off ~30 outreach attempts a week. Six weeks in I&apos;m at 9 booked off ~25. The scoring isn&apos;t magic — pre-sorting by who actually engages back is what saves me from chasing dead ends."
              name="Jonas R."
              role="Solo podcast producer"
              context="Long-form weekly show · 40 episodes shipped"
              initials="JR"
              avatarColor="#1B6FB5"
            />
            <Testimonial
              quote="HubSpot wanted $400/month and didn&apos;t know what an Instagram handle was. The two influencer CRMs I tried were $300+ and gated their search behind a sales call. This is free and I shipped my first client campaign two days after signup."
              name="Priya S."
              role="Solo influencer-agency owner"
              context="Micro-influencer campaigns · 4 active clients"
              initials="PS"
              avatarColor="#7B2DBE"
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
          <p className="max-w-[58ch] mx-auto text-[16px] text-[#0F1733]/65 dark:text-white/65 leading-[1.6] mb-12">
            All five major creator platforms are searched in parallel and ranked against the same criteria. No tab-juggling.
          </p>
          {/* Platform tiles — actual brand glyphs (YouTube/IG/TikTok/X/
              LinkedIn). Hovering raises the tile and reveals an
              accent stripe on the left edge so the hover state is a
              real affordance, not a generic 4px lift. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 max-w-[900px] mx-auto">
            {PLATFORM_MARKS.map(({ name, Glyph, accent }) => (
              <div
                key={name}
                className="group relative rounded-xl border border-[#0F1733]/10 dark:border-white/10 bg-white dark:bg-[#1A2034] px-4 py-7 hover:-translate-y-1 transition-transform overflow-hidden"
                style={{ boxShadow: '0 1px 3px rgba(15,23,51,0.05)' }}
              >
                {/* Left accent stripe — fades in on hover, colored to the
                    platform's brand accent. Subtle but reads as a designed
                    state, not a default hover lift. */}
                <span
                  aria-hidden
                  className="absolute inset-y-3 left-0 w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: accent }}
                />
                <div className="flex flex-col items-center justify-center gap-3">
                  {/* Dark-mode legibility: X's currentColor glyph reads
                      black-on-dark — flip it to white in dark mode. */}
                  <Glyph
                    size={32}
                    className={
                      name === 'X' || name === 'TikTok'
                        ? 'text-[#0F1733] dark:text-white'
                        : ''
                    }
                  />
                  <div className="text-[14px] font-semibold">{name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="px-6 pb-20 md:pb-28 scroll-mt-24 bg-white dark:bg-[#131826] border-y border-[#0F1733]/8 dark:border-white/10">
        <div className="max-w-[1100px] mx-auto pt-20 md:pt-28">
          <div className="text-center mb-12">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">Pricing</div>
            <h2 className="font-semibold tracking-[-0.025em] mb-5" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              Free during beta. Grandfathered when it isn&apos;t.
            </h2>
            <p className="max-w-[58ch] mx-auto text-[17px] text-[#0F1733]/65 dark:text-white/65 leading-[1.55]">
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
            <h2 className="font-semibold tracking-[-0.025em] mx-auto max-w-[26ch] mb-6" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              One query. Five platforms. <span className="text-[#F2A261]">One queue.</span>
            </h2>
            <p className="max-w-[52ch] mx-auto text-[16px] text-white/70 leading-[1.55] mb-9">
              Free while in beta. No card on file, no seat cap. The outreach work is the hard part — the tool shouldn&apos;t be.
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
      <footer className="bg-white dark:bg-[#131826] border-t border-[#0F1733]/10 dark:border-white/10 px-6 py-14">
        <div className="max-w-[1280px] mx-auto grid md:grid-cols-6 gap-8">
          <div className="md:col-span-2">
            <Link href="/landing" className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#0F1733] text-[#F2A261] text-[14px] font-bold">C</span>
              <span className="font-semibold tracking-tight text-[16px]">Creator Outreach</span>
            </Link>
            <p className="text-[13px] text-[#0F1733]/60 dark:text-white/60 leading-[1.55] max-w-[36ch]">
              The modern way to source, score, and pitch creators. Built for the operators who actually send the messages.
            </p>
            <div className="mt-6 text-[12px] text-[#0F1733]/50 dark:text-white/50">© 2026 Creator Outreach</div>
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

function SolutionTile({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[#0F1733]/10 dark:border-white/10 bg-white dark:bg-[#1A2034] p-6 hover:-translate-y-1 transition-transform" style={{ boxShadow: '0 1px 3px rgba(15,23,51,0.05)' }}>
      <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#E85D2F]/10 text-[#E85D2F] mb-4 [&>svg]:w-5 [&>svg]:h-5">
        {icon}
      </span>
      <h3 className="text-[18px] font-semibold tracking-[-0.01em] mb-2">{title}</h3>
      <p className="text-[14px] text-[#0F1733]/65 dark:text-white/65 leading-[1.55]">{body}</p>
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

function Testimonial({
  quote,
  name,
  role,
  context,
  initials,
  avatarColor,
}: {
  quote: string
  /** Real-feeling first name + last initial (e.g. "Marisa H.") */
  name: string
  /** Job/persona label (e.g. "Newsletter operator") */
  role: string
  /** One-line lived-in detail (show name, niche, etc.) */
  context: string
  /** 1–2 letter monogram for the avatar disc */
  initials: string
  /** Hex color for the avatar disc */
  avatarColor: string
}) {
  return (
    <figure className="flex flex-col">
      {/* Editorial open-quote glyph — large, accent-colored, hangs
          above the quote with no card chrome around it. */}
      <span
        aria-hidden
        className="text-[#E85D2F] font-serif leading-none mb-4"
        style={{ fontSize: '44px' }}
      >
        “
      </span>
      <blockquote className="text-[16px] md:text-[17px] text-[#0F1733]/85 dark:text-white/85 leading-[1.6] mb-6 flex-1">
        {quote}
      </blockquote>
      {/* Hairline divider — replaces the bordered-card shell with
          editorial rhythm. */}
      <hr className="border-0 border-t border-[#0F1733]/12 dark:border-white/15 mb-4" />
      <figcaption className="flex items-center gap-3">
        {/* Avatar disc — initials, no fake stock photo. The colored
            background matches the testimonial subject's "vibe" (warm
            for newsletter, blue for podcast, purple for agency). */}
        <span
          aria-hidden
          className="inline-flex items-center justify-center w-10 h-10 rounded-full text-white text-[13px] font-bold tracking-tight shrink-0"
          style={{ backgroundColor: avatarColor }}
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold leading-tight">{name}</span>
            {/* Honest "Beta" chip — these are early-access users, not
                verified ARR customers. Saying so up-front beats faking
                logos / stars. */}
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-[0.14em] font-bold bg-[#E85D2F]/10 text-[#9C3D1F] dark:bg-[#F2A261]/15 dark:text-[#F2A261]">
              Beta
            </span>
          </div>
          <div className="text-[13px] text-[#0F1733]/65 dark:text-white/65 leading-tight mt-0.5">{role}</div>
          <div className="text-[12px] text-[#0F1733]/45 dark:text-white/45 leading-tight mt-1">{context}</div>
        </div>
      </figcaption>
    </figure>
  )
}

function PricingCard({ tier, price, priceSub, features, cta, ctaHref, featured = false }: { tier: string; price: string; priceSub: string; features: string[]; cta: string; ctaHref: string; featured?: boolean }) {
  return (
    <div className={`rounded-2xl p-7 md:p-8 ${featured ? 'bg-[#0F1733] text-white' : 'bg-white dark:bg-[#131826] border border-[#0F1733]/10 dark:border-white/10'}`} style={featured ? { boxShadow: '0 30px 60px -30px rgba(15,23,51,0.4)' } : undefined}>
      <div className={`text-[13px] uppercase tracking-[0.18em] mb-3 font-semibold ${featured ? 'text-[#F2A261]' : 'text-[#E85D2F]'}`}>{tier}</div>
      <div className="font-semibold tracking-[-0.025em] mb-1" style={{ fontSize: 'clamp(2.25rem, 4vw, 3rem)' }}>{price}</div>
      <div className={`text-[13px] mb-6 ${featured ? 'text-white/55' : 'text-[#0F1733]/55 dark:text-white/55'}`}>{priceSub}</div>
      <ul className="space-y-2.5 mb-7 text-[14px]">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2.5">
            <span className={featured ? 'text-[#F2A261] font-bold mt-0.5 shrink-0' : 'text-[#E85D2F] font-bold mt-0.5 shrink-0'}>✓</span>
            <span className={featured ? 'text-white/90' : 'text-[#0F1733]/85 dark:text-white/85'}>{f}</span>
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
    <article className="rounded-xl border border-[#0F1733]/10 dark:border-white/10 bg-white dark:bg-[#1A2034] p-6 hover:-translate-y-1 transition-transform" style={{ boxShadow: '0 1px 3px rgba(15,23,51,0.05)' }}>
      <div className="text-[10px] uppercase tracking-[0.22em] text-[#E85D2F] font-semibold mb-3">{tag}</div>
      <h3 className="text-[18px] font-semibold tracking-[-0.01em] mb-2.5">{title}</h3>
      <p className="text-[14px] text-[#0F1733]/65 dark:text-white/65 leading-[1.55]">{body}</p>
    </article>
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
