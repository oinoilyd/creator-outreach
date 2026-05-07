import Link from 'next/link'
import { VersionSwitcher } from '@/components/landing/VersionSwitcher'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V4 — TRADING TERMINAL
 *
 * Direction: Bloomberg terminal × TradingView × Plausible analytics ×
 * what a Wall Street operator would actually want a software landing
 * page to look like. Dark mode locked. Mono everywhere. Numbers as
 * the hero. Live tickers. Trader-palette accents (amber #FFB800,
 * pit green #00C56A, hazard red #FF3D55).
 *
 * Reads as: "this is a tool, here are the numbers, here's what it
 * does, here's the price." No hype copy, just signal density.
 */

export const metadata = {
  title: 'CREATOR OUTREACH | TERMINAL',
  description: 'Operator-grade creator outreach. Live pipeline metrics, five-platform search, AI fit scoring. Free in beta.',
}

const TICKER_ROW: { sym: string; val: string; delta: string; pos: boolean }[] = [
  { sym: 'YT.SUB', val: '142.3K', delta: '+2.1%', pos: true },
  { sym: 'IG.FOL', val: '88.7K',  delta: '+1.4%', pos: true },
  { sym: 'TT.FOL', val: '54.2K',  delta: '-0.3%', pos: false },
  { sym: 'X.FOL',  val: '31.8K',  delta: '+0.2%', pos: true },
  { sym: 'LI.FOL', val: '22.1K',  delta: '+0.6%', pos: true },
  { sym: 'REPLY%', val: '34.1',   delta: '+4.2',  pos: true },
  { sym: 'PIPE$',  val: '184K',   delta: '+12K',  pos: true },
  { sym: 'CACHE',  val: '94.7%',  delta: '+1.1',  pos: true },
]

export default async function LandingV4() {
  const { isAuthed } = await getLandingAuthState()

  return (
    <main className="min-h-screen text-[#E8E8E8] font-mono" style={{ backgroundColor: '#0A0E13' }}>
      <VersionSwitcher />

      {/* Status bar — terminal chrome */}
      <div className="border-b border-[#1F2530] bg-[#0E141C] text-[11px] tracking-[0.06em]">
        <div className="max-w-[1400px] mx-auto px-5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00C56A] animate-pulse" />
              <span className="text-[#00C56A]">CONNECTED</span>
            </span>
            <span className="text-[#E8E8E8]/40">|</span>
            <span className="text-[#E8E8E8]/60">SESSION 2026.05.07 · LIVE FEED · v0.5.0</span>
          </div>
          <div className="hidden md:flex items-center gap-3 text-[#E8E8E8]/50">
            <span>UTC {new Date().toISOString().slice(11, 16)}</span>
            <span>|</span>
            <span>NODE US-EAST</span>
          </div>
        </div>
      </div>

      {/* Top nav — terminal command line look */}
      <header className="border-b border-[#1F2530]">
        <div className="max-w-[1400px] mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <Link href="/landing/v4" className="flex items-baseline gap-3">
            <span className="text-[#FFB800] text-[14px] font-bold">▣</span>
            <span className="text-[15px] tracking-[0.05em] uppercase">CREATOR_OUTREACH<span className="text-[#FFB800]">::</span>TERMINAL</span>
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-[12px] uppercase tracking-[0.1em] text-[#E8E8E8]/60">
            <a href="#metrics" className="hover:text-[#FFB800]">METRICS</a>
            <a href="#methodology" className="hover:text-[#FFB800]">METHOD</a>
            <a href="#pricing" className="hover:text-[#FFB800]">PRICING</a>
          </nav>
          <Link
            href={isAuthed ? '/' : '/auth/signup'}
            className="inline-flex items-center gap-2 border border-[#FFB800] text-[#FFB800] hover:bg-[#FFB800] hover:text-[#0A0E13] px-3 py-1.5 text-[12px] uppercase tracking-[0.1em] transition-colors"
          >
            {isAuthed ? '↗ OPEN APP' : '↗ EXEC NEW SESSION'}
          </Link>
        </div>
      </header>

      {/* Live ticker */}
      <div className="border-b border-[#1F2530] bg-[#0E141C] py-2 overflow-hidden whitespace-nowrap text-[12px]">
        <div className="inline-block animate-[ticker_45s_linear_infinite]">
          {[...TICKER_ROW, ...TICKER_ROW].map((t, i) => (
            <span key={i} className="mx-6 inline-flex items-center gap-2">
              <span className="text-[#E8E8E8]/55">{t.sym}</span>
              <span className="text-[#E8E8E8] tabular-nums">{t.val}</span>
              <span className={t.pos ? 'text-[#00C56A] tabular-nums' : 'text-[#FF3D55] tabular-nums'}>
                {t.pos ? '▲' : '▼'} {t.delta}
              </span>
              <span className="text-[#1F2530] mx-2">|</span>
            </span>
          ))}
        </div>
      </div>

      {/* Hero — numbers-first */}
      <section className="px-5 py-14 md:py-20 border-b border-[#1F2530]">
        <div className="max-w-[1400px] mx-auto grid md:grid-cols-12 gap-8">
          <div className="md:col-span-7">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#FFB800]/80 mb-4">
              › PIPELINE OPS / OUTREACH DESK
            </div>
            <h1 className="font-bold uppercase leading-[1.0] tracking-tight" style={{ fontSize: 'clamp(2.25rem, 6vw, 5rem)' }}>
              Creator outreach,<br />
              priced in <span className="text-[#FFB800]">replies</span>,<br />
              not <span className="text-[#FF3D55]">spreadsheet hours</span>.
            </h1>
            <p className="mt-7 max-w-[60ch] text-[15px] text-[#E8E8E8]/70 leading-[1.55]">
              An operator-grade tool for finding, scoring, and pitching
              creators across YouTube, Instagram, TikTok, X, and
              LinkedIn. Live pipeline metrics. Auto-cadence follow-ups.
              Plain-English fit scoring. No CRM cosplay.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3 text-[12px] uppercase tracking-[0.1em]">
              <Link
                href={isAuthed ? '/' : '/auth/signup'}
                className="inline-flex items-center gap-2 bg-[#FFB800] text-[#0A0E13] hover:bg-[#FFCC44] px-5 py-3 font-bold transition-colors"
              >
                {isAuthed ? '↗ OPEN APP' : '↗ EXEC NEW SESSION [F1]'}
              </Link>
              {!isAuthed && (
                <Link
                  href="/auth/signin"
                  className="inline-flex items-center gap-2 border border-[#1F2530] hover:border-[#FFB800] px-5 py-3 transition-colors"
                >
                  ↻ RESUME SESSION
                </Link>
              )}
            </div>
          </div>

          {/* Pipeline metrics card — looks like a Bloomberg panel */}
          <aside className="md:col-span-5 border border-[#1F2530] bg-[#0E141C]">
            <div className="border-b border-[#1F2530] px-4 py-2.5 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.18em] text-[#FFB800]">PIPELINE OVERVIEW</span>
              <span className="text-[10px] text-[#E8E8E8]/40">REAL-TIME</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-[#1F2530]">
              <Cell sym="LEADS·SEARCHED" val="14,820" delta="+221" pos />
              <Cell sym="LEADS·CONTACTED" val="3,114" delta="+47" pos />
              <Cell sym="REPLY·RATE" val="34.1%" delta="+4.2" pos />
              <Cell sym="CADENCE·ACTIVE" val="612" delta="+12" pos />
            </div>
            <div className="border-t border-[#1F2530] px-4 py-3 grid grid-cols-5 gap-1 text-[10px] uppercase tracking-[0.1em] text-[#E8E8E8]/55">
              <span>YT</span>
              <span>IG</span>
              <span>TT</span>
              <span>X</span>
              <span>LI</span>
            </div>
            <div className="px-4 pb-4 grid grid-cols-5 gap-1">
              {[42, 28, 14, 9, 7].map((h, i) => (
                <div key={i} className="h-20 bg-[#0A0E13] border border-[#1F2530] flex items-end">
                  <div className="w-full bg-[#FFB800]/80" style={{ height: `${h * 1.5}%` }} />
                </div>
              ))}
            </div>
            <div className="border-t border-[#1F2530] px-4 py-2 text-[10px] tracking-[0.1em] text-[#E8E8E8]/45 flex items-center justify-between">
              <span>PLATFORM MIX (LAST 30D)</span>
              <span className="text-[#00C56A]">▲ HEALTHY</span>
            </div>
          </aside>
        </div>
      </section>

      {/* Metrics grid */}
      <section id="metrics" className="px-5 py-12 md:py-16 border-b border-[#1F2530]">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#FFB800]/80 mb-6">› SYSTEM METRICS</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#1F2530]">
            <Stat label="PLATFORMS·INDEXED" val="5" sub="YT · IG · TT · X · LI" />
            <Stat label="MEDIAN·SEARCH·MS" val="430" sub="cache HIT rate 94%" />
            <Stat label="AI·SCORING·VER"  val="v3.1" sub="plain-english fit" />
            <Stat label="PRICE·BETA"      val="$0" sub="no card · no seat cap" />
          </div>
        </div>
      </section>

      {/* Methodology — terminal command list */}
      <section id="methodology" className="px-5 py-14 md:py-20 border-b border-[#1F2530]">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#FFB800]/80 mb-6">› METHODOLOGY · 4 STAGES</div>
          <div className="border border-[#1F2530] bg-[#0E141C] divide-y divide-[#1F2530]">
            <Stage cmd="$ SEARCH" desc="Five platforms in one query. Filter by audience, region, recency, niche." status="EXEC" />
            <Stage cmd="$ SCORE"  desc="AI ranks fit, reach, and recency. Reasoning shown in plain English; criteria editable." status="EXEC" />
            <Stage cmd="$ PITCH"  desc="One click composes a templated message per channel — DM / email / LinkedIn." status="EXEC" />
            <Stage cmd="$ TRACK"  desc="Replies update status. Auto-cadence pings you when silence hits 3 days." status="EXEC" />
          </div>
        </div>
      </section>

      {/* Pricing — terminal-style price table */}
      <section id="pricing" className="px-5 py-14 md:py-20 border-b border-[#1F2530]">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#FFB800]/80 mb-6">› PRICING SCHEDULE</div>
          <div className="border border-[#1F2530] bg-[#0E141C]">
            <div className="grid grid-cols-12 border-b border-[#1F2530] text-[11px] uppercase tracking-[0.16em] text-[#E8E8E8]/55">
              <div className="col-span-3 px-4 py-3 border-r border-[#1F2530]">PLAN</div>
              <div className="col-span-3 px-4 py-3 border-r border-[#1F2530]">PRICE</div>
              <div className="col-span-6 px-4 py-3">INCLUDED</div>
            </div>
            <div className="grid grid-cols-12 border-b border-[#1F2530] text-[14px]">
              <div className="col-span-3 px-4 py-5 border-r border-[#1F2530] flex items-center gap-2">
                <span className="text-[#00C56A]">●</span>
                <span className="uppercase tracking-[0.1em]">BETA</span>
              </div>
              <div className="col-span-3 px-4 py-5 border-r border-[#1F2530] flex items-baseline gap-2">
                <span className="text-2xl md:text-3xl font-bold tabular-nums">$0</span>
                <span className="text-[11px] text-[#E8E8E8]/50">/forever for early users</span>
              </div>
              <div className="col-span-6 px-4 py-5 text-[#E8E8E8]/85">
                Search, scoring, templates, auto-cadence, exports. No
                seat cap, no usage meter. Beta users grandfathered.
              </div>
            </div>
            <div className="grid grid-cols-12 text-[14px] text-[#E8E8E8]/55">
              <div className="col-span-3 px-4 py-5 border-r border-[#1F2530] uppercase tracking-[0.1em]">PRO</div>
              <div className="col-span-3 px-4 py-5 border-r border-[#1F2530]">— TBA</div>
              <div className="col-span-6 px-4 py-5">Announced before any tier change.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 py-8 text-[11px] uppercase tracking-[0.18em] text-[#E8E8E8]/50">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[#FFB800]">▣</span>
            © 2026 CREATOR_OUTREACH::TERMINAL
          </div>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-[#FFB800]">PRIVACY</Link>
            <Link href="/terms" className="hover:text-[#FFB800]">TERMS</Link>
            <a href="mailto:dmeehanj@gmail.com" className="hover:text-[#FFB800]">CONTACT</a>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </main>
  )
}

function Cell({ sym, val, delta, pos }: { sym: string; val: string; delta: string; pos: boolean }) {
  return (
    <div className="px-4 py-3 border-b border-[#1F2530]">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#E8E8E8]/50">{sym}</div>
      <div className="text-2xl tabular-nums mt-1 flex items-baseline gap-2">
        {val}
        <span className={pos ? 'text-[10px] text-[#00C56A]' : 'text-[10px] text-[#FF3D55]'}>
          {pos ? '▲' : '▼'} {delta}
        </span>
      </div>
    </div>
  )
}

function Stat({ label, val, sub }: { label: string; val: string; sub: string }) {
  return (
    <div className="bg-[#0A0E13] px-5 py-6">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#E8E8E8]/50">{label}</div>
      <div className="font-bold tabular-nums text-[#FFB800] mt-2" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}>{val}</div>
      <div className="text-[11px] text-[#E8E8E8]/55 mt-1">{sub}</div>
    </div>
  )
}

function Stage({ cmd, desc, status }: { cmd: string; desc: string; status: string }) {
  return (
    <div className="grid grid-cols-12 px-4 py-4 hover:bg-[#0A0E13] transition-colors">
      <div className="col-span-3 text-[#FFB800] tabular-nums uppercase tracking-[0.06em]">{cmd}</div>
      <div className="col-span-7 text-[14px] text-[#E8E8E8]/85">{desc}</div>
      <div className="col-span-2 text-right text-[10px] text-[#00C56A] uppercase tracking-[0.18em]">[{status}]</div>
    </div>
  )
}
