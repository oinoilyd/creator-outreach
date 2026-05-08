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
    short: 'Whether you can actually contact them',
    detail:
      'Email AND LinkedIn presence = full credit. Email-only = strong partial. LinkedIn-only = light partial. No public contact = zero. The scraper pulls each per platform; a row with no contact info ends up at the bottom of the queue regardless of fit.',
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
          <div className="grid md:grid-cols-12 gap-10 md:gap-12 items-start">
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

          {/* Supporting row — 3 stats, no "5 platforms in parallel" lead. */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 mt-12 md:mt-14 pt-12 md:pt-14 border-t border-white/10">
            <SmallStat
              n="Inline"
              label="email + social handles per result · no manual lookup"
            />
            <SmallStat
              n="Per channel"
              label="templated outreach + auto-cadence follow-ups"
            />
            <SmallStat n="$0" label="free in beta · no card · no seat cap" />
          </div>
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
          @keyframes sb-twinkle {
            0%, 100% { opacity: 0.15; transform: scale(0.85); }
            50%      { opacity: 1; transform: scale(1.15); }
          }
          @keyframes sb-pulse-core {
            0%, 100% { opacity: 0.9; }
            50%      { opacity: 1; }
          }
        `}</style>
      </div>
    </section>
  )
}

function SmallStat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <div
        className="font-semibold tracking-[-0.02em] text-[#F2A261] leading-none mb-2"
        style={{ fontSize: 'clamp(1.5rem, 2.4vw, 1.875rem)' }}
      >
        {n}
      </div>
      <div className="text-[13px] text-white/65 leading-[1.5]">{label}</div>
    </div>
  )
}

/**
 * FitScoreOrbital — the animated dial. Ten-plus visual layers,
 * synchronized with the score number prop. Colors shift to the
 * currently-selected dimension's accent when the parent re-renders.
 */
function FitScoreOrbital({ score, accent }: { score: number; accent: string }) {
  // Deterministic positions for 8 twinkling particles at varied radii.
  const particles = [
    { angle: -65, r: 88, delay: 0 },
    { angle: -20, r: 132, delay: 1.2 },
    { angle: 35, r: 98, delay: 0.6 },
    { angle: 72, r: 124, delay: 2.0 },
    { angle: 120, r: 82, delay: 1.6 },
    { angle: 165, r: 138, delay: 0.4 },
    { angle: 215, r: 96, delay: 2.4 },
    { angle: 268, r: 130, delay: 1.0 },
  ]

  return (
    <div className="relative w-full max-w-[340px] aspect-square">
      {/* Outer rotating ring with dashed stroke */}
      <svg
        viewBox="0 0 320 320"
        className="absolute inset-0 w-full h-full motion-reduce:hidden"
        style={{ animation: 'sb-orbit-spin 32s linear infinite' }}
        aria-hidden
      >
        <circle
          cx="160"
          cy="160"
          r="152"
          fill="none"
          stroke="rgba(242,162,97,0.30)"
          strokeWidth="1"
          strokeDasharray="2 6"
        />
      </svg>
      {/* Second outer ring, finer dashes, opposite rotation */}
      <svg
        viewBox="0 0 320 320"
        className="absolute inset-0 w-full h-full motion-reduce:hidden"
        style={{ animation: 'sb-orbit-spin-rev 28s linear infinite' }}
        aria-hidden
      >
        <circle
          cx="160"
          cy="160"
          r="138"
          fill="none"
          stroke="rgba(232,93,47,0.40)"
          strokeWidth="1.2"
          strokeDasharray="1 4"
        />
      </svg>
      {/* Middle counter-rotating ring with thicker dashes */}
      <svg
        viewBox="0 0 320 320"
        className="absolute inset-0 w-full h-full motion-reduce:hidden"
        style={{ animation: 'sb-orbit-spin-rev 36s linear infinite' }}
        aria-hidden
      >
        <circle
          cx="160"
          cy="160"
          r="110"
          fill="none"
          stroke="rgba(232,93,47,0.55)"
          strokeWidth="1.5"
          strokeDasharray="6 14"
        />
      </svg>

      {/* Radar sweep — conic-gradient slice that orbits */}
      <div
        aria-hidden
        className="absolute inset-0 motion-reduce:hidden"
        style={{
          animation: 'sb-radar-sweep 6s linear infinite',
          background:
            'conic-gradient(from 0deg, transparent 0deg, transparent 320deg, rgba(242,162,97,0.18) 350deg, rgba(242,162,97,0.30) 358deg, transparent 360deg)',
          maskImage: 'radial-gradient(circle at center, transparent 28%, black 30%, black 56%, transparent 60%)',
          WebkitMaskImage: 'radial-gradient(circle at center, transparent 28%, black 30%, black 56%, transparent 60%)',
        }}
      />

      {/* Twinkling particles */}
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
              r="2"
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

      {/* Static inner ring with terracotta gradient stroke + glowing core */}
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
        </defs>
        {/* Outer glow halo */}
        <circle cx="160" cy="160" r="78" fill="url(#sb-orbital-core)" opacity="0.7" />
        {/* Core glow */}
        <circle
          cx="160"
          cy="160"
          r="62"
          fill="url(#sb-orbital-core)"
          style={{ animation: 'sb-pulse-core 3.4s ease-in-out infinite' }}
        />
        {/* Inner ring */}
        <circle cx="160" cy="160" r="72" fill="none" stroke="url(#sb-orbital-grad)" strokeWidth="1.5" />
        {/* Score number */}
        <text
          x="160"
          y="156"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#FFFFFF"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontWeight="700"
          fontSize="44"
          letterSpacing="-2"
        >
          {score}
        </text>
        <text
          x="160"
          y="190"
          textAnchor="middle"
          fill={accent}
          fontFamily="ui-monospace, monospace"
          fontSize="9"
          letterSpacing="2"
          fontWeight="700"
        >
          STRONG FIT
        </text>
        {/* Six dimension dots — colored to the active dimension */}
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
