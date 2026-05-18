import Link from 'next/link'
import { LandingTopNav } from '@/components/landing/LandingTopNav'
import { RoadmapLane } from '@/components/landing/RoadmapLane'
import { createClient } from '@/lib/supabase/server'

/**
 * /roadmap — public-facing Pipeline page.
 *
 * Reachable from:
 *   • LandingTopNav on /landing (requires signin — middleware
 *     redirects unauth visitors to /auth/signin?next=/roadmap)
 *   • In-app HamburgerMenu → "Roadmap"
 *
 * Both paths land on this same URL with the same content. The page
 * surfaces what's shipped, what's paused (working manually until Unipile
 * re-subscribes), what's queued next, and what's on the longer-term
 * radar. Internal technical-debt items live on /admin/roadmap which is
 * admin-gated; this page is the user-facing version.
 *
 * Content overhaul 2026-05-18 — replaces the prior list which assumed
 * Unipile was active. Manual-mode reality is now reflected in the
 * Paused lane, and items shipped over the last week (Templates editor,
 * paywall, FAQ, reply-based footer) join Shipped.
 */

export const metadata = {
  title: 'Roadmap — Creator Outreach',
  description:
    "What's paused and what's coming next. Email me to vote on priority.",
  alternates: { canonical: 'https://creatoroutreach.net/roadmap' },
}

const PAUSED_ITEMS = [
  {
    title: 'Auto follow-up cron',
    body: 'Per-row toggle to auto-send follow-ups via your Gmail every 15 min when the date hits. Hard caps prevent runaway. CODE intact — UI checkbox self-disables when Gmail is not connected. Unblocks when Unipile is reconnected.',
  },
  {
    title: 'Programmatic email send (Path B)',
    body: 'In-app SendPreviewModal that sends via Unipile API directly — instead of opening Gmail compose. Lets us track sends, opens, link clicks, and offer richer HTML formatting. Unblocks when Unipile is reconnected.',
  },
  {
    title: 'Reply detection + auto-status flip',
    body: 'When a creator replies, an inbound Unipile webhook fires, AI classifies the reply (positive / negative / autoresponder / unclear), and the row\'s status updates automatically. Right now status is updated manually. Unblocks when Unipile is reconnected.',
  },
  {
    title: 'Open + click tracking',
    body: 'See when a recipient opens the email or clicks an embedded link, surfaced on the outreach row. Engagement signal before any reply lands. Unblocks when Unipile is reconnected.',
  },
  {
    title: 'In-app conversation thread modal',
    body: '💬 button per outreach row that opens the full back-and-forth thread inline (color-coded by sender, oldest first). Reads like a normal chat surface instead of jumping to Gmail. Unblocks when Unipile is reconnected.',
  },
  {
    title: 'Instagram + LinkedIn DM send via API',
    body: 'Push DMs from inside the app without copy-paste. Same SendPreviewModal flavor as email Path B but for IG / LinkedIn. Currently every DM is copy-to-clipboard + manual paste. Unblocks when Unipile is reconnected.',
  },
]

