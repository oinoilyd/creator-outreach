import Link from 'next/link'
import { MastheadNav } from '@/components/landing/MastheadNav'
import { ScreenshotPlate } from '@/components/landing/ScreenshotPlate'
import { ContactForm } from '@/components/landing/ContactForm'
import { FAQ } from '@/components/landing/FAQ'
import { createClient } from '@/lib/supabase/server'

/**
 * Brutalist redesign — Swiss Industrial Print mode.
 *
 * Direction (taste-skill / brutalist-skill / redesign-skill):
 *   - Substrate: matte unbleached paper (#F4F4F0)
 *   - Foreground: carbon ink (#0A0A0A)
 *   - Single accent: hazard red (#E61919)
 *   - Typography: Archivo Black for the cover headline,
 *     IBM Plex Mono for everything chrome (nav, section markers,
 *     captions, metadata), Geist sans for prose only
 *   - Geometry: 0px border-radius EVERYWHERE
 *   - Motion: none. No fade-in, no spring, no parallax.
 *   - Compartmentalization: 1px ink rules between every section
 *
 * Replaced/removed since prior iterations:
 *   - Aurora / lava-lamp / Meteors / BorderBeam / Spotlight (motion)
 *   - Bento grid feature cards (replaced with ASCII tables)
 *   - 3-pill pricing card row (replaced with a tabular plan list)
 *   - Founder's-letter narrative voice (replaced with declassified-
 *     document tone — numbered sections, footnoted captions, ASCII
 *     framing)
 *   - Theme toggle on landing (committed to light substrate per
 *     taste-skill: "choose the visual direction the product wants")
 *   - Gradient logo square + rounded hamburger (replaced with mono
 *     masthead identity)
 *
 * Auth-aware CTA preserved — server component reads supabase user.
 *
 * NOTE: this page DELIBERATELY uses CSS variables (--color-paper,
 * --color-ink, --color-hazard) that exist outside the next-themes
 * dark-mode scheme. The landing is single-substrate by design.
 */

