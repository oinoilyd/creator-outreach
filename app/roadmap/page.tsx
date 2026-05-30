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
 * surfaces what we're validating, what's queued next, and what's on
 * the longer-term radar. Internal technical-debt items live on
 * /admin/roadmap which is admin-gated; this page is the user-facing
 * version.
 *
 * Content overhaul 2026-05-18 — copy intentionally customer-facing.
 * No vendor names, no implementation paths, no operational items
 * (DB upgrades, billing setup, etc.). Items either describe what a
 * user will get when the feature ships, or describe what we're
 * validating before it ships. Anything embarrassing to expose to a
 * paying customer lives on /admin/roadmap instead.
 */

export const metadata = {
  title: 'Roadmap — Creator Outreach',
  description:
    "What we're validating and what's coming next. Email me to vote on priority.",
  alternates: { canonical: 'https://creatoroutreach.net/roadmap' },
}

// Note: const arrays kept name PAUSED_ITEMS internally to keep older
// git diffs clean. User-facing label is "Validating." All copy below
// is intentionally customer-facing — no internal terms (Unipile, Path B,
// "manual mode"), no implementation paths (lib/foo.ts), no operational
// items (DB upgrades, vendor billing). This is a product roadmap, not
// an engineering changelog.

const PAUSED_ITEMS = [
  {
    title: 'Automated follow-up sequences',
    body: 'Toggle automation on a row and the system sends follow-ups at the right time without you lifting a finger. Built-in cadence ladder — 3, then 7, then 14, then 21 days — and stops the moment a recipient replies. Currently exercising the cadence rules with our first cohort.',
  },
  {
    title: 'In-app email composer with preview',
    body: 'Compose and send your outreach without leaving the app. Side-by-side preview, template variables, recipient validation, and live send status. Currently validating the composer flow against real campaigns.',
  },
  {
    title: 'Real-time reply detection',
    body: 'When a recipient replies, the row updates automatically and the conversation lands in your CRM. AI tags the reply by intent — positive, negative, autoresponder, unclear — so you can sort by signal. Currently validating classification accuracy on real outreach.',
  },
  {
    title: 'Email engagement signals',
    body: 'See when recipients open your email or click a link, surfaced right on the outreach row. Warm leads light up before any reply lands so you can prioritize follow-ups. Currently validating delivery reliability across mail clients.',
  },
  {
    title: 'Inline conversation threads',
    body: 'Click a message icon on any row to see the full back-and-forth — color-coded by sender, oldest first. Reads like a chat surface instead of jumping to your inbox. Currently validating thread rendering against real customer replies.',
  },
  {
    title: 'One-click DM send (Instagram + LinkedIn)',
    body: 'Send DMs from inside the app, same composer flavor as email — no copy-paste, no platform-hopping. Currently validating per-platform message formatting before broad release.',
  },
]

const UP_NEXT_ITEMS = [
  {
    title: 'Promo code redemption at checkout',
    body: '"Have a code?" input below the Subscribe button. Drop in a partner-program or waitlist code and the discount applies automatically to the trial-end charge.',
  },
  {
    title: 'Trial-end reminders',
    body: 'Get notified by email two days before your 7-day trial converts to a paid subscription, so the auto-charge is never a surprise.',
  },
  {
    title: 'X + TikTok message templates',
    body: 'Editable per-platform templates wired into outreach rows, joining the existing Instagram and LinkedIn DM flows. Tailor your voice per platform without code.',
  },
  {
    title: 'Official Instagram metrics',
    body: 'Authoritative follower counts, post cadence, and engagement pulled directly from Meta\'s Graph API. Adds reliability for IG-heavy campaigns where the public-data fallback can lag.',
  },
  {
    title: 'Custom cadence sequences',
    body: 'Define your own multi-touch follow-up sequence per campaign — Day 1 cold, Day 4 bump, Day 8 final — with per-step body templates and timing. Replaces the built-in 3 → 7 → 14 → 21 cadence when you want different rhythms.',
  },
  {
    title: 'Quick-action keyboard shortcuts',
    body: 'Mark replies, advance status, snooze follow-ups, and skip rows entirely from the keyboard. Faster than scrolling and clicking when triaging dozens of replies in one sitting.',
  },
]