const UP_NEXT_ITEMS = [
  {
    title: '"Have a code?" coupon input on /pricing',
    body: 'Small input below the Subscribe button. Type VIPOUTREACH (or any future coupon code) → checkout endpoint validates against Stripe → applied to the checkout session. ETA: this week once the coupon is created in Stripe.',
  },
  {
    title: 'Stripe trial-end reminder emails',
    body: 'Email customers 3 days before their 14-day trial ends so the auto-charge isn\'t a surprise. Stripe sends these natively once the toggle is enabled in their Dashboard. The /pricing FAQ already claims this is on.',
  },
  {
    title: 'X DM + TikTok DM cell handlers',
    body: 'Templates for X and TikTok DMs already exist in the Templates modal, but there\'s no actual UI button yet to trigger copy-to-clipboard from a row. Quick wire-up to make the modal not a dangling surface.',
  },
  {
    title: 'Meta Graph API for official IG metrics',
    body: 'Replace the public-scrape fallback with official Meta-sourced IG follower / post counts. Integration code already exists in lib/instagram-graph.ts. Needs Meta App + ~1-2 weeks of App Review for production scale.',
  },
  {
    title: 'Sequence editor v1 — custom cadence templates',
    body: 'Define a multi-touch cadence (Day 1 cold, Day 4 bump, Day 8 final) with per-step body templates and timing. Auto-applies to new outreach. Customer-pulled — defer until ~$10K MRR.',
  },
  {
    title: 'Supabase Pro upgrade',
    body: '$25/mo. Required before first paying customer — lifts row / storage / egress limits and adds daily backups + 7-day point-in-time recovery. 5-minute upgrade in Supabase Dashboard.',
  },
]

const ON_RADAR_ITEMS = [
  {
    title: 'Multi-seat workspaces',
    body: 'Shared outreach queues, per-user notes, per-seat status — without per-seat pricing punishments. One workspace, many operators, one bill. Unblocked when first 5+ paying customers ask for it.',
  },
  {
    title: 'CSV import + bulk fit-score',
    body: 'Bring an existing prospect list, run the AI fit score against your criteria, get a ranked output. Useful for migrating from a spreadsheet workflow without re-doing the search.',
  },
  {
    title: 'Browser extension',
    body: 'See a creator on YouTube / IG / LinkedIn, hit a hotkey, drop them into the Outreach board with one keystroke. Bypasses the unified-search workflow when you already know who you want.',
  },
  {
    title: 'Slack + Notion sync',
    body: 'Push status changes into a Slack channel; mirror the Outreach board into a Notion view so non-app teammates can follow along.',
  },
  {
    title: 'Custom unsubscribe domain per user',
    body: 'Connect your own subdomain via CNAME so footer URLs land on your domain instead of creatoroutreach.net. Bigger lift; needed when senders want zero tool reveal. Currently sidestepped via reply-based opt-out.',
  },
  {
    title: 'CASA-verified own OAuth (replaces Unipile at scale)',
    body: 'Once paid-customer count crosses ~5,000, the per-seat math on renting Unipile\'s verified OAuth flips. Worth paying for Google\'s CASA security review (~$15–75k one-time) to remove the middleman.',
  },
]

