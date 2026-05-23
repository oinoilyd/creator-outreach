'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

/**
 * WhyThisExists — sharpened editorial section.
 *
 * Earlier passes accumulated a lot of decorative cruft (per-chapter
 * color themes, italic-serif emphasis on every chapter headline,
 * bracket annotations, caption strips, diagonal accent lines, S-curve
 * connector arrows, three orbs per chapter). All of that read as
 * "AI-designed everything stacked together."
 *
 * Sharpening pass:
 *   - Single accent color (brand violet) across every chapter — no
 *     per-chapter hue variation. Brand violet matches the in-app
 *     "C" tile mark, so atmospheric layers tie to the brand.
 *   - Italic-serif kept on the section H2 only; chapter headlines
 *     are single-font sans, single weight
 *   - Type scale tightened: chapter numeral down ~50%, chapter h3
 *     down a step, slightly smaller body
 *   - Decorative layers removed: connector arrow, bracket label,
 *     caption strip, diagonal accent lines
 *   - Atmospheric layers kept and restrained: one diffuse halo +
 *     two floating orbs (down from three) + particle field
 *   - Answer block simplified: 1px border, no corner brackets, just
 *     the accent + checkmark + label + body
 *   - Real screenshots remain the focal point of every chapter
 */

type Chapter = {
  num: string
  tag: string
  pain: string
  note: string
  answer: string
  screenshot: { src: string; alt: string; aspect: string }
}

const CHAPTERS: Chapter[] = [
  {
    num: '01',
    tag: 'Sourcing',
    pain: 'Hunting one creator across five tabs.',
    note: 'YouTube to find them. LinkedIn to dig out an email. X to confirm they’re still active. A spreadsheet to track who’s already been messaged. Five sources of truth, none of them talking.',
    answer:
      'One query searches every platform at once. Email and social handles surface inline on every row. Five tabs collapse into one queue.',
    screenshot: {
      src: '/screenshots/results.png',
      alt: 'Results table — one row per creator with email + social handles inline',
      aspect: '2472 / 1182',
    },
  },
  {
    num: '02',
    tag: 'Fit score',
    pain: '“Engagement rate” answers the wrong question.',
    note: 'Off-the-shelf creator scores rank by audience size or engagement rate. The right question is fit: US-based weekly poster, talks about value investing, under 100K subs. No generic score gets that.',
    answer:
      'Plain-English Lead Criteria. The AI scores every result on five dimensions you control — fully customizable, weighted per platform.',
    screenshot: {
      src: '/screenshots/bento-fit.png',
      alt: 'Fit score column — Strong / Possible / Weak labels per row',
      aspect: '1352 / 1256',
    },
  },
  {
    num: '03',
    tag: 'Follow-ups',
    pain: 'Most pipelines leak through “I’ll DM them tomorrow.”',
    note: 'Reach out. Forget for a week. Reach out again. Then realize the same creator was already messaged last month. The follow-up is the bottleneck — not the outreach.',
    answer:
      'Auto-cadence per creator. The Follow-ups tab surfaces what’s due today, sorted by who’s gone cold longest. One click resets the cadence.',
    screenshot: {
      src: '/screenshots/followups.png',
      alt: 'Follow-ups view — Due-today list with cadence chips',
      aspect: '2810 / 1234',
    },
  },
]

// Single accent color used across every chapter — no more
// per-chapter hue variation. That was AI-template behavior.
//
// Accent values are literal oklch strings matching --brand (light
// mode primary). Inline gradients / SVG fills need literal color
// strings (CSS custom properties don't interpolate inside template
// literals), so we hardcode the same oklch values the tokens
// resolve to. Keeps the atmospheric layers tied to the brand mark.
const ACCENT = {
  primary: 'oklch(0.40 0.265 290)',
  primaryDark: 'oklch(0.68 0.240 290)',
  soft: 'oklch(0.40 0.265 290 / 0.08)',
  ring: 'oklch(0.40 0.265 290 / 0.30)',
  glow: 'oklch(0.40 0.265 290 / 0.40)',
}

