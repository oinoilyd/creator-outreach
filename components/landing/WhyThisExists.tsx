'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { FollowupsMock } from './FollowupsMock'
import { PLATFORM_MARKS } from './PlatformBrandMarks'

/**
 * WhyThisExists — the centerpiece visual section.
 *
 * Dylan asked for max-overboard graphic treatment. Each chapter now
 * has 6+ layered visual elements composed together:
 *   - Atmospheric gradient mesh + blueprint grid
 *   - Faded "before-state" iconography (drifting platform marks,
 *     greyed metric chips, struck-through dates) tied to the chapter
 *   - Connecting flow arrows + animated particle dots
 *   - Hero product visual (real screenshot in tilted dark frame for
 *     chapters 01 + 02; stylized FollowupsMock for chapter 03)
 *   - Decorative annotations: serif chapter labels, monospace tag
 *     captions, ornamental rules
 *   - Subtle motion: scroll-triggered fade-up, drift on background
 *     elements, pulse on the active accent
 *
 * Voice: tool-focused (no "I built this" / "my friend"). The
 * walls described are the realities of running creator outreach
 * by hand; the answer is always framed as what the tool does.
 */

type Chapter = {
  num: string
  tag: string
  pain: string
  italic?: string
  /** Short prose paragraph stating the workaround. */
  note: string
  /** What the tool does — the answer. */
  answer: string
  /** Color theme that tints this chapter's accents. */
  hue: { primary: string; soft: string; ring: string }
  /** Bg motif chips that drift behind the visual. */
  motif: { items: string[]; tone: 'platforms' | 'metrics' | 'dates' }
  /** Render function for the hero visual. */
  renderHero: (revealed: boolean, flipped: boolean) => React.ReactNode
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
    hue: { primary: '#E85D2F', soft: 'rgba(232,93,47,0.08)', ring: 'rgba(232,93,47,0.30)' },
    motif: {
      tone: 'platforms',
      items: ['YouTube', 'Instagram', 'TikTok', 'X', 'LinkedIn', 'Sheet', 'Twitter'],
    },
    renderHero: (revealed, flipped) => (
      <ScreenshotHero
        src="/screenshots/results.png"
        alt="Results table — one row per creator with email + social handles inline"
        aspect="2472 / 1182"
        flipped={flipped}
        revealed={revealed}
      />
    ),
  },
  {
    num: '02',
    tag: 'Fit score',
    pain: '“Engagement rate” answers',
    italic: 'the wrong question.',
    note: 'Off-the-shelf creator scores rank by audience size or engagement rate. The right question is fit: US-based weekly poster, talks about value investing, under 100K subs. No generic score gets that.',
    answer:
      'Plain-English Lead Criteria. The AI scores every result on five dimensions you control — fully customizable, weighted per platform.',
    hue: { primary: '#F2A261', soft: 'rgba(242,162,97,0.10)', ring: 'rgba(242,162,97,0.32)' },
    motif: {
      tone: 'metrics',
      items: ['Subs · 245K', 'ER · 5.2%', 'Vertical · Finance', 'Reach · ↑', 'Audience · 18–34'],
    },
    renderHero: (revealed, flipped) => (
      <ScreenshotHero
        src="/screenshots/bento-fit.png"
        alt="Fit score column — Strong / Possible / Weak labels per row"
        aspect="1352 / 1256"
        flipped={flipped}
        revealed={revealed}
      />
    ),
  },
  {
    num: '03',
    tag: 'Follow-ups',
    pain: 'Most pipelines leak through',
    italic: '“I’ll DM them tomorrow.”',
    note: 'Reach out. Forget for a week. Reach out again. Then realize the same creator was already messaged last month. The follow-up is the bottleneck — not the outreach.',
    answer:
      'Auto-cadence per creator. The Follow-ups tab surfaces what’s due today, sorted by who’s gone cold longest. One click resets the cadence.',
    hue: { primary: '#16A34A', soft: 'rgba(22,163,74,0.08)', ring: 'rgba(22,163,74,0.30)' },
    motif: {
      tone: 'dates',
      items: ['Mon · 3d', 'Tue · 7d', 'Wed · 14d', 'Thu · ?', 'Fri · ?', 'Sat · cold', 'Sun · cold'],
    },
    renderHero: (revealed, flipped) => (
      <FollowupsHero revealed={revealed} flipped={flipped} />
    ),
  },
]

