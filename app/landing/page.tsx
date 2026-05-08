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
  title: 'Creator Outreach — Search, score, and reach out in one queue',
  description: 'Click a niche bucket, search YouTube/IG/TikTok/X/LinkedIn in parallel, score every result against criteria you wrote in plain English, and reach out from one board. Free during beta.',
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
            <p className="mt-7 max-w-[54ch] text-[17px] md:text-[18px] text-[#0F1733]/70 dark:text-white/70 leading-[1.55]">
              One click on a niche bucket runs YouTube, Instagram,
              TikTok, X, and LinkedIn in parallel. Each result gets a
              fit score against criteria you wrote in plain English.
              Reach out from a board with status pills, follow-up
              cadence, and an Instagram DM auto-composer. All free
              while in beta.
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

      {/* SOLUTIONS — reframed from "personas" to actual product loop.
          The four tiles now mirror what's literally in the app: niche
          buckets → plain-English Lead Criteria → outreach board → IG
          metrics scrape. No fake "use case" buckets that don't map to
          screens. */}
      <section id="solutions" className="px-6 py-20 md:py-28 bg-white dark:bg-[#131826] border-y border-[#0F1733]/8 dark:border-white/10">
        <div className="max-w-[1280px] mx-auto">
          <div className="max-w-[680px] mb-12 md:mb-16">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">What&apos;s actually in the app</div>
            <h2 className="font-semibold tracking-[-0.025em]" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              Four pieces, one loop.
            </h2>
            <p className="mt-5 text-[17px] text-[#0F1733]/65 dark:text-white/65 leading-[1.55]">
              Search a niche across five platforms in parallel. Score
              the results against criteria you wrote in plain English.
              Reach out from one board. Watch what&apos;s landing in seven
              KPIs. Built for the way one operator actually works through
              a list — not the way a CRM thinks they should.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <SolutionTile
              icon={
                /* Layers / niche buckets */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polygon points="12 2 22 8.5 12 15 2 8.5 12 2" />
                  <polyline points="2 14 12 20.5 22 14" />
                  <polyline points="2 19 12 25.5 22 19" transform="translate(0 -4)" />
                </svg>
              }
              title="13 niche buckets, not just keywords"
              body="Click Fitness &amp; Health, Finance &amp; Wealth, Real Estate, Tech &amp; Startups (13 buckets, ~30 occupations each) and the search fans out across all five platforms in parallel. One click instead of typing 30 queries."
            />
            <SolutionTile
              icon={
                /* Sparkles — plain-English AI scoring */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
                  <circle cx="12" cy="12" r="3.5" />
                </svg>
              }
              title="Plain-English Lead Criteria"
              body="Type your ideal creator in a sentence — &ldquo;US-based, posts weekly, 10K–100K subs, talks about value investing.&rdquo; Five-dimension fit score (recency, reach, reachability, relevance, quality) ranks every result against it. Re-tunable per platform."
            />
            <SolutionTile
              icon={
                /* Inbox / outreach board */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M22 12h-6l-2 3h-4l-2-3H2" />
                  <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                </svg>
              }
              title="One outreach board, no CRM bill"
              body="Status pill, medium tracker (Email · LinkedIn · Other), follow-up cadence, product notes — one row per creator. Click an Instagram handle and an opener template lands in your clipboard while the profile opens."
            />
            <SolutionTile
              icon={
                /* Bar chart — analytics */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="3" y1="20" x2="21" y2="20" />
                  <rect x="5" y="11" width="3" height="9" />
                  <rect x="10.5" y="6" width="3" height="14" />
                  <rect x="16" y="13" width="3" height="7" />
                </svg>
              }
              title="7 KPIs out of the box"
              body="In Pipeline · Reached Out · Responses · Response Rate · Win Rate · Pipeline $ · Stale Follow-ups. Status-breakdown bar, outreach-by-medium split. Add custom metrics — no formula bar, no SQL."
            />
          </div>
        </div>
      </section>

      {/* HOW IT ACTUALLY WORKS — 3-step horizontal demo strip with
          tight bento screenshot crops. Sells the whole loop in 2
          seconds without marketing copy: pick a niche → see scored
          results → reach out + track. The screenshots are the real
          UI (bento-search.png / bento-fit.png / bento-status.png),
          not synthesized mockups. */}
      <section className="px-6 pt-20 md:pt-28 pb-4">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center max-w-[640px] mx-auto mb-12 md:mb-14">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">How it actually works</div>
            <h2 className="font-semibold tracking-[-0.025em]" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>
              The whole loop, in three clicks.
            </h2>
          </div>
          <div className="relative grid md:grid-cols-3 gap-6 md:gap-3 items-stretch">
            <DemoStep
              n="01"
              title="Pick a niche"
              body="Click one of 13 niche buckets. The search fans out across all five platforms in parallel."
              src="/screenshots/bento-search.png"
              alt="Search filters with niche bucket selected"
            />
            <DemoStep
              n="02"
              title="See ranked results"
              body="Every creator scored against your plain-English criteria. Strong / Possible / Weak labels, sortable per dimension."
              src="/screenshots/bento-fit.png"
              alt="Results table with fit score column"
            />
            <DemoStep
              n="03"
              title="Reach out, track status"
              body="Status pill, medium tracker, follow-up cadence. Click an Instagram handle and a DM template lands in your clipboard."
              src="/screenshots/bento-status.png"
              alt="Outreach board with status pills"
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
                One query — or one click on a niche bucket — runs against
                YouTube, Instagram, TikTok, X, and LinkedIn in parallel.
                Each result gets a fit score that explains itself in
                plain English (Strong / Possible / Weak), based on
                criteria you describe in a sentence.
              </p>
              {/* Bullets verified against the actual app:
                  - 13 niche buckets in lib/format.ts
                  - 5-dimension fit score in lib/scoring.ts
                  - 20 regions in lib/regions.ts (NOT 22 like the old copy
                    claimed — verified count) */}
              <ul className="space-y-2.5 text-[15px] text-[#0F1733]/85 dark:text-white/85">
                <Bullet>One query &rarr; results across all five platforms in parallel</Bullet>
                <Bullet>13 niche buckets fan out into ~30 occupations each (Fitness, Finance, Real Estate, Tech, Coaching, Sports, Creative &amp; Media, Legal, Education, Food, Home, Travel, HR)</Bullet>
                <Bullet>5-dimension fit score (recency · reach · reachability · relevance · quality) — re-weight per platform</Bullet>
                <Bullet>20 region filters · audience-size buckets · last-posted recency · Instagram follower count inline</Bullet>
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

      {/* STAT BAND — editorial layout (was a 4-up evenly-spaced grid).
          One hero stat with explainer copy on the right; three smaller
          stats below. Reads as "here's the lead number, here's the
          rest" instead of "here's a marketing dashboard."

          TODO Dylan: when you want, swap the hero "13 / niche buckets"
          for your actual pipeline number ("73 creators in my pipeline
          last month" or whatever it is right now). The product-fact
          version below is the honest placeholder until then. */}
      <section className="px-6 pb-20 md:pb-28">
        <div className="max-w-[1280px] mx-auto bg-[#0F1733] rounded-3xl px-8 py-14 md:py-20 text-white">
          <div className="text-center max-w-[700px] mx-auto mb-14">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#F2A261] mb-3 font-semibold">What&apos;s actually under the hood</div>
            <h2 className="font-semibold tracking-[-0.02em] leading-[1.1]" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>
              A search engine, a scoring engine, and a CRM — built into one.
            </h2>
          </div>

          {/* Hero stat row: one big number left, explainer copy right.
              Asymmetric weight; reads editorial, not template. */}
          <div className="grid md:grid-cols-12 gap-8 md:gap-10 items-center mb-12 md:mb-14 pb-12 md:pb-14 border-b border-white/10">
            <div className="md:col-span-5">
              <div
                className="font-semibold tracking-[-0.04em] leading-[0.95] text-[#F2A261]"
                style={{ fontSize: 'clamp(5rem, 11vw, 9rem)' }}
              >
                13
              </div>
              <div className="text-[16px] md:text-[17px] text-white font-semibold mt-2">
                niche buckets, ~30 occupations each
              </div>
            </div>
            <div className="md:col-span-7 text-[15px] md:text-[16px] text-white/75 leading-[1.65]">
              Fitness &amp; Health · Finance &amp; Wealth · Real Estate · Tech
              &amp; Startups · Coaching · Sports · Creative &amp; Media · Legal
              · Education · Food &amp; Hospitality · Home &amp; Building · Travel ·
              HR &amp; Recruiting. Each bucket fans out across five platforms
              in parallel — one click runs the search you&apos;d otherwise
              type out 30 times.
            </div>
          </div>

          {/* Supporting row: three smaller stats. */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
            <Stat n="5" label="platforms searched in parallel" />
            <Stat n="5" label="dimensions in the fit score, per-platform tunable" />
            <Stat n="$0" label="while in beta · no card · no seat cap" />
          </div>
        </div>
      </section>

      {/* "BUILT BECAUSE" — replaces the fake-testimonial section that
          had me inventing customer names. Creator Outreach is in beta
          with one operator (Dylan) eating his own dog food, so honest
          framing is "here are the three pains I hit running my own
          pipeline, and the three features I built for each one." This
          is far more credible than fabricated testimonials. */}
      <section id="customers" className="px-6 pb-20 md:pb-28 scroll-mt-24 bg-white dark:bg-[#131826] border-y border-[#0F1733]/8 dark:border-white/10">
        <div className="max-w-[1280px] mx-auto pt-20 md:pt-28">
          <div className="text-center mb-12 md:mb-16">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">Built because</div>
            <h2 className="font-semibold tracking-[-0.025em] mx-auto max-w-[26ch]" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              Three real pains. Three things in the app.
            </h2>
            <p className="mt-5 max-w-[58ch] mx-auto text-[16px] text-[#0F1733]/65 dark:text-white/65 leading-[1.6]">
              Creator Outreach is in beta and built by one operator
              running his own creator pipeline. Every piece of the app
              exists because the spreadsheet version of it stopped
              scaling. Here&apos;s the receipts.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-x-10 md:gap-x-14 gap-y-12 max-w-[1180px] mx-auto">
            <BuiltBecauseNote
              pain="The four-tab problem."
              note="Sourcing one guest meant a YouTube tab, a LinkedIn tab to find an email, a Twitter tab to confirm they were still active, and a Google Sheet to remember who I&apos;d already messaged. Five sources of truth, none of them talking."
              becameFeature="One query → scored results across all five platforms, with email + LinkedIn + Instagram links inline per row. The four tabs collapse into one."
              tag="Sourcing"
            />
            <BuiltBecauseNote
              pain="Generic AI scoring lies."
              note="Every off-the-shelf creator score is the same: subscriber count, engagement rate, maybe vertical. None of them know what I&apos;m actually looking for — &ldquo;US-based, posts weekly, talks about value investing, under 100K subs.&rdquo;"
              becameFeature="Plain-English Lead Criteria you write in a sentence. Five-dimension fit score (recency · reach · reachability · relevance · quality) with re-tunable weights per platform."
              tag="Scoring"
            />
            <BuiltBecauseNote
              pain="HubSpot didn&apos;t know what an Instagram handle was."
              note="Tried HubSpot ($400/mo). Tried two influencer-CRMs ($300+/mo, gated behind a sales call). All of them treated email as the only channel. None of them clicked an IG handle and gave me a DM template."
              becameFeature="One outreach board with status pill, medium tracker (Email · LinkedIn · Other), follow-up cadence, IG DM auto-composer. $0 while in beta. CSV export anytime — your data leaves with you."
              tag="Outreach"
            />
          </div>
        </div>
      </section>

      {/* PLATFORMS — eyebrow ("Platforms supported") removed; the
          headline ("Five platforms, in one queue") already does that
          job and one fewer uppercase orange chip helps the page rhythm. */}
      <section className="px-6 py-20 md:py-28">
        <div className="max-w-[1280px] mx-auto text-center">
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
                className="group relative rounded-xl border border-[#0F1733]/10 dark:border-white/10 bg-white dark:bg-[#131826] px-4 py-7 hover:-translate-y-1 transition-transform overflow-hidden"
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

      {/* PRICING — eyebrow ("Pricing") removed; the $0 in the card
          and the headline do the labelling, no need to also chip it. */}
      <section id="pricing" className="px-6 pb-20 md:pb-28 scroll-mt-24 bg-white dark:bg-[#131826] border-y border-[#0F1733]/8 dark:border-white/10">
        <div className="max-w-[1100px] mx-auto pt-20 md:pt-28">
          <div className="text-center mb-12">
            <h2 className="font-semibold tracking-[-0.025em] mb-5" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              Free during beta. Grandfathered when it isn&apos;t.
            </h2>
            <p className="max-w-[58ch] mx-auto text-[17px] text-[#0F1733]/65 dark:text-white/65 leading-[1.55]">
              No card on file, no seat cap, no annual upsell. Beta users will be looked after when paid plans launch.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5 max-w-[820px] mx-auto">
            {/* Beta features — every bullet names a real, shipped
                app feature. Verified against the codebase: niche
                buckets in lib/format.ts, fit score in lib/scoring.ts,
                IG scraper in lib/hooks/useInstagramMetrics, cadence in
                CadencePopover, IG DM composer in app/page.tsx, export
                in app/api/export. No aspirational bullets here —
                those live in the Pro tier. */}
            <PricingCard
              tier="Beta"
              price="$0"
              priceSub="Free while in beta · no card · no seat cap"
              features={[
                '5-platform parallel search + 13 niche buckets',
                'Plain-English Lead Criteria + 5-dimension fit score',
                'Outreach board: status pills, medium tracker, follow-up cadence',
                'Instagram DM auto-composer + real follower data inline',
                'CSV / Excel export — your data, anytime',
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
                'Higher search + enrichment quotas',
                'Multi-seat workspaces',
                'Bulk email enrichment via Meta Graph API',
                'Priority support + custom guidance presets',
                'Beta users grandfathered into Pro pricing',
              ]}
              cta="Notify me"
              ctaHref="mailto:dmeehanj@gmail.com?subject=Notify%20me%20when%20Creator%20Outreach%20Pro%20is%20ready"
            />
          </div>
        </div>
      </section>

      {/* RESOURCES — reframed as honest "writing in progress" rather
          than fake-published guides. Cards now say "DRAFT" with a
          "Notify me" CTA per piece, instead of pretending each one is
          a finished post linking somewhere. */}
      <section className="px-6 py-20 md:py-28">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-3 font-semibold">Writing in progress</div>
              <h2 className="font-semibold tracking-[-0.025em]" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>
                Playbooks I&apos;m writing as I run my own pipeline.
              </h2>
              <p className="mt-3 max-w-[60ch] text-[15px] text-[#0F1733]/65 dark:text-white/65 leading-[1.6]">
                These are drafts — published as I finish them. Email me
                and I&apos;ll send the next one when it lands.
              </p>
            </div>
            <a href="mailto:dmeehanj@gmail.com?subject=Notify%20me%20when%20Creator%20Outreach%20playbooks%20publish" className="text-[14px] font-semibold text-[#E85D2F] hover:underline">
              Notify me &rarr;
            </a>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <ResourceCard tag="DRAFT · GUIDE"    title="The 4-step outreach loop, without a CRM"  body="Search → Score → Pitch → Track. How to run the whole loop on this app, the manual fallback when something breaks, and the spreadsheet template I started with before building this." />
            <ResourceCard tag="DRAFT · POST"     title="Why generic creator scoring lies"          body="Subscriber count + engagement rate + vertical doesn&apos;t describe fit. Walk-through of the 5-dimension fit score, which weights I tune per platform, and why &lsquo;US-based, posts weekly&rsquo; was the only criteria that actually moved my reply rate." />
            <ResourceCard tag="DRAFT · PLAYBOOK" title="Per-channel template anatomy"              body="What an Instagram DM, a LinkedIn message, and a creator email each need to feel different and still convert. Side-by-side teardown of the templates that work for me right now." />
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
          <FooterCol heading="Resources" links={[['Guides','mailto:dmeehanj@gmail.com'],['Playbooks','mailto:dmeehanj@gmail.com'],['Changelog','mailto:dmeehanj@gmail.com']]} />
          <FooterCol heading="Company"   links={[['About','#'],['Contact','mailto:dmeehanj@gmail.com'],['Talk to us','mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20demo']]} />
          <FooterCol heading="Legal"     links={[['Privacy','/privacy'],['Terms','/terms']]} />
        </div>
      </footer>
    </main>
  )
}