export function WhyThisExists() {
  return (
    <section
      id="customers"
      className="relative px-6 py-24 md:py-32 scroll-mt-24 bg-card border-y border-border overflow-hidden"
    >
      {/* AMBIENT BACKDROP — blueprint grid + two breathing washes
          tinted on the brand violet/teal pair (was terracotta). */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.04] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(to right, oklch(0.18 0.045 275 / 0.6) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.18 0.045 275 / 0.6) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 80% 70% at center, black 30%, transparent 90%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at center, black 30%, transparent 90%)',
        }}
      />
      <div
        aria-hidden
        className="absolute -top-1/3 -right-1/4 w-[800px] h-[800px] pointer-events-none opacity-[0.10] dark:opacity-[0.15] motion-reduce:hidden"
        style={{
          background: 'radial-gradient(closest-side, oklch(0.40 0.265 290 / 0.6), transparent 70%)',
          animation: 'wte-breath 14s ease-in-out infinite',
        }}
      />
      <div
        aria-hidden
        className="absolute -bottom-1/3 -left-1/4 w-[680px] h-[680px] pointer-events-none opacity-[0.07] dark:opacity-[0.11] motion-reduce:hidden"
        style={{
          background: 'radial-gradient(closest-side, oklch(0.50 0.150 215 / 0.5), transparent 70%)',
          animation: 'wte-breath 18s ease-in-out infinite reverse',
        }}
      />

      <div className="max-w-[1180px] mx-auto relative">
        {/* SECTION HEADER — italic-serif emphasis kept here only.
            Tighter scale than before. */}
        <header className="max-w-[760px] mb-20 md:mb-28">
          <div className="inline-flex items-center gap-2 mb-5 px-2.5 py-1 rounded-full bg-brand/10 border border-brand/30 text-[10.5px] uppercase tracking-[0.2em] text-brand dark:text-brand-2 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-brand" />
            Why this exists
          </div>
          <h2
            className="font-semibold tracking-[-0.03em] leading-[1] text-foreground"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 4rem)' }}
          >
            Three walls in creator outreach.{' '}
            <span
              className="italic font-normal bg-gradient-to-br from-brand to-brand-2 bg-clip-text text-transparent"
              style={{ fontFamily: 'var(--font-newsreader), Georgia, serif' }}
            >
              Three answers.
            </span>
          </h2>
          <p className="mt-5 max-w-[58ch] text-[16px] text-muted-foreground leading-[1.6]">
            Three places creator outreach kept breaking down. Each one
            is now built into the tool, because the workaround was where
            the pipeline kept dying.
          </p>
        </header>

        {/* CHAPTERS */}
        <div className="space-y-24 md:space-y-36">
          {CHAPTERS.map((c, i) => (
            <Chapter key={c.num} chapter={c} flipped={i % 2 === 1} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes wte-breath {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.06); opacity: 0.7; }
        }
        @keyframes wte-orb {
          0%, 100% { transform: translate(0,0); opacity: var(--orb-opacity, 0.5); }
          50%      { transform: translate(var(--orb-dx,0), var(--orb-dy,0)); opacity: 0.75; }
        }
        @keyframes wte-particle {
          0%   { opacity: 0; transform: translate(0,0) scale(0.6); }
          50%  { opacity: 0.8; }
          100% { opacity: 0; transform: var(--travel) scale(1.1); }
        }
        @keyframes wte-pulse-dot {
          0%, 100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }
        @keyframes wte-halo-pulse {
          0%, 100% { transform: scale(1); opacity: 0.35; }
          50%      { transform: scale(1.05); opacity: 0.6; }
        }
      `}</style>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   CHAPTER
   ═══════════════════════════════════════════════════════════════ */

function Chapter({ chapter, flipped }: { chapter: Chapter; flipped: boolean }) {
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
    transform: revealed ? 'translateY(0)' : 'translateY(24px)',
    transition: `opacity 700ms ${delay}ms ease-out, transform 700ms ${delay}ms ease-out`,
  })

  return (
    <article ref={ref} className="relative">
      {/* CHAPTER MARK — small numeral + chip + thin rule.
          Way more restrained than the prior 16rem outlined giant. */}
      <div className="mb-10 md:mb-14 flex items-center gap-4" style={fadeUp(0)}>
        <span
          aria-hidden
          className="font-bold tracking-[-0.04em] leading-none font-mono text-brand dark:text-brand-2 select-none"
          style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)' }}
        >
          {chapter.num}
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand/10 border border-brand/25 text-[10.5px] uppercase tracking-[0.2em] font-bold text-brand dark:text-brand-2">
          <span
            className="w-1.5 h-1.5 rounded-full bg-brand"
            style={{ animation: 'wte-pulse-dot 2.4s ease-in-out infinite' }}
          />
          {chapter.tag}
        </span>
        <span className="flex-1 h-px bg-border" />
      </div>

      {/* CONTENT GRID */}
      <div className="grid md:grid-cols-12 gap-10 md:gap-14 items-center">
        {/* TEXT COLUMN */}
        <div className={`md:col-span-6 ${flipped ? 'md:order-2' : 'md:order-1'}`}>
          {/* Pain headline — single sans, no italic-serif emphasis.
              Tighter scale than before (2-3.25rem → 1.5-2.5rem). */}
          <h3
            className="font-semibold tracking-[-0.025em] leading-[1.1] text-foreground mb-6"
            style={{ fontSize: 'clamp(1.5rem, 2.8vw, 2.25rem)', ...fadeUp(80) }}
          >
            {chapter.pain}
          </h3>

          <blockquote
            className="relative pl-4 mb-7 text-[15.5px] md:text-[16px] text-muted-foreground leading-[1.65] border-l-2 border-brand/35"
            style={fadeUp(160)}
          >
            {chapter.note}
          </blockquote>

          {/* Answer block — simplified. 1px border, no corner brackets,
              tighter padding. Still anchored visually by the
              checkmark + accent label. */}
          <div
            className="relative rounded-xl border bg-brand/[0.04] border-brand/20 p-4 md:p-5"
            style={fadeUp(220)}
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-brand to-brand-2 text-primary-foreground shrink-0 shadow-md shadow-brand/40"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="5 12 10 17 19 7" />
                </svg>
              </span>
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-brand dark:text-brand-2 mb-1">
                  In the tool
                </div>
                <p className="text-[14.5px] text-foreground/85 leading-[1.6]">
                  {chapter.answer}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* VISUAL COLUMN */}
        <div className={`md:col-span-6 ${flipped ? 'md:order-1' : 'md:order-2'}`}>
          <ChapterVisual chapter={chapter} revealed={revealed} flipped={flipped} />
        </div>
      </div>
    </article>
  )
}

/* ═══════════════════════════════════════════════════════════════
   CHAPTER VISUAL — restrained atmospheric layers + screenshot
   ═══════════════════════════════════════════════════════════════ */

function ChapterVisual({
  chapter,
  revealed,
  flipped,
}: {
  chapter: Chapter
  revealed: boolean
  flipped: boolean
}) {
  return (
    <div className="relative isolate">
      {/* HALO — single diffuse glow. Quieter than before. */}
      <div
        aria-hidden
        className="absolute -inset-10 md:-inset-14 -z-10 pointer-events-none motion-reduce:hidden"
        style={{
          background: `radial-gradient(ellipse 60% 55% at center, ${ACCENT.glow}, transparent 70%)`,
          opacity: revealed ? 1 : 0,
          transition: 'opacity 1100ms 100ms ease-out',
          animation: 'wte-halo-pulse 8s ease-in-out infinite',
        }}
      />

      {/* GRADIENT MESH — short-radius soft wash inside the halo */}
      <div
        aria-hidden
        className="absolute -inset-5 md:-inset-7 -z-10 rounded-3xl pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 40%, ${ACCENT.soft}, transparent 70%)`,
          opacity: revealed ? 1 : 0,
          transition: 'opacity 900ms 100ms ease-out',
        }}
      />

      {/* TWO FLOATING ORBS — down from three. */}
      <FloatingOrbs revealed={revealed} flipped={flipped} />

      {/* PARTICLE FIELD — flowing dots */}
      <ParticleField revealed={revealed} />

      {/* HERO SCREENSHOT */}
      <ScreenshotHero
        src={chapter.screenshot.src}
        alt={chapter.screenshot.alt}
        aspect={chapter.screenshot.aspect}
        flipped={flipped}
        revealed={revealed}
      />
    </div>
  )
}

