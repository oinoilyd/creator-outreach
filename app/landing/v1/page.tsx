import Link from 'next/link'
import { VersionSwitcher } from '@/components/landing/VersionSwitcher'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V1 — EDITORIAL MAGAZINE
 *
 * Direction: New Yorker / Bloomberg Businessweek / The Atlantic.
 * Cream paper substrate, oxford-blue ink, single oxblood accent.
 * Heavy serif headlines, justified body, drop caps, pull quotes,
 * footnoted captions, multi-column flow on wide screens.
 *
 * The product is reframed as a "feature article" about a tool that
 * an indie operator built — not a SaaS landing page. Headers feel
 * like article kickers, not marketing.
 */

export const metadata = {
  title: 'Creator Outreach — A Quiet Tool for a Loud Channel',
  description: 'A small piece of software for indie operators running creator outreach. Built by one person, used by a few.',
}

export default async function LandingV1() {
  const { isAuthed } = await getLandingAuthState()

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#F2EBDA', color: '#1A2238' }}>
      <VersionSwitcher />

      {/* Masthead */}
      <header className="border-b-2 border-[#1A2238]">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-baseline justify-between gap-6">
          <div className="font-serif">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#1A2238]/60">Vol. I · No. 1 · 2026</div>
            <div className="text-2xl md:text-3xl font-bold tracking-tight">The Outreach Review</div>
          </div>
          <div className="hidden md:flex items-center gap-5 text-[11px] uppercase tracking-[0.18em] text-[#1A2238]/70">
            <span>Search</span>
            <span>Score</span>
            <span>Pitch</span>
            <span>Track</span>
          </div>
          <Link
            href={isAuthed ? '/' : '/auth/signup'}
            className="text-[11px] uppercase tracking-[0.18em] border-b-2 border-[#8C2A2A] hover:text-[#8C2A2A] transition-colors pb-0.5"
          >
            {isAuthed ? 'Open the app →' : 'Subscribe (free) →'}
          </Link>
        </div>
      </header>

      {/* Cover */}
      <section className="border-b border-[#1A2238]/30">
        <div className="max-w-[1200px] mx-auto px-6 py-16 md:py-24 grid md:grid-cols-12 gap-8">
          <div className="md:col-span-8">
            <div className="font-serif italic text-[#8C2A2A] text-[14px] mb-4 tracking-wide">
              ESSAYS · ON SOFTWARE · I — A PRACTITIONER'S TOOL
            </div>
            <h1 className="font-serif font-bold leading-[0.95] tracking-tight" style={{ fontSize: 'clamp(2.75rem, 7vw, 6.5rem)' }}>
              How I stopped<br />
              <em className="not-italic"><span className="text-[#8C2A2A]">running outreach</span></em><br />
              like it was 2014.
            </h1>
            <div className="mt-8 font-serif text-[15px] text-[#1A2238]/70 leading-[1.6] max-w-[60ch] italic">
              On the spreadsheet, the four-tab workflow, and the small
              piece of software that replaced both — written by the
              person who built it, used by a few dozen others, free
              while it's still being figured out.
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 font-serif text-[13px] text-[#1A2238]/70">
              <span>By <em className="font-semibold not-italic">D. Meehan</em></span>
              <span aria-hidden>·</span>
              <span>Reading time: 4 minutes</span>
              <span aria-hidden>·</span>
              <span>Filed under: <em>Software</em>, <em>Indie</em></span>
            </div>
          </div>
          <aside className="md:col-span-4 md:border-l md:border-[#1A2238]/30 md:pl-6 font-serif">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#1A2238]/60 mb-3">In This Issue</div>
            <ol className="space-y-3 text-[14px] leading-[1.5]">
              <li><span className="text-[#8C2A2A] font-semibold">I.</span> The spreadsheet problem</li>
              <li><span className="text-[#8C2A2A] font-semibold">II.</span> Five platforms, one queue</li>
              <li><span className="text-[#8C2A2A] font-semibold">III.</span> Plain-English scoring</li>
              <li><span className="text-[#8C2A2A] font-semibold">IV.</span> Templates that don't lie</li>
              <li><span className="text-[#8C2A2A] font-semibold">V.</span> What it costs (nothing, yet)</li>
            </ol>
          </aside>
        </div>
      </section>

      {/* Body — multi-column with drop cap */}
      <article className="border-b border-[#1A2238]/30">
        <div className="max-w-[1200px] mx-auto px-6 py-16 md:py-24 grid md:grid-cols-12 gap-8 font-serif text-[16px] leading-[1.65] text-[#1A2238]">
          <div className="md:col-span-3">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#1A2238]/60 sticky top-20">
              I. The Spreadsheet<br />
              <span className="text-[#8C2A2A]">Problem</span>
            </div>
          </div>
          <div className="md:col-span-9 md:columns-2 md:gap-10 md:[column-rule:1px_solid_rgba(26,34,56,0.18)]">
            <p className="mb-5">
              <span className="float-left text-[5.5rem] leading-[0.85] mr-2 mt-1 font-bold text-[#8C2A2A]">F</span>
              or the better part of a year I ran creator outreach
              for a small consumer product the way most operators
              do: a multi-tab spreadsheet, three message templates
              copy-pasted from Notion, and a tab in Outlook with the
              search query "still alive?" pinned to the top.
            </p>
            <p className="mb-5">
              The spreadsheet was a graveyard. By Friday afternoon I
              could not tell you which of the seventy-three creators
              I had emailed had actually replied, which had agreed
              to a partnership, or which had quietly ghosted three
              touches ago. I knew because I had been wrong about
              this twice already — once in front of a partner who
              had already declined, and once with a creator who had
              already shipped.
            </p>
            <p className="mb-5">
              I tried two CRMs. Both were too expensive for one
              person, both required a setup ritual I never finished,
              and both had no idea what an Instagram handle was.
              I went back to the spreadsheet. The spreadsheet, of
              course, did not get better.
            </p>
            <p>
              So I built the smallest tool I could that would not let
              me forget. It searches five platforms in one query,
              scores the results in plain English, drafts the right
              templated message per channel, and pings me when a
              reply lapses. It is not, in any meaningful sense, a
              CRM. It is a queue with discipline.
            </p>
          </div>
        </div>
      </article>

      {/* Pull quote */}
      <section className="border-b border-[#1A2238]/30">
        <div className="max-w-[900px] mx-auto px-6 py-20 md:py-28 text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#8C2A2A] mb-6">Pulled from the piece</div>
          <blockquote className="font-serif italic text-[#1A2238] leading-[1.18]" style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)' }}>
            “The spreadsheet was a graveyard. The CRM was a museum.
            I needed a queue with discipline.”
          </blockquote>
          <div className="mt-8 font-serif text-[12px] text-[#1A2238]/60 uppercase tracking-[0.2em]">
            — From <em>How I Stopped Running Outreach Like It Was 2014</em>
          </div>
        </div>
      </section>

      {/* Three columns — features as essay sub-sections */}
      <section className="border-b border-[#1A2238]/30">
        <div className="max-w-[1200px] mx-auto px-6 py-16 md:py-24 grid md:grid-cols-3 gap-10 font-serif text-[15px] leading-[1.55] text-[#1A2238]/85">
          <FeatureEssay
            chapter="II"
            title="Five platforms, one queue"
            body="A single search returns YouTube, Instagram, TikTok, X, and LinkedIn creators in the same table. You filter by audience size, region, and recency. It is the part of the tool that takes the longest to explain because it sounds, in 2026, suspiciously simple."
          />
          <FeatureEssay
            chapter="III"
            title="Plain-English scoring"
            body="The fit score is computed in English, not stars. You read why a creator scored high. You correct the criteria. The next search uses your correction. Nobody is required to learn a slider."
          />
          <FeatureEssay
            chapter="IV"
            title="Templates that don't lie"
            body="One click composes the right message for the channel — DM on Instagram, message on LinkedIn, email everywhere else. The template includes the creator's first name and one line you can always edit. Auto-cadence pings you when a reply lapses."
          />
        </div>
      </section>

      {/* Pricing — masthead-style strip */}
      <section id="pricing" className="border-b border-[#1A2238]/30">
        <div className="max-w-[1200px] mx-auto px-6 py-16 md:py-20 grid md:grid-cols-12 gap-8">
          <div className="md:col-span-3 font-serif">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#1A2238]/60">V. What it costs</div>
            <div className="mt-2 italic text-[#8C2A2A] text-[20px]">— Nothing, yet.</div>
          </div>
          <div className="md:col-span-9 font-serif text-[16px] leading-[1.6] text-[#1A2238]/85">
            <p className="mb-4">
              <span className="font-bold text-[#1A2238]">$0</span> while in beta. There is no
              card on file, no annual commitment, no seat cap.
              Beta users will be grandfathered into a price that
              has not yet been set, and which will be announced
              before any tier changes.
            </p>
            <p className="text-[14px] text-[#1A2238]/65 italic">
              I would rather have you tell me it is broken than have
              you have paid for it being broken.
            </p>
            <Link
              href={isAuthed ? '/' : '/auth/signup'}
              className="mt-6 inline-flex items-center gap-2 bg-[#1A2238] text-[#F2EBDA] hover:bg-[#8C2A2A] transition-colors px-6 py-3 font-serif text-[15px]"
            >
              {isAuthed ? 'Open the app' : 'Begin reading (free)'} <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Colophon footer */}
      <footer className="font-serif text-[12px] text-[#1A2238]/65">
        <div className="max-w-[1200px] mx-auto px-6 py-8 grid md:grid-cols-3 gap-4">
          <div>
            <div className="uppercase tracking-[0.22em] text-[10px] text-[#1A2238]/50">Colophon</div>
            <div className="mt-1">Set in Source Serif & system serif. Printed on the open web. © 2026 Creator Outreach.</div>
          </div>
          <div className="md:text-center">
            <Link href="/privacy" className="hover:text-[#8C2A2A] mr-4">Privacy</Link>
            <Link href="/terms" className="hover:text-[#8C2A2A] mr-4">Terms</Link>
            <a href="mailto:dmeehanj@gmail.com" className="hover:text-[#8C2A2A]">Contact</a>
          </div>
          <div className="md:text-right">
            Vol. I · No. 1 · 2026 · D. Meehan, Editor & Operator
          </div>
        </div>
      </footer>
    </main>
  )
}

function FeatureEssay({ chapter, title, body }: { chapter: string; title: string; body: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-[#8C2A2A] mb-2">Chapter {chapter}</div>
      <h3 className="font-serif font-semibold text-[22px] leading-[1.15] mb-3 text-[#1A2238]">
        {title}
      </h3>
      <p>{body}</p>
    </div>
  )
}
