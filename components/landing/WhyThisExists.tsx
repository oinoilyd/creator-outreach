'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * WhyThisExists — replaces the previous flat 3-column text grid with
 * per-card "before → after" visuals.
 *
 * Each of the three cards has:
 *   - Giant 01/02/03 numeral hanging in the corner
 *   - Tag chip (Sourcing / Fit Score / Outreach)
 *   - Custom inline-SVG visual showing the workaround vs the built-in
 *     answer (4 chaotic tabs collapsing into a row, etc.)
 *   - Pain headline (large)
 *   - Operator note paragraph
 *   - "Built in" callout block — terracotta-bordered with a checkmark
 *
 * Cards reveal on scroll via IntersectionObserver — once the card
 * enters viewport, it fades up + the visual's interior elements stagger
 * in. Respects prefers-reduced-motion (everything pre-revealed).
 */

type CardData = {
  num: string
  tag: string
  headline: string
  note: string
  answerLabel: string
  answer: string
  /** SVG illustration component */
  Visual: React.ComponentType<{ revealed: boolean }>
}

const CARDS: CardData[] = [
  {
    num: '01',
    tag: 'Sourcing',
    headline: 'Four tabs to source one creator.',
    note: 'YouTube to find them. LinkedIn for a work email. Twitter to check if they’re still active. A Google Sheet to remember who I’d already messaged. Five sources of truth, none of them talking.',
    answerLabel: 'Built in',
    answer: 'One query, five platforms, scored. Email and social handles surface inline. Four tabs become one row.',
    Visual: SourcingVisual,
  },
  {
    num: '02',
    tag: 'Fit Score',
    headline: 'Off-the-shelf creator scoring is useless.',
    note: 'Subs + engagement + vertical doesn’t describe fit. None of it knew I wanted US-based weekly posters who talk about value investing, under 100K subs.',
    answerLabel: 'Built in',
    answer: 'Write what you actually want, in plain English. The AI scores against that — fully customizable, weighted per platform.',
    Visual: FitScoreVisual,
  },
  {
    num: '03',
    tag: 'Outreach',
    headline: 'Every CRM ignored Instagram.',
    note: 'HubSpot is $400 / month. Two influencer-CRMs were $300+ / month behind a sales call. None of them recognized an IG handle, let alone helped me open a DM.',
    answerLabel: 'Built in',
    answer: 'Built-in CRM tuned for creators. Click an IG handle, get a DM template. Email, LinkedIn, and other channels tracked per row.',
    Visual: OutreachVisual,
  },
]

