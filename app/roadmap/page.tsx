import Link from 'next/link'
import { LandingTopNav } from '@/components/landing/LandingTopNav'
import { RoadmapLane } from '@/components/landing/RoadmapLane'
import { createClient } from '@/lib/supabase/server'

/**
 * /roadmap — public Pipeline page (formerly "Roadmap" — renamed 2026-05-10).
 *
 * The actual build queue. Lanes mirror the lifecycle:
 *   • Shipped — landed this week, ready to use
 *   • Up next — clear next moves, queued behind Shipped validation
 *   • On the radar — future phases, multi-tenant scale work
 *   • Security & technical debt — items from the internal audit
 *     that need fixing but aren't user-facing
 *
 * URL stays /roadmap to keep external links working — only labels
 * + content moved to Pipeline.
 */

export const metadata = {
  title: 'Pipeline',
  description:
    "What's shipping next. The actual build queue, sorted by what unblocks the most pipeline. Email me to vote on priority.",
  alternates: { canonical: 'https://creatoroutreach.net/roadmap' },
}

export default async function PipelinePage() {
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
            Pipeline
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
            They move left as they ship. The list is the list — no
            marketing-quarter calendar behind it. Security &amp; tech
            debt sits in its own lane so the user-facing queue stays clean.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20pipeline%20feedback"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md text-[14px] font-semibold text-white bg-[#E85D2F] hover:bg-[#9C3D1F] transition-colors"
            >
              Vote on the queue
              <span aria-hidden>&rarr;</span>
            </a>
            <a
              href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20pipeline%20suggestion"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md text-[14px] font-semibold text-[#0F1733] dark:text-white border border-[#0F1733]/15 dark:border-white/15 hover:border-[#0F1733] dark:hover:border-white transition-colors"
            >
              Suggest something missing
            </a>
          </div>
        </div>
      </section>

      {/* SUMMARY METRICS */}
      <section className="px-6 pb-12">
        <div className="max-w-[1180px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
          {[
            { n: '7', label: 'Shipped this week' },
            { n: '6', label: 'Up next · 1–4 weeks' },
            { n: '6', label: 'On the radar' },
            { n: '9', label: 'Security &amp; tech debt' },
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
              <div
                className="text-[12.5px] text-[#0F1733]/65 dark:text-white/65 leading-[1.4]"
                dangerouslySetInnerHTML={{ __html: s.label }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* USER-FACING QUEUE */}
      <section className="px-6 py-14 md:py-20 bg-white dark:bg-[#131826] border-y border-[#0F1733]/8 dark:border-white/10">
        <div className="max-w-[1180px] mx-auto">
          <div className="grid md:grid-cols-3 gap-8 md:gap-10">
            <RoadmapLane
              label="Shipped"
              count={7}
              accent="#16A34A"
              caption="Live this week. Unipile integration — full Gmail-send / reply-detect / auto-followup rebuild."
              items={[
                {
                  title: 'Connect Gmail with one click (Unipile OAuth)',
                  body: 'Profile → Connect Gmail → Google\'s consent screen → back in app, status shows "Connected as: foo@gmail.com". Replaces the compose-URL hack that caused the wrong-To bug. No more multi-account confusion in Safari.',
                },
                {
                  title: 'Programmatic email send + preview modal',
                  body: 'Click Send Email on any outreach row → SendPreviewModal opens with editable To/Subject/Body → confirm → email actually sends via your real Gmail. No Gmail tab opens, no compose-URL params getting lost.',
                },
                {
                  title: 'Reply detection + AI auto-classify',
                  body: 'Replies hit a real webhook (no SendGrid Inbound forwarding hack). AI classifies positive / successful / negative / autoresponder / unclear. Status auto-flips on confident classifications; ambiguous replies leave status untouched.',
                },
                {
                  title: 'Auto-follow-up cron (sequence engine v0)',
                  body: 'Toggle "Auto Follow-up" on a row. When Follow Up Date hits AND no reply received, cron fires a follow-up email every 15 min. Atomic claim prevents double-fire on overlapping runs. Hard caps: 50/run global, 10/user/run.',
                },
                {
                  title: 'Conversation thread modal',
                  body: 'Every outreach row with a Unipile thread gets a 💬 button. Click → full back-and-forth inline, oldest first, color-coded by sender. No more guessing what was said.',
                },
                {
                  title: 'Open + click tracking',
                  body: 'Tracking pixel + link wrapping on follow-up sends (off by default for cold sends to dodge Gmail "may track activity" warnings). Open count shows on rows once enabled. ~70% pixel-fire rate is the known limit.',
                },
                {
                  title: 'LinkedIn connect scaffold',
                  body: 'Connect LinkedIn button in Profile. OAuth via Unipile\'s same hosted flow. UI button to send LinkedIn DMs from outreach rows is the next step.',
                },
              ]}
            />
            <RoadmapLane
              label="Up next"
              count={6}
              accent="#E85D2F"
              caption="Queued behind validation of the Unipile shipment. ETA 1–4 weeks."
              items={[
                {
                  title: 'Meta Graph API setup (one-time, 30 min)',
                  body: 'Integration code in lib/instagram-graph.ts already exists and is wired into /api/instagram-status. Just needs four env vars (META_APP_ID, META_APP_SECRET, META_LONG_LIVED_TOKEN, META_IG_BUSINESS_ID) and a Meta Business Manager + Facebook App setup. Replaces the public-scrape fallback with official Meta-sourced IG follower/post counts for test users immediately (200 calls/hour); full production scale needs Meta App Review (~1-2 weeks) when ready to onboard non-allowlisted users.',
                },
                {
                  title: 'LinkedIn DM send UI on outreach rows',
                  body: 'Same SendPreviewModal flavor but for LinkedIn. Send connection requests with custom note. Reply detection already works via the same webhook — just need the click target.',
                },
                {
                  title: 'Sequence editor v1 — custom cadence templates',
                  body: 'Define a multi-touch cadence (Day 1 cold, Day 4 bump, Day 8 final) with per-step body templates and timing. Auto-applies to new outreach. v0 (auto-fire on followUpDate) is already live; v1 adds the template editor.',
                },
                {
                  title: '/admin/unipile-debug page',
                  body: 'Rolling list of recent webhook events (creations, replies, opens, errors) — same shape as /admin/inbound-debug. Surfaces failures quickly when Unipile changes their event vocabulary or our parser drifts.',
                },
                {
                  title: 'Multi-user end-to-end test',
                  body: 'Spin up a second test account, connect a different Gmail, verify a reply to user A\'s creator does NOT flip user B\'s row. Code is multi-tenant clean by design — just needs the live verification.',
                },
                {
                  title: 'LinkedIn click → DM template to clipboard (per-platform)',
                  body: 'Already works for IG / LinkedIn icons on rows (open profile + copy templated message). Extend the template copy logic to also key off recent posts for per-creator personalization.',
                },
              ]}
            />
            <RoadmapLane
              label="On the radar"
              count={6}
              accent="#1B6FB5"
              caption="Researching. Vote to bump."
              items={[
                {
                  title: 'Instagram DM send via Unipile',
                  body: 'Connect Instagram → send DMs from outreach rows. Unipile supports IG natively; we just haven\'t wired the UI yet. Status update logic carries over from email/LinkedIn.',
                },
                {
                  title: 'Multi-seat workspaces',
                  body: 'Shared outreach queues, per-user notes, per-seat status — without per-seat pricing punishments. One workspace, many operators, one bill.',
                },
                {
                  title: 'CASA verification for own OAuth (post-revenue)',
                  body: 'Currently renting Unipile\'s verified OAuth (~$0.50-$3/user/mo). At ~5,000 paying users, the per-seat math flips and it\'s worth paying for Google\'s CASA security review (~$15-75k one-time) to remove the middleman.',
                },
                {
                  title: 'CSV import + bulk fit-score',
                  body: 'Bring an existing prospect list, run the AI fit score against your criteria, get a ranked output. Useful for migrating from a spreadsheet workflow.',
                },
                {
                  title: 'Browser extension',
                  body: 'See a creator on YouTube/IG/LinkedIn, hit a hotkey, drop them into the Outreach board with one keystroke.',
                },
                {
                  title: 'Slack + Notion sync',
                  body: 'Push status changes into a Slack channel; mirror the Outreach board into a Notion view so non-app teammates can follow along.',
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* SECURITY & TECH DEBT — separate lane so user-facing pipeline stays clean */}
      <section className="px-6 py-14 md:py-20">
        <div className="max-w-[1180px] mx-auto">
          <div className="mb-10 md:mb-14 max-w-[68ch]">
            <div className="inline-flex items-center gap-2 mb-4 px-2.5 py-1 rounded-full bg-[#0F1733]/8 dark:bg-white/10 border border-[#0F1733]/15 dark:border-white/20 text-[10.5px] uppercase tracking-[0.2em] text-[#0F1733]/70 dark:text-white/70 font-bold">
              Internal lane
            </div>
            <h2 className="font-semibold tracking-[-0.02em] text-[#0F1733] dark:text-white text-[28px] md:text-[36px] mb-3">
              Security &amp; technical debt
            </h2>
            <p className="text-[15px] text-[#0F1733]/65 dark:text-white/65 leading-[1.6]">
              Backlog from the 2026-05-10 internal audit. Critical and
              High bugs already fixed in production. These remaining items
              are correctness / hardening work that doesn&apos;t block
              shipping but should land before scaling past the first
              cohort of users.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 md:gap-10">
            <RoadmapLane
              label="Security hardening"
              count={4}
              accent="#9333EA"
              caption="Defense-in-depth items."
              items={[
                {
                  title: 'Webhook signature verification (HMAC)',
                  body: 'Current cross-verify (getAccount → name match) catches forged payloads but is one round-trip per event. When Unipile exposes a shared-secret signing header, replace with HMAC verification for sub-millisecond auth.',
                },
                {
                  title: 'Redis-backed rate limiter',
                  body: 'In-memory rate limiter on /api/unipile/send is per-Vercel-instance. With N warm instances a user gets 60×N sends/hr instead of 60. Migrate to Upstash (already in stack) once send volume warrants.',
                },
                {
                  title: 'Secret rotation backlog (7 secrets)',
                  body: 'Google OAuth, Anthropic, Supabase service role, Resend, Upstash, SendGrid Inbound, Unipile — all pasted in chat during build sessions. Rotate as a single batch and document the playbook for next time.',
                },
                {
                  title: 'NEXT_PUBLIC_APP_URL documented as prod-required',
                  body: 'Hosted-auth redirect URLs derive from req.nextUrl.host when the env is missing — safe on Vercel today but tightening to fail-closed on missing env prevents preview-deploy edge cases.',
                },
              ]}
            />
            <RoadmapLane
              label="Correctness"
              count={3}
              accent="#9333EA"
              caption="Edge cases the audit found."
              items={[
                {
                  title: 'Open-count idempotency',
                  body: 'Unipile retries webhook delivery on non-2xx — open_count++ would over-count under retries. Store a recent event_id set in Redis for dedup, or accept that opens are directional-only (presence matters, exact count doesn\'t).',
                },
                {
                  title: 'getEmailMessage id format',
                  body: 'Webhook sometimes carries Gmail Message-ID, sometimes Unipile internal id. Current call may 404 silently and fall through to webhook payload (which may have empty body). Add a fallback that tries both id formats before classification.',
                },
                {
                  title: 'touchpoints column type',
                  body: 'Stored as TEXT historically but always parsed as INT. Free-text values like "called twice" would silently become 0. Migrate to INTEGER, validate the existing data.',
                },
              ]}
            />
            <RoadmapLane
              label="Observability"
              count={2}
              accent="#9333EA"
              caption="Make failures visible."
              items={[
                {
                  title: '/admin/unipile-debug page',
                  body: 'Rolling 50 most recent webhook events with status, account, payload preview. Same shape as /admin/inbound-debug. Critical when Unipile changes their event vocabulary and our parser silently stops matching.',
                },
                {
                  title: 'Vercel cron run telemetry',
                  body: 'Log each cron run\'s candidates/sent/skipped/errors summary to a metrics endpoint. Right now visibility is only in Vercel function logs which are ephemeral. A persistent dashboard surfaces gradual drift before users notice.',
                },
              ]}
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
              Email me what you&apos;d use today and what would unblock you
              tomorrow. The pipeline reorders fast when there&apos;s real
              demand for an item.
            </p>
          </div>
          <a
            href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20pipeline%20vote"
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
