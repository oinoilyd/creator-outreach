'use client'

import { useEffect, useRef } from 'react'
import { animate, createTimeline, stagger, utils } from 'animejs'

/**
 * OperatorConsole — the hero visual for the Apollo-style landing.
 *
 * What it shows: a live operator working through the product end-to-end.
 *
 *   1. Search bar at the top types a query character-by-character
 *   2. Underneath, six creator result cards CASCADE in from above
 *      with staggered drop + spring bounce
 *   3. Each card's fit-score bar fills + score number ticks up to
 *      its final value (numbers roll like an odometer)
 *   4. Right side: a "LIVE QUEUE" panel with three counters that
 *      increment continuously, plus an "ACTIVITY" feed of recent
 *      handles rotating in
 *   5. After the 8-second master loop: query clears, cards fade
 *      out, loop restarts with a new query
 *
 * Why anime.js v4:
 *   - createTimeline orchestrates the master sequence
 *   - stagger() handles the per-card cascade delays
 *   - spring-flavored easings (out(5), elasticOut) for the card landings
 *   - Independent loops for ambient motion (counters, pulse, parallax)
 *
 * Performance:
 *   - Pure transform/opacity for compositor-only animation
 *   - IntersectionObserver pauses the loop off-screen
 *   - Respects prefers-reduced-motion (renders the final frame statically)
 */

// Sample creator data — read as real human names rather than placeholders
const CREATORS: { name: string; handle: string; platform: string; platformBg: string; avatarBg: string; finalScore: number }[] = [
  { name: 'Marina Briggs',  handle: '@marinabriggs',  platform: 'IG', platformBg: '#E85D2F', avatarBg: 'linear-gradient(135deg,#FFE0D6,#E85D2F)', finalScore: 92 },
  { name: 'Alex Castelli',  handle: '@alex.castelli', platform: 'YT', platformBg: '#FF0000', avatarBg: 'linear-gradient(135deg,#FFD9D9,#C00000)', finalScore: 88 },
  { name: 'Jay Reyes',       handle: '@jayreyes',     platform: 'TT', platformBg: '#1A1F2E', avatarBg: 'linear-gradient(135deg,#E0E5FF,#5B6FD0)', finalScore: 76 },
  { name: 'Lena Aldaco',    handle: '@lena.aldaco',   platform: 'IG', platformBg: '#E85D2F', avatarBg: 'linear-gradient(135deg,#FFE5C4,#F2A261)', finalScore: 95 },
  { name: 'Pat Okafor',      handle: '@patokafor',    platform: 'LI', platformBg: '#1B6FB5', avatarBg: 'linear-gradient(135deg,#D6EBFF,#1B6FB5)', finalScore: 71 },
  { name: 'Mei Tanaka',     handle: '@mei.tanaka',    platform: 'YT', platformBg: '#FF0000', avatarBg: 'linear-gradient(135deg,#F4DAFF,#A26FE8)', finalScore: 84 },
]

const QUERIES = [
  'commercial real estate creators',
  'indie podcasters in SaaS',
  'sustainable fashion influencers',
  'b2b finance youtubers under 50k',
]

const ACTIVITY_NAMES = [
  '@dylan.j',
  '@sarah.run',
  '@jonpark',
  '@m.castro',
  '@oliviak',
  '@n.chen',
  '@rich.field',
  '@a.ross',
]