/* ─── visual sub-layers ─── */

function FloatingOrbs({ revealed, flipped }: { revealed: boolean; flipped: boolean }) {
  // Two orbs (was three). Top-left + bottom-right.
  const orbs = [
    { size: 96, top: '-2%', left: '-4%', dx: 12, dy: -8, dur: 11, delay: 0, opacity: 0.5 },
    { size: 72, top: '88%', left: '92%', dx: -10, dy: -14, dur: 9, delay: 1.6, opacity: 0.4 },
  ]
  return (
    <div
      aria-hidden
      className="absolute inset-0 z-0 pointer-events-none motion-reduce:hidden"
      style={{
        opacity: revealed ? 1 : 0,
        transition: 'opacity 1100ms 200ms ease-out',
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
            background: `radial-gradient(circle, ${ACCENT.primary}, transparent 70%)`,
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

function ParticleField({ revealed }: { revealed: boolean }) {
  // Six particles (down from eight). Plenty of motion, less density.
  const particles = [
    { x: 8, y: 12, delay: 0 },
    { x: 92, y: 18, delay: 0.6 },
    { x: 4, y: 70, delay: 1.4 },
    { x: 96, y: 62, delay: 0.9 },
    { x: 50, y: 4, delay: 0.3 },
    { x: 50, y: 100, delay: 1.7 },
  ]
  return (
    <div
      aria-hidden
      className="absolute inset-0 z-[1] pointer-events-none motion-reduce:hidden"
      style={{
        opacity: revealed ? 1 : 0,
        transition: 'opacity 1100ms 350ms ease-out',
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
              backgroundColor: ACCENT.primary,
              boxShadow: `0 0 10px ${ACCENT.primary}`,
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
          ? `perspective(1200px) rotateY(${flipped ? 3 : -3}deg) rotateX(1deg)`
          : `perspective(1200px) rotateY(${flipped ? 7 : -7}deg) rotateX(2.5deg) translateY(36px) scale(0.95)`,
        transition: 'opacity 900ms 100ms ease-out, transform 1000ms 100ms ease-out',
      }}
    >
      <div
        className="relative rounded-2xl overflow-hidden border border-border bg-[#0E121C]"
        style={{
          aspectRatio: aspect,
          boxShadow: '0 36px 72px -32px oklch(0.18 0.045 275 / 0.40), 0 16px 32px -12px oklch(0.40 0.265 290 / 0.18)',
        }}
      >
        <div
          aria-hidden
          className="absolute top-0 inset-x-0 h-[2px] z-10"
          style={{
            background: 'linear-gradient(90deg, transparent, oklch(0.40 0.265 290 / 0.85) 30%, oklch(0.50 0.150 215 / 0.85) 70%, transparent)',
          }}
        />
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 1280px) 580px, 100vw"
          className="object-contain"
        />
      </div>
    </div>
  )
}
