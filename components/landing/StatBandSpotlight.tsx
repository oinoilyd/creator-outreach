'use client'

import { useState, useEffect } from 'react'

/**
 * StatBandSpotlight — the "What's actually under the hood" feature
 * spotlight for the AI fit score.
 *
 * Visual treatment is intentionally over-the-top: 4 concentric rings
 * rotating at different speeds, a radar conic-gradient sweep, eight
 * twinkling particles at varied radii with random animation delays,
 * a breathing aura, a softly pulsing core, and an animated score
 * number that ticks up to 92 on mount.
 *
 * Right side: clickable dimension chips. Selecting a chip reveals an
 * explanation panel below — pulled from the actual scoring logic in
 * `lib/scoring.ts` so the copy isn't marketing fluff:
 *   - Recency: 7-day window full credit, decays out to 90+ days
 *   - Reach (avgViews): 10K–50K sweet-spot
 *   - Reachability: email + LinkedIn presence
 *   - Relevance: content match to your search
 *   - Quality: views/subscriber engagement ratio
 *   - + your own: any plain-English criterion you describe
 */

type Dimension = {
  key: string
  label: string
  short: string
  detail: string
  /** Hex accent for chip + explanation header */
  accent: string
}

const DIMENSIONS: Dimension[] = [
  {
    key: 'recency',
    label: 'Recency',
    short: 'How recently they posted',
    detail:
      'Posts within the last 7 days earn full credit. The score steps down at 30, 60, and 90 days. Stale accounts (no post in 90+ days) drop to a floor. Re-tunable per platform — daily IG posters and weekly LinkedIn posters get scored against different cadences.',
    accent: '#F2A261',
  },
  {
    key: 'reach',
    label: 'Reach',
    short: 'Audience size that fits your goal',
    detail:
      'Based on subscriber count and average views per recent post. The default sweet spot is 10K–50K avg views (where most outreach actually converts), with partial credit for smaller and larger creators. Adjust the band per niche — micro-influencer campaigns weight differently than enterprise sponsorships.',
    accent: '#E85D2F',
  },
  {
    key: 'reachability',
    label: 'Reachability',
    short: 'Channels you can actually reach them on, per target platform',
    detail:
      'Depends on the platform you target. YouTube outreach scores email + LinkedIn presence. Instagram outreach scores Instagram handle + email. LinkedIn outreach is LinkedIn-first. Each platform has its own definition of "actually reachable" — a creator with no IG DM but a public email scores high for YouTube outreach and low for Instagram outreach. Configurable per platform, weighted to whatever channel you actually use.',
    accent: '#16A34A',
  },
  {
    key: 'relevance',
    label: 'Relevance',
    short: 'Content + audience match for your size of lead',
    detail:
      'How tightly the creator matches what you typed. Name match, title match, recent-post topical match all roll in. Combined with your preferred subscriber range and avg-view band, so a 50K-sub fit reads differently than a 5M-sub fit even when the topic matches.',
    accent: '#1B6FB5',
  },
  {
    key: 'quality',
    label: 'Quality',
    short: 'Engagement signal — not just follower count',
    detail:
      'Views-to-subscriber ratio. 10%+ = full credit (these creators have real attention). 5%+ = 70%. 2%+ = 40%. Below that, low engagement drags the score even if reach looks good. Cuts through inflated follower numbers.',
    accent: '#7B2DBE',
  },
  {
    key: 'custom',
    label: '+ your own',
    short: 'Any criterion you can describe',
    detail:
      'Type something like "based in the US" or "talks about value investing" or "posts long-form weekly" and the AI scores every result against it as an additional weighted dimension. Re-rank live as you tweak.',
    accent: '#F2A261',
  },
]