export function OperatorConsole() {
  const rootRef = useRef<HTMLDivElement>(null)
  const queryRef = useRef<HTMLSpanElement>(null)
  const cursorRef = useRef<HTMLSpanElement>(null)
  const queryIdxRef = useRef(0)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReduced) {
      // Static final-frame render: query filled in, cards visible, scores at final value
      if (queryRef.current) queryRef.current.textContent = QUERIES[0]
      utils.set('.oc-card', { opacity: 1, translateY: 0 })
      CREATORS.forEach((c, i) => {
        utils.set(`.oc-card-${i} .oc-bar-fill`, { width: `${c.finalScore}%` })
        const scoreEl = root.querySelector(`.oc-card-${i} .oc-score`)
        if (scoreEl) scoreEl.textContent = String(c.finalScore)
      })
      return
    }

    let active = true
    let masterTl: ReturnType<typeof createTimeline> | null = null

    function buildMaster() {
      if (!active || !root) return

      // Reset state
      utils.set('.oc-card', { opacity: 0, translateY: -40, scale: 0.95 })
      utils.set('.oc-bar-fill', { width: '0%' })
      utils.set('.oc-score-pill', { opacity: 0, scale: 0.6 })
      root.querySelectorAll('.oc-score').forEach(el => { (el as HTMLElement).textContent = '0' })
      if (queryRef.current) queryRef.current.textContent = ''

      // Pick next query
      const query = QUERIES[queryIdxRef.current % QUERIES.length]
      queryIdxRef.current++

      const tl = createTimeline({ defaults: { ease: 'out(3)' } })

      // 1. TYPE the query character by character (~70ms per char)
      const chars = query.split('')
      chars.forEach((_, i) => {
        tl.add({}, {
          duration: 70,
          onBegin: () => {
            if (queryRef.current) {
              queryRef.current.textContent = chars.slice(0, i + 1).join('')
            }
          },
        })
      })

      // 2. Pause briefly after typing
      tl.add({}, { duration: 350 })

      // 3. CASCADE cards in from above with staggered drop + spring landing
      tl.add('.oc-card', {
        opacity: [0, 1],
        translateY: [-40, 0],
        scale: [0.95, 1],
        duration: 700,
        ease: 'outElastic(1, 0.6)',
        delay: stagger(120),
      }, '+=0')

      // 4. SCORE BAR fills per card (stagger so they don't all bloom at once)
      CREATORS.forEach((c, i) => {
        tl.add(`.oc-card-${i} .oc-bar-fill`, {
          width: ['0%', `${c.finalScore}%`],
          duration: 700,
          ease: 'out(4)',
        }, `-=${700 - i * 90}`)

        // 5. SCORE NUMBER ticks up, tied to bar fill timing
        const target = { v: 0 }
        tl.add(target, {
          v: c.finalScore,
          duration: 700,
          modifier: utils.round(0),
          ease: 'out(4)',
          onUpdate: () => {
            const el = root.querySelector(`.oc-card-${i} .oc-score`) as HTMLElement | null
            if (el) el.textContent = String(Math.round(target.v))
          },
        }, `-=700`)

        // 6. SCORE PILL pop-in once filled (high scorers only — pulls the eye)
        if (c.finalScore >= 85) {
          tl.add(`.oc-card-${i} .oc-score-pill`, {
            opacity: [0, 1],
            scale: [0.6, 1.0],
            duration: 350,
            ease: 'outElastic(1, 0.5)',
          }, `-=300`)
        }
      })

      // 7. HOLD the populated state
      tl.add({}, { duration: 1800 })

      // 8. FADE OUT — cards float up + opacity drops
      tl.add('.oc-card', {
        opacity: 0,
        translateY: -20,
        duration: 500,
        ease: 'in(2)',
        delay: stagger(40, { from: 'last' }),
      })

      // 9. CLEAR query, pause briefly
      tl.add({}, {
        duration: 450,
        onBegin: () => { if (queryRef.current) queryRef.current.textContent = '' },
      })

      // Loop back into a fresh query
      tl.then(() => buildMaster())

      masterTl = tl
    }

    // Independent loops — these run continuously regardless of master state

    // CURSOR blink — anime v4 dropped the 'steps(N)' string easing, so
    // use a sharp inOut at half-duration each direction (visually
    // equivalent to a hard blink without the warning).
    animate('.oc-cursor', {
      opacity: [1, 0],
      duration: 500,
      loop: true,
      alternate: true,
    })

    // LIVE pulse
    animate('.oc-live-dot', {
      scale: [1, 1.5, 1],
      opacity: [1, 0.5, 1],
      duration: 1400,
      loop: true,
      ease: 'inOut(2)',
    })

    // BACKGROUND grid subtle parallax
    animate('.oc-grid', {
      translateY: [0, 20],
      duration: 8000,
      loop: true,
      ease: 'linear',
    })

    // QUEUE counters — each ticks up at its own rate
    const counterAnims: Array<ReturnType<typeof animate>> = []
    const counters = [
      { sel: '.oc-counter-sourced', from: 1284, rate: 7 },
      { sel: '.oc-counter-contacted', from: 487, rate: 3 },
      { sel: '.oc-counter-replied', from: 124, rate: 1 },
    ]
    counters.forEach(({ sel, from, rate }) => {
      const target = { v: from }
      counterAnims.push(animate(target, {
        v: from + 200,
        duration: (200 / rate) * 1000,
        loop: true,
        ease: 'linear',
        modifier: utils.round(0),
        onUpdate: () => {
          const el = root.querySelector(sel) as HTMLElement | null
          if (el) el.textContent = Math.round(target.v).toLocaleString()
        },
      }))
    })

    // ACTIVITY feed — names rotate in/out
    const activityEl = root.querySelector('.oc-activity-list')
    if (activityEl) {
      let idx = 0
      const rotateActivity = () => {
        const items = activityEl.querySelectorAll('.oc-activity-item')
        items.forEach((item, i) => {
          const nameEl = item.querySelector('.oc-activity-name')
          if (nameEl) nameEl.textContent = ACTIVITY_NAMES[(idx + i) % ACTIVITY_NAMES.length]
        })
        animate('.oc-activity-item', {
          opacity: [0, 1],
          translateY: [10, 0],
          duration: 400,
          delay: stagger(60),
          ease: 'out(2)',
        })
        idx++
      }
      rotateActivity()
      const activityInterval = setInterval(rotateActivity, 3000)
      ;(rootRef as any)._activityInterval = activityInterval
    }

    // IntersectionObserver — pause the master loop when off-screen
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
      counterAnims.forEach(a => a.pause())
      const interval = (rootRef as any)._activityInterval
      if (interval) clearInterval(interval)
    }
  }, [])

  return (
    <div
      ref={rootRef}
      className="relative w-full overflow-hidden rounded-2xl border border-[#0F1733]/10 bg-white"
      style={{
        boxShadow: '0 50px 100px -40px rgba(15,23,51,0.30), 0 25px 50px -20px rgba(232,93,47,0.15)',
        aspectRatio: '720/520',
      }}
      aria-label="Animated operator console showing search query, scored creator results, live counters, and activity feed"
    >
      {/* Background grid — subtle parallax */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
        <defs>
          <pattern id="oc-grid-pattern" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="#0F1733" opacity="0.06" />
          </pattern>
        </defs>
        <g className="oc-grid">
          <rect x="0" y="-32" width="100%" height="120%" fill="url(#oc-grid-pattern)" />
        </g>
      </svg>

      {/* Soft warm glow in upper-right */}
      <div
        aria-hidden
        className="absolute -top-20 -right-20 w-[300px] h-[300px] pointer-events-none rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(232,93,47,0.20) 0%, transparent 70%)' }}
      />

      {/* Window chrome */}
      <div className="relative z-10 flex items-center gap-1.5 px-4 py-3 border-b border-[#0F1733]/10 bg-[#FCFAF6]/80 backdrop-blur-sm">
        <span className="w-2.5 h-2.5 rounded-full bg-[#0F1733]/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#0F1733]/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#0F1733]/15" />
        <span className="ml-3 text-[11px] text-[#0F1733]/45 font-medium font-mono">creatoroutreach.net / live</span>
        <div className="ml-auto inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-bold text-[#16A34A]">
          <span className="oc-live-dot inline-block w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
          Live
        </div>
      </div>

      {/* Main grid: search + cards on left, queue panel on right */}
      <div className="relative z-10 grid grid-cols-12 gap-3 p-4">
        {/* LEFT: search + cards */}
        <div className="col-span-8">
          {/* Search bar */}
          <div className="relative mb-3 rounded-lg border border-[#0F1733]/15 bg-white px-3 py-2 flex items-center gap-2 text-[13px] font-medium" style={{ boxShadow: '0 1px 3px rgba(15,23,51,0.04)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#E85D2F]" aria-hidden>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span ref={queryRef} className="text-[#0F1733]" />
            <span ref={cursorRef} className="oc-cursor inline-block w-[1.5px] h-[14px] bg-[#0F1733] -ml-0.5" />
          </div>

          {/* Cards grid 3x2 */}
          <div className="grid grid-cols-3 gap-2.5">
            {CREATORS.map((c, i) => (
              <div
                key={i}
                className={`oc-card oc-card-${i} relative rounded-lg border border-[#0F1733]/12 bg-white p-2.5 overflow-hidden`}
                style={{ boxShadow: '0 1px 3px rgba(15,23,51,0.05)' }}
              >
                {/* High-score pill (top right) — pops in for >=85 */}
                {c.finalScore >= 85 && (
                  <div className="oc-score-pill absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#16A34A] text-white text-[8px] font-bold uppercase tracking-[0.12em]">
                    Top fit
                  </div>
                )}
                {/* Avatar + name */}
                <div className="flex items-center gap-1.5 mb-2">
                  <div
                    className="w-7 h-7 rounded-full shrink-0 border border-white"
                    style={{ background: c.avatarBg, boxShadow: '0 1px 2px rgba(15,23,51,0.10)' }}
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-[#0F1733] truncate">{c.name}</div>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] font-bold text-white px-1 rounded" style={{ backgroundColor: c.platformBg }}>{c.platform}</span>
                      <span className="text-[9px] text-[#0F1733]/55 truncate">{c.handle}</span>
                    </div>
                  </div>
                </div>
                {/* Score bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.12em] text-[#0F1733]/55">
                    <span>Fit Score</span>
                    <span className="oc-score text-[#0F1733] tabular-nums text-[11px]">0</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#0F1733]/8 overflow-hidden">
                    <div
                      className="oc-bar-fill h-full rounded-full"
                      style={{
                        width: '0%',
                        background: c.finalScore >= 85
                          ? 'linear-gradient(90deg,#16A34A,#65D88F)'
                          : c.finalScore >= 75
                            ? 'linear-gradient(90deg,#E85D2F,#F2A261)'
                            : 'linear-gradient(90deg,#0F1733,#3F4A6E)',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: queue panel + activity */}
        <div className="col-span-4 flex flex-col gap-3">
          {/* Queue panel */}
          <div className="rounded-lg border border-[#0F1733]/12 bg-[#0F1733] text-white p-3" style={{ boxShadow: '0 8px 24px -8px rgba(15,23,51,0.35)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#F2A261]">Queue</span>
              <span className="oc-live-dot inline-block w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
            </div>
            <CounterRow label="Sourced" sel="oc-counter-sourced" initial="1,284" />
            <CounterRow label="Contacted" sel="oc-counter-contacted" initial="487" />
            <CounterRow label="Replied" sel="oc-counter-replied" initial="124" />
          </div>

          {/* Activity feed */}
          <div className="flex-1 rounded-lg border border-[#0F1733]/12 bg-white p-3" style={{ boxShadow: '0 1px 3px rgba(15,23,51,0.05)' }}>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#0F1733]/55">Activity</span>
            </div>
            <div className="oc-activity-list space-y-1.5">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="oc-activity-item flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#16A34A]" />
                  <span className="oc-activity-name text-[10px] font-mono text-[#0F1733]/75">@loading</span>
                  <span className="ml-auto text-[8px] uppercase tracking-[0.14em] font-bold text-[#0F1733]/40">replied</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CounterRow({ label, sel, initial }: { label: string; sel: string; initial: string }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5 last:mb-0">
      <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/55">{label}</span>
      <span className={`${sel} font-bold tabular-nums text-[18px] text-white`}>{initial}</span>
    </div>
  )
}