export default async function PipelinePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isAuthed = !!user

  const pausedCount = PAUSED_ITEMS.length
  const upNextCount = UP_NEXT_ITEMS.length
  const onRadarCount = ON_RADAR_ITEMS.length

  return (
    <main className="min-h-screen text-[#0F1733] dark:text-white font-[family-name:var(--font-geist-sans)] bg-[#FCFAF6] dark:bg-[#0A0E15]">
      <LandingTopNav isAuthed={isAuthed} />

      {/* HERO */}
      <section className="px-6 pt-14 md:pt-20 pb-10 md:pb-14">
        <div className="max-w-[1180px] mx-auto">
          {/* Back link — visually different shape per auth state.
              Signed-in users hit the roadmap from inside the app, so
              the return path needs to be obvious + button-shaped (most
              users arrive expecting to read briefly and return). Unauth
              visitors land here from the landing-page nav; a subtle
              text link is enough since they're casually browsing. */}
          {isAuthed ? (
            <Link
              href="/"
              className="inline-flex items-center gap-2 mb-7 px-4 py-2.5 rounded-md text-[14px] font-semibold text-white bg-[#0F1733] hover:bg-[#E85D2F] dark:bg-[#F2A261] dark:text-[#0F1733] dark:hover:bg-white transition-colors shadow-sm"
            >
              <span aria-hidden>&larr;</span>
              Back to app
            </Link>
          ) : (
            <Link
              href="/landing"
              className="inline-flex items-center gap-1.5 text-[13px] text-[#0F1733]/55 dark:text-white/55 hover:text-[#E85D2F] dark:hover:text-[#F2A261] transition-colors mb-6"
            >
              <span aria-hidden>&larr;</span>
              Back to home
            </Link>
          )}
          <div className="inline-flex items-center gap-2 mb-5 px-2.5 py-1 rounded-full bg-[#E85D2F]/10 border border-[#E85D2F]/30 text-[10.5px] uppercase tracking-[0.2em] text-[#9C3D1F] dark:text-[#F2A261] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E85D2F]" />
            Roadmap
          </div>
          <h1
            className="font-semibold tracking-[-0.03em] leading-[1] text-[#0F1733] dark:text-white"
            style={{ fontSize: 'clamp(2.5rem, 5.5vw, 4.5rem)' }}
          >
            What&apos;s coming next.{' '}
            <span
              className="italic font-normal text-[#E85D2F] dark:text-[#F2A261]"
              style={{ fontFamily: 'var(--font-newsreader), Georgia, serif' }}
            >
              The actual queue.
            </span>
          </h1>
          <p className="mt-6 max-w-[64ch] text-[16px] md:text-[17px] text-[#0F1733]/65 dark:text-white/65 leading-[1.65]">
            Forward-looking only. The Paused lane shows features that are built and tested
            but currently waiting on a third-party (Unipile) re-subscription — your data +
            UI stays intact, only the automation is dormant. No marketing-quarter calendar
            behind any of this; the list is the list.
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

      {/* SUMMARY METRICS — auto-derived from the lane arrays so adding an
          item updates the count automatically. */}
      <section className="px-6 pb-12">
        <div className="max-w-[1180px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {[
            { n: pausedCount, label: 'Paused', sub: 'Awaiting Unipile' },
            { n: upNextCount, label: 'Up next', sub: '1–4 weeks' },
            { n: onRadarCount, label: 'On the radar', sub: 'Longer-term' },
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
              <div className="text-[12.5px] font-semibold text-[#0F1733] dark:text-white leading-[1.4]">
                {s.label}
              </div>
              <div className="text-[11px] text-[#0F1733]/55 dark:text-white/55 mt-0.5">
                {s.sub}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MAIN QUEUE — 3 forward-looking lanes: Paused, Up next, On the
          radar. Shipped items intentionally NOT included here — a
          roadmap is what's coming, not a changelog of what's done. */}
      <section className="px-6 py-14 md:py-20 bg-white dark:bg-[#131826] border-y border-[#0F1733]/8 dark:border-white/10">
        <div className="max-w-[1180px] mx-auto">
          <div className="grid md:grid-cols-3 gap-8 md:gap-10">
            <RoadmapLane
              label="Paused"
              count={pausedCount}
              accent="#CA8A04"
              caption="Built + tested. Automation dormant while we operate manually."
              items={PAUSED_ITEMS}
            />
            <RoadmapLane
              label="Up next"
              count={upNextCount}
              accent="#E85D2F"
              caption="Queued. 1–4 weeks out."
              items={UP_NEXT_ITEMS}
            />
            <RoadmapLane
              label="On the radar"
              count={onRadarCount}
              accent="#1B6FB5"
              caption="Researching. Vote to bump."
              items={ON_RADAR_ITEMS}
            />
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="px-6 pb-20 border-t border-[#0F1733]/8 dark:border-white/10">
        <div className="max-w-[1180px] mx-auto pt-12 md:pt-16 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[58ch]">
            <h2 className="font-semibold tracking-[-0.02em] text-[24px] md:text-[28px] mb-3">
              Move something up the queue.
            </h2>
            <p className="text-[15px] text-[#0F1733]/65 dark:text-white/65 leading-[1.6]">
              Email what you&apos;d use today and what would unblock you tomorrow.
              The pipeline reorders fast when there&apos;s real demand for an item.
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
      </section>
    </main>
  )
}