export function StatBandSpotlight() {
  const [selected, setSelected] = useState<string>('relevance')
  const active = DIMENSIONS.find(d => d.key === selected) ?? DIMENSIONS[0]

  // Score number ticks up to 92 on first paint for a small bit of life.
  const [score, setScore] = useState(0)
  useEffect(() => {
    let frame = 0
    const target = 92
    const duration = 1600 // ms
    const start = performance.now()
    let raf: number
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setScore(Math.round(eased * target))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <section className="px-6 pt-20 md:pt-28 pb-20 md:pb-28">
      <div className="max-w-[1280px] mx-auto bg-[#0F1733] rounded-3xl px-6 sm:px-8 py-14 md:py-20 text-white relative overflow-hidden">
        {/* Multi-layer ambient glows — terracotta + amber breathing
            radials behind the band. */}
        <div
          aria-hidden
          className="absolute -top-1/3 -right-1/4 w-[680px] h-[680px] pointer-events-none motion-reduce:hidden"
          style={{
            background: 'radial-gradient(closest-side, rgba(232,93,47,0.28), transparent 70%)',
            animation: 'sb-breath 9s ease-in-out infinite',
          }}
        />
        <div
          aria-hidden
          className="absolute -bottom-1/3 -left-1/4 w-[600px] h-[600px] pointer-events-none motion-reduce:hidden"
          style={{
            background: 'radial-gradient(closest-side, rgba(242,162,97,0.18), transparent 70%)',
            animation: 'sb-breath 11s ease-in-out infinite reverse',
          }}
        />
        {/* Faint grid overlay for "scoring engine" texture */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          }}
        />

        <div className="relative">
          <div className="text-center max-w-[700px] mx-auto mb-12 md:mb-14">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#F2A261] mb-3 font-semibold">
              What&apos;s actually under the hood
            </div>
            <h2
              className="font-semibold tracking-[-0.02em] leading-[1.1]"
              style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}
            >
              A search engine, a scoring engine, and a CRM — built into one.
            </h2>
          </div>

          {/* Spotlight: animated orbital + interactive dimension panel */}
          <div className="grid md:grid-cols-12 gap-10 md:gap-12 items-center">
            <div className="md:col-span-5 flex items-center justify-center">
              <FitScoreOrbital score={score} accent={active.accent} />
            </div>

            <div className="md:col-span-7">
              <div className="inline-flex items-center gap-2 mb-4 px-2.5 py-1 rounded-full bg-[#F2A261]/10 border border-[#F2A261]/30 text-[11px] uppercase tracking-[0.18em] text-[#F2A261] font-bold">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2 L14.5 9.5 L22 12 L14.5 14.5 L12 22 L9.5 14.5 L2 12 L9.5 9.5 Z" />
                </svg>
                AI fit score
              </div>
              <h3
                className="text-white font-semibold tracking-[-0.02em] leading-[1.15] mb-4"
                style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)' }}
              >
                Fully customizable. Click a dimension to see what&apos;s in it.
              </h3>
              <p className="text-[15px] md:text-[16px] text-white/75 leading-[1.65] mb-5">
                Describe your ideal lead in plain English. The AI ranks every
                result on weighted dimensions you control — re-tune per
                platform, plug in any custom criterion you can name.
              </p>

              {/* Clickable chip cloud */}
              <div className="flex flex-wrap gap-2 mb-5">
                {DIMENSIONS.map(d => {
                  const isSelected = d.key === selected
                  const isCustom = d.key === 'custom'
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setSelected(d.key)}
                      aria-pressed={isSelected}
                      className={
                        'inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium transition-all duration-200 cursor-pointer ' +
                        (isSelected
                          ? 'bg-[#F2A261] text-[#0F1733] border border-[#F2A261] shadow-[0_0_24px_rgba(242,162,97,0.45)]'
                          : isCustom
                          ? 'bg-[#F2A261]/15 text-[#F2A261] border border-[#F2A261]/40 hover:bg-[#F2A261]/25'
                          : 'bg-white/8 text-white/85 border border-white/15 hover:bg-white/12 hover:border-white/30')
                      }
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>

              {/* Explanation panel — shows criteria for the selected
                  dimension. Animated via key change so it crossfades. */}
              <div
                key={active.key}
                className="rounded-xl bg-white/[0.04] border border-white/10 p-4 md:p-5 backdrop-blur-sm"
                style={{ animation: 'sb-fade-in 280ms ease-out' }}
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-1 w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: active.accent, boxShadow: `0 0 12px ${active.accent}` }}
                  />
                  <div>
                    <div className="text-[13px] font-bold tracking-tight text-white">
                      {active.label}
                      <span className="ml-2 text-[12px] font-normal text-white/55">
                        {active.short}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13.5px] text-white/75 leading-[1.6]">
                      {active.detail}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* (Bottom supporting-stat row removed — felt extra after the
              chip cloud already sells customizability.) */}
        </div>

        <style>{`
          @keyframes sb-breath {
            0%,100% { transform: scale(1); opacity: 1; }
            50%     { transform: scale(1.08); opacity: 0.75; }
          }
          @keyframes sb-fade-in {
            from { opacity: 0; transform: translateY(4px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes sb-orbit-spin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
          @keyframes sb-orbit-spin-rev {
            from { transform: rotate(360deg); }
            to   { transform: rotate(0deg); }
          }
          @keyframes sb-radar-sweep {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
          @keyframes sb-radar-sweep-rev {
            from { transform: rotate(360deg); }
            to   { transform: rotate(0deg); }
          }
          @keyframes sb-twinkle {
            0%, 100% { opacity: 0.15; transform: scale(0.85); }
            50%      { opacity: 1; transform: scale(1.15); }
          }
          @keyframes sb-pulse-core {
            0%, 100% { opacity: 0.9; }
            50%      { opacity: 1; }
          }
          @keyframes sb-pulse-aura {
            0%, 100% { opacity: 0.5; transform: scale(1); transform-origin: 160px 160px; }
            50%      { opacity: 1; transform: scale(1.08); transform-origin: 160px 160px; }
          }
          @keyframes sb-beam-pulse {
            0%, 100% { stroke-opacity: 0.2; }
            50%      { stroke-opacity: 0.6; }
          }
          @keyframes sb-dot-halo {
            0%, 100% { opacity: 0.1; r: 8; }
            50%      { opacity: 0.3; r: 11; }
          }
        `}</style>
      </div>
    </section>
  )
}