export function WhyThisExists() {
  return (
    <section
      id="customers"
      className="relative px-6 py-24 md:py-32 scroll-mt-24 bg-white dark:bg-[#131826] border-y border-[#0F1733]/8 dark:border-white/10 overflow-hidden"
    >
      {/* LAYER 1 — Faint blueprint grid pattern, masked to fade
          toward the edges. Reads as "schematic / engineering" — ties
          the section to the orbital-stat-band aesthetic. */}
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

      {/* LAYER 2 — Two breathing radial washes, opposite corners,
          opposite cycles. Subtle ambient color motion. */}
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

        {/* CHAPTERS — alternating editorial layout */}
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
        @keyframes wte-drift {
          0%, 100% { transform: translateY(0) translateX(0); }
          50%      { transform: translateY(-10px) translateX(4px); }
        }
        @keyframes wte-particle {
          0%   { opacity: 0; transform: translate(0,0) scale(0.6); }
          50%  { opacity: 0.9; }
          100% { opacity: 0; transform: var(--travel) scale(1.1); }
        }
        @keyframes wte-arrow-draw {
          from { stroke-dashoffset: 240; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes wte-pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50%      { transform: scale(1.08); opacity: 0.75; }
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
      {/* CHAPTER BREAK BAND — giant ghosted numeral + horizontal rule
          + chapter label. Decorative chapter-page divider. */}
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
          {/* Display headline — sans + italic-serif emphasis */}
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

          {/* Operator-voice note — pull-quote treatment */}
          <blockquote
            className="relative pl-5 mb-8 text-[16px] md:text-[17px] text-[#0F1733]/75 dark:text-white/75 leading-[1.7] border-l-2"
            style={{ borderColor: chapter.hue.ring, ...fadeUp(160) }}
          >
            {chapter.note}
          </blockquote>

          {/* "What the tool does" answer block — bigger, more dramatic */}
          <div
            className="relative rounded-2xl border-2 p-5 md:p-6"
            style={{
              borderColor: chapter.hue.ring,
              backgroundColor: chapter.hue.soft,
              boxShadow: `0 24px 48px -28px ${chapter.hue.primary}80`,
              ...fadeUp(240),
            }}
          >
            {/* Corner accent marks (decorative brackets) */}
            <span
              aria-hidden
              className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2"
              style={{ borderColor: chapter.hue.primary }}
            />
            <span
              aria-hidden
              className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2"
              style={{ borderColor: chapter.hue.primary }}
            />
            <span
              aria-hidden
              className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2"
              style={{ borderColor: chapter.hue.primary }}
            />
            <span
              aria-hidden
              className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2"
              style={{ borderColor: chapter.hue.primary }}
            />
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
                <div
                  className="text-[10px] uppercase tracking-[0.22em] font-bold mb-1.5"
                  style={{ color: chapter.hue.primary }}
                >
                  In the tool
                </div>
                <p className="text-[14.5px] md:text-[15.5px] text-[#0F1733]/90 dark:text-white/90 leading-[1.65]">
                  {chapter.answer}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* VISUAL COLUMN — the hero "after" element + layered chaos
            background + flow particles + decorative annotations */}
        <div className={`md:col-span-6 ${flipped ? 'md:order-1' : 'md:order-2'}`}>
          <ChapterVisual chapter={chapter} revealed={revealed} flipped={flipped} index={index} />
        </div>
      </div>
    </article>
  )
}

/* ═══════════════════════════════════════════════════════════════
   CHAPTER VISUAL — the layered composition
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
      {/* LAYER A — Chapter-tinted gradient mesh behind everything */}
      <div
        aria-hidden
        className="absolute -inset-8 md:-inset-10 -z-10 rounded-3xl pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 40%, ${chapter.hue.soft}, transparent 70%)`,
          opacity: revealed ? 1 : 0,
          transition: 'opacity 1000ms 100ms ease-out',
        }}
      />

      {/* LAYER B — "Before" chaos motif in the background. Different
          tone per chapter (platforms / metrics / dates) but always
          drifts subtly. */}
      <BeforeMotif chapter={chapter} revealed={revealed} />

      {/* LAYER C — Particle dots flowing toward the hero */}
      <ParticleField revealed={revealed} accent={chapter.hue.primary} flipped={flipped} />

      {/* LAYER D — Decorative connecting arrow from "before chaos"
          to the product hero. Stroke draws on reveal. */}
      <ConnectorArrow revealed={revealed} flipped={flipped} accent={chapter.hue.primary} />

      {/* LAYER E — The hero product visual itself */}
      <div className="relative z-10">
        {chapter.renderHero(revealed, flipped)}
      </div>

      {/* LAYER F — Decorative annotations: bracketed callout,
          chapter-numbered watermark in the corner. */}
      <AnnotationBracket
        revealed={revealed}
        flipped={flipped}
        accent={chapter.hue.primary}
        label={chapter.tag.toUpperCase()}
      />

      {/* LAYER G — Caption strip below the visual */}
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
        <span style={{ color: chapter.hue.primary }}>
          {String(index + 1).padStart(2, '0')} / 03
        </span>
      </div>
    </div>
  )
}

