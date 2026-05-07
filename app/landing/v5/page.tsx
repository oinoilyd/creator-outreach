import Link from 'next/link'
import Image from 'next/image'
import { VersionSwitcher } from '@/components/landing/VersionSwitcher'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V5 — ANTHROPIC-STYLE
 *
 * Reference: anthropic.com
 *
 * Visual signatures we're modeling:
 *   - Cream/off-white substrate (#F4EFE8)
 *   - Editorial display serif headlines (Instrument Serif), italic
 *     accents on key words
 *   - Sans body (Geist Sans), generous line-height, narrow column
 *   - Single warm accent: terracotta-rust (#A0501F)
 *   - Restrained, editorial layout — long single-column scroll, big
 *     quiet hero, ample whitespace
 *   - Section dividers as thin warm-rust horizontal rules
 *   - Reading-optimized: 70ch max width on prose, lead paragraph in
 *     larger size with tighter leading
 *   - Quiet authority — speaks softly, no exclamation marks
 *
 * Distinct from V1 (Linear premium dark) and V2 (Clay warm B2B): this
 * is the "intellectual / institutional" register. Less product-shop,
 * more publication.
 */

export const metadata = {
  title: 'Creator Outreach — A precise tool for the work of finding and writing to creators.',
  description: 'A small piece of software for the operators who actually send the messages. Five platforms, plain-English scoring, templated outreach per channel.',
}

export default async function LandingV5() {
  const { isAuthed } = await getLandingAuthState()

  return (
    <main className="min-h-screen relative" style={{ backgroundColor: '#F4EFE8', color: '#1A1410' }}>
      <VersionSwitcher />

      {/* Top nav */}
      <header className="border-b border-[#1A1410]/10">
        <div className="max-w-[1180px] mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/landing/v5" className="flex items-baseline gap-3">
            <span className="font-[family-name:var(--font-instrument-serif)] text-[24px] tracking-tight text-[#1A1410]">
              Creator Outreach
            </span>
            <span className="hidden sm:inline-block font-[family-name:var(--font-geist-sans)] text-[11px] uppercase tracking-[0.18em] text-[#A0501F]">
              An indie tool
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-[13px] text-[#1A1410]/65 font-[family-name:var(--font-geist-sans)]">
            <a href="#manifesto" className="hover:text-[#1A1410] transition-colors">Why</a>
            <a href="#preview"   className="hover:text-[#1A1410] transition-colors">Product</a>
            <a href="#pricing"   className="hover:text-[#1A1410] transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-2 font-[family-name:var(--font-geist-sans)]">
            {!isAuthed && (
              <Link href="/auth/signin" className="text-[13px] text-[#1A1410]/65 hover:text-[#1A1410] px-3 py-2 transition-colors">
                Sign in
              </Link>
            )}
            <Link
              href={isAuthed ? '/' : '/auth/signup'}
              className="inline-flex items-center gap-1.5 bg-[#1A1410] text-[#F4EFE8] hover:bg-[#A0501F] px-4 py-2 text-[13px] font-medium transition-colors"
            >
              {isAuthed ? 'Open' : 'Begin'}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 pt-24 md:pt-36 pb-20 md:pb-28">
        <div className="max-w-[940px] mx-auto">
          <div className="font-[family-name:var(--font-geist-sans)] text-[12px] uppercase tracking-[0.22em] text-[#A0501F] mb-8">
            ◇ Vol. I · An Essay on a Small Tool
          </div>
          <h1
            className="font-[family-name:var(--font-instrument-serif)] tracking-[-0.015em] leading-[0.99] text-[#1A1410]"
            style={{ fontSize: 'clamp(3rem, 8vw, 7rem)' }}
          >
            A precise tool for the <em className="text-[#A0501F]">work</em> of finding and writing to creators.
          </h1>
          <p className="mt-10 max-w-[60ch] font-[family-name:var(--font-geist-sans)] text-[18px] md:text-[19px] text-[#1A1410]/75 leading-[1.65]">
            Search five platforms in one query. Score every creator in
            plain English. Pitch with the right templated message per
            channel. Track every reply in a single quiet queue. Built
            for operators who care about how the tools they use feel
            in the hand.
          </p>
          <div className="mt-12 flex items-center gap-5 font-[family-name:var(--font-geist-sans)]">
            <Link
              href={isAuthed ? '/' : '/auth/signup'}
              className="inline-flex items-center gap-2 bg-[#1A1410] text-[#F4EFE8] hover:bg-[#A0501F] px-6 py-3 text-[15px] font-medium transition-colors"
            >
              {isAuthed ? 'Open the app' : 'Begin reading'}
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="#manifesto"
              className="text-[14px] text-[#1A1410]/70 hover:text-[#A0501F] underline decoration-1 decoration-[#1A1410]/25 hover:decoration-[#A0501F] underline-offset-[5px] transition-colors"
            >
              On why this exists ↓
            </Link>
          </div>
        </div>
      </section>

      {/* Editorial divider */}
      <div className="max-w-[940px] mx-auto px-6">
        <hr className="border-t border-[#A0501F]/40" />
      </div>

      {/* Manifesto / why — single-column reading */}
      <section id="manifesto" className="px-6 py-20 md:py-28">
        <article className="max-w-[680px] mx-auto font-[family-name:var(--font-geist-sans)] text-[17px] md:text-[18px] leading-[1.75] text-[#1A1410]/85">
          <div className="text-[12px] uppercase tracking-[0.22em] text-[#A0501F] mb-5">
            ◇ I — On The Spreadsheet
          </div>
          <h2 className="font-[family-name:var(--font-instrument-serif)] text-[#1A1410] mb-10 leading-[1.05]" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
            On the spreadsheet, and why I stopped using one.
          </h2>
          <p className="mb-6">
            For the better part of a year I ran creator outreach for a
            consumer product the way most operators do: a multi-tab
            spreadsheet, three message templates copy-pasted from
            Notion, a tab in Outlook with the search query{' '}
            <em className="font-[family-name:var(--font-instrument-serif)]">"still alive?"</em> pinned to the top.
            By Friday afternoon I could not tell you which of the
            seventy-three creators I had emailed had replied, which
            had agreed, or which had quietly ghosted three touches ago.
          </p>
          <p className="mb-6">
            I tried two CRMs. Both were too expensive for one person,
            both required a setup ritual I never finished, and neither
            knew what an Instagram handle was. I went back to the
            spreadsheet. The spreadsheet, of course, did not get
            better.
          </p>
          <p>
            So I built the smallest tool I could that would not let
            me forget. Five platforms in one query, plain-English
            scoring, the right templated message per channel,
            auto-cadence pings me when a reply lapses. It is not, in
            any meaningful sense, a CRM. It is{' '}
            <em className="font-[family-name:var(--font-instrument-serif)]">a queue with discipline.</em>
          </p>
        </article>
      </section>

      {/* Product preview — restrained frame */}
      <section id="preview" className="px-6 pb-20 md:pb-28">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-[12px] uppercase tracking-[0.22em] text-[#A0501F] mb-5 text-center font-[family-name:var(--font-geist-sans)]">
            ◇ II — The Tool, Captured
          </div>
          <figure>
            <div className="border border-[#1A1410]/15 bg-white p-3" style={{ boxShadow: '0 30px 60px -30px rgba(160,80,31,0.18), 0 12px 24px -12px rgba(26,20,16,0.10)' }}>
              <div className="relative aspect-[1440/900] bg-[#0A0E13] overflow-hidden">
                <Image
                  src="/screenshots/results.png"
                  alt="Creator Outreach — Results view"
                  fill
                  priority
                  sizes="(min-width: 1100px) 1100px, 100vw"
                  className="object-cover object-top"
                />
              </div>
            </div>
            <figcaption className="mt-4 text-center font-[family-name:var(--font-instrument-serif)] italic text-[15px] text-[#1A1410]/65">
              Fig. 1 — the Results view, with five platforms searched in one query and scored on fit.
            </figcaption>
          </figure>
        </div>
      </section>

      <div className="max-w-[940px] mx-auto px-6">
        <hr className="border-t border-[#A0501F]/40" />
      </div>

      {/* Three column features — editorial */}
      <section className="px-6 py-20 md:py-28">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-[12px] uppercase tracking-[0.22em] text-[#A0501F] mb-5 font-[family-name:var(--font-geist-sans)]">
            ◇ III — The Method
          </div>
          <h2 className="font-[family-name:var(--font-instrument-serif)] text-[#1A1410] mb-12 leading-[1.05] max-w-[18ch]" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.25rem)' }}>
            Three motions, repeated until the queue is quiet.
          </h2>
          <div className="grid md:grid-cols-3 gap-x-10 gap-y-12 font-[family-name:var(--font-geist-sans)]">
            <Chapter
              numeral="i."
              title="Source"
              body="A single search returns YouTube, Instagram, TikTok, X, and LinkedIn creators in the same table. Filter by audience, region, recency. AI surfaces fits matching the criteria you typed in plain English."
            />
            <Chapter
              numeral="ii."
              title="Score"
              body="Each creator is scored on fit, reach, and recency. The reasoning is shown in English you can read and correct. The next search learns."
            />
            <Chapter
              numeral="iii."
              title="Pitch"
              body="One click composes the right templated message per channel — DM on Instagram, message on LinkedIn, email everywhere else. Auto-cadence pings you when silence hits three days."
            />
          </div>
        </div>
      </section>

      <div className="max-w-[940px] mx-auto px-6">
        <hr className="border-t border-[#A0501F]/40" />
      </div>

      {/* Pull-quote — full bleed text moment */}
      <section className="px-6 py-24 md:py-32">
        <div className="max-w-[820px] mx-auto text-center">
          <blockquote className="font-[family-name:var(--font-instrument-serif)] italic text-[#1A1410] leading-[1.15]" style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)' }}>
            “The spreadsheet was a graveyard. The CRM was a museum. I
            wanted a queue with discipline.”
          </blockquote>
          <div className="mt-7 font-[family-name:var(--font-geist-sans)] text-[12px] uppercase tracking-[0.22em] text-[#1A1410]/55">
            — From <em className="not-italic">Vol. I, Section I</em>
          </div>
        </div>
      </section>

      <div className="max-w-[940px] mx-auto px-6">
        <hr className="border-t border-[#A0501F]/40" />
      </div>

      {/* Pricing — restrained editorial */}
      <section id="pricing" className="px-6 py-20 md:py-28">
        <div className="max-w-[820px] mx-auto">
          <div className="text-[12px] uppercase tracking-[0.22em] text-[#A0501F] mb-5 font-[family-name:var(--font-geist-sans)]">
            ◇ IV — On What It Costs
          </div>
          <h2 className="font-[family-name:var(--font-instrument-serif)] text-[#1A1410] mb-8 leading-[1.05]" style={{ fontSize: 'clamp(2.25rem, 5vw, 4rem)' }}>
            <em className="text-[#A0501F]">Nothing,</em> for now.
          </h2>
          <p className="font-[family-name:var(--font-geist-sans)] text-[17px] text-[#1A1410]/75 leading-[1.65] max-w-[58ch]">
            $0 while in beta. No card on file, no seat cap, no annual
            commitment. Beta users will be grandfathered into a price
            that has not yet been set, and which will be announced
            before any tier change. I would rather you tell me it is
            broken than have you have paid for it being broken.
          </p>
          <Link
            href={isAuthed ? '/' : '/auth/signup'}
            className="mt-10 inline-flex items-center gap-2 bg-[#1A1410] text-[#F4EFE8] hover:bg-[#A0501F] px-6 py-3 font-[family-name:var(--font-geist-sans)] text-[15px] font-medium transition-colors"
          >
            {isAuthed ? 'Open the app' : 'Begin'}
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1A1410]/15 px-6 py-10 font-[family-name:var(--font-geist-sans)]">
        <div className="max-w-[1180px] mx-auto flex flex-wrap items-center justify-between gap-3 text-[13px] text-[#1A1410]/55">
          <div className="flex items-baseline gap-3">
            <span className="font-[family-name:var(--font-instrument-serif)] text-[18px] text-[#1A1410]">Creator Outreach</span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#A0501F]">Vol. I · 2026</span>
          </div>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-[#1A1410] transition-colors">Privacy</Link>
            <Link href="/terms"   className="hover:text-[#1A1410] transition-colors">Terms</Link>
            <a href="mailto:dmeehanj@gmail.com" className="hover:text-[#1A1410] transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  )
}

function Chapter({ numeral, title, body }: { numeral: string; title: string; body: string }) {
  return (
    <div>
      <div className="font-[family-name:var(--font-instrument-serif)] italic text-[#A0501F] text-[24px] mb-2">{numeral}</div>
      <h3 className="font-[family-name:var(--font-instrument-serif)] text-[26px] tracking-[-0.005em] text-[#1A1410] mb-3">{title}</h3>
      <p className="text-[15px] text-[#1A1410]/70 leading-[1.65]">{body}</p>
    </div>
  )
}
