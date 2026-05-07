import Link from 'next/link'
import Image from 'next/image'
import { VersionSwitcher } from '@/components/landing/VersionSwitcher'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V5 — OPERATOR'S NOTEBOOK
 *
 * Direction: Pieter Levels' personal site × Paul Graham essays ×
 * indie-hacker journals × Notion changelog × handwritten zine.
 * Off-white paper, ink-blue ballpoint underlines, hand-drawn arrows
 * pointing at things, polaroid-style screenshot frames with caption
 * tape, mixed font sizes, casual humanizing voice.
 *
 * Reads like the actual operator's notebook — not a marketing site,
 * not a brand. The product is the byproduct of a person solving
 * their own problem and offering the result to anyone else who has it.
 */

export const metadata = {
  title: "Dylan's notebook — building Creator Outreach",
  description: 'A tool I built to stop running creator outreach in spreadsheets. Free while in beta. Made by one person, used by a few dozen.',
}

export default async function LandingV5() {
  const { isAuthed } = await getLandingAuthState()

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#FBF7EE', color: '#1B2A4E' }}>
      <VersionSwitcher />

      {/* Top — handwritten title block */}
      <header className="px-6 pt-14 md:pt-20 max-w-[820px] mx-auto">
        <div className="text-[13px] text-[#1B2A4E]/60 italic mb-3">
          dylan's notebook · vol. 1 / page 1 · written 2026
        </div>
        <h1
          className="leading-[0.95] tracking-tight"
          style={{
            fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
            fontSize: 'clamp(2.5rem, 6vw, 5rem)',
            fontWeight: 600,
          }}
        >
          I built a tool because I hated{' '}
          <span className="relative inline-block">
            spreadsheets
            <Underline />
          </span>{' '}
          for outreach.
        </h1>
        <p className="mt-7 text-[18px] leading-[1.65]" style={{ fontFamily: 'ui-serif, Georgia, "Times New Roman", serif' }}>
          It's called <strong>Creator Outreach</strong>. It searches
          five platforms in one query, scores creators in plain
          English, drafts the right templated message per channel, and
          reminds me to follow up. It's free while I figure it out.
          You can{' '}
          <Link href={isAuthed ? '/' : '/auth/signup'} className="border-b-2 border-[#1B2A4E] hover:text-[#C45C27]">
            try it{' '}
            <ArrowDoodle />
          </Link>
          {' '}or keep reading.
        </p>
      </header>

      {/* Polaroid screenshot — taped to page */}
      <section className="px-6 mt-16 md:mt-20 max-w-[820px] mx-auto">
        <Polaroid
          caption="The Results table. This is the screen I look at the most."
          tilt={-2}
          src="/screenshots/results.png"
        />
      </section>

      {/* Why I built it */}
      <article
        className="px-6 mt-16 md:mt-24 max-w-[680px] mx-auto"
        style={{ fontFamily: 'ui-serif, Georgia, "Times New Roman", serif' }}
      >
        <h2 className="text-[14px] uppercase tracking-[0.22em] text-[#1B2A4E]/55 mb-3">
          Why I built it
        </h2>
        <div className="text-[18px] leading-[1.7] space-y-5 text-[#1B2A4E]">
          <p>
            For a year I ran outreach for a fishing-conditions product
            using a spreadsheet, three Outlook templates, and a
            running tab of "still alive?" searches. I forgot to follow
            up with everyone twice.{' '}
            <Marginalia>(this was the worst part)</Marginalia>
          </p>
          <p>
            Two CRMs were too expensive for one person and didn't know
            what an Instagram handle was. So I wrote my own. It is
            <em> tiny</em>. It is a queue with discipline, and it
            ships every day.
          </p>
        </div>
      </article>

      {/* What it does — bulleted notes */}
      <article
        className="px-6 mt-16 md:mt-20 max-w-[680px] mx-auto"
        style={{ fontFamily: 'ui-serif, Georgia, "Times New Roman", serif' }}
      >
        <h2 className="text-[14px] uppercase tracking-[0.22em] text-[#1B2A4E]/55 mb-3">
          What it does
        </h2>
        <ul className="space-y-3 text-[17px] leading-[1.55]">
          <NoteItem>
            <strong>Searches 5 platforms</strong> at once: YouTube,
            Instagram, TikTok, X, LinkedIn. <em>Filter by audience size, recency, region.</em>
          </NoteItem>
          <NoteItem>
            <strong>Scores fit in plain English.</strong> "Strong fit
            — posts about commercial real estate weekly, 80k
            followers, last upload 3 days ago." You correct it; the
            next search learns.
          </NoteItem>
          <NoteItem>
            <strong>Composes a templated message</strong> per channel
            in one click — DM on IG, message on LinkedIn, email
            elsewhere. Edit before send.
          </NoteItem>
          <NoteItem>
            <strong>Auto-cadence</strong> pings me when a reply lapses
            beyond a few days, so nothing rots in the queue.
          </NoteItem>
        </ul>
      </article>

      {/* Margin annotated screenshot 2 */}
      <section className="px-6 mt-16 md:mt-20 max-w-[820px] mx-auto">
        <Polaroid
          caption="Outreach board. Each card = one creator I'm pitching."
          tilt={1.5}
          src="/screenshots/outreach.png"
        />
      </section>

      {/* What it costs */}
      <article
        className="px-6 mt-16 md:mt-20 max-w-[680px] mx-auto"
        style={{ fontFamily: 'ui-serif, Georgia, "Times New Roman", serif' }}
      >
        <h2 className="text-[14px] uppercase tracking-[0.22em] text-[#1B2A4E]/55 mb-3">
          What it costs
        </h2>
        <p className="text-[18px] leading-[1.7]">
          <strong className="text-[28px] block mb-2">Nothing, yet.</strong>
          Beta is free. No card. No seat cap. When I start charging,
          everyone using it now gets grandfathered into a price I
          announce in advance. I'd rather you tell me it's broken
          than pay me for it being broken.
        </p>
      </article>

      {/* Sign in / sign up — handwritten button feel */}
      <section className="px-6 mt-12 md:mt-16 max-w-[680px] mx-auto">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={isAuthed ? '/' : '/auth/signup'}
            className="inline-flex items-center gap-2 bg-[#1B2A4E] text-[#FBF7EE] hover:bg-[#C45C27] transition-colors px-6 py-3 border-[3px] border-[#1B2A4E] hover:border-[#C45C27] text-[16px] font-medium"
            style={{ fontFamily: 'ui-serif, Georgia, "Times New Roman", serif' }}
          >
            {isAuthed ? '↗ Open the app' : '↗ Try it (it\'s free)'}
          </Link>
          {!isAuthed && (
            <Link
              href="/auth/signin"
              className="text-[15px] text-[#1B2A4E]/70 hover:text-[#C45C27] underline decoration-2 decoration-[#1B2A4E]/30 hover:decoration-[#C45C27] underline-offset-4"
            >
              or sign in if you've used it before
            </Link>
          )}
        </div>
      </section>

      {/* Hand-signed footer */}
      <footer className="px-6 mt-24 md:mt-32 pb-16 max-w-[680px] mx-auto" style={{ fontFamily: 'ui-serif, Georgia, "Times New Roman", serif' }}>
        <div className="border-t border-[#1B2A4E]/30 pt-8">
          <p className="text-[16px] leading-[1.65] text-[#1B2A4E]/85 italic">
            Tell me what's missing. The form on{' '}
            <a href="mailto:dmeehanj@gmail.com" className="border-b border-[#1B2A4E] hover:text-[#C45C27]">
              dmeehanj@gmail.com
            </a>{' '}
            goes straight to me. I read every reply. If something is
            broken, I'm the only one who can fix it — so tell me.
          </p>
          <div
            className="mt-6 text-[28px] text-[#C45C27]"
            style={{ fontFamily: '"Brush Script MT", "Lucida Handwriting", cursive', transform: 'rotate(-3deg)', display: 'inline-block' }}
          >
            — Dylan
          </div>
          <div className="mt-10 text-[12px] text-[#1B2A4E]/50 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>© 2026 Creator Outreach</span>
            <Link href="/privacy" className="hover:text-[#C45C27]">privacy</Link>
            <Link href="/terms" className="hover:text-[#C45C27]">terms</Link>
            <a href="mailto:dmeehanj@gmail.com" className="hover:text-[#C45C27]">contact</a>
          </div>
        </div>
      </footer>
    </main>
  )
}

