'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

/**
 * WhyThisExists — the centerpiece visual section.
 *
 * Each chapter is a layered editorial composition built around a
 * real product screenshot. The earlier version surrounded each
 * screenshot with text-heavy chip clouds (line-through platform
 * names / greyed metrics / stale dates) which Dylan flagged as
 * busy and word-cluttered.
 *
 * Replaced those chip clouds with cleaner atmospheric layers:
 *   - A large diffuse accent-tinted glow halo behind the screenshot
 *     (chapter-themed color)
 *   - Floating abstract geometric orbs that drift slowly
 *   - A diagonal accent-line slash that anchors the composition
 *   - Particle dots flowing toward the hero (kept — visual, no text)
 *   - S-curve connector arrow that draws on reveal (kept — visual)
 *   - Bracket label `[ TAG ]` hanging off the corner (small text,
 *     functional)
 *   - Caption strip below: `Live capture · {tag}` + chapter counter
 *     (small text, navigational)
 *
 * The hero in every chapter is now a real screenshot rendered at its
 * natural aspect ratio with object-contain — never distorted.
 */

type Chapter = {
  num: string
  tag: string
  pain: string
  italic?: string
  note: string
  answer: string
  hue: { primary: string; soft: string; ring: string; glow: string }
  screenshot: { src: string; alt: string; aspect: string }
}

const CHAPTERS: Chapter[] = [
  {
    num: '01',
    tag: 'Sourcing',
    pain: 'Hunting one creator across',
    italic: 'five tabs.',
    note: 'YouTube to find them. LinkedIn to dig out an email. X to confirm they’re still active. A Google Sheet to remember who’s already been messaged. Five sources of truth, none of them talking to each other.',
    answer:
      'One query searches every platform at once. Email and social handles surface inline on every row. Five tabs collapse into one queue.',
    hue: {
      primary: '#E85D2F',
      soft: 'rgba(232,93,47,0.08)',
      ring: 'rgba(232,93,47,0.30)',
      glow: 'rgba(232,93,47,0.45)',
    },
    screenshot: {
      src: '/screenshots/results.png',
      alt: 'Results table — one row per creator with email + social handles inline',
      aspect: '2472 / 1182',
    },
  },
  {
    num: '02',
    tag: 'Fit score',
    pain: '“Engagement rate” answers',
    italic: 'the wrong question.',
    note: 'Off-the-shelf creator scores rank by audience size or engagement rate. The right question is fit: US-based weekly poster, talks about value investing, under 100K subs. No generic score gets that.',
    answer:
      'Plain-English Lead Criteria. The AI scores every result on five dimensions you control — fully customizable, weighted per platform.',
    hue: {
      primary: '#F2A261',
      soft: 'rgba(242,162,97,0.10)',
      ring: 'rgba(242,162,97,0.32)',
      glow: 'rgba(242,162,97,0.50)',
    },
    screenshot: {
      src: '/screenshots/bento-fit.png',
      alt: 'Fit score column — Strong / Possible / Weak labels per row',
      aspect: '1352 / 1256',
    },
  },
  {
    num: '03',
    tag: 'Follow-ups',
    pain: 'Most pipelines leak through',
    italic: '“I’ll DM them tomorrow.”',
    note: 'Reach out. Forget for a week. Reach out again. Then realize the same creator was already messaged last month. The follow-up is the bottleneck — not the outreach.',
    answer:
      'Auto-cadence per creator. The Follow-ups tab surfaces what’s due today, sorted by who’s gone cold longest. One click resets the cadence.',
    hue: {
      primary: '#16A34A',
      soft: 'rgba(22,163,74,0.08)',
      ring: 'rgba(22,163,74,0.30)',
      glow: 'rgba(22,163,74,0.45)',
    },
    screenshot: {
      src: '/screenshots/followups.png',
      alt: 'Follow-ups view — Due-today list with cadence chips per creator',
      aspect: '2810 / 1234',
    },
  },
]