/* ─── primitives ─── */

function DemoStep({
  n,
  title,
  body,
  src,
  alt,
}: {
  /** Step number "01" / "02" / "03" — typeset in muted mono */
  n: string
  title: string
  body: string
  src: string
  alt: string
}) {
  return (
    <div className="relative flex flex-col rounded-xl border border-[#0F1733]/10 dark:border-white/10 bg-white dark:bg-[#131826] overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(15,23,51,0.05)' }}>
      {/* Screenshot strip — locked 16:9 with object-contain on a dark
          frame so different bento crops (search 2.47:1, fit 1.08:1,
          status 3.98:1) all sit visibly in the same height slot
          without forced cropping. Always dark frame regardless of
          theme so the screenshots match. */}
      <div className="relative w-full bg-[#0E121C] border-b border-[#0F1733]/10 dark:border-white/10" style={{ aspectRatio: '16 / 9' }}>
        <Image src={src} alt={alt} fill sizes="(min-width: 1280px) 400px, 100vw" className="object-contain" />
      </div>
      <div className="flex-1 p-5 md:p-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#E85D2F] font-bold font-mono mb-2">{n}</div>
        <h3 className="text-[18px] font-semibold tracking-[-0.01em] mb-2">{title}</h3>
        <p className="text-[14px] text-[#0F1733]/65 dark:text-white/65 leading-[1.55]">{body}</p>
      </div>
    </div>
  )
}