/* ─── tiny notebook primitives ─── */

function Underline() {
  // Hand-drawn-feel ballpoint underline using SVG
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 12"
      preserveAspectRatio="none"
      className="absolute left-0 right-0 -bottom-1 w-full h-[10px]"
    >
      <path
        d="M2,8 C40,2 80,11 120,5 C160,1 180,9 198,4"
        stroke="#C45C27"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ArrowDoodle() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 40 12"
      className="inline-block w-[36px] h-[12px] align-baseline ml-1"
    >
      <path
        d="M2,6 C12,2 22,10 32,6"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M28,2 L34,6 L28,10"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

function Marginalia({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block text-[14px] text-[#C45C27] italic ml-1"
      style={{ fontFamily: '"Lucida Handwriting", "Brush Script MT", cursive' }}
    >
      {children}
    </span>
  )
}

function NoteItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[max-content_1fr] gap-3">
      <span className="text-[#C45C27] text-[20px] leading-none mt-1">▸</span>
      <span>{children}</span>
    </li>
  )
}

function Polaroid({ caption, tilt = 0, src }: { caption: string; tilt?: number; src: string }) {
  return (
    <figure
      className="relative bg-white p-3 pb-12 mx-auto max-w-[680px]"
      style={{
        transform: `rotate(${tilt}deg)`,
        boxShadow: '0 12px 30px -10px rgba(27,42,78,0.30), 0 4px 8px -2px rgba(27,42,78,0.12)',
      }}
    >
      {/* Tape strip */}
      <div
        aria-hidden
        className="absolute -top-3 left-1/2 w-20 h-7 -translate-x-1/2 rotate-[-3deg]"
        style={{ backgroundColor: 'rgba(196,92,39,0.4)', boxShadow: 'inset 0 0 6px rgba(0,0,0,0.08)' }}
      />
      <div className="relative aspect-[1440/900] bg-[#080A11] overflow-hidden">
        <Image
          src={src}
          alt={caption}
          fill
          sizes="(min-width: 680px) 680px, 100vw"
          className="object-cover object-top"
        />
      </div>
      <figcaption
        className="absolute left-0 right-0 bottom-2 text-center text-[14px] text-[#1B2A4E]/85 italic px-4"
        style={{ fontFamily: '"Lucida Handwriting", "Brush Script MT", cursive' }}
      >
        {caption}
      </figcaption>
    </figure>
  )
}
