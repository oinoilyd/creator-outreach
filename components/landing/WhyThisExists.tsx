'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

/**
 * WhyThisExists — editorial-spread layout for the "I built this
 * because I needed it" section.
 *
 * Design rationale (rebuilt 2026-05-08 after the prior synthesized-
 * SVG version landed flat):
 *   - Three vertical chapters that alternate left/right orientation.
 *     Each chapter is wide (no 3-column grid cramming), so the
 *     section reads like a magazine feature, not a product card grid.
 *   - Display-serif (Newsreader) for the pain headlines. Pairs with
 *     the existing Geist sans for editorial typographic contrast.
 *   - Giant ghosted numerals as decorative chapter marks.
 *   - Real product UI fragments — actual screenshots from
 *     /screenshots/ — used as the "after" visual instead of cartoon
 *     SVG illustrations. Each screenshot sits in a tinted dark frame
 *     with subtle terracotta accent border.
 *   - "Before" texture — a soft chaotic pattern (faded platform
 *     marks, scattered date stamps, struck-through metrics) sits
 *     behind/around the screenshot, hinting at the chaos without
 *     stealing focus.
 *   - "Built in" answer block — terracotta-bordered, with checkmark
 *     icon, anchored at the bottom of each text column.
 *   - Topics now match the actual product themes (Sourcing → Fit
 *     score → Follow-ups). The previous "CRM ignored Instagram"
 *     angle was bashing other tools instead of telling our story;
 *     the Follow-ups chapter is more on-brand for this app.
 *   - IntersectionObserver reveal: headline + visual fade up
 *     independently, screenshot has a slight scale-in. Respects
 *     prefers-reduced-motion.
 */

type Chapter = {
  num: string
  tag: string
  /** Display-serif pain headline. */
  pain: string
  /** Optional italic emphasis word inside the headline. */
  italic?: string
  /** Operator-voice note. */
  note: string
  answer: string
  /** Real product screenshot from /screenshots/. */
  screenshot: { src: string; alt: string; aspect: string }
  /** Background motif under the screenshot — names the "before" chaos. */
  before: { items: string[]; tone: 'platforms' | 'metrics' | 'dates' }
}

const CHAPTERS: Chapter[] = [
  {
    num: '01',
    tag: 'Sourcing',
    pain: 'I was hunting one creator across',
    italic: 'five tabs.',
    note: '“YouTube to find them. LinkedIn for an email. Twitter to confirm they’re still active. A Google Sheet to remember who I’d already messaged. Five sources of truth, none of them talking to each other.”',
    answer:
      'One query searches every platform at once. Email and social handles surface inline on every row. Five tabs collapse into one queue.',
    screenshot: {
      src: '/screenshots/results.png',
      alt: 'Results table — one row per creator with email + social handles inline',
      aspect: '2472 / 1182',
    },
    before: {
      tone: 'platforms',
      items: ['YouTube', 'Instagram', 'TikTok', 'X', 'LinkedIn', 'Sheet'],
    },
  },
  {
    num: '02',
    tag: 'Fit score',
    pain: '“Engagement rate” was answering',
    italic: 'the wrong question.',
    note: '“Off-the-shelf creator scores rank by audience size or engagement. I wanted it to ask: does this person actually fit what I’m looking for? US-based, weekly poster, talks about value investing, under 100K subs.”',
    answer:
      'Plain-English Lead Criteria. Five-dimension AI fit score (recency · reach · reachability · relevance · quality) — fully customizable, weighted per platform.',
    screenshot: {
      src: '/screenshots/bento-fit.png',
      alt: 'Fit score column — Strong / Possible / Weak labels per row',
      aspect: '1352 / 1256',
    },
    before: {
      tone: 'metrics',
      items: ['Subs · 245K', 'Engagement · 5.2%', 'Vertical · Finance', 'Reach · ↑'],
    },
  },
  {
    num: '03',
    tag: 'Follow-ups',
    pain: 'Half my pipeline was leaking through',
    italic: '“I’ll DM them tomorrow.”',
    note: '“I’d reach out, forget for a week, reach out again, then realize last month I’d already messaged the same person. The follow-up was the bottleneck — not the outreach.”',
    answer:
      'Auto-cadence per creator. The Follow-ups tab surfaces what’s due today, sorted by who’s gone cold longest. One click resets the cadence.',
    screenshot: {
      src: '/screenshots/followups.png',
      alt: 'Follow-ups view — due today list with cadence chips',
      aspect: '2810 / 1234',
    },
    before: {
      tone: 'dates',
      items: ['Mon · 3d ago', 'Tue · 7d ago', 'Wed · 14d ago', 'Thu · ?', 'Fri · ?'],
    },
  },
]

