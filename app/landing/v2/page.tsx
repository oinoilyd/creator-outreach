import Link from 'next/link'
import { VersionSwitcher } from '@/components/landing/VersionSwitcher'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V2 — MAXIMALIST Y2K / RETAIL CATALOG
 *
 * Direction: 90s Patagonia catalog × Gymshark × Neue Pixel × Liquid
 * Death packaging. Color collisions on purpose (peach + electric blue
 * + lime green + hot pink + cream). Sticker badges, marquee tickers,
 * dotted borders, hand-drawn arrows, mixed font weights/families,
 * curved sections. Loud, fun, anti-corporate, anti-template.
 *
 * The opposite of "Linear/Stripe restraint" — this leans all the way
 * into personality. Designed to feel like a product you remember.
 */

export const metadata = {
  title: 'CREATOR OUTREACH ★ STOP SENDING DEAD EMAILS',
  description: 'A loud little tool for finding creators across YouTube, IG, TikTok, X, and LinkedIn. Free while in beta. No spreadsheet. No CRM bill.',
}

export default async function LandingV2() {
  const { isAuthed } = await getLandingAuthState()

  return (
    <main className="min-h-screen overflow-hidden" style={{ backgroundColor: '#FFE9CF', color: '#0E1A2B' }}>
      <VersionSwitcher />

      {/* Marquee ticker */}
      <div className="bg-[#0E1A2B] text-[#FFE9CF] py-2 overflow-hidden whitespace-nowrap font-bold text-[14px] uppercase tracking-[0.18em]">
        <div className="inline-block animate-[marquee_30s_linear_infinite]">
          <span className="mx-6">★ FREE WHILE IN BETA</span>
          <span className="mx-6 text-[#FF5C8A]">●</span>
          <span className="mx-6">SEARCHES 5 PLATFORMS AT ONCE</span>
          <span className="mx-6 text-[#A8FF60]">●</span>
          <span className="mx-6">NO SPREADSHEET</span>
          <span className="mx-6 text-[#5CB8FF]">●</span>
          <span className="mx-6">NO $400/MO CRM</span>
          <span className="mx-6 text-[#FF5C8A]">●</span>
          <span className="mx-6">BUILT BY ONE PERSON</span>
          <span className="mx-6 text-[#A8FF60]">●</span>
          <span className="mx-6">SHIP DAILY</span>
          <span className="mx-6 text-[#5CB8FF]">●</span>
          <span className="mx-6">★ FREE WHILE IN BETA</span>
          <span className="mx-6 text-[#FF5C8A]">●</span>
          <span className="mx-6">SEARCHES 5 PLATFORMS AT ONCE</span>
          <span className="mx-6 text-[#A8FF60]">●</span>
          <span className="mx-6">NO SPREADSHEET</span>
          <span className="mx-6 text-[#5CB8FF]">●</span>
        </div>
      </div>

      {/* Top nav row */}
      <div className="border-b-2 border-dashed border-[#0E1A2B]/40">
        <div className="max-w-[1280px] mx-auto px-5 py-4 flex items-center justify-between gap-4 font-bold">
          <Link href="/landing/v2" className="inline-flex items-center gap-2">
            <span className="inline-block w-9 h-9 rounded-full bg-[#FF5C8A] border-2 border-[#0E1A2B] flex items-center justify-center text-white text-lg">★</span>
            <span className="uppercase tracking-tight text-[18px]">creator&nbsp;outreach</span>
            <span className="text-[10px] uppercase bg-[#A8FF60] border-2 border-[#0E1A2B] px-1.5 py-0.5 rotate-[-3deg] inline-block">EST. 2026</span>
          </Link>
          <Link
            href={isAuthed ? '/' : '/auth/signup'}
            className="hidden sm:inline-flex items-center gap-2 bg-[#0E1A2B] text-[#FFE9CF] hover:bg-[#FF5C8A] hover:text-[#0E1A2B] transition-colors px-4 py-2 border-2 border-[#0E1A2B] uppercase text-[13px] tracking-tight active:translate-y-[2px] active:shadow-none shadow-[3px_3px_0_0_#0E1A2B]"
          >
            {isAuthed ? '↗ open the app' : '↗ try it FREE'}
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="relative px-5 py-14 md:py-20">
        {/* Decorative stickers */}
        <Sticker className="absolute top-10 right-[8%] hidden md:block" rotate={-12} bg="#A8FF60">NEW!</Sticker>
        <Sticker className="absolute bottom-10 left-[6%] hidden md:block" rotate={8} bg="#5CB8FF">NO CARD</Sticker>
        <Sticker className="absolute top-[40%] left-[3%] hidden lg:block" rotate={-6} bg="#FF5C8A">IT'S FREE</Sticker>

        <div className="max-w-[1280px] mx-auto grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-7">
            <div className="text-[12px] uppercase tracking-[0.2em] mb-4 inline-block bg-[#FF5C8A] text-white px-2 py-1 rotate-[-2deg]">
              ↓ A loud little tool for cold outreach ↓
            </div>
            <h1 className="font-black uppercase leading-[0.92] tracking-tight" style={{ fontSize: 'clamp(3rem, 8.5vw, 8rem)' }}>
              STOP SENDING<br />
              <span className="bg-[#A8FF60] px-3 inline-block rotate-[-1deg]">DEAD</span><br />
              EMAILS.
            </h1>
            <p className="mt-7 max-w-[44ch] text-[18px] md:text-[20px] leading-[1.4] font-medium">
              <span className="font-black">Search 5 platforms.</span>{' '}
              <span className="bg-[#5CB8FF]/40 px-1">Score every creator in plain English.</span>{' '}
              <span className="font-black">Pitch them with a templated message.</span>{' '}
              Auto-cadence pings you when they ghost. <span className="italic">No CRM bill.</span>
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href={isAuthed ? '/' : '/auth/signup'}
                className="inline-flex items-center gap-2 bg-[#FF5C8A] text-white border-2 border-[#0E1A2B] px-6 py-4 uppercase font-black tracking-tight text-[16px] hover:bg-[#A8FF60] hover:text-[#0E1A2B] active:translate-y-[2px] active:shadow-none shadow-[5px_5px_0_0_#0E1A2B] transition-colors"
              >
                {isAuthed ? '↗ open the app' : '↗ try it FREE !!!'}
              </Link>
              <span className="font-bold text-[14px] uppercase tracking-wider text-[#0E1A2B]/70">
                ← takes 30 seconds <span className="text-[#FF5C8A]">★</span>
              </span>
            </div>
          </div>

          {/* Right hero — fake catalog "product card" stack */}
          <div className="md:col-span-5 relative">
            <CatalogCard rotate={3} bg="#5CB8FF" tag="ITEM 001 / SEARCH">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/80 mb-1">in stock</div>
              <div className="text-3xl font-black uppercase leading-none">5-Platform<br />Search</div>
              <div className="mt-3 text-white/85 text-[13px] leading-tight">YouTube · Instagram · TikTok · X · LinkedIn — one query, one queue.</div>
            </CatalogCard>
            <CatalogCard rotate={-4} bg="#A8FF60" tag="ITEM 002 / SCORE" className="-mt-6 ml-10">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#0E1A2B]/70 mb-1">plain english</div>
              <div className="text-3xl font-black uppercase leading-none text-[#0E1A2B]">AI Fit<br />Scoring</div>
              <div className="mt-3 text-[#0E1A2B]/85 text-[13px] leading-tight">"Strong fit. Posts about commercial real estate weekly, 80k followers, last upload 3 days ago."</div>
            </CatalogCard>
            <CatalogCard rotate={2} bg="#FF5C8A" tag="ITEM 003 / PITCH" className="-mt-4 ml-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/80 mb-1">one click</div>
              <div className="text-3xl font-black uppercase leading-none">Templated<br />Pitch</div>
              <div className="mt-3 text-white/85 text-[13px] leading-tight">DM · email · LinkedIn message — channel-correct, edit-friendly.</div>
            </CatalogCard>
          </div>
        </div>
      </section>

      {/* Big stat strip */}
      <section className="bg-[#0E1A2B] text-[#FFE9CF] border-y-2 border-[#0E1A2B]">
        <div className="max-w-[1280px] mx-auto px-5 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <Stat n="5" label="platforms" color="#FF5C8A" />
          <Stat n="30s" label="search time" color="#A8FF60" />
          <Stat n="$0" label="while in beta" color="#5CB8FF" />
          <Stat n="∞" label="creators in db" color="#FF5C8A" />
        </div>
      </section>

      {/* Feature row — 4 boxes, full collisions */}
      <section className="px-5 py-16 md:py-20">
        <div className="max-w-[1280px] mx-auto">
          <h2 className="font-black uppercase mb-10 leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}>
            Everything <span className="bg-[#FF5C8A] text-white px-2 rotate-[-1deg] inline-block">you need.</span><br />
            Nothing <span className="bg-[#A8FF60] px-2 rotate-[1deg] inline-block">you don't.</span>
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <FeatureBox bg="#FFE9CF" accent="#FF5C8A" badge="01" title="SEARCH" body="Five platforms in one query. Filter by subscribers, region, recency, niche." />
            <FeatureBox bg="#FFE9CF" accent="#A8FF60" badge="02" title="SCORE" body="AI ranks fit, reach, and recency. You read the reasons in plain English." />
            <FeatureBox bg="#FFE9CF" accent="#5CB8FF" badge="03" title="PITCH" body="One click composes the right message — DM, email, LinkedIn — per channel." />
            <FeatureBox bg="#FFE9CF" accent="#FF5C8A" badge="04" title="TRACK" body="Replies update status. Auto-cadence reminds you when silence hits 3 days." />
          </div>
        </div>
      </section>

      {/* Pricing — sticker style */}
      <section id="pricing" className="px-5 py-16 md:py-20 bg-[#A8FF60] border-y-2 border-[#0E1A2B]">
        <div className="max-w-[1100px] mx-auto grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="inline-block bg-white border-2 border-[#0E1A2B] px-3 py-1 text-[12px] font-bold uppercase rotate-[-2deg] mb-4 shadow-[3px_3px_0_0_#0E1A2B]">
              Pricing ↓
            </div>
            <h2 className="font-black uppercase leading-[0.95]" style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}>
              IT'S<br />
              <span className="bg-[#FF5C8A] text-white px-3 inline-block rotate-[-1deg]">FREE</span><br />
              FOR NOW.
            </h2>
            <p className="mt-6 max-w-[40ch] text-[16px] font-medium">
              Beta users get grandfathered when paid plans drop.
              Until then, no card, no seat cap, no "starter / pro /
              enterprise" cosplay.
            </p>
          </div>
          <div className="bg-white border-2 border-[#0E1A2B] p-6 shadow-[8px_8px_0_0_#0E1A2B]">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-[12px] uppercase tracking-[0.18em] text-[#0E1A2B]/60">Right now</span>
              <span className="text-[10px] bg-[#FF5C8A] text-white px-1.5 py-0.5 uppercase font-bold">beta</span>
            </div>
            <div className="font-black text-[#0E1A2B] flex items-baseline gap-2">
              <span style={{ fontSize: 'clamp(3rem, 7vw, 5rem)' }}>$0</span>
              <span className="text-[14px] text-[#0E1A2B]/60 font-medium">/forever ish</span>
            </div>
            <ul className="mt-4 space-y-2 text-[14px] font-medium">
              {[
                'Search across 5 platforms',
                'AI scoring in plain English',
                'Templated outreach per channel',
                'Auto-cadence follow-ups',
                'CSV export, anytime',
              ].map(s => (
                <li key={s} className="flex items-start gap-2">
                  <span className="text-[#FF5C8A] font-black mt-0.5">✓</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            <Link
              href={isAuthed ? '/' : '/auth/signup'}
              className="mt-6 block text-center bg-[#0E1A2B] text-[#FFE9CF] py-3.5 uppercase font-black tracking-tight text-[15px] hover:bg-[#FF5C8A] active:translate-y-[2px] active:shadow-none transition-colors"
            >
              {isAuthed ? '↗ open the app' : '↗ start FREE'}
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0E1A2B] text-[#FFE9CF] px-5 py-10">
        <div className="max-w-[1280px] mx-auto flex flex-wrap items-center justify-between gap-4 font-bold text-[12px] uppercase tracking-[0.18em]">
          <div className="flex items-center gap-2">
            <span className="inline-block w-7 h-7 rounded-full bg-[#FF5C8A] border-2 border-[#FFE9CF] flex items-center justify-center text-white">★</span>
            © 2026 creator outreach
          </div>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-[#A8FF60]">privacy</Link>
            <Link href="/terms" className="hover:text-[#A8FF60]">terms</Link>
            <a href="mailto:dmeehanj@gmail.com" className="hover:text-[#A8FF60]">contact</a>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </main>
  )
}

function Sticker({ children, className = '', rotate = 0, bg }: { children: React.ReactNode; className?: string; rotate?: number; bg: string }) {
  return (
    <div
      className={'inline-block px-3 py-1.5 border-2 border-[#0E1A2B] uppercase font-black text-[12px] tracking-tight ' + className}
      style={{ backgroundColor: bg, transform: `rotate(${rotate}deg)`, boxShadow: '3px 3px 0 0 #0E1A2B' }}
    >
      {children}
    </div>
  )
}

function CatalogCard({ children, rotate = 0, bg, tag, className = '' }: { children: React.ReactNode; rotate?: number; bg: string; tag: string; className?: string }) {
  return (
    <div
      className={'relative border-2 border-[#0E1A2B] p-5 ' + className}
      style={{ backgroundColor: bg, transform: `rotate(${rotate}deg)`, boxShadow: '6px 6px 0 0 #0E1A2B' }}
    >
      <div className="absolute top-2 right-2 text-[9px] uppercase tracking-[0.22em] font-bold text-[#0E1A2B]/70">{tag}</div>
      {children}
    </div>
  )
}

function Stat({ n, label, color }: { n: string; label: string; color: string }) {
  return (
    <div>
      <div className="font-black leading-none" style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', color }}>{n}</div>
      <div className="mt-1 text-[12px] uppercase tracking-[0.22em] font-bold text-[#FFE9CF]/70">{label}</div>
    </div>
  )
}

function FeatureBox({ bg, accent, badge, title, body }: { bg: string; accent: string; badge: string; title: string; body: string }) {
  return (
    <div className="border-2 border-[#0E1A2B] p-5 hover:translate-y-[-3px] transition-transform shadow-[5px_5px_0_0_#0E1A2B]" style={{ backgroundColor: bg }}>
      <div className="inline-block w-9 h-9 border-2 border-[#0E1A2B] flex items-center justify-center font-black text-[14px] mb-3" style={{ backgroundColor: accent }}>
        {badge}
      </div>
      <div className="font-black uppercase text-[20px] tracking-tight mb-1.5">{title}</div>
      <div className="text-[14px] font-medium leading-tight">{body}</div>
    </div>
  )
}