function SolutionTile({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
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

function BuiltBecauseNote({
  pain,
  note,
  becameFeature,
  tag,
}: {
  /** Headline pain (the thing that broke). */
  pain: string
  /** Lived-in description of the pain in operator voice. */
  note: string
  /** What got built in the app to solve it. */
  becameFeature: string
  /** One-word section tag (Sourcing / Scoring / Outreach). */
  tag: string
}) {
  return (
    <figure className="flex flex-col">
      {/* Tag — small uppercase chip naming which part of the app this
          pain produced. */}
      <span className="text-[11px] uppercase tracking-[0.18em] text-[#E85D2F] font-bold mb-4">
        {tag}
      </span>
      <h3 className="text-[20px] md:text-[22px] font-semibold tracking-[-0.015em] leading-[1.25] mb-4 text-[#0F1733] dark:text-white">
        {pain}
      </h3>
      <p
        className="text-[15px] md:text-[16px] text-[#0F1733]/75 dark:text-white/75 leading-[1.6] mb-5 flex-1"
        dangerouslySetInnerHTML={{ __html: note }}
      />
      {/* Hairline rule + "what got built" block — connects the pain
          directly to the feature in the app. Reads as a real changelog
          entry, not marketing fluff. */}
      <div className="border-t border-[#0F1733]/12 dark:border-white/15 pt-4 flex gap-3">
        <span
          aria-hidden
          className="mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#E85D2F]/15 text-[#E85D2F] shrink-0"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="5 12 10 17 19 7" />
          </svg>
        </span>
        <p
          className="text-[13.5px] text-[#0F1733]/70 dark:text-white/70 leading-[1.55]"
          dangerouslySetInnerHTML={{ __html: becameFeature }}
        />
      </div>
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
    <article className="group rounded-xl border border-[#0F1733]/10 dark:border-white/10 bg-white dark:bg-[#131826] p-6 transition-colors hover:border-[#E85D2F]/40" style={{ boxShadow: '0 1px 3px rgba(15,23,51,0.05)' }}>
      <div className="text-[10px] uppercase tracking-[0.22em] text-[#E85D2F] font-semibold mb-3">{tag}</div>
      {/* Title + chevron — the chevron trails the title on hover
          (translate-x). Different hover affordance from the lift on
          solution tiles or the brand-stripe on platform tiles. */}
      <h3 className="text-[18px] font-semibold tracking-[-0.01em] mb-2.5 inline-flex items-center gap-1.5">
        <span>{title}</span>
        <svg
          aria-hidden
          className="text-[#E85D2F] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 shrink-0"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </h3>
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