const ON_RADAR_ITEMS = [
  {
    title: 'Multi-seat workspaces',
    body: 'Shared outreach queues, per-user notes, per-seat status — without per-seat pricing punishments. One workspace, many operators, one bill.',
  },
  {
    title: 'CSV import + bulk fit-score',
    body: 'Bring an existing prospect list, run the AI fit score against your criteria, get a ranked output. Useful for migrating from a spreadsheet workflow without re-doing the search.',
  },
  {
    title: 'Browser extension',
    body: 'See a creator on YouTube, Instagram, or LinkedIn, hit a hotkey, drop them into your Outreach board with one keystroke.',
  },
  {
    title: 'Slack + Notion sync',
    body: 'Push status changes into a Slack channel; mirror the Outreach board into a Notion view so non-app teammates can follow along.',
  },
  {
    title: 'Custom-domain unsubscribe links',
    body: 'Connect your own subdomain so unsubscribe URLs land on your domain instead of ours. Cleaner footers when you want zero tool reveal.',
  },
  {
    title: 'AI-assisted outreach copy',
    body: 'Generate a first-draft message per scored creator based on their content and your pitch. Always editable before send. Quality threshold and human-in-the-loop guardrails enforced.',
  },
]

export default async function PipelinePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isAuthed = !!user

  const validatingCount = PAUSED_ITEMS.length
  const upNextCount = UP_NEXT_ITEMS.length
  const onRadarCount = ON_RADAR_ITEMS.length

  return (
    <main className="min-h-screen text-foreground bg-background font-[family-name:var(--font-geist-sans)]">
      <LandingTopNav isAuthed={isAuthed} />

      {/* HERO — top padding intentionally tight; the back-link sits
          high so the H1 stays prominent without a giant blank stretch
          above it. */}
      <section className="px-6 pt-8 md:pt-10 pb-10 md:pb-14">
        <div className="max-w-[1180px] mx-auto">
          {/* Back link — wrapped in its own block-level div so it
              renders on its own line (without it, inline-flex links
              and the inline-flex pill below collide on the same row).
              Signed-in users get a button-shaped CTA; unauth visitors
              get a subtle text link. */}
          <div className="mb-7 md:mb-8">
            {isAuthed ? (
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-[14px] font-semibold text-primary-foreground bg-gradient-to-br from-brand to-brand-2 hover:opacity-90 transition-opacity shadow-sm shadow-brand/20"
              >
                <span aria-hidden>&larr;</span>
                Back to app
              </Link>
            ) : (
              <Link
                href="/landing"
                className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-brand transition-colors"
              >
                <span aria-hidden>&larr;</span>
                Back to home
              </Link>
            )}
          </div>
          <div className="inline-flex items-center gap-2 mb-5 px-2.5 py-1 rounded-full bg-brand/10 border border-brand/30 text-[10.5px] uppercase tracking-[0.2em] text-brand font-bold dark:text-brand-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand" />
            Roadmap
          </div>
          <h1
            className="font-semibold tracking-[-0.03em] leading-[1] text-foreground"
            style={{ fontSize: 'clamp(2.5rem, 5.5vw, 4.5rem)' }}
          >
            What&apos;s coming next.{' '}
            <span
              className="italic font-normal bg-gradient-to-br from-brand to-brand-2 bg-clip-text text-transparent"
              style={{ fontFamily: 'var(--font-newsreader), Georgia, serif' }}
            >
              The actual queue.
            </span>
          </h1>
          <p className="mt-6 max-w-[64ch] text-[16px] md:text-[17px] text-muted-foreground leading-[1.65]">
            Forward-looking only. Validating items are feature-complete and currently
            being exercised end-to-end with our first cohort of users before broader
            release. No marketing-quarter calendar behind any of this — the list is
            the list, and it reorders fast when there&apos;s real demand for an item.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20roadmap%20feedback"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md text-[14px] font-semibold text-primary-foreground bg-gradient-to-br from-brand to-brand-2 hover:opacity-90 transition-opacity shadow-sm shadow-brand/20"
            >
              Vote on the queue
              <span aria-hidden>&rarr;</span>
            </a>
            <a
              href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20roadmap%20suggestion"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md text-[14px] font-semibold text-foreground border border-border hover:border-foreground transition-colors"
            >
              Suggest something missing
            </a>
          </div>
        </div>
      </section>

      {/* SUMMARY METRICS — auto-derived from the lane arrays so adding an
          item updates the count automatically. Big numbers ride the
          brand gradient so they pop without needing a hardcoded accent
          color, and the gradient ties the marketing CTAs to these
          summary cards via the same violet→teal sweep. */}
      <section className="px-6 pb-12">
        <div className="max-w-[1180px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {[
            { n: validatingCount, label: 'Validating', sub: 'Running in manual mode' },
            { n: upNextCount, label: 'Up next', sub: '1–4 weeks' },
            { n: onRadarCount, label: 'On the radar', sub: 'Longer-term' },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-sm shadow-foreground/[0.03]"
            >
              <div
                className="font-semibold tracking-[-0.025em] bg-gradient-to-br from-brand to-brand-2 bg-clip-text text-transparent leading-none mb-2"
                style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)' }}
              >
                {s.n}
              </div>
              <div className="text-[12.5px] font-semibold text-foreground leading-[1.4]">
                {s.label}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {s.sub}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MAIN QUEUE — 3 forward-looking lanes: Validating, Up next,
          On the radar. Shipped items intentionally NOT included here —
          a roadmap is what's coming, not a changelog of what's done.
          The const array is still named PAUSED_ITEMS internally so we
          don't break older revisions; user-facing label is "Validating".

          Lane accents: amber (validating — semantic "in progress"),
          brand violet (up next — primary brand color, the lane closest
          to ship), brand-2 teal (on the radar — secondary brand for
          longer-term). Tornado-aligned. */}
      <section className="px-6 py-14 md:py-20 bg-card border-y border-border">
        <div className="max-w-[1180px] mx-auto">
          <div className="grid md:grid-cols-3 gap-8 md:gap-10">
            <RoadmapLane
              label="Validating"
              count={validatingCount}
              accent="oklch(0.62 0.155 70)"
              caption="Built + feature-complete. Validating the end-to-end manual workflow before re-enabling automation."
              items={PAUSED_ITEMS}
            />
            <RoadmapLane
              label="Up next"
              count={upNextCount}
              accent="oklch(0.40 0.265 290)"
              caption="Queued. 1–4 weeks out."
              items={UP_NEXT_ITEMS}
            />
            <RoadmapLane
              label="On the radar"
              count={onRadarCount}
              accent="oklch(0.50 0.150 215)"
              caption="Researching. Vote to bump."
              items={ON_RADAR_ITEMS}
            />
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="px-6 pb-20 border-t border-border">
        <div className="max-w-[1180px] mx-auto pt-12 md:pt-16 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[58ch]">
            <h2 className="font-semibold tracking-[-0.02em] text-[24px] md:text-[28px] mb-3 text-foreground">
              Move something up the queue.
            </h2>
            <p className="text-[15px] text-muted-foreground leading-[1.6]">
              Email what you&apos;d use today and what would unblock you tomorrow.
              The pipeline reorders fast when there&apos;s real demand for an item.
            </p>
          </div>
          <a
            href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20roadmap%20vote"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md text-[14px] font-semibold text-primary-foreground bg-gradient-to-br from-brand to-brand-2 hover:opacity-90 transition-opacity shadow-sm shadow-brand/20"
          >
            Email me
            <span aria-hidden>&rarr;</span>
          </a>
        </div>
      </section>
    </main>
  )
}