export function WhyThisExists() {
  return (
    <section
      id="customers"
      className="px-6 py-24 md:py-32 scroll-mt-24 bg-white dark:bg-[#131826] border-y border-[#0F1733]/8 dark:border-white/10 relative overflow-hidden"
    >
      {/* Ambient backdrop wash — soft, almost imperceptible */}
      <div
        aria-hidden
        className="absolute -top-1/3 right-0 w-[900px] h-[900px] pointer-events-none opacity-[0.05] dark:opacity-[0.10] motion-reduce:hidden"
        style={{
          background: 'radial-gradient(closest-side, rgba(232,93,47,0.7), transparent 70%)',
          animation: 'wte-breath 18s ease-in-out infinite',
        }}
      />

      <div className="max-w-[1200px] mx-auto relative">
        {/* SECTION HEADER — editorial title block */}
        <header className="max-w-[820px] mb-20 md:mb-32">
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full bg-[#E85D2F]/10 border border-[#E85D2F]/30 text-[11px] uppercase tracking-[0.2em] text-[#9C3D1F] dark:text-[#F2A261] font-bold">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="12" cy="12" r="9" fillOpacity="0.3" />
              <circle cx="12" cy="12" r="4" />
            </svg>
            Why this exists
          </div>
          <h2
            className="font-semibold tracking-[-0.035em] leading-[0.98] text-[#0F1733] dark:text-white"
            style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}
          >
            I built this because{' '}
            <span
              className="italic font-normal text-[#E85D2F] dark:text-[#F2A261]"
              style={{ fontFamily: 'var(--font-newsreader), Georgia, serif' }}
            >
              I needed it.
            </span>
          </h2>
          <p className="mt-7 max-w-[58ch] text-[17px] md:text-[18px] text-[#0F1733]/65 dark:text-white/65 leading-[1.6]">
            Three walls I kept hitting trying to run my own creator
            pipeline by hand. Each one is now a feature, because the
            workaround was where the pipeline kept dying.
          </p>
        </header>

        {/* THREE EDITORIAL CHAPTERS */}
        <div className="space-y-24 md:space-y-32">
          {CHAPTERS.map((c, i) => (
            <Chapter key={c.num} chapter={c} flipped={i % 2 === 1} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes wte-breath {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.08); opacity: 0.65; }
        }
        @keyframes wte-fade-up {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes wte-screenshot-in {
          from { opacity: 0; transform: translateY(40px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes wte-before-drift {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
      `}</style>
    </section>
  )
}

/* ─── chapter ─── */

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
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' },
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
    <article
      ref={ref}
      className={`grid md:grid-cols-12 gap-10 md:gap-14 items-center ${flipped ? '' : ''}`}
    >
      {/* TEXT COLUMN — order flips on every other chapter */}
      <div className={`md:col-span-6 ${flipped ? 'md:order-2' : 'md:order-1'}`}>
        {/* Decorative numeral + tag */}
        <div className="flex items-baseline gap-5 mb-6" style={fadeUp(0)}>
          <span
            aria-hidden
            className="font-bold tracking-[-0.06em] text-[#E85D2F]/15 dark:text-[#F2A261]/20 leading-none font-mono select-none"
            style={{ fontSize: 'clamp(4rem, 7vw, 6.5rem)' }}
          >
            {chapter.num}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#E85D2F]/10 dark:bg-[#F2A261]/15 border border-[#E85D2F]/30 dark:border-[#F2A261]/30 text-[10px] uppercase tracking-[0.18em] font-bold text-[#9C3D1F] dark:text-[#F2A261]">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {chapter.tag}
          </span>
        </div>

        {/* Display headline — sans + italic-serif emphasis */}
        <h3
          className="font-semibold tracking-[-0.025em] leading-[1.05] text-[#0F1733] dark:text-white mb-7"
          style={{ fontSize: 'clamp(1.875rem, 3.6vw, 3rem)', ...fadeUp(80) }}
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

        {/* Operator-voice note — pull quote treatment */}
        <blockquote
          className="relative pl-5 mb-8 text-[16px] md:text-[17px] text-[#0F1733]/75 dark:text-white/75 leading-[1.7] border-l-2 border-[#0F1733]/15 dark:border-white/15"
          style={fadeUp(160)}
        >
          {chapter.note}
        </blockquote>

        {/* "Built in" answer block */}
        <div
          className="relative rounded-xl bg-[#E85D2F]/[0.06] dark:bg-[#F2A261]/[0.08] border border-[#E85D2F]/25 dark:border-[#F2A261]/25 p-4 md:p-5"
          style={fadeUp(240)}
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#E85D2F] text-white shrink-0 shadow-[0_0_16px_rgba(232,93,47,0.45)]"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <polyline points="5 12 10 17 19 7" />
              </svg>
            </span>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#9C3D1F] dark:text-[#F2A261] mb-1.5">
                What I built
              </div>
              <p className="text-[14px] md:text-[15px] text-[#0F1733]/90 dark:text-white/90 leading-[1.6]">
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
    </article>
  )
}

/* ─── chapter visual ─── */

/**
 * ChapterVisual — composed visual that pairs the "before" chaos
 * (faded platform marks / metrics / date stamps) with the "after"
 * real product screenshot in a stylized dark frame.
 */
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
    <div className="relative">
      {/* "Before" chaos chips — drift in the background, faded */}
      <div
        aria-hidden
        className="absolute -inset-4 md:-inset-6 pointer-events-none flex flex-wrap gap-2 content-start opacity-50 dark:opacity-60"
        style={{
          opacity: revealed ? 0.5 : 0,
          transition: 'opacity 900ms 200ms ease-out',
        }}
      >
        {chapter.before.items.map((item, idx) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0F1733]/[0.04] dark:bg-white/[0.05] border border-[#0F1733]/10 dark:border-white/10 text-[10px] font-mono text-[#0F1733]/40 dark:text-white/40 line-through decoration-[#E85D2F]/60 decoration-[1px]"
            style={{
              animation: `wte-before-drift ${4 + (idx % 3)}s ease-in-out infinite`,
              animationDelay: `${idx * 0.4}s`,
              transform: `translate(${(idx % 3 - 1) * 6}px, ${Math.sin(idx) * 4}px) rotate(${(idx % 2 ? -1 : 1) * (idx % 3)}deg)`,
            }}
          >
            {item}
          </span>
        ))}
      </div>

      {/* "After" — real product screenshot in a dark frame.
          Tilted slightly toward content; flipped chapters tilt the
          other way so the spread reads symmetric. */}
      <div
        className="relative z-10"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed
            ? `perspective(1200px) rotateY(${flipped ? 4 : -4}deg) rotateX(1deg)`
            : `perspective(1200px) rotateY(${flipped ? 8 : -8}deg) rotateX(2deg) translateY(40px) scale(0.96)`,
          transition: 'opacity 900ms 100ms ease-out, transform 900ms 100ms ease-out',
        }}
      >
        <div
          className="relative rounded-xl overflow-hidden border border-[#0F1733]/15 dark:border-white/15 bg-[#0E121C]"
          style={{
            aspectRatio: chapter.screenshot.aspect,
            boxShadow:
              '0 30px 60px -25px rgba(15,23,51,0.35), 0 14px 30px -10px rgba(232,93,47,0.18)',
          }}
        >
          {/* Top-bar accent — terracotta scan line at the very top of
              the frame, signals "live capture" without being literal. */}
          <div
            aria-hidden
            className="absolute top-0 inset-x-0 h-[2px] z-10"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(232,93,47,0.85) 30%, rgba(242,162,97,0.85) 70%, transparent)',
            }}
          />
          <Image
            src={chapter.screenshot.src}
            alt={chapter.screenshot.alt}
            fill
            sizes="(min-width: 1280px) 580px, 100vw"
            className="object-contain"
          />
        </div>

        {/* Caption directly under the screenshot */}
        <div className="mt-4 text-[11px] uppercase tracking-[0.2em] font-bold text-[#0F1733]/45 dark:text-white/45 font-mono">
          → Live capture · {chapter.tag.toLowerCase()} view
        </div>
      </div>

      {/* Decorative arrow connector — points from chaos to product.
          Subtle line motif in the corner. */}
      <svg
        aria-hidden
        className="absolute -top-4 -right-4 w-12 h-12 text-[#E85D2F]/40 dark:text-[#F2A261]/50 motion-reduce:hidden"
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          opacity: revealed ? 1 : 0,
          transition: 'opacity 900ms 500ms ease-out',
        }}
      >
        <path d="M 6 8 Q 24 8 24 24 Q 24 40 42 40" />
        <polyline points="36 36 42 40 38 44" />
      </svg>
    </div>
  )
}
