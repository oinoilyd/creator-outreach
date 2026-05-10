import Link from 'next/link'
import { LandingTopNav } from '@/components/landing/LandingTopNav'
import { RoadmapLane } from '@/components/landing/RoadmapLane'
import { createClient } from '@/lib/supabase/server'

/**
 * /roadmap — dedicated public roadmap page.
 *
 * Lifted out of the landing page (was an inline section) per Dylan
 * so the landing reads tighter and the roadmap can carry more
 * weight as its own page. Reuses the RoadmapLane primitive from
 * components/landing/. Lengthy version: more lanes, more items,
 * deeper item descriptions, vote-by-email CTA at the bottom.
 */

export const metadata = {
  // The root layout title template is "%s · Creator Outreach", so
  // setting the title to just "Roadmap" here yields the proper
  // "Roadmap · Creator Outreach" tab — not the double-prefixed
  // "Creator Outreach — Roadmap · Creator Outreach" we had before.
  title: 'Roadmap',
  description:
    "What's shipping next. The actual build queue, sorted by what unblocks the most pipeline. Email me to vote on priority.",
  alternates: { canonical: 'https://creatoroutreach.net/roadmap' },
}

export default async function RoadmapPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isAuthed = !!user

  return (
    <main className="min-h-screen text-[#0F1733] dark:text-white font-[family-name:var(--font-geist-sans)] bg-[#FCFAF6] dark:bg-[#0A0E15]">
      <LandingTopNav isAuthed={isAuthed} />

      {/* HERO */}
      <section className="px-6 pt-14 md:pt-20 pb-10 md:pb-14">
        <div className="max-w-[1180px] mx-auto">
          <Link
            href="/landing"
            className="inline-flex items-center gap-1.5 text-[13px] text-[#0F1733]/55 dark:text-white/55 hover:text-[#E85D2F] dark:hover:text-[#F2A261] transition-colors mb-6"
          >
            <span aria-hidden>&larr;</span>
            Back to home
          </Link>
          <div className="inline-flex items-center gap-2 mb-5 px-2.5 py-1 rounded-full bg-[#E85D2F]/10 border border-[#E85D2F]/30 text-[10.5px] uppercase tracking-[0.2em] text-[#9C3D1F] dark:text-[#F2A261] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E85D2F]" />
            Roadmap
          </div>
          <h1
            className="font-semibold tracking-[-0.03em] leading-[1] text-[#0F1733] dark:text-white"
            style={{ fontSize: 'clamp(2.5rem, 5.5vw, 4.5rem)' }}
          >
            What&apos;s shipping next.{' '}
            <span
              className="italic font-normal text-[#E85D2F] dark:text-[#F2A261]"
              style={{ fontFamily: 'var(--font-newsreader), Georgia, serif' }}
            >
              The actual queue.
            </span>
          </h1>
          <p className="mt-6 max-w-[64ch] text-[16px] md:text-[17px] text-[#0F1733]/65 dark:text-white/65 leading-[1.65]">
            Items are sorted by what unblocks the most pipeline next.
            They move left as they ship. The list is the list — there&apos;s
            no marketing-quarter calendar behind it.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20roadmap%20feedback"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md text-[14px] font-semibold text-white bg-[#E85D2F] hover:bg-[#9C3D1F] transition-colors"
            >
              Vote on the queue
              <span aria-hidden>&rarr;</span>
            </a>
            <a
              href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20roadmap%20suggestion"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md text-[14px] font-semibold text-[#0F1733] dark:text-white border border-[#0F1733]/15 dark:border-white/15 hover:border-[#0F1733] dark:hover:border-white transition-colors"
            >
              Suggest something missing
            </a>
          </div>
        </div>
      </section>

      {/* SUMMARY METRICS — gives the page weight as its own destination */}
      <section className="px-6 pb-12">
        <div className="max-w-[1180px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
          {[
            { n: '3', label: 'Now shipping' },
            { n: '4', label: 'Up next · 2–6 weeks' },
            { n: '6', label: 'On the radar' },
            { n: '13', label: 'Items total' },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-xl border border-[#0F1733]/10 dark:border-white/10 bg-white dark:bg-[#131826] p-4 md:p-5"
              style={{ boxShadow: '0 1px 3px rgba(15,23,51,0.04)' }}
            >
              <div
                className="font-semibold tracking-[-0.025em] text-[#E85D2F] dark:text-[#F2A261] leading-none mb-2"
                style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)' }}
              >
                {s.n}
              </div>
              <div className="text-[12.5px] text-[#0F1733]/65 dark:text-white/65 leading-[1.4]">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* THE QUEUE */}
      <section className="px-6 py-14 md:py-20 bg-white dark:bg-[#131826] border-y border-[#0F1733]/8 dark:border-white/10">
        <div className="max-w-[1180px] mx-auto">
          <div className="grid md:grid-cols-3 gap-8 md:gap-10">
            <RoadmapLane
              label="Now shipping"
              count={3}
              accent="#16A34A"
              caption="Live this week."
              items={[
                {
                  title: 'Real Instagram metrics inline',
                  body: 'Inline follower counts and recent-post recency on every IG row. Three-strategy public-profile scraper handles cases where the Graph API would deny — no Meta Business setup required to see audience-size signals.',
                },
                {
                  title: 'Per-platform fit-score weights',
                  body: 'Re-tune Recency / Reach / Reachability / Relevance / Quality independently per platform. Instagram weight isn’t YouTube weight isn’t LinkedIn weight, and the score recomputes live as you adjust.',
                },
                {
                  title: 'Mobile-first hamburger nav',
                  body: 'Top nav rebuilt to never overflow on iPhone widths. Theme toggle and section deep-links beefier; mobile CTA surfaced inside the menu.',
                },
              ]}
            />
            <RoadmapLane
              label="Up next"
              count={4}
              accent="#E85D2F"
              caption="Building now — ETA 2–6 weeks."
              items={[
                {
                  title: 'Meta Graph API + bulk email enrichment',
                  body: 'Verified IG audience-quality signals via the Graph API. Bulk-lookup that turns a list of handles into a reachability-scored sheet in one pass. Replaces the public-scrape fallback when full enrichment is required.',
                },
                {
                  title: 'Custom scoring presets',
                  body: 'Save a fit-criteria recipe (e.g. “Fitness IG sponsorship”), share it across platforms, snapshot a per-niche scoring profile and reuse in one click. Editable JSON for power users; presets browser for everyone else.',
                },
                {
                  title: 'Reply-rate analytics per template',
                  body: 'A/B opener templates head-to-head. See which DM hooks reply on which platform. Auto-rotate the winner. Per-template breakdown in the Analytics dashboard with statistical-significance markers.',
                },
                {
                  title: 'AI-drafted opener per creator',
                  body: 'One-click first-draft DM or email referencing the creator’s actual recent posts — not a generic template. Preview-and-edit before sending; learns your voice from sent history.',
                },
              ]}
            />
            <RoadmapLane
              label="On the radar"
              count={6}
              accent="#1B6FB5"
              caption="Researching — vote to bump."
              items={[
                {
                  title: 'Multi-seat workspaces',
                  body: 'Shared queues, per-user notes, per-seat outreach status — without per-seat pricing punishments. One workspace, many operators, one bill.',
                },
                {
                  title: 'Browser extension',
                  body: 'See a creator on YouTube/IG, hit a hotkey, drop them into the Outreach board with one keystroke. Skip the copy-paste round-trip.',
                },
                {
                  title: 'Slack + Notion sync',
                  body: 'Push status changes into a Slack channel; mirror the Outreach board into a Notion view so non-app teammates can follow along.',
                },
                {
                  title: 'CSV import that scores existing lists',
                  body: 'Bring an existing prospect list, run the AI fit score against your criteria, get a ranked output. Useful for migrating from a spreadsheet workflow.',
                },
                {
                  title: 'Cadence templates by industry',
                  body: 'Suggested follow-up rhythms based on your niche (3-day for time-sensitive, 7-day for evergreen, 14-day for warm leads). Default presets you can override per creator.',
                },
                {
                  title: 'Inbox integration (Gmail / Outlook)',
                  body: 'Reply-detection by parsing inbound email so the Outreach board updates status automatically when a creator responds. Zero manual marking.',
                },
              ]}
            />
          </div>

          {/* Footer-of-section CTA */}
          <div className="mt-16 md:mt-20 pt-10 md:pt-12 border-t border-[#0F1733]/10 dark:border-white/10 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-[58ch]">
              <h2 className="font-semibold tracking-[-0.02em] text-[24px] md:text-[28px] mb-3">
                Move something up the queue.
              </h2>
              <p className="text-[15px] text-[#0F1733]/65 dark:text-white/65 leading-[1.6]">
                Email me what you&apos;d use today and what would unblock
                you tomorrow. The roadmap reorders fast when there&apos;s
                real demand for an item.
              </p>
            </div>
            <a
              href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20roadmap%20vote"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md text-[14px] font-semibold text-white bg-[#0F1733] hover:bg-[#E85D2F] dark:bg-[#F2A261] dark:text-[#0F1733] dark:hover:bg-white transition-colors"
            >
              Email me
              <span aria-hidden>&rarr;</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