/**
 * FitScoreOrbital — the animated dial. ~20 visual layers cranking
 * from "designed sci-fi instrument" toward "this is alive."
 *
 * Layers (back → front):
 *  1. Outermost dashed ring (very slow rotation)
 *  2. Second dashed ring with finer dashes (counter-rotation)
 *  3. Third dashed ring (medium rotation)
 *  4. Middle thick-dash ring (counter-rotation, brand color)
 *  5. Comet streak orbiting at ring-3 radius
 *  6. Second comet at ring-1 radius (different speed)
 *  7. Conic-gradient radar sweep (clipped to a ring band)
 *  8. Counter-rotating second radar sweep, thinner
 *  9. 12 twinkling particles at varied radii + delays
 * 10. Glowing pulse halo
 * 11. Outer glow halo + inner core gradient
 * 12. Inner brand-stroke ring
 * 13. 6 connecting beam-lines from each dimension dot to the core
 *     (active dimension's beam pulses bright)
 * 14. 6 dimension dots with active-state ring
 * 15. Score number + STRONG FIT label
 * 16. Tiny tick-marks around the inner ring (12 ticks, 30° apart)
 *
 * `accent` follows the currently-selected dimension's color so
 * the active beam, score subtitle, and Custom dot all match.
 * `activeDimension` highlights its beam-line.
 */