export function WhyThisExists() {
  return (
    <section
      id="customers"
      className="relative px-6 py-24 md:py-32 scroll-mt-24 bg-white dark:bg-[#131826] border-y border-[#0F1733]/8 dark:border-white/10 overflow-hidden"
    >
      {/* AMBIENT BACKDROP — blueprint grid + two breathing radial
          washes. These set the section atmosphere; chapter visuals
          add their own layers on top. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.05] dark:opacity-[0.10]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(15,23,51,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,51,0.6) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 80% 70% at center, black 30%, transparent 90%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at center, black 30%, transparent 90%)',
        }}
      />
      <div
        aria-hidden
        className="absolute -top-1/3 -right-1/4 w-[820px] h-[820px] pointer-events-none opacity-[0.10] dark:opacity-[0.18] motion-reduce:hidden"
        style={{
          background: 'radial-gradient(closest-side, rgba(232,93,47,0.7), transparent 70%)',
          animation: 'wte-breath 14s ease-in-out infinite',
        }}
      />
      <div
        aria-hidden
        className="absolute -bottom-1/3 -left-1/4 w-[700px] h-[700px] pointer-events-none opacity-[0.08] dark:opacity-[0.14] motion-reduce:hidden"
        style={{
          background: 'radial-gradient(closest-side, rgba(242,162,97,0.6), transparent 70%)',
          animation: 'wte-breath 18s ease-in-out infinite reverse',
        }}
      />

      <div className="max-w-[1280px] mx-auto relative">
        {/* SECTION HEADER */}
        <header className="max-w-[860px] mb-24 md:mb-36">
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full bg-[#E85D2F]/10 border border-[#E85D2F]/30 text-[11px] uppercase tracking-[0.2em] text-[#9C3D1F] dark:text-[#F2A261] font-bold">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="12" cy="12" r="9" fillOpacity="0.3" />
              <circle cx="12" cy="12" r="4" />
            </svg>
            Why this exists
          </div>
          <h2
            className="font-semibold tracking-[-0.035em] leading-[0.98] text-[#0F1733] dark:text-white"
            style={{ fontSize: 'clamp(2.75rem, 6.5vw, 5.5rem)' }}
          >
            Three walls in creator outreach.{' '}
            <span
              className="italic font-normal text-[#E85D2F] dark:text-[#F2A261]"
              style={{ fontFamily: 'var(--font-newsreader), Georgia, serif' }}
            >
              Three answers.
            </span>
          </h2>
          <p className="mt-7 max-w-[60ch] text-[17px] md:text-[18px] text-[#0F1733]/65 dark:text-white/65 leading-[1.6]">
            Three places creator outreach kept breaking down. Each one
            is now built into the tool — because the workaround was
            where the pipeline kept dying.
          </p>
        </header>

        {/* CHAPTERS */}
        <div className="space-y-28 md:space-y-44">
          {CHAPTERS.map((c, i) => (
            <Chapter key={c.num} chapter={c} flipped={i % 2 === 1} index={i} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes wte-breath {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.08); opacity: 0.65; }
        }
        @keyframes wte-orb {
          0%, 100% { transform: translate(0,0); opacity: var(--orb-opacity, 0.55); }
          50%      { transform: translate(var(--orb-dx,0), var(--orb-dy,0)); opacity: 0.85; }
        }
        @keyframes wte-particle {
          0%   { opacity: 0; transform: translate(0,0) scale(0.6); }
          50%  { opacity: 0.9; }
          100% { opacity: 0; transform: var(--travel) scale(1.1); }
        }
        @keyframes wte-pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50%      { transform: scale(1.08); opacity: 0.75; }
        }
        @keyframes wte-halo-pulse {
          0%, 100% { transform: scale(1); opacity: var(--halo-opacity, 0.4); }
          50%      { transform: scale(1.06); opacity: 0.7; }
        }
      `}</style>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   CHAPTER
   ═══════════════════════════════════════════════════════════════ */

function Chapter({ chapter, flipped, index }: { chapter: Chapter; flipped: boolean; index: number }) {
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
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
    )
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  const fadeUp = (delay: number) => ({
    opacity: revealed ? 1 : 0,
    transform: revealed ? 'translateY(0)' : 'translateY(28px)',
    transition: `opacity 800ms ${delay}ms ease-out, transform 800ms ${delay}ms ease-out`,
  })

  return (
    <article ref={ref} className="relative">
      {/* CHAPTER BREAK BAND — outlined giant numeral + chapter chip
          + gradient horizontal rule */}
      <div className="mb-12 md:mb-16 flex items-end gap-6 md:gap-10" style={fadeUp(0)}>
        <span
          aria-hidden
          className="font-bold tracking-[-0.06em] leading-[0.85] font-mono select-none pointer-events-none"
          style={{
            fontSize: 'clamp(7rem, 14vw, 16rem)',
            color: 'transparent',
            WebkitTextStroke: `1.5px ${chapter.hue.primary}55`,
          }}
        >
          {chapter.num}
        </span>
        <div className="flex-1 pb-6 md:pb-10">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E85D2F]/10 dark:bg-[#F2A261]/15 border border-[#E85D2F]/30 dark:border-[#F2A261]/30 text-[11px] uppercase tracking-[0.22em] font-bold text-[#9C3D1F] dark:text-[#F2A261]">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: chapter.hue.primary,
                animation: 'wte-pulse-ring 2.4s ease-in-out infinite',
              }}
            />
            Chapter {chapter.num} · {chapter.tag}
          </span>
          <div className="mt-3 h-px bg-gradient-to-r from-[#0F1733]/20 dark:from-white/20 via-[#E85D2F]/40 to-transparent" />
        </div>
      </div>

      {/* CONTENT GRID */}
      <div className="grid md:grid-cols-12 gap-10 md:gap-16 items-center">
        {/* TEXT COLUMN */}
        <div className={`md:col-span-6 ${flipped ? 'md:order-2' : 'md:order-1'}`}>
          <h3
            className="font-semibold tracking-[-0.025em] leading-[1.05] text-[#0F1733] dark:text-white mb-7"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)', ...fadeUp(80) }}
          >
            {chapter.pain}{' '}
            {chapter.italic && (
              <span
                className="italic font-normal text-[#E85D2F] dark:text-[#F2A261]"
                style={{ fontFamily: 'var(--font-newsreader), Georgia, serif' }}
              >
                {chapter.italic}
              </span>
            )}
          </h3>

          <blockquote
            className="relative pl-5 mb-8 text-[16px] md:text-[17px] text-[#0F1733]/75 dark:text-white/75 leading-[1.7] border-l-2"
            style={{ borderColor: chapter.hue.ring, ...fadeUp(160) }}
          >
            {chapter.note}
          </blockquote>

          <div
            className="relative rounded-2xl border-2 p-5 md:p-6"
            style={{
              borderColor: chapter.hue.ring,
              backgroundColor: chapter.hue.soft,
              boxShadow: `0 24px 48px -28px ${chapter.hue.primary}80`,
              ...fadeUp(240),
            }}
          >
            {/* Corner brackets */}
            <span aria-hidden className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2" style={{ borderColor: chapter.hue.primary }} />
            <span aria-hidden className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2" style={{ borderColor: chapter.hue.primary }} />
            <span aria-hidden className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2" style={{ borderColor: chapter.hue.primary }} />
            <span aria-hidden className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2" style={{ borderColor: chapter.hue.primary }} />
            <div className="flex items-start gap-3.5">
              <span
                aria-hidden
                className="mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-full text-white shrink-0"
                style={{
                  backgroundColor: chapter.hue.primary,
                  boxShadow: `0 0 24px ${chapter.hue.primary}`,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="5 12 10 17 19 7" />
                </svg>
              </span>
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] font-bold mb-1.5" style={{ color: chapter.hue.primary }}>
                  In the tool
                </div>
                <p className="text-[14.5px] md:text-[15.5px] text-[#0F1733]/90 dark:text-white/90 leading-[1.65]">
                  {chapter.answer}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* VISUAL COLUMN */}
        <div className={`md:col-span-6 ${flipped ? 'md:order-1' : 'md:order-2'}`}>
          <ChapterVisual chapter={chapter} revealed={revealed} flipped={flipped} index={index} />
        </div>
      </div>
    </article>
  )
}

/* ═══════════════════════════════════════════════════════════════
   CHAPTER VISUAL — atmospheric layers around a real screenshot
   ═══════════════════════════════════════════════════════════════ */

function ChapterVisual({
  chapter,
  revealed,
  flipped,
  index,
}: {
  chapter: Chapter
  revealed: boolean
  flipped: boolean
  index: number
}) {
  return (
    <div className="relative isolate">
      {/* HALO — large diffuse glow in chapter accent. The single
          most prominent atmospheric layer. Sits behind everything,
          gently pulsing. */}
      <div
        aria-hidden
        className="absolute -inset-12 md:-inset-16 -z-10 pointer-events-none motion-reduce:hidden"
        style={{
          background: `radial-gradient(ellipse 60% 55% at center, ${chapter.hue.glow}, transparent 70%)`,
          opacity: revealed ? 1 : 0,
          transition: 'opacity 1200ms 100ms ease-out',
          animation: 'wte-halo-pulse 8s ease-in-out infinite',
          ['--halo-opacity' as string]: '0.45',
        }}
      />

      {/* GRADIENT MESH — subtle chapter-tinted wash, smaller than
          the halo, adds depth */}
      <div
        aria-hidden
        className="absolute -inset-6 md:-inset-8 -z-10 rounded-3xl pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 40%, ${chapter.hue.soft}, transparent 70%)`,
          opacity: revealed ? 1 : 0,
          transition: 'opacity 1000ms 100ms ease-out',
        }}
      />

      {/* FLOATING ORBS — three abstract circles drifting at different
          speeds. Pure visual texture; no text. */}
      <FloatingOrbs revealed={revealed} accent={chapter.hue.primary} flipped={flipped} />

      {/* DIAGONAL ACCENT LINE — bold compositional anchor that
          slashes the area diagonally. Reads as "scan / motion". */}
      <DiagonalAccent revealed={revealed} accent={chapter.hue.primary} flipped={flipped} />

      {/* PARTICLE FIELD — flowing dots drifting across the area */}
      <ParticleField revealed={revealed} accent={chapter.hue.primary} />

      {/* CONNECTOR ARROW — S-curve in the corner, draws on reveal */}
      <ConnectorArrow revealed={revealed} flipped={flipped} accent={chapter.hue.primary} />

      {/* HERO — real screenshot, never distorted */}
      <ScreenshotHero
        src={chapter.screenshot.src}
        alt={chapter.screenshot.alt}
        aspect={chapter.screenshot.aspect}
        flipped={flipped}
        revealed={revealed}
      />

      {/* BRACKET ANNOTATION + CAPTION — small text, functional */}
      <AnnotationBracket revealed={revealed} flipped={flipped} accent={chapter.hue.primary} label={chapter.tag.toUpperCase()} />

      <div
        className="mt-5 flex items-center gap-3 text-[10.5px] uppercase tracking-[0.22em] font-bold text-[#0F1733]/45 dark:text-white/45 font-mono"
        style={{
          opacity: revealed ? 1 : 0,
          transition: 'opacity 800ms 600ms ease-out',
        }}
      >
        <span className="w-6 h-px" style={{ backgroundColor: chapter.hue.primary }} />
        <span>Live capture · {chapter.tag.toLowerCase()}</span>
        <span className="flex-1 h-px bg-[#0F1733]/12 dark:bg-white/12" />
        <span style={{ color: chapter.hue.primary }}>{String(index + 1).padStart(2, '0')} / 03</span>
      </div>
    </div>
  )
}

