import Link from 'next/link'
import { AppPreview } from '@/components/landing/AppPreview'
import { LandingNav } from '@/components/landing/LandingNav'
import { ContactForm } from '@/components/landing/ContactForm'
import { FAQ } from '@/components/landing/FAQ'
import { PlatformMarquee } from '@/components/landing/PlatformMarquee'
import { createClient } from '@/lib/supabase/server'

/**
 * Editorial redesign — "Founder's letter."
 *
 * Stripped: lava-lamp Aurora, Meteors, BorderBeam, Spotlight,
 *           live-pulse dots, gradient headline text, bento grid,
 *           glass cards stacked everywhere.
 *
 * Kept    : LandingNav, AppPreview (cleaned), PlatformMarquee,
 *           FAQ, ContactForm, semantic tokens (--brand, --foreground),
 *           Playwright tests targeted at structural elements.
 *
 * Voice   : First person, indie operator, no marketing-bot.
 */

export const metadata = {
  title: 'Creator Outreach — find them, score them, pitch them, close them',
  description: 'A focused tool for running creator outreach. Built by an indie operator. Free while in beta.',
}

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthed = !!user

  return (
    <main className="relative min-h-screen text-foreground bg-background">
      <LandingNav isAuthed={isAuthed} />

      {/* ─── Hero ─────────────────────────────────────────────────
          Asymmetric, text-led, generous whitespace. One accent
          color (brand violet) appears on the inline highlight word
          and the primary CTA. Nothing else animates on first paint
          except a one-shot fade. */}
      <section className="relative px-6 pt-16 md:pt-28 pb-20 md:pb-32">
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-y-12 gap-x-8 items-end">
          {/* Left — eyebrow + headline + subline */}
          <div className="lg:col-span-8">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-6">
              Beta · Built by one person
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-[-0.02em] leading-[1.05] mb-8">
              Outreach to creators<br className="hidden md:block" />
              that actually <span className="text-brand">closes</span>.
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-[52ch] leading-relaxed">
              Find creators across YouTube, Instagram, TikTok, X, and LinkedIn. Score them in plain English.
              Pitch them with a templated message. Track every reply.<br className="hidden md:block" />
              No spreadsheet. No four-tab workflow. No $400 / month CRM.
            </p>
          </div>

          {/* Right — CTAs (clean, no border beam, no glow) */}
          <div className="lg:col-span-4 flex flex-col gap-3 lg:items-end">
            <Link
              href={isAuthed ? '/' : '/auth/signup'}
              className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-md font-medium text-base active:scale-[0.98] hover:opacity-90 transition-[opacity,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {isAuthed ? 'Open the app' : 'Try it free'}
              <span aria-hidden>→</span>
            </Link>
            {!isAuthed && (
              <Link
                href="/auth/signin"
                className="inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors lg:self-end"
              >
                or sign in
              </Link>
            )}
            <p className="text-xs text-muted-foreground/70 mt-1">
              No credit card. Beta is free.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Product preview ───────────────────────────────────── */}
      <section className="relative px-6 pb-24 md:pb-32">
        <div className="max-w-[1100px] mx-auto">
          <AppPreview />
        </div>
      </section>

      {/* ─── Platform marquee ─────────────────────────────────── */}
      <section className="relative px-6 pb-24 md:pb-32">
        <PlatformMarquee />
      </section>

      {/* ─── Founder's note ────────────────────────────────────── */}
      <section id="about" className="relative px-6 pb-24 md:pb-32 scroll-mt-20">
        <div className="max-w-[680px] mx-auto">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-6">
            Why I built this
          </div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.01em] leading-snug mb-8">
            I was running outreach in a spreadsheet, three browser tabs, and a Notion page that was always out of date.
          </h2>
          <div className="space-y-5 text-base md:text-lg leading-relaxed text-muted-foreground">
            <p>
              The tools I tried cost more than my rent. They could find creators, sure. But none of them
              could tell me which ones were actually a good fit for what I was building. So I&apos;d still end up
              ranking the list myself, in a spreadsheet, copying scores from one tab to another.
            </p>
            <p>
              I built this because I wanted one thing on my screen — a queue, scored by criteria I describe in plain English,
              with the right pitch already in my clipboard when I hit the email cell. That&apos;s it.
            </p>
            <p>
              It&apos;s still early. I&apos;m the only person on it. If you use it and something&apos;s off,
              tell me — that&apos;s how it gets better.
            </p>
            <p className="text-sm text-muted-foreground/70 pt-2">
              — Dylan
            </p>
          </div>
        </div>
      </section>

      {/* ─── How it works (numbered) ───────────────────────────── */}
      <section className="relative px-6 pb-24 md:pb-32">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-12 text-center">
            How it works
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12">
            <NumberedStep
              n="01"
              title="Search"
              body="One query searches YouTube, Instagram, TikTok, X, and LinkedIn in parallel. Filter by views, subscribers, region, and last-posted date. Skip the dead channels."
            />
            <NumberedStep
              n="02"
              title="Score"
              body="Tell the tool what makes a good lead in plain English — &ldquo;small US legal channels with consistent uploads.&rdquo; AI ranks every result against your words."
            />
            <NumberedStep
              n="03"
              title="Outreach"
              body="Click an Instagram handle, the DM&apos;s in your clipboard. Click email, the draft opens. Templated, personal, ready to send."
            />
            <NumberedStep
              n="04"
              title="Track"
              body="Every reply, every status. Auto follow-up at 3, 7, 14, and 21 days — or whatever rhythm fits the deal. Win rate, response rate, pipeline value all live."
            />
          </div>
        </div>
      </section>

      {/* ─── What's inside (text-led, no bento) ────────────────── */}
      <section className="relative px-6 pb-24 md:pb-32">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-6 text-center">
            What&apos;s inside
          </div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.01em] leading-snug mb-12 text-center max-w-2xl mx-auto">
            Discovery, scoring, outreach, and tracking — under one roof, designed to actually fit together.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
            <TextFeature
              title="Five platforms, one queue"
              body="Search YouTube, Instagram, TikTok, X, and LinkedIn in one query. Same scoring. Same outreach board."
            />
            <TextFeature
              title="AI scoring in plain English"
              body="No formulas. Describe a great lead in your own words; AI re-ranks every result to match."
            />
            <TextFeature
              title="Region targeting"
              body="22 specific regions, language filter, has-email toggle. Focus on creators who fit your market."
            />
            <TextFeature
              title="Built-in CRM"
              body="Channel, email, status pills, medium, notes — every outreach in one row. No second tool."
            />
            <TextFeature
              title="Templated outreach"
              body="One click loads the right templated message — Instagram DM, LinkedIn note, email. Personalize, send."
            />
            <TextFeature
              title="Cadence on your terms"
              body="3, 7, 14, 21 days as a default. Or whatever rhythm fits the deal. The system pings you."
            />
            <TextFeature
              title="Analytics out of the box"
              body="Win rate, response rate, pipeline value, stale follow-ups, status breakdown. No Looker contract."
            />
            <TextFeature
              title="Customize your own metrics"
              body="Counts, percentages, sums, averages — over the filters you set. Saves to your dashboard."
            />
            <TextFeature
              title="Spreadsheet import"
              body="Already running outreach in a sheet? Drag the CSV in. Every row, status, and note arrives intact."
            />
          </div>
        </div>
      </section>

      {/* ─── Pricing ───────────────────────────────────────────── */}
      <section id="pricing" className="relative px-6 pb-24 md:pb-32 scroll-mt-20">
        <div className="max-w-[680px] mx-auto text-center">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-6">
            Pricing
          </div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.01em] leading-snug mb-4">
            Free while in beta.
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            No credit card to start. Beta users will be looked after when pricing arrives —
            early supporters get treated like early supporters.
          </p>
        </div>
      </section>

      {/* ─── FAQ ───────────────────────────────────────────────── */}
      <section id="faq" className="relative px-6 pb-24 md:pb-32 scroll-mt-20">
        <div className="max-w-[680px] mx-auto">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-6 text-center">
            FAQ
          </div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.01em] leading-snug mb-10 text-center">
            Common questions.
          </h2>
          <FAQ />
        </div>
      </section>

      {/* ─── Contact ───────────────────────────────────────────── */}
      <section id="contact" className="relative px-6 pb-24 md:pb-32 scroll-mt-20">
        <div className="max-w-[680px] mx-auto">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-6 text-center">
            Contact
          </div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.01em] leading-snug mb-4 text-center">
            Get in touch.
          </h2>
          <p className="text-muted-foreground mb-10 text-center">
            Feedback, bugs, feature ideas — they all land in the same inbox.
          </p>
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 dark:bg-white/[0.04] dark:border-white/10">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* ─── CTA strip ─────────────────────────────────────────── */}
      {!isAuthed && (
        <section className="relative px-6 pb-24">
          <div className="max-w-[680px] mx-auto text-center border-t border-border pt-16">
            <h3 className="text-xl md:text-2xl font-semibold tracking-[-0.01em] mb-4">
              Stop emailing the wrong creators.
            </h3>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-md font-medium text-sm active:scale-[0.98] hover:opacity-90 transition-[opacity,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Try it free
              <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
      )}

      <footer className="relative px-6 py-8 border-t border-border text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Creator Outreach.{' '}
        <a href="#contact" className="hover:text-foreground transition-colors">
          Contact
        </a>
      </footer>
    </main>
  )
}

/**
 * Numbered step. Print-style — large grey number on the left,
 * label + body on the right. No icons, no animations, no pills.
 */
function NumberedStep({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="flex gap-6">
      <div className="text-3xl md:text-4xl font-semibold text-muted-foreground/40 leading-none tabular-nums shrink-0 w-12">
        {n}
      </div>
      <div>
        <h3 className="text-lg md:text-xl font-semibold tracking-[-0.01em] mb-2">{title}</h3>
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{body}</p>
      </div>
    </div>
  )
}

/**
 * Compact text-only feature row. No icon, no card, no border.
 * Title above, body below, generous gap. Reads like an editorial
 * spec sheet, not a marketing card grid.
 */
function TextFeature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold tracking-[-0.01em] mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  )
}