/* ─── visual sub-layers ─── */

function BeforeMotif({ chapter, revealed }: { chapter: Chapter; revealed: boolean }) {
  return (
    <div
      aria-hidden
      className="absolute -inset-2 md:-inset-4 z-0 pointer-events-none flex flex-wrap gap-2 content-start"
      style={{
        opacity: revealed ? 0.55 : 0,
        transition: 'opacity 1000ms 250ms ease-out',
      }}
    >
      {chapter.motif.tone === 'platforms' && (
        <PlatformChips items={chapter.motif.items} accent={chapter.hue.primary} />
      )}
      {chapter.motif.tone === 'metrics' && (
        <MetricChips items={chapter.motif.items} accent={chapter.hue.primary} />
      )}
      {chapter.motif.tone === 'dates' && (
        <DateChips items={chapter.motif.items} accent={chapter.hue.primary} />
      )}
    </div>
  )
}

function PlatformChips({ items, accent }: { items: string[]; accent: string }) {
  // Use the real brand glyphs from PLATFORM_MARKS where the name matches.
  const byName = new Map<string, (typeof PLATFORM_MARKS)[number]>(
    PLATFORM_MARKS.map(m => [m.name, m]),
  )
  return (
    <>
      {items.map((label, i) => {
        const brand = byName.get(label)
        const Glyph = brand?.Glyph
        return (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0F1733]/[0.04] dark:bg-white/[0.05] border border-[#0F1733]/10 dark:border-white/10 text-[10px] font-mono text-[#0F1733]/45 dark:text-white/45 line-through decoration-[1px]"
            style={{
              textDecorationColor: accent,
              animation: `wte-drift ${3 + (i % 3)}s ease-in-out infinite`,
              animationDelay: `${i * 0.4}s`,
              transform: `rotate(${(i % 2 ? -1 : 1) * (i % 4)}deg) translate(${(i * 7) % 30 - 15}px, ${(i * 11) % 24 - 12}px)`,
            }}
          >
            {Glyph && <Glyph size={10} className="opacity-40" />}
            {label}
          </span>
        )
      })}
    </>
  )
}