/* ─── visual sub-layers ─── */

function FloatingOrbs({ revealed, accent, flipped }: { revealed: boolean; accent: string; flipped: boolean }) {
  // Three abstract orbs at different positions / sizes / drift
  // amplitudes. Pure decoration, no text content.
  const orbs = [
    { side: 'tl', size: 96, top: '-2%', left: '-4%', dx: 12, dy: -8, dur: 11, delay: 0, opacity: 0.55 },
    { side: 'br', size: 72, top: '88%', left: '92%', dx: -10, dy: -14, dur: 9, delay: 1.6, opacity: 0.45 },
    { side: 'mid', size: 48, top: '38%', left: '102%', dx: -8, dy: 10, dur: 13, delay: 0.8, opacity: 0.6 },
  ]
  return (
    <div
      aria-hidden
      className="absolute inset-0 z-0 pointer-events-none motion-reduce:hidden"
      style={{
        opacity: revealed ? 1 : 0,
        transition: 'opacity 1200ms 200ms ease-out',
        transform: flipped ? 'scaleX(-1)' : undefined,
      }}
    >
      {orbs.map((o, i) => (
        <span
          key={i}
          className="absolute rounded-full blur-2xl"
          style={{
            top: o.top,
            left: o.left,
            width: o.size,
            height: o.size,
            background: `radial-gradient(circle, ${accent}, transparent 70%)`,
            ['--orb-dx' as string]: `${o.dx}px`,
            ['--orb-dy' as string]: `${o.dy}px`,
            ['--orb-opacity' as string]: o.opacity,
            animation: `wte-orb ${o.dur}s ease-in-out infinite`,
            animationDelay: `${o.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

function DiagonalAccent({ revealed, accent, flipped }: { revealed: boolean; accent: string; flipped: boolean }) {
  // A single bold-but-translucent diagonal line that anchors the
  // composition. Sits behind the screenshot.
  return (
    <svg
      aria-hidden
      className="absolute inset-0 z-0 w-full h-full pointer-events-none"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
      style={{
        opacity: revealed ? 0.35 : 0,
        transition: 'opacity 1200ms 300ms ease-out',
        transform: flipped ? 'scaleX(-1)' : undefined,
      }}
    >
      <defs>
        <linearGradient id={`diag-${accent.replace('#', '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={accent} stopOpacity="0" />
          <stop offset="50%" stopColor={accent} stopOpacity="0.75" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line
        x1="-10"
        y1="115"
        x2="115"
        y2="-15"
        stroke={`url(#diag-${accent.replace('#', '')})`}
        strokeWidth="0.6"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1="-10"
        y1="105"
        x2="115"
        y2="-25"
        stroke={accent}
        strokeOpacity="0.18"
        strokeWidth="0.3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function ParticleField({ revealed, accent }: { revealed: boolean; accent: string }) {
  const particles = [
    { x: 8, y: 12, delay: 0 },
    { x: 92, y: 18, delay: 0.6 },
    { x: 4, y: 60, delay: 1.4 },
    { x: 96, y: 70, delay: 0.9 },
    { x: 14, y: 92, delay: 2.0 },
    { x: 86, y: 90, delay: 1.2 },
    { x: 50, y: 4, delay: 0.3 },
    { x: 50, y: 100, delay: 1.7 },
  ]
  return (
    <div
      aria-hidden
      className="absolute inset-0 z-[1] pointer-events-none motion-reduce:hidden"
      style={{
        opacity: revealed ? 1 : 0,
        transition: 'opacity 1200ms 400ms ease-out',
      }}
    >
      {particles.map((p, i) => {
        const dx = 50 - p.x
        const dy = 50 - p.y
        return (
          <span
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              backgroundColor: accent,
              boxShadow: `0 0 12px ${accent}`,
              ['--travel' as string]: `${dx * 0.6}% ${dy * 0.6}%`,
              animation: 'wte-particle 4.2s ease-in-out infinite',
              animationDelay: `${p.delay}s`,
            }}
          />
        )
      })}
    </div>
  )
}

function ConnectorArrow({ revealed, flipped, accent }: { revealed: boolean; flipped: boolean; accent: string }) {
  return (
    <svg
      aria-hidden
      className="absolute -top-6 -right-6 md:-top-8 md:-right-8 w-20 h-20 md:w-24 md:h-24 z-[2] pointer-events-none motion-reduce:hidden"
      viewBox="0 0 100 100"
      fill="none"
      style={{ transform: flipped ? 'scaleX(-1)' : undefined }}
    >
      <path
        d="M 8 10 Q 50 10 50 50 Q 50 90 92 90"
        stroke={accent}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.55"
        strokeDasharray="240"
        style={{
          strokeDashoffset: revealed ? 0 : 240,
          transition: 'stroke-dashoffset 1400ms 500ms ease-out',
        }}
      />
      <polyline
        points="84 84 92 90 86 96"
        stroke={accent}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.55"
        fill="none"
        style={{
          opacity: revealed ? 1 : 0,
          transition: 'opacity 600ms 1700ms ease-out',
        }}
      />
    </svg>
  )
}

function AnnotationBracket({
  revealed,
  flipped,
  accent,
  label,
}: {
  revealed: boolean
  flipped: boolean
  accent: string
  label: string
}) {
  return (
    <div
      aria-hidden
      className={`absolute z-[3] pointer-events-none flex items-center gap-2 ${flipped ? 'right-0 md:-right-4' : 'left-0 md:-left-4'} -bottom-3 md:-bottom-4`}
      style={{
        opacity: revealed ? 1 : 0,
        transition: 'opacity 800ms 700ms ease-out',
      }}
    >
      <span className="text-[10px] font-mono font-bold tracking-[0.2em]" style={{ color: accent }}>[</span>
      <span className="text-[10px] uppercase tracking-[0.24em] font-bold" style={{ color: accent }}>{label}</span>
      <span className="text-[10px] font-mono font-bold tracking-[0.2em]" style={{ color: accent }}>]</span>
    </div>
  )
}

/* ─── hero ─── */

function ScreenshotHero({
  src,
  alt,
  aspect,
  flipped,
  revealed,
}: {
  src: string
  alt: string
  aspect: string
  flipped: boolean
  revealed: boolean
}) {
  return (
    <div
      className="relative z-10"
      style={{
        opacity: revealed ? 1 : 0,
        transform: revealed
          ? `perspective(1200px) rotateY(${flipped ? 4 : -4}deg) rotateX(1.5deg)`
          : `perspective(1200px) rotateY(${flipped ? 8 : -8}deg) rotateX(3deg) translateY(40px) scale(0.94)`,
        transition: 'opacity 900ms 100ms ease-out, transform 1000ms 100ms ease-out',
      }}
    >
      <div
        className="relative rounded-2xl overflow-hidden border border-[#0F1733]/15 dark:border-white/15 bg-[#0E121C]"
        style={{
          aspectRatio: aspect,
          boxShadow: '0 40px 80px -30px rgba(15,23,51,0.40), 0 18px 40px -12px rgba(232,93,47,0.22)',
        }}
      >
        <div
          aria-hidden
          className="absolute top-0 inset-x-0 h-[2px] z-10"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(232,93,47,0.85) 30%, rgba(242,162,97,0.85) 70%, transparent)',
          }}
        />
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 1280px) 600px, 100vw"
          className="object-contain"
        />
      </div>
    </div>
  )
}
