'use client'

import { useEffect, useRef } from 'react'
import { animate, createTimeline, stagger, utils } from 'animejs'

/**
 * OperatorConsole — the hero visual for the landing page.
 *
 * Mirrors the ACTUAL Results table inside the authenticated app
 * (dark theme, exact column layout, real fit-score thresholds).
 * Shows a fresh search resolving live: query types itself, status
 * line confirms creators found, tabs settle, then 6 rows cascade
 * into the table from the top with staggered drop physics.
 *
 *   ┌─[chrome]──────────────────────────────────────┐
 *   │ 🔍 day trader|     ⚡  ▼  [Search]  ↓         │
 *   │ Done — 100 creators found                     │
 *   │ Results (66/100)  Outreach  Dismissed [Custom]│
 *   │                                               │
 *   │ ⊕  Channel        Fit       Subs   Email   IG│
 *   │ +  Derek Moneyberg 51 Poss.. 176K  ✓green  DM│
 *   │ +  Toby Mathis...  77 Strong 611K  ✓green  DM│
 *   │ ...                                           │
 *   └───────────────────────────────────────────────┘
 *
 * Real fit-score thresholds (from lib/scoring.ts):
 *   ≥70 = "Strong Fit" (green)
 *   ≥50 = "Possible Fit" (yellow)
 *   ≥25 = "Weak Fit" (orange)
 *
 * anime.js v4:
 * - createTimeline orchestrates the master loop (typing → status →
 *   row cascade → hold → fade → next query)
 * - outElastic for the row drop landing
 * - IntersectionObserver pause off-screen
 * - prefers-reduced-motion → static populated state
 */

interface Row {
  name: string
  fitScore: number
  avgViews: number
  subs: string             // formatted "176K", "1.83K", "1.2M"
  lastVideo: string         // "today" / "2 days ago" / "3 months ago"
  email: string             // empty string = no email
  hasIG: boolean
  hasLI: boolean
}

// Each query gets its own row data so the visual changes meaningfully on loop
const SCENARIOS: { query: string; rows: Row[] }[] = [
  {
    query: 'day trader',
    rows: [
      { name: 'Derek Moneyberg',     fitScore: 51, avgViews: 53114,  subs: '176K',  lastVideo: '2 days ago',  email: 'servicialcliente@derek.co',  hasIG: true,  hasLI: true },
      { name: 'Jesse VanRo',          fitScore: 43, avgViews: 171,    subs: '1.83K', lastVideo: '3 months ago', email: 'support@jessevanro.com',     hasIG: true,  hasLI: true },
      { name: 'Roderick Casilli',    fitScore: 51, avgViews: 9362,   subs: '50.5K', lastVideo: 'today',        email: 'futuresfanatic@noisereach.com', hasIG: true,  hasLI: true },
      { name: 'Roman Paolucci',       fitScore: 51, avgViews: 141037, subs: '79.4K', lastVideo: 'today',        email: 'support@quantguild.com',     hasIG: true,  hasLI: true },
      { name: 'Toby Mathis Esq.',    fitScore: 77, avgViews: 163614, subs: '611K',  lastVideo: 'today',        email: 'info@andersonadvisors.com',  hasIG: true,  hasLI: true },
      { name: 'TraderTV Live',        fitScore: 51, avgViews: 5157,   subs: '564K',  lastVideo: '4 hrs ago',    email: 'marketing@tradertv.live',    hasIG: true,  hasLI: false },
    ],
  },
  {
    query: 'commercial real estate',
    rows: [
      { name: 'Grant Cardone',        fitScore: 82, avgViews: 412900, subs: '2.1M',  lastVideo: 'today',        email: 'info@cardone.com',          hasIG: true,  hasLI: true },
      { name: 'Ken McElroy',          fitScore: 71, avgViews: 87432,  subs: '348K',  lastVideo: '2 days ago',  email: 'team@kenmcelroy.com',       hasIG: true,  hasLI: true },
      { name: 'BiggerPockets',       fitScore: 68, avgViews: 124000, subs: '1.2M',  lastVideo: '6 hrs ago',    email: 'press@biggerpockets.com',   hasIG: false, hasLI: true },
      { name: 'CRE Daily',            fitScore: 64, avgViews: 8421,   subs: '42K',   lastVideo: 'yesterday',    email: '',                            hasIG: true,  hasLI: true },
      { name: 'Beth Azor',            fitScore: 56, avgViews: 5102,   subs: '38K',   lastVideo: '4 days ago',   email: 'beth@azor.com',             hasIG: true,  hasLI: true },
      { name: 'CRE Analyst',         fitScore: 49, avgViews: 14302,  subs: '88K',   lastVideo: '1 week ago',   email: 'team@creanalyst.io',       hasIG: false, hasLI: true },
    ],
  },
  {
    query: 'sustainable fashion',
    rows: [
      { name: 'Aja Barber',            fitScore: 86, avgViews: 64211,  subs: '184K',  lastVideo: 'today',        email: 'hello@ajabarber.com',       hasIG: true,  hasLI: true },
      { name: 'Justine Leconte',       fitScore: 79, avgViews: 312000, subs: '900K',  lastVideo: '2 days ago',  email: 'team@justineleconte.com',  hasIG: true,  hasLI: true },
      { name: 'Venetia La Manna',      fitScore: 73, avgViews: 24300,  subs: '142K',  lastVideo: 'yesterday',    email: 'venetia@lamanna.studio',    hasIG: true,  hasLI: false },
      { name: 'Bestdressed',           fitScore: 58, avgViews: 893422, subs: '4.1M',  lastVideo: '3 weeks ago',  email: '',                            hasIG: true,  hasLI: false },
      { name: 'Stella McCartney Press',fitScore: 55, avgViews: 72100,  subs: '510K',  lastVideo: 'today',        email: 'press@stellamccartney.com',hasIG: true,  hasLI: true },
      { name: 'Mikaela Loach',         fitScore: 47, avgViews: 4811,   subs: '38K',   lastVideo: '5 days ago',   email: 'mikaela@theyoungrebel.com',hasIG: true,  hasLI: true },
    ],
  },
]