function FitScoreOrbital({ score, accent }: { score: number; accent: string }) {
  // 12 twinkling particles for richer ambience.
  const particles = [
    { angle: -65, r: 88, delay: 0, size: 2 },
    { angle: -20, r: 132, delay: 1.2, size: 2.5 },
    { angle: 35, r: 98, delay: 0.6, size: 1.8 },
    { angle: 72, r: 124, delay: 2.0, size: 2 },
    { angle: 120, r: 82, delay: 1.6, size: 2.2 },
    { angle: 165, r: 138, delay: 0.4, size: 1.6 },
    { angle: 215, r: 96, delay: 2.4, size: 2 },
    { angle: 268, r: 130, delay: 1.0, size: 2.4 },
    { angle: -45, r: 145, delay: 0.9, size: 1.5 },
    { angle: 85, r: 148, delay: 1.8, size: 1.7 },
    { angle: 195, r: 145, delay: 0.2, size: 2 },
    { angle: 305, r: 142, delay: 2.7, size: 1.8 },
  ]

  // 12 tick marks around the inner ring at 30° intervals.
  const ticks = Array.from({ length: 12 }, (_, i) => i * 30 - 90)

  return (
    <div className="relative w-full max-w-[380px] aspect-square">
      {/* RING 1 — outermost dashed, very slow */}
      <svg
        viewBox="0 0 320 320"
        className="absolute inset-0 w-full h-full motion-reduce:hidden"
        style={{ animation: 'sb-orbit-spin 38s linear infinite' }}
        aria-hidden
      >
        <circle cx="160" cy="160" r="156" fill="none" stroke="rgba(242,162,97,0.25)" strokeWidth="1" strokeDasharray="2 8" />
      </svg>
      {/* RING 2 — finer dashes, counter-rotation */}
      <svg
        viewBox="0 0 320 320"
        className="absolute inset-0 w-full h-full motion-reduce:hidden"
        style={{ animation: 'sb-orbit-spin-rev 28s linear infinite' }}
        aria-hidden
      >
        <circle cx="160" cy="160" r="142" fill="none" stroke="rgba(232,93,47,0.40)" strokeWidth="1.2" strokeDasharray="1 4" />
      </svg>
      {/* RING 3 — medium rotation */}
      <svg
        viewBox="0 0 320 320"
        className="absolute inset-0 w-full h-full motion-reduce:hidden"
        style={{ animation: 'sb-orbit-spin 22s linear infinite' }}
        aria-hidden
      >
        <circle cx="160" cy="160" r="128" fill="none" stroke="rgba(242,162,97,0.50)" strokeWidth="1" strokeDasharray="3 9" />
      </svg>
      {/* RING 4 — middle thick-dash, counter-rotation */}
      <svg
        viewBox="0 0 320 320"
        className="absolute inset-0 w-full h-full motion-reduce:hidden"
        style={{ animation: 'sb-orbit-spin-rev 36s linear infinite' }}
        aria-hidden
      >
        <circle cx="160" cy="160" r="110" fill="none" stroke="rgba(232,93,47,0.55)" strokeWidth="1.5" strokeDasharray="6 14" />
      </svg>

      {/* COMET 1 — orbits ring 3 (r=128) */}
      <div
        aria-hidden
        className="absolute inset-0 motion-reduce:hidden"
        style={{ animation: 'sb-orbit-spin 8s linear infinite' }}
      >
        <svg viewBox="0 0 320 320" className="absolute inset-0 w-full h-full">
          <defs>
            <linearGradient id="sb-comet-1" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="rgba(242,162,97,0)" />
              <stop offset="50%" stopColor="rgba(242,162,97,0.6)" />
              <stop offset="100%" stopColor="#F2A261" />
            </linearGradient>
          </defs>
          <path
            d="M 160,32 A 128,128 0 0,1 220,52"
            fill="none"
            stroke="url(#sb-comet-1)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="220" cy="52" r="3" fill="#F2A261" />
        </svg>
      </div>

      {/* COMET 2 — orbits outer (r=156), slower, opposite */}
      <div
        aria-hidden
        className="absolute inset-0 motion-reduce:hidden"
        style={{ animation: 'sb-orbit-spin-rev 12s linear infinite' }}
      >
        <svg viewBox="0 0 320 320" className="absolute inset-0 w-full h-full">
          <defs>
            <linearGradient id="sb-comet-2" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="rgba(232,93,47,0)" />
              <stop offset="60%" stopColor="rgba(232,93,47,0.4)" />
              <stop offset="100%" stopColor="#E85D2F" />
            </linearGradient>
          </defs>
          <path
            d="M 160,4 A 156,156 0 0,1 232,28"
            fill="none"
            stroke="url(#sb-comet-2)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="232" cy="28" r="2.5" fill="#E85D2F" />
        </svg>
      </div>

      {/* RADAR SWEEP 1 — wide slice, clipped to a ring band */}
      <div
        aria-hidden
        className="absolute inset-0 motion-reduce:hidden"
        style={{
          animation: 'sb-radar-sweep 6s linear infinite',
          background:
            'conic-gradient(from 0deg, transparent 0deg, transparent 318deg, rgba(242,162,97,0.18) 348deg, rgba(242,162,97,0.40) 358deg, transparent 360deg)',
          maskImage: 'radial-gradient(circle at center, transparent 26%, black 30%, black 58%, transparent 62%)',
          WebkitMaskImage: 'radial-gradient(circle at center, transparent 26%, black 30%, black 58%, transparent 62%)',
        }}
      />
      {/* RADAR SWEEP 2 — narrower, faster, counter direction */}
      <div
        aria-hidden
        className="absolute inset-0 motion-reduce:hidden"
        style={{
          animation: 'sb-radar-sweep-rev 4s linear infinite',
          background:
            'conic-gradient(from 0deg, transparent 0deg, transparent 340deg, rgba(232,93,47,0.20) 355deg, rgba(232,93,47,0.50) 359deg, transparent 360deg)',
          maskImage: 'radial-gradient(circle at center, transparent 12%, black 16%, black 28%, transparent 32%)',
          WebkitMaskImage: 'radial-gradient(circle at center, transparent 12%, black 16%, black 28%, transparent 32%)',
        }}
      />

      {/* TWINKLING PARTICLES — 12, varied size + delay */}
      <svg viewBox="0 0 320 320" className="absolute inset-0 w-full h-full motion-reduce:hidden" aria-hidden>
        {particles.map((p, i) => {
          const rad = (p.angle * Math.PI) / 180
          const cx = 160 + Math.cos(rad) * p.r
          const cy = 160 + Math.sin(rad) * p.r
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={p.size}
              fill="#F2A261"
              style={{
                animation: `sb-twinkle 2.6s ease-in-out infinite`,
                animationDelay: `${p.delay}s`,
                transformOrigin: `${cx}px ${cy}px`,
              }}
            />
          )
        })}
      </svg>

      {/* CORE + RING + DOTS + BEAMS */}
      <svg viewBox="0 0 320 320" className="absolute inset-0 w-full h-full" aria-hidden>
        <defs>
          <linearGradient id="sb-orbital-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F2A261" />
            <stop offset="100%" stopColor="#E85D2F" />
          </linearGradient>
          <radialGradient id="sb-orbital-core" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#F2A261" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#E85D2F" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#E85D2F" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sb-pulse-aura" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={accent} stopOpacity="0.4" />
            <stop offset="60%" stopColor={accent} stopOpacity="0.1" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Pulse aura — accent-tinted, breathes */}
        <circle
          cx="160"
          cy="160"
          r="92"
          fill="url(#sb-pulse-aura)"
          style={{ animation: 'sb-pulse-aura 2.8s ease-in-out infinite' }}
        />
        {/* Outer glow halo */}
        <circle cx="160" cy="160" r="78" fill="url(#sb-orbital-core)" opacity="0.7" />
        {/* Core glow with breath */}
        <circle
          cx="160"
          cy="160"
          r="62"
          fill="url(#sb-orbital-core)"
          style={{ animation: 'sb-pulse-core 3.4s ease-in-out infinite' }}
        />
        {/* Inner ring */}
        <circle cx="160" cy="160" r="72" fill="none" stroke="url(#sb-orbital-grad)" strokeWidth="1.5" />

        {/* TICK MARKS — 12 around inner ring */}
        {ticks.map(angle => {
          const rad = (angle * Math.PI) / 180
          const x1 = 160 + Math.cos(rad) * 75
          const y1 = 160 + Math.sin(rad) * 75
          const x2 = 160 + Math.cos(rad) * 80
          const y2 = 160 + Math.sin(rad) * 80
          return (
            <line
              key={angle}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(242,162,97,0.6)"
              strokeWidth="1"
              strokeLinecap="round"
            />
          )
        })}

        {/* BEAM LINES — from each dimension dot inward toward core */}
        {[
          { angle: -90, label: 'Recency' },
          { angle: -30, label: 'Reach' },
          { angle: 30, label: 'Reachability' },
          { angle: 90, label: 'Relevance' },
          { angle: 150, label: 'Quality' },
          { angle: 210, label: 'Custom' },
        ].map(({ angle, label }) => {
          const rad = (angle * Math.PI) / 180
          const r1 = 80 // beam start (just outside inner ring)
          const r2 = 105 // beam end (just inside dot)
          const x1 = 160 + Math.cos(rad) * r1
          const y1 = 160 + Math.sin(rad) * r1
          const x2 = 160 + Math.cos(rad) * r2
          const y2 = 160 + Math.sin(rad) * r2
          return (
            <line
              key={`beam-${label}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={accent}
              strokeOpacity="0.35"
              strokeWidth="1"
              strokeLinecap="round"
              style={{
                animation: 'sb-beam-pulse 2.4s ease-in-out infinite',
                animationDelay: `${(angle + 90) / 60 * 0.2}s`,
              }}
            />
          )
        })}

        {/* SCORE NUMBER */}
        <text
          x="160"
          y="156"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#FFFFFF"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontWeight="700"
          fontSize="48"
          letterSpacing="-2"
        >
          {score}
        </text>
        <text
          x="160"
          y="194"
          textAnchor="middle"
          fill={accent}
          fontFamily="ui-monospace, monospace"
          fontSize="9"
          letterSpacing="2.5"
          fontWeight="700"
        >
          STRONG FIT
        </text>

        {/* DIMENSION DOTS — color-shift to active accent on the
            currently-selected one. */}
        {[
          { angle: -90, label: 'Recency' },
          { angle: -30, label: 'Reach' },
          { angle: 30, label: 'Reachability' },
          { angle: 90, label: 'Relevance' },
          { angle: 150, label: 'Quality' },
          { angle: 210, label: 'Custom' },
        ].map(({ angle, label }) => {
          const rad = (angle * Math.PI) / 180
          const r = 110
          const cx = 160 + Math.cos(rad) * r
          const cy = 160 + Math.sin(rad) * r
          const lr = 138
          const lx = 160 + Math.cos(rad) * lr
          const ly = 160 + Math.sin(rad) * lr
          const isCustom = label === 'Custom'
          return (
            <g key={label}>
              {/* Halo behind dot — pulses with active accent */}
              <circle
                cx={cx}
                cy={cy}
                r="9"
                fill={accent}
                opacity="0.18"
                style={{
                  animation: 'sb-dot-halo 2.2s ease-in-out infinite',
                  animationDelay: `${(angle + 90) / 60 * 0.15}s`,
                }}
              />
              <circle
                cx={cx}
                cy={cy}
                r={isCustom ? 5 : 4}
                fill={isCustom ? accent : '#FFFFFF'}
                stroke={isCustom ? accent : 'rgba(255,255,255,0.4)'}
                strokeWidth="1"
              />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fill={isCustom ? accent : 'rgba(255,255,255,0.7)'}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontSize="9"
                fontWeight={isCustom ? 700 : 500}
                letterSpacing="0.5"
              >
                {label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