export const metadata = {
  title: 'Creator Outreach — DOC-001 / V0.5',
  description:
    'Outreach to creators without the spreadsheet. Five platforms, plain-English scoring, templated messages, auto-cadence follow-ups. Free in beta.',
}

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthed = !!user

  return (
    <main
      className="relative min-h-screen text-ink"
      style={{ backgroundColor: 'var(--color-paper)', color: 'var(--color-ink)' }}
    >
      <MastheadNav isAuthed={isAuthed} />

      {/* ─── COVER ─────────────────────────────────────────────── */}
      <section
        id="cover"
        className="border-b border-ink"
      >
        <div className="max-w-[1280px] mx-auto px-6 py-16 md:py-24 grid grid-cols-12 gap-x-6 gap-y-10">
          {/* Cover left — section marker + cover headline. Massive
              clamp(), tight tracking, compressed leading. */}
          <div className="col-span-12 lg:col-span-9">
            <SectionMarker number="00" label="COVER / MARKETING DOSSIER" />
            <h1
              className="font-[family-name:var(--font-archivo-black)] uppercase mt-6 leading-[0.92] tracking-[-0.03em]"
              style={{ fontSize: 'clamp(3.5rem, 9vw, 8.5rem)' }}
            >
              RUN OUTREACH
              <br />
              WITHOUT THE
              <br />
              <span className="text-hazard">SPREADSHEET.</span>
            </h1>
            <div className="mt-8 max-w-[58ch] font-[family-name:var(--font-geist-sans)] text-[17px] md:text-[18px] leading-[1.55] text-ink/85">
              Find creators across YouTube, Instagram, TikTok, X, and LinkedIn.
              Score them in plain English. Pitch them with a templated message
              per channel. Auto-cadence pings you when a reply lapses. One
              operator, one tool. No CRM bill.
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3 font-[family-name:var(--font-ibm-plex-mono)] text-[12px] uppercase tracking-[0.16em]">
              <Link
                href={isAuthed ? '/' : '/auth/signup'}
                className="inline-flex items-center gap-2 border border-ink bg-ink text-paper px-5 py-3 hover:bg-hazard hover:border-hazard transition-colors"
              >
                {isAuthed ? '↗ OPEN THE APP' : '↗ TRY IT FREE'}
              </Link>
              {!isAuthed && (
                <Link
                  href="/auth/signin"
                  className="inline-flex items-center gap-2 border border-ink/70 px-5 py-3 hover:bg-ink hover:text-paper transition-colors"
                >
                  OR SIGN IN
                </Link>
              )}
              <span aria-hidden className="opacity-30 hidden md:inline">|</span>
              <span className="text-ink/60">
                ▸ NO CARD ▸ FREE WHILE IN BETA ▸ EARLY USERS GRANDFATHERED
              </span>
            </div>
          </div>

          {/* Cover right — masthead specs, like the colophon block of
              a print magazine. Mono, tight, technical. */}
          <aside className="col-span-12 lg:col-span-3 lg:border-l lg:border-ink/60 lg:pl-6 font-[family-name:var(--font-ibm-plex-mono)] text-[11px] uppercase tracking-[0.12em] text-ink/70">
            <div className="border-b border-ink/30 pb-3 mb-3">
              <div className="text-[10px] opacity-60 mb-1">DOSSIER</div>
              <div className="text-ink font-semibold">
                CREATOR&nbsp;OUTREACH<sup className="text-hazard">®</sup>
              </div>
              <div className="opacity-70">CLASS / B2B / OPS TOOL</div>
            </div>

            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5">
              <Spec k="VER">0.5 / BETA</Spec>
              <Spec k="OPER">D. MEEHAN</Spec>
              <Spec k="STACK">NEXT 16 / TS</Spec>
              <Spec k="REGN">US / CA / UK</Spec>
              <Spec k="DOC">001</Spec>
              <Spec k="REV">2026.05</Spec>
            </dl>

            <div className="border-t border-ink/30 mt-4 pt-3 text-[10px] opacity-60 leading-[1.6]">
              ▸ ALL FIGURES IN THIS DOCUMENT REFLECT
              ACTUAL PRODUCT STATE AS OF REV ABOVE.
              SCREENSHOTS LIVE-CAPTURED FROM
              CREATOROUTREACH.NET.
            </div>
          </aside>
        </div>
      </section>

      {/* ─── 01 / WHAT IT REPLACES ─────────────────────────────── */}
      <section id="section-replaces" className="border-b border-ink">
        <div className="max-w-[1280px] mx-auto px-6 py-16 md:py-20">
          <SectionHeader number="01" title="WHAT IT REPLACES" />

          <div className="mt-10 grid md:grid-cols-2 gap-0 border border-ink/80">
            <ReplacesColumn
              heading="TODAY"
              tag="STATUS QUO"
              accent={false}
              rows={[
                ['T+0:00', '3 hrs of Google searches across 5 platforms'],
                ['T+3:00', 'Spreadsheet you forget to update by Friday'],
                ['T+3:30', 'Outlook copy-paste, three different templates'],
                ['T+5:00', '"I\'ll follow up Monday" — never does'],
                ['T+7:00', 'No idea which channel actually replied'],
              ]}
            />
            <ReplacesColumn
              heading="CREATOR OUTREACH"
              tag="REPLACEMENT"
              accent={true}
              rows={[
                ['T+0:00', '30-second multi-platform search'],
                ['T+0:30', 'AI-scored fit, in plain English'],
                ['T+0:45', 'One-click templated DM / email / IG / LinkedIn'],
                ['T+1:00', 'Status auto-tracked per lead'],
                ['T+1:30', 'Auto-cadence reminds you when to ping'],
              ]}
            />
          </div>
        </div>
      </section>

      {/* ─── 02 / METHODOLOGY ──────────────────────────────────── */}
      <section id="section-method" className="border-b border-ink">
        <div className="max-w-[1280px] mx-auto px-6 py-16 md:py-20">
          <SectionHeader number="02" title="METHODOLOGY / FOUR STEPS" />

          <ol className="mt-10 grid md:grid-cols-4 gap-0 border border-ink/80">
            <Step n="01" k="SEARCH" desc="Five platforms in one query. Filter by subscribers, views, recency, region." />
            <Step n="02" k="SCORE"  desc="AI ranks fit + reach + recency. You read the reasons in plain English." />
            <Step n="03" k="OUTREACH" desc="One click composes a templated message per channel. Email, DM, LinkedIn." />
            <Step n="04" k="TRACK"  desc="Replies update the status. Auto-cadence pings you when silence hits 3 days." />
          </ol>
        </div>
      </section>

      {/* ─── 03 / INTERFACE / SCREENSHOT PLATES ────────────────── */}
      <section id="section-interface" className="border-b border-ink">
        <div className="max-w-[1280px] mx-auto px-6 py-16 md:py-20">
          <SectionHeader number="03" title="THE INTERFACE / FIG. A — D" />
          <p className="mt-4 max-w-[68ch] font-[family-name:var(--font-geist-sans)] text-[15px] leading-[1.6] text-ink/80">
            Real product. Captured from creatoroutreach.net at the version
            stamped above. Click the figure tabs to switch between the four
            primary surfaces.
          </p>

          <div className="mt-8">
            <ScreenshotPlate />
          </div>
        </div>
      </section>

      {/* ─── 04 / PRICING ──────────────────────────────────────── */}
      <section id="pricing" className="border-b border-ink">
        <div className="max-w-[1280px] mx-auto px-6 py-16 md:py-20">
          <SectionHeader number="04" title="PRICING / SCHEDULE A" />

          <div className="mt-10 border border-ink/80">
            {/* Header row */}
            <div className="grid grid-cols-12 border-b border-ink/80 font-[family-name:var(--font-ibm-plex-mono)] text-[10px] uppercase tracking-[0.18em] bg-ink text-paper">
              <div className="col-span-3 px-4 py-3">PLAN</div>
              <div className="col-span-3 px-4 py-3 border-l border-paper/30">PRICE</div>
              <div className="col-span-6 px-4 py-3 border-l border-paper/30">INCLUDES</div>
            </div>

            <PricingRow
              plan="BETA"
              price="$0"
              priceSub="Free while we build"
              includes="Everything we ship. Search, AI scoring, templates, auto-cadence, exports, no seat cap."
              featured
            />
            <PricingRow
              plan="POST-BETA"
              price="—"
              priceSub="TBA"
              includes="Beta users grandfathered in. Pricing announced before any tier change."
            />
          </div>

          <p className="mt-6 font-[family-name:var(--font-ibm-plex-mono)] text-[11px] uppercase tracking-[0.18em] text-ink/60">
            ▸ NO HIDDEN SEATS · NO USAGE METER · NO ANNUAL UPSELL
          </p>
        </div>
      </section>

      {/* ─── 05 / OPERATOR ─────────────────────────────────────── */}
      <section id="section-operator" className="border-b border-ink">
        <div className="max-w-[1280px] mx-auto px-6 py-16 md:py-20 grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-7">
            <SectionHeader number="05" title="THE OPERATOR" />
            <div className="mt-8 font-[family-name:var(--font-geist-sans)] text-[17px] leading-[1.6] text-ink/85 space-y-5 max-w-[60ch]">
              <p>
                Creator Outreach is built and run by one person. I spent
                the last year doing creator outreach by hand for a
                fishing-conditions product, hated every minute of the
                spreadsheet, and built this so I never have to do it that
                way again.
              </p>
              <p>
                I read every reply, ship to production daily, and answer
                every email at the address below. If something is broken,
                tell me directly — I'm the only person who can fix it.
              </p>
            </div>
          </div>

          <aside className="col-span-12 md:col-span-5 md:border-l md:border-ink/60 md:pl-6 font-[family-name:var(--font-ibm-plex-mono)] text-[11px] uppercase tracking-[0.14em] text-ink/80">
            <div className="border-b border-ink/30 pb-3 mb-3">
              <div className="text-[10px] opacity-60 mb-1">CONTACT</div>
              <a
                href="mailto:dmeehanj@gmail.com"
                className="text-ink hover:text-hazard underline decoration-ink/30 hover:decoration-hazard underline-offset-4"
              >
                dmeehanj@gmail.com
              </a>
            </div>
            <div className="border-b border-ink/30 pb-3 mb-3">
              <div className="text-[10px] opacity-60 mb-1">CODE</div>
              <a
                href="https://github.com/oinoilyd"
                target="_blank"
                rel="noreferrer"
                className="text-ink hover:text-hazard underline decoration-ink/30 hover:decoration-hazard underline-offset-4"
              >
                github.com/oinoilyd
              </a>
            </div>
            <div>
              <div className="text-[10px] opacity-60 mb-1">SHIP CADENCE</div>
              <div>DAILY ▸ TYPICALLY 2–4 PRS / DAY</div>
            </div>
          </aside>
        </div>
      </section>

      {/* ─── 06 / FAQ ──────────────────────────────────────────── */}
      <section id="faq" className="border-b border-ink">
        <div className="max-w-[1280px] mx-auto px-6 py-16 md:py-20">
          <SectionHeader number="06" title="FAQ / FIELD NOTES" />
          <div className="mt-10 max-w-[68ch]">
            <FAQ />
          </div>
        </div>
      </section>

      {/* ─── 07 / CONTACT ──────────────────────────────────────── */}
      <section id="contact" className="border-b border-ink">
        <div className="max-w-[1280px] mx-auto px-6 py-16 md:py-20 grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-5">
            <SectionHeader number="07" title="CONTACT" />
            <p className="mt-6 max-w-[42ch] font-[family-name:var(--font-geist-sans)] text-[15px] leading-[1.6] text-ink/80">
              Tell me what's missing. The form goes straight to my inbox —
              I read all of them. For bugs, include a screenshot if you can.
            </p>
          </div>
          <div className="col-span-12 md:col-span-7 md:border-l md:border-ink/60 md:pl-6">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* ─── COLOPHON / FOOTER ─────────────────────────────────── */}
      <footer className="font-[family-name:var(--font-ibm-plex-mono)] text-[10px] uppercase tracking-[0.18em] text-ink/70">
        <div className="max-w-[1280px] mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-3">
          <div>© 2026 CREATOR OUTREACH ® / DOC-001 / V0.5</div>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:text-ink hover:underline decoration-hazard underline-offset-4">PRIVACY</a>
            <a href="/terms" className="hover:text-ink hover:underline decoration-hazard underline-offset-4">TERMS</a>
            <a href="mailto:dmeehanj@gmail.com" className="hover:text-ink hover:underline decoration-hazard underline-offset-4">CONTACT</a>
          </div>
        </div>
      </footer>
    </main>
  )
}