function MetricChips({ items, accent }: { items: string[]; accent: string }) {
  return (
    <>
      {items.map((label, i) => (
        <span
          key={label}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0F1733]/[0.04] dark:bg-white/[0.05] border border-[#0F1733]/10 dark:border-white/10 text-[10px] font-mono text-[#0F1733]/45 dark:text-white/45 line-through decoration-[1px]"
          style={{
            textDecorationColor: accent,
            animation: `wte-drift ${4 + (i % 3)}s ease-in-out infinite`,
            animationDelay: `${i * 0.5}s`,
            transform: `rotate(${(i % 2 ? -1 : 1) * (i % 3)}deg) translate(${(i * 9) % 28 - 14}px, ${(i * 13) % 22 - 11}px)`,
          }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <line x1="3" y1="20" x2="21" y2="20" />
            <line x1="6" y1="16" x2="6" y2="20" />
            <line x1="11" y1="10" x2="11" y2="20" />
            <line x1="16" y1="14" x2="16" y2="20" />
          </svg>
          {label}
        </span>
      ))}
    </>
  )
}

function DateChips({ items, accent }: { items: string[]; accent: string }) {
  return (
    <>
      {items.map((label, i) => (
        <span
          key={label}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0F1733]/[0.04] dark:bg-white/[0.05] border border-[#0F1733]/10 dark:border-white/10 text-[10px] font-mono text-[#0F1733]/45 dark:text-white/45 line-through decoration-[1px]"
          style={{
            textDecorationColor: accent,
            animation: `wte-drift ${3.5 + (i % 3)}s ease-in-out infinite`,
            animationDelay: `${i * 0.35}s`,
            transform: `rotate(${(i % 2 ? -1 : 1) * (i % 3)}deg) translate(${(i * 8) % 26 - 13}px, ${(i * 14) % 24 - 12}px)`,
          }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="8" y1="3" x2="8" y2="7" />
            <line x1="16" y1="3" x2="16" y2="7" />
          </svg>
          {label}
        </span>
      ))}
    </>
  )
}

function ParticleField({ revealed, accent, flipped }: { revealed: boolean; accent: string; flipped: boolean }) {
  // 8 particles drift from the chaotic edges toward the hero center.
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
        const dx = 50 - p.x // travel toward center
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
  // Decorative S-curve connecting the corner of the chaos to the
  // hero. Strokes draw on reveal via stroke-dashoffset.
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
  // Editorial bracket-and-label — "[ FOLLOW-UPS ]" hangs off the
  // bottom-left (or bottom-right when flipped) of the hero.
  return (
    <div
      aria-hidden
      className={`absolute z-[3] pointer-events-none flex items-center gap-2 ${flipped ? 'right-0 md:-right-4' : 'left-0 md:-left-4'} -bottom-3 md:-bottom-4`}
      style={{
        opacity: revealed ? 1 : 0,
        transition: 'opacity 800ms 700ms ease-out',
      }}
    >
      <span className="text-[10px] font-mono font-bold tracking-[0.2em]" style={{ color: accent }}>
        [
      </span>
      <span className="text-[10px] uppercase tracking-[0.24em] font-bold" style={{ color: accent }}>
        {label}
      </span>
      <span className="text-[10px] font-mono font-bold tracking-[0.2em]" style={{ color: accent }}>
        ]
      </span>
    </div>
  )
}

/* ─── hero variants ─── */

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
          boxShadow:
            '0 40px 80px -30px rgba(15,23,51,0.40), 0 18px 40px -12px rgba(232,93,47,0.22)',
        }}
      >
        {/* Top scan-line accent */}
        <div
          aria-hidden
          className="absolute top-0 inset-x-0 h-[2px] z-10"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(232,93,47,0.85) 30%, rgba(242,162,97,0.85) 70%, transparent)',
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

function FollowupsHero({ flipped, revealed }: { flipped: boolean; revealed: boolean }) {
  return (
    <div
      style={{
        opacity: revealed ? 1 : 0,
        transform: revealed
          ? `perspective(1200px) rotateY(${flipped ? 4 : -4}deg) rotateX(1.5deg)`
          : `perspective(1200px) rotateY(${flipped ? 8 : -8}deg) rotateX(3deg) translateY(40px) scale(0.94)`,
        transition: 'opacity 900ms 100ms ease-out, transform 1000ms 100ms ease-out',
      }}
    >
      <FollowupsMock />
    </div>
  )
}
