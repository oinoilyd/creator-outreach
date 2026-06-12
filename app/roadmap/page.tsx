import Link from 'next/link'
import { LandingTopNav } from '@/components/landing/LandingTopNav'
import { createClient } from '@/lib/supabase/server'

/**
 * /roadmap — public-facing vision page.
 *
 * Reachable from LandingTopNav (hamburger → "Roadmap") and the in-app
 * HamburgerMenu. Signin-gated (middleware redirects unauth visitors to
 * /auth/signin), so in practice only signed-in users see it.
 *
 * 2026-06-12 rewrite (Dylan): the previous version was a transparent
 * three-lane queue — exact follow-up cadences, week-level timelines,
 * per-item build status ("currently validating…"), and item counts.
 * Too revealing. This version is HIGH-LEVEL ONLY: a handful of
 * directional themes describing where the product is headed, with no
 * mechanics, no dates, no build status, no counts. Aspirational but
 * honest — "directions we're exploring," not a delivery promise.
 * Internal engineering items still live on /admin/roadmap.
 *
 * Contact CTAs route to the landing-page contact form (/landing#contact)
 * — no personal email exposed, consistent with the rest of the site.
 */

export const metadata = {
  title: 'Roadmap — Creator Outreach',
  description:
    'Where Creator Outreach is headed — the directions we’re exploring to grow it from a creator-finding tool into your whole outreach engine.',
  alternates: { canonical: 'https://creatoroutreach.net/roadmap' },
}

// High-level vision themes — intentionally directional and loose. No
// mechanics, no timelines, no build status. Each is "what could be down
// the line," not a committed spec. Accents cycle a brand-adjacent sweep
// so the grid reads cohesive; tints use color-mix so we never hardcode a
// per-card alpha.
const THEMES: {
  glyph: string
  eyebrow: string
  title: string
  body: string
  accent: string
}[] = [
  {
    glyph: '⚡',
    eyebrow: 'Automation',
    title: 'Outreach that runs itself',
    body: 'Well-timed follow-ups that keep your pipeline moving while you’re focused elsewhere — and know to step back the moment someone replies.',
    accent: 'oklch(0.55 0.22 290)',
  },
  {
    glyph: '💬',
    eyebrow: 'Conversations',
    title: 'Every reply in one place',
    body: 'Responses and the full back-and-forth surfaced right beside the lead — the whole conversation living where you work, not scattered across inboxes.',
    accent: 'oklch(0.55 0.16 250)',
  },
  {
    glyph: '🌐',
    eyebrow: 'Reach',
    title: 'Meet creators anywhere',
    body: 'One place to reach out across the platforms creators actually live on — in your voice, without hopping between a dozen tabs.',
    accent: 'oklch(0.57 0.14 215)',
  },
  {
    glyph: '🎯',
    eyebrow: 'Intelligence',
    title: 'Targeting that keeps sharpening',
    body: 'Discovery and scoring that get better over time at separating the right creators from the noise — and can draft the opening message for you.',
    accent: 'oklch(0.54 0.2 305)',
  },
  {
    glyph: '👥',
    eyebrow: 'Scale',
    title: 'Built to grow with you',
    body: 'From a solo operator to a full team — shared queues and the tools you already work in, without the workflow getting in the way.',
    accent: 'oklch(0.56 0.15 235)',
  },
  {
    glyph: '✨',
    eyebrow: 'Craft',
    title: 'The busywork, engineered away',
    body: 'The small frictions — copy-pasting, status bookkeeping, manual updates — quietly removed so your time goes to the leads, not the admin.',
    accent: 'oklch(0.6 0.14 195)',
  },
]