export function WhyThisExists() {
  return (
    <section
      id="customers"
      className="px-6 py-20 md:py-28 scroll-mt-24 bg-white dark:bg-[#131826] border-y border-[#0F1733]/8 dark:border-white/10 relative overflow-hidden"
    >
      {/* Ambient backdrop — single soft terracotta wash that breathes
          quietly so the section reads as a feature spotlight, not a
          flat text block. */}
      <div
        aria-hidden
        className="absolute -top-1/2 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] pointer-events-none opacity-[0.10] dark:opacity-[0.18] motion-reduce:hidden"
        style={{
          background: 'radial-gradient(closest-side, rgba(232,93,47,0.6), transparent 70%)',
          animation: 'wte-breath 14s ease-in-out infinite',
        }}
      />

      <div className="max-w-[1280px] mx-auto relative">
        <div className="text-center mb-14 md:mb-20">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-[#E85D2F]/10 border border-[#E85D2F]/30 text-[11px] uppercase tracking-[0.18em] text-[#9C3D1F] dark:text-[#F2A261] font-bold">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="12" cy="12" r="9" fillOpacity="0.3" />
              <circle cx="12" cy="12" r="4" />
            </svg>
            Why this exists
          </div>
          <h2
            className="font-semibold tracking-[-0.025em] mx-auto max-w-[20ch] mb-5"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 4rem)' }}
          >
            Three walls I kept hitting.{' '}
            <span className="text-[#E85D2F] dark:text-[#F2A261]">Three things I built.</span>
          </h2>
          <p className="max-w-[58ch] mx-auto text-[16px] md:text-[17px] text-[#0F1733]/65 dark:text-white/65 leading-[1.6]">
            Every piece of this app exists because the spreadsheet
            version of it stopped scaling. Below is the actual receipt.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 md:gap-6 items-stretch">
          {CARDS.map(card => (
            <WhyCard key={card.num} {...card} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes wte-breath {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: 1; }
          50%      { transform: translateX(-50%) scale(1.06); opacity: 0.7; }
        }
        @keyframes wte-card-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes wte-stroke {
          from { stroke-dashoffset: 100; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes wte-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes wte-pop-in {
          0%   { opacity: 0; transform: scale(0.85); }
          70%  { opacity: 1; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </section>
  )
}

function WhyCard({ num, tag, headline, note, answerLabel, answer, Visual }: CardData) {
  const ref = useRef<HTMLElement>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setRevealed(true)
      return
    }
    if (!ref.current) return
    const obs = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setRevealed(true)
            obs.disconnect()
          }
        }
      },
      { threshold: 0.3 },
    )
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <article
      ref={ref}
      className="group relative flex flex-col rounded-2xl border border-[#0F1733]/10 dark:border-white/10 bg-white dark:bg-[#0F1733] overflow-hidden transition-all duration-300 hover:border-[#E85D2F]/40"
      style={{
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 600ms ease-out, transform 600ms ease-out, border-color 200ms ease-out',
        boxShadow: '0 1px 3px rgba(15,23,51,0.05)',
      }}
    >
      {/* Big numeral hanging in the top-right */}
      <span
        aria-hidden
        className="absolute top-4 right-5 font-bold tracking-[-0.04em] text-[#0F1733]/[0.04] dark:text-white/[0.05] pointer-events-none select-none leading-none font-mono"
        style={{ fontSize: 'clamp(5rem, 8vw, 8rem)' }}
      >
        {num}
      </span>

      {/* Visual block — bg slightly darker so it reads as a "stage" */}
      <div className="relative h-48 md:h-52 bg-gradient-to-br from-[#FCFAF6] to-[#F7F2EA] dark:from-[#0A0E15] dark:to-[#13192B] border-b border-[#0F1733]/8 dark:border-white/8">
        <Visual revealed={revealed} />
      </div>

      <div className="p-6 md:p-7 flex flex-col flex-1">
        <div className="inline-flex self-start items-center gap-1.5 mb-4 px-2 py-0.5 rounded-full bg-[#E85D2F]/10 dark:bg-[#F2A261]/15 text-[10px] uppercase tracking-[0.18em] text-[#9C3D1F] dark:text-[#F2A261] font-bold border border-[#E85D2F]/30 dark:border-[#F2A261]/30">
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {tag}
        </div>
        <h3
          className="font-semibold tracking-[-0.015em] leading-[1.2] mb-3 text-[#0F1733] dark:text-white"
          style={{ fontSize: 'clamp(1.25rem, 1.75vw, 1.5rem)' }}
        >
          {headline}
        </h3>
        <p className="text-[14px] text-[#0F1733]/65 dark:text-white/65 leading-[1.65] mb-5 flex-1">
          {note}
        </p>

        {/* "Built in" answer block — terracotta accent box */}
        <div className="rounded-xl bg-[#E85D2F]/[0.06] dark:bg-[#F2A261]/[0.08] border border-[#E85D2F]/20 dark:border-[#F2A261]/25 p-3.5">
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden
              className="mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#E85D2F] text-white shrink-0"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="5 12 10 17 19 7" />
              </svg>
            </span>
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#9C3D1F] dark:text-[#F2A261] mb-1">
                {answerLabel}
              </div>
              <p className="text-[13.5px] text-[#0F1733]/85 dark:text-white/85 leading-[1.55]">
                {answer}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

/* ─── per-card visuals ─── */

/**
 * SourcingVisual — four chaotic browser-tab shapes (YT/LinkedIn/X/
 * Sheet) with strike-through, arrow down, single unified row.
 */
function SourcingVisual({ revealed }: { revealed: boolean }) {
  const fadeIn = (delay: number) => ({
    opacity: revealed ? 1 : 0,
    animation: revealed ? `wte-fade-in 500ms ${delay}ms ease-out both` : undefined,
  })
  return (
    <svg viewBox="0 0 320 200" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id="src-tab-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(15,23,51,0.06)" />
          <stop offset="100%" stopColor="rgba(15,23,51,0.02)" />
        </linearGradient>
        <linearGradient id="src-row-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#E85D2F" />
          <stop offset="100%" stopColor="#F2A261" />
        </linearGradient>
      </defs>

      {/* Four chaotic tabs (slightly rotated) */}
      <g className="dark:[&_rect]:fill-[#1A2034]" style={fadeIn(0)}>
        {[
          { x: 22, y: 24, rot: -6, label: 'YouTube' },
          { x: 110, y: 18, rot: 4, label: 'LinkedIn' },
          { x: 198, y: 28, rot: -3, label: 'Twitter' },
          { x: 240, y: 56, rot: 8, label: 'Sheet' },
        ].map((t, i) => (
          <g key={i} transform={`translate(${t.x},${t.y}) rotate(${t.rot})`}>
            <rect
              width="64"
              height="38"
              rx="6"
              fill="url(#src-tab-grad)"
              stroke="rgba(15,23,51,0.14)"
              strokeWidth="1"
              className="dark:fill-[#1A2034] dark:stroke-white/15"
            />
            <circle cx="10" cy="10" r="1.5" fill="rgba(15,23,51,0.28)" className="dark:fill-white/30" />
            <circle cx="16" cy="10" r="1.5" fill="rgba(15,23,51,0.28)" className="dark:fill-white/30" />
            <circle cx="22" cy="10" r="1.5" fill="rgba(15,23,51,0.28)" className="dark:fill-white/30" />
            <text x="32" y="26" textAnchor="middle" fill="rgba(15,23,51,0.55)" fontSize="8" fontWeight="600" className="dark:fill-white/55">
              {t.label}
            </text>
            {/* Strike-through */}
            <line
              x1="6"
              y1="19"
              x2="58"
              y2="19"
              stroke="#E85D2F"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.85"
              style={{
                strokeDasharray: 100,
                strokeDashoffset: revealed ? 0 : 100,
                transition: `stroke-dashoffset 500ms ${300 + i * 80}ms ease-out`,
              }}
            />
          </g>
        ))}
      </g>

      {/* Down arrow */}
      <g style={fadeIn(700)}>
        <line x1="160" y1="98" x2="160" y2="118" stroke="#E85D2F" strokeWidth="2" strokeLinecap="round" />
        <polyline points="153,112 160,120 167,112" fill="none" stroke="#E85D2F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Unified row */}
      <g style={fadeIn(900)}>
        <rect
          x="32"
          y="130"
          width="256"
          height="48"
          rx="10"
          fill="white"
          stroke="#E85D2F"
          strokeWidth="1.5"
          className="dark:fill-[#0F1733] dark:stroke-[#F2A261]"
        />
        {/* Avatar disc */}
        <circle cx="56" cy="154" r="11" fill="url(#src-row-grad)" />
        <text x="56" y="158" textAnchor="middle" fill="white" fontSize="9" fontWeight="700">CR</text>
        {/* Name + handle */}
        <text x="76" y="150" fill="#0F1733" fontSize="9.5" fontWeight="600" className="dark:fill-white">
          Creator name
        </text>
        <text x="76" y="163" fill="rgba(15,23,51,0.55)" fontSize="8" className="dark:fill-white/55">
          email · IG · LinkedIn · YouTube
        </text>
        {/* Score pill */}
        <rect x="232" y="144" width="44" height="20" rx="10" fill="#E85D2F" />
        <text x="254" y="158" textAnchor="middle" fill="white" fontSize="9" fontWeight="700">92 · STRONG</text>
      </g>
    </svg>
  )
}

/**
 * FitScoreVisual — generic flat gauge (greyed out) above, customized
 * gauge with chips below, terracotta arrow between them.
 */
function FitScoreVisual({ revealed }: { revealed: boolean }) {
  const fadeIn = (delay: number) => ({
    opacity: revealed ? 1 : 0,
    animation: revealed ? `wte-fade-in 500ms ${delay}ms ease-out both` : undefined,
  })
  return (
    <svg viewBox="0 0 320 200" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id="fit-arc-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E85D2F" />
          <stop offset="100%" stopColor="#F2A261" />
        </linearGradient>
      </defs>

      {/* Generic / greyed gauge top-left */}
      <g style={fadeIn(0)} transform="translate(40, 36)">
        <rect width="100" height="50" rx="8" fill="rgba(15,23,51,0.04)" stroke="rgba(15,23,51,0.12)" strokeWidth="1" className="dark:fill-white/[0.04] dark:stroke-white/15" />
        <text x="50" y="16" textAnchor="middle" fill="rgba(15,23,51,0.5)" fontSize="7" fontWeight="600" letterSpacing="0.5" className="dark:fill-white/45">
          GENERIC SCORE
        </text>
        {/* Bland bar */}
        <rect x="10" y="24" width="80" height="6" rx="3" fill="rgba(15,23,51,0.08)" className="dark:fill-white/12" />
        <rect x="10" y="24" width="40" height="6" rx="3" fill="rgba(15,23,51,0.30)" className="dark:fill-white/30" />
        <text x="10" y="42" fill="rgba(15,23,51,0.5)" fontSize="7" className="dark:fill-white/50">
          Engagement: 5.4%
        </text>
        <line x1="10" y1="33" x2="90" y2="13" stroke="#E85D2F" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" style={{
          strokeDasharray: 100,
          strokeDashoffset: revealed ? 0 : 100,
          transition: 'stroke-dashoffset 500ms 300ms ease-out',
        }} />
      </g>

      {/* Arrow */}
      <g style={fadeIn(550)}>
        <path d="M 168 60 Q 200 60 200 100" fill="none" stroke="#E85D2F" strokeWidth="2" strokeLinecap="round" />
        <polyline points="194,94 200,102 206,94" fill="none" stroke="#E85D2F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Customized score with arc + chips bottom-right */}
      <g style={fadeIn(800)} transform="translate(180, 100)">
        {/* Mini arc */}
        <path
          d="M 8 56 A 48 48 0 0 1 104 56"
          fill="none"
          stroke="rgba(15,23,51,0.08)"
          strokeWidth="6"
          strokeLinecap="round"
          className="dark:stroke-white/12"
        />
        <path
          d="M 8 56 A 48 48 0 0 1 92 32"
          fill="none"
          stroke="url(#fit-arc-grad)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <text x="56" y="48" textAnchor="middle" fill="#0F1733" fontSize="20" fontWeight="700" className="dark:fill-white">
          92
        </text>
        <text x="56" y="62" textAnchor="middle" fill="#E85D2F" fontSize="6" fontWeight="700" letterSpacing="1">
          STRONG FIT
        </text>
        {/* Custom criteria chips below */}
        {[
          { x: 0, label: 'US-based' },
          { x: 38, label: 'Weekly' },
          { x: 70, label: '< 100K' },
        ].map((c, i) => (
          <g key={c.label} style={{
            opacity: revealed ? 1 : 0,
            animation: revealed ? `wte-pop-in 400ms ${1000 + i * 120}ms ease-out both` : undefined,
          }}>
            <rect x={c.x} y="76" width={c.label.length * 5 + 8} height="14" rx="7" fill="white" stroke="#E85D2F" strokeWidth="1" className="dark:fill-[#0F1733] dark:stroke-[#F2A261]" />
            <text x={c.x + (c.label.length * 5 + 8) / 2} y="86" textAnchor="middle" fill="#9C3D1F" fontSize="7" fontWeight="600" className="dark:fill-[#F2A261]">
              {c.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  )
}

/**
 * OutreachVisual — two greyed-out CRM logos with $ price labels and
 * X marks, then a unified Outreach row with IG/Email/LinkedIn pills.
 */
function OutreachVisual({ revealed }: { revealed: boolean }) {
  const fadeIn = (delay: number) => ({
    opacity: revealed ? 1 : 0,
    animation: revealed ? `wte-fade-in 500ms ${delay}ms ease-out both` : undefined,
  })
  return (
    <svg viewBox="0 0 320 200" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id="out-row-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#E85D2F" />
          <stop offset="100%" stopColor="#F2A261" />
        </linearGradient>
      </defs>

      {/* Two crossed-out CRM blocks at top */}
      {[
        { x: 32, label: 'HubSpot', price: '$400/mo', delay: 0 },
        { x: 168, label: 'Pipedrive', price: '$300/mo', delay: 120 },
      ].map(c => (
        <g key={c.label} style={fadeIn(c.delay)} transform={`translate(${c.x}, 24)`}>
          <rect
            width="120"
            height="48"
            rx="8"
            fill="rgba(15,23,51,0.04)"
            stroke="rgba(15,23,51,0.14)"
            strokeWidth="1"
            className="dark:fill-white/[0.04] dark:stroke-white/15"
          />
          <text x="60" y="22" textAnchor="middle" fill="rgba(15,23,51,0.55)" fontSize="11" fontWeight="700" className="dark:fill-white/55">
            {c.label}
          </text>
          <text x="60" y="36" textAnchor="middle" fill="rgba(15,23,51,0.4)" fontSize="8" className="dark:fill-white/40">
            {c.price} · no IG
          </text>
          {/* Big X */}
          <line x1="14" y1="10" x2="106" y2="38" stroke="#E85D2F" strokeWidth="2.5" strokeLinecap="round" style={{
            strokeDasharray: 120,
            strokeDashoffset: revealed ? 0 : 120,
            transition: `stroke-dashoffset 500ms ${c.delay + 300}ms ease-out`,
          }} />
          <line x1="106" y1="10" x2="14" y2="38" stroke="#E85D2F" strokeWidth="2.5" strokeLinecap="round" style={{
            strokeDasharray: 120,
            strokeDashoffset: revealed ? 0 : 120,
            transition: `stroke-dashoffset 500ms ${c.delay + 380}ms ease-out`,
          }} />
        </g>
      ))}

      {/* Down arrow */}
      <g style={fadeIn(700)}>
        <line x1="160" y1="86" x2="160" y2="110" stroke="#E85D2F" strokeWidth="2" strokeLinecap="round" />
        <polyline points="153,104 160,112 167,104" fill="none" stroke="#E85D2F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Built-in row */}
      <g style={fadeIn(900)}>
        <rect
          x="22"
          y="124"
          width="276"
          height="56"
          rx="10"
          fill="white"
          stroke="#E85D2F"
          strokeWidth="1.5"
          className="dark:fill-[#0F1733] dark:stroke-[#F2A261]"
        />
        {/* Status pill */}
        <rect x="34" y="138" width="60" height="16" rx="8" fill="#16A34A" />
        <text x="64" y="150" textAnchor="middle" fill="white" fontSize="8" fontWeight="700" letterSpacing="0.4">
          OPEN
        </text>
        <text x="34" y="170" fill="rgba(15,23,51,0.55)" fontSize="7" className="dark:fill-white/55">
          Reached out
        </text>
        {/* Channel pills */}
        {[
          { x: 110, label: 'Email', fill: '#1B6FB5' },
          { x: 158, label: 'IG DM', fill: '#E85D2F' },
          { x: 200, label: 'LinkedIn', fill: '#0A66C2' },
        ].map(p => (
          <g key={p.label}>
            <rect x={p.x} y="138" width={p.label.length * 5 + 12} height="16" rx="8" fill={p.fill} fillOpacity="0.18" stroke={p.fill} strokeWidth="1" />
            <text x={p.x + (p.label.length * 5 + 12) / 2} y="150" textAnchor="middle" fill={p.fill} fontSize="8" fontWeight="700">
              {p.label}
            </text>
          </g>
        ))}
        {/* Cadence chip */}
        <rect x="252" y="138" width="36" height="16" rx="8" fill="url(#out-row-grad)" />
        <text x="270" y="150" textAnchor="middle" fill="white" fontSize="8" fontWeight="700">
          7d
        </text>
        <text x="110" y="170" fill="rgba(15,23,51,0.55)" fontSize="7" className="dark:fill-white/55">
          DM template ready · cadence set
        </text>
      </g>
    </svg>
  )
}