/* ───────── small in-file primitives ───────── */

function SectionMarker({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex items-center gap-3 font-[family-name:var(--font-ibm-plex-mono)] text-[11px] uppercase tracking-[0.22em] text-ink/70">
      <span className="inline-block w-8 border-t border-ink/60" />
      <span>[ {number} / {label} ]</span>
    </div>
  )
}

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-ink/30 pb-4">
      <span className="font-[family-name:var(--font-ibm-plex-mono)] text-[12px] uppercase tracking-[0.22em] text-hazard">
        ▸ SECTION {number}
      </span>
      <h2 className="font-[family-name:var(--font-archivo-black)] uppercase tracking-[-0.01em] text-2xl md:text-4xl text-ink">
        {title}
      </h2>
    </div>
  )
}

function Spec({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="opacity-60">{k}</dt>
      <dd className="text-ink">{children}</dd>
    </>
  )
}

function ReplacesColumn({
  heading,
  tag,
  accent,
  rows,
}: {
  heading: string
  tag: string
  accent: boolean
  rows: [string, string][]
}) {
  return (
    <div
      className={
        accent
          ? 'border-l border-ink/80 first:border-l-0'
          : 'border-l border-ink/80 first:border-l-0'
      }
    >
      {/* Header strip */}
      <div className={
        'px-4 py-3 border-b border-ink/30 font-[family-name:var(--font-ibm-plex-mono)] text-[10px] uppercase tracking-[0.18em] flex items-center justify-between ' +
        (accent ? 'bg-hazard text-paper' : 'bg-ink text-paper')
      }>
        <span className="font-semibold">{heading}</span>
        <span className="opacity-70">[ {tag} ]</span>
      </div>

      {/* Rows */}
      <ul className="divide-y divide-ink/15">
        {rows.map(([t, v], i) => (
          <li key={i} className="grid grid-cols-[max-content_1fr] gap-3 px-4 py-3 font-[family-name:var(--font-ibm-plex-mono)] text-[12px]">
            <span className="text-ink/50 uppercase tracking-[0.14em]">{t}</span>
            <span className="text-ink/85">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Step({ n, k, desc }: { n: string; k: string; desc: string }) {
  return (
    <li className="border-l border-ink/30 first:border-l-0 px-5 py-6">
      <div className="flex items-baseline gap-2 font-[family-name:var(--font-ibm-plex-mono)] text-[10px] uppercase tracking-[0.22em] text-ink/60">
        <span className="text-hazard font-semibold">STEP&nbsp;{n}</span>
        <span aria-hidden>///</span>
      </div>
      <h3 className="mt-2 font-[family-name:var(--font-archivo-black)] uppercase text-xl md:text-2xl tracking-[-0.01em] text-ink">
        {k}
      </h3>
      <p className="mt-2 font-[family-name:var(--font-geist-sans)] text-[14px] leading-[1.5] text-ink/75">
        {desc}
      </p>
    </li>
  )
}

function PricingRow({
  plan,
  price,
  priceSub,
  includes,
  featured = false,
}: {
  plan: string
  price: string
  priceSub: string
  includes: string
  featured?: boolean
}) {
  return (
    <div className={
      'grid grid-cols-12 border-b last:border-b-0 border-ink/30 ' +
      (featured ? 'bg-paper' : 'bg-paper')
    }>
      <div className="col-span-3 px-4 py-5 border-r border-ink/30 font-[family-name:var(--font-ibm-plex-mono)] uppercase tracking-[0.18em] text-[12px] flex items-center gap-2">
        {featured && <span className="text-hazard">●</span>}
        {plan}
      </div>
      <div className="col-span-3 px-4 py-5 border-r border-ink/30">
        <div className="font-[family-name:var(--font-archivo-black)] text-3xl md:text-4xl text-ink leading-none">
          {price}
        </div>
        <div className="mt-1 font-[family-name:var(--font-ibm-plex-mono)] text-[10px] uppercase tracking-[0.18em] text-ink/60">
          {priceSub}
        </div>
      </div>
      <div className="col-span-6 px-4 py-5 font-[family-name:var(--font-geist-sans)] text-[15px] leading-[1.5] text-ink/80">
        {includes}
      </div>
    </div>
  )
}