export default async function RoadmapPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isAuthed = !!user

  return (
    <main className="min-h-screen text-foreground bg-background font-[family-name:var(--font-geist-sans)]">
      <LandingTopNav isAuthed={isAuthed} />

      {/* HERO — directional framing. Sets the expectation up front that
          this is a vision, not a dated delivery queue. */}
      <section className="px-6 pt-8 md:pt-10 pb-12 md:pb-16">
        <div className="max-w-[1180px] mx-auto">
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
            Where this is headed.{' '}
            <span
              className="italic font-normal bg-gradient-to-br from-brand to-brand-2 bg-clip-text text-transparent"
              style={{ fontFamily: 'var(--font-newsreader), Georgia, serif' }}
            >
              The bigger picture.
            </span>
          </h1>
          <p className="mt-6 max-w-[64ch] text-[16px] md:text-[17px] text-muted-foreground leading-[1.65]">
            A look at the directions we’re exploring — the kind of capabilities
            that grow Creator Outreach from finding the right creators into
            running your whole outreach motion. Directional, not dated: no
            delivery calendar, no promises. We build hardest toward whatever
            our users pull us toward.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/landing#contact"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md text-[14px] font-semibold text-primary-foreground bg-gradient-to-br from-brand to-brand-2 hover:opacity-90 transition-opacity shadow-sm shadow-brand/20"
            >
              Tell us what you’d want
              <span aria-hidden>&rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      {/* VISION THEMES — high-level only. A bento-ish grid of directions,
          each accent-tinted via color-mix so the row feels designed
          without a hardcoded alpha per card. No status, no counts. */}
      <section className="px-6 py-14 md:py-20 bg-card border-y border-border">
        <div className="max-w-[1180px] mx-auto">
          <div className="mb-10 md:mb-12 max-w-[60ch]">
            <h2 className="text-[12px] uppercase tracking-[0.22em] font-bold text-brand dark:text-brand-2 mb-3">
              The directions
            </h2>
            <p className="text-[18px] md:text-[20px] font-medium text-foreground/90 leading-[1.5] tracking-[-0.01em]">
              A few of the bigger bets — the kind that turn finding creators
              into running the entire conversation.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {THEMES.map(t => (
              <article
                key={t.title}
                className="group relative rounded-2xl border border-border bg-background p-6 md:p-7 transition-all duration-200 hover:border-foreground/25 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/[0.05]"
              >
                {/* Accent hairline reveals on hover — ties the card to its
                    theme color without a heavy always-on border. */}
                <span
                  aria-hidden
                  className="absolute inset-x-5 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)` }}
                />
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-[19px] border leading-none"
                    style={{
                      backgroundColor: `color-mix(in oklch, ${t.accent} 12%, transparent)`,
                      borderColor: `color-mix(in oklch, ${t.accent} 32%, transparent)`,
                    }}
                  >
                    {t.glyph}
                  </span>
                  <span
                    className="text-[10.5px] uppercase tracking-[0.18em] font-bold"
                    style={{ color: t.accent }}
                  >
                    {t.eyebrow}
                  </span>
                </div>
                <h3 className="text-[18px] md:text-[19px] font-semibold tracking-[-0.015em] leading-[1.25] mb-2 text-foreground">
                  {t.title}
                </h3>
                <p className="text-[14px] text-muted-foreground leading-[1.6]">
                  {t.body}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-10 text-[13px] text-muted-foreground/80 italic max-w-[58ch]">
            Not a delivery schedule — a sense of direction. What ships first
            depends on what our users ask for loudest.
          </p>
        </div>
      </section>

      {/* FOOTER CTA — routes to the contact form, not a personal email. */}
      <section className="px-6 pb-20 border-t border-border">
        <div className="max-w-[1180px] mx-auto pt-12 md:pt-16 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[58ch]">
            <h2 className="font-semibold tracking-[-0.02em] text-[24px] md:text-[28px] mb-3 text-foreground">
              Have something in mind?
            </h2>
            <p className="text-[15px] text-muted-foreground leading-[1.6]">
              Tell us what would make this indispensable for you. The
              directions above shift fast when someone asks for something
              specific.
            </p>
          </div>
          <Link
            href="/landing#contact"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md text-[14px] font-semibold text-primary-foreground bg-gradient-to-br from-brand to-brand-2 hover:opacity-90 transition-opacity shadow-sm shadow-brand/20"
          >
            Share an idea
            <span aria-hidden>&rarr;</span>
          </Link>
        </div>
      </section>
    </main>
  )
}