const COL_WIDTHS = {
  outreach: 36,
  channel: 'minmax(0,1.7fr)',
  fit:     'minmax(0,1.3fr)',
  subs:    'minmax(0,0.6fr)',
  recent:  'minmax(0,0.7fr)',
  email:   'minmax(0,1.4fr)',
  social:  '46px',
}

function gridTemplate() {
  return `${COL_WIDTHS.outreach}px ${COL_WIDTHS.channel} ${COL_WIDTHS.fit} ${COL_WIDTHS.subs} ${COL_WIDTHS.recent} ${COL_WIDTHS.email} ${COL_WIDTHS.social} ${COL_WIDTHS.social}`
}

function fitMeta(score: number) {
  // Mirrors lib/scoring.ts fitScoreMeta exactly.
  if (score >= 70) return { label: 'Strong Fit',  text: '#34D399', dot: '#10B981' }
  if (score >= 50) return { label: 'Possible Fit', text: '#FACC15', dot: '#EAB308' }
  if (score >= 25) return { label: 'Weak Fit',    text: '#FB923C', dot: '#F97316' }
  return                  { label: 'No Fit',      text: '#F87171', dot: '#EF4444' }
}

export function OperatorConsole() {
  const rootRef = useRef<HTMLDivElement>(null)
  const queryRef = useRef<HTMLSpanElement>(null)
  const statusRef = useRef<HTMLSpanElement>(null)
  const scenarioIdxRef = useRef(0)
  const tableBodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root || !tableBodyRef.current) return

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function renderRows(rows: Row[]) {
      if (!tableBodyRef.current) return
      tableBodyRef.current.innerHTML = rows.map((r, i) => rowHTML(r, i)).join('')
    }

    if (prefersReduced) {
      renderRows(SCENARIOS[0].rows)
      if (queryRef.current) queryRef.current.textContent = SCENARIOS[0].query
      if (statusRef.current) statusRef.current.textContent = `Done — 100 creators found.`
      return
    }

    let active = true
    let masterTl: ReturnType<typeof createTimeline> | null = null

    function buildMaster() {
      if (!active || !root || !tableBodyRef.current) return

      const scenario = SCENARIOS[scenarioIdxRef.current % SCENARIOS.length]
      scenarioIdxRef.current++

      // Render the rows (initially hidden — animation reveals them)
      renderRows(scenario.rows)
      utils.set('.oc-row', { opacity: 0, translateY: -28 })
      if (queryRef.current) queryRef.current.textContent = ''
      if (statusRef.current) statusRef.current.textContent = ''

      const tl = createTimeline({ defaults: { ease: 'out(3)' } })

      // 1. Type the query character-by-character
      const chars = scenario.query.split('')
      chars.forEach((_, i) => {
        tl.add({}, {
          duration: 60,
          onBegin: () => {
            if (queryRef.current) queryRef.current.textContent = chars.slice(0, i + 1).join('')
          },
        })
      })

      // 2. Pause briefly after typing (operator hovers their finger)
      tl.add({}, { duration: 280 })

      // 3. Status line populates
      tl.add({}, {
        duration: 200,
        onBegin: () => {
          if (statusRef.current) statusRef.current.textContent = `Done — 100 creators found.`
        },
      })

      // 4. Rows cascade in from above with stagger + outElastic landing
      tl.add('.oc-row', {
        opacity: [0, 1],
        translateY: [-28, 0],
        duration: 700,
        ease: 'outElastic(1, 0.65)',
        delay: stagger(95),
      }, '+=120')

      // 5. Hold the populated state
      tl.add({}, { duration: 2400 })

      // 6. Fade out, clear query, loop into next scenario
      tl.add('.oc-row', {
        opacity: 0,
        translateY: -16,
        duration: 380,
        ease: 'in(2)',
        delay: stagger(35, { from: 'last' }),
      })

      tl.add({}, {
        duration: 350,
        onBegin: () => {
          if (queryRef.current) queryRef.current.textContent = ''
          if (statusRef.current) statusRef.current.textContent = ''
        },
      })

      tl.then(() => buildMaster())

      masterTl = tl
    }

    // Cursor blink (continuous)
    animate('.oc-cursor', {
      opacity: [1, 0],
      duration: 500,
      loop: true,
      alternate: true,
    })

    // IntersectionObserver to pause when off-screen
    const io = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!masterTl) buildMaster()
          } else {
            masterTl?.pause()
          }
        }
      },
      { threshold: 0.05 },
    )
    io.observe(root)

    return () => {
      active = false
      io.disconnect()
      masterTl?.pause()
    }
  }, [])

  return (
    <div
      ref={rootRef}
      className="relative w-full overflow-hidden rounded-2xl border border-[#0F1733]/10 bg-white"
      style={{
        boxShadow: '0 50px 100px -40px rgba(15,23,51,0.30), 0 25px 50px -20px rgba(232,93,47,0.15)',
        aspectRatio: '760/540',
      }}
      aria-label="Animated Results table showing a search query resolving creator data into the live operator queue"
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#0F1733]/10 bg-[#FCFAF6]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#0F1733]/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#0F1733]/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#0F1733]/15" />
        <span className="ml-3 text-[11px] text-[#0F1733]/45 font-medium font-mono">creatoroutreach.net / results</span>
      </div>

      {/* The actual app frame — DARK like the real app */}
      <div className="bg-[#0E121C] text-white" style={{ height: 'calc(100% - 38px)' }}>
        {/* Search bar */}
        <div className="px-4 pt-3.5 pb-3 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-[#1A1F2E] border border-white/10 rounded-md px-3 py-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/55 shrink-0">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span ref={queryRef} className="text-[13px] text-white" />
            <span className="oc-cursor inline-block w-[1.5px] h-[14px] bg-white -ml-1" />
          </div>
          {/* Lightning + filter buttons */}
          <button className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-violet-600 text-white" aria-hidden>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" /></svg>
          </button>
          <button className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-[#1A1F2E] border border-white/10 text-white/65" aria-hidden>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          </button>
          <button className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-md px-3 py-1.5 text-[12px] font-semibold" aria-hidden>
            Search
          </button>
          <button className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-emerald-600/90 text-white" aria-hidden>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          </button>
        </div>

        {/* Status line */}
        <div className="px-4 -mt-0.5 pb-2 text-[11px] text-[#34D399] font-medium tabular-nums min-h-[14px]">
          <span ref={statusRef} />
        </div>

        {/* Tabs strip */}
        <div className="px-4 pb-2 flex items-center gap-5 border-b border-white/8 text-[12px] font-medium">
          <span className="pb-2 border-b-2 border-violet-500 text-white">Results <span className="text-white/45 ml-0.5 tabular-nums">(66/100)</span></span>
          <span className="pb-2 text-white/55 hover:text-white/80 cursor-default">Outreach <span className="text-white/30 tabular-nums">(124)</span></span>
          <span className="pb-2 text-white/55 hover:text-white/80 cursor-default">Dismissed <span className="text-white/30 tabular-nums">(8)</span></span>
          <span className="ml-auto pb-2 text-white/55 inline-flex items-center gap-1 cursor-default text-[11px]">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            Customize
          </span>
        </div>

        {/* Table header */}
        <div
          className="px-4 py-2 grid items-center text-[10px] uppercase tracking-[0.12em] font-semibold text-white/45 border-b border-white/5"
          style={{ gridTemplateColumns: gridTemplate() }}
        >
          <span /> {/* outreach action col */}
          <span>Channel</span>
          <span>Fit Score</span>
          <span>Subs</span>
          <span>Last Video</span>
          <span>Email</span>
          <span className="text-center">LI</span>
          <span className="text-center">IG</span>
        </div>

        {/* Rows — populated by anime.js on every loop */}
        <div ref={tableBodyRef} className="px-1 pt-1" />
      </div>
    </div>
  )
}

/** Render one row's HTML directly so anime.js can write into a single container.
 *  Tradeoff: not React-idiomatic, but lets anime.js own per-row updates without
 *  React reconciler churn during the cascade animation. */
function rowHTML(r: Row, i: number): string {
  const fit = fitMeta(r.fitScore)
  const emailColor = r.email ? '#34D399' : 'rgba(255,255,255,0.30)'
  const emailText = r.email || '—'
  const liChip = r.hasLI
    ? `<span class="text-pink-400 text-[10px] font-semibold">Message</span>`
    : `<span class="text-white/30">—</span>`
  const igChip = r.hasIG
    ? `<span class="text-pink-400 text-[10px] font-semibold">DM</span>`
    : `<span class="text-white/30">—</span>`
  const initial = r.name.charAt(0).toUpperCase()
  // Avatar gradient — cycle 4 colors so the rows don't all look the same
  const gradients = [
    'linear-gradient(135deg,#FFE5C4,#F2A261)',
    'linear-gradient(135deg,#FFD9D9,#E85D2F)',
    'linear-gradient(135deg,#D6EBFF,#1B6FB5)',
    'linear-gradient(135deg,#F4DAFF,#A26FE8)',
  ]
  const avatarBg = gradients[i % gradients.length]

  return `
    <div class="oc-row grid items-center px-3 py-2 rounded-md hover:bg-white/[0.025]" style="grid-template-columns:${gridTemplate()};opacity:0;transform:translateY(-28px)">
      <span class="text-violet-400/80 text-[14px] font-bold">+</span>
      <span class="flex items-center gap-2 min-w-0">
        <span class="w-5 h-5 rounded-full shrink-0 border border-white/15 inline-flex items-center justify-center text-[9px] font-bold text-[#0F1733]" style="background:${avatarBg}">${initial}</span>
        <span class="text-[12px] font-medium text-white truncate">${r.name}</span>
      </span>
      <span class="flex items-baseline gap-1.5">
        <span class="text-[13px] font-bold text-white tabular-nums">${r.fitScore}</span>
        <span class="text-[10px] font-semibold" style="color:${fit.text}">${fit.label}</span>
      </span>
      <span class="text-[11px] tabular-nums text-white/85">${r.subs}</span>
      <span class="text-[10px] text-white/55">${r.lastVideo}</span>
      <span class="text-[11px] truncate" style="color:${emailColor}">${emailText}</span>
      <span class="text-center">${liChip}</span>
      <span class="text-center">${igChip}</span>
    </div>
  `
}
