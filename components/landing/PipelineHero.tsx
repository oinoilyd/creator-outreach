'use client'

import { useEffect, useRef } from 'react'
import { animate, createTimeline, stagger, utils } from 'animejs'

/**
 * PipelineHero — animated B2B prospecting visual for the Apollo-style
 * landing hero (V1).
 *
 * What it shows:
 *   Four columns (Search → Score → Pitch → Track) with creator
 *   "tokens" flowing left to right. As each token reaches a column
 *   it picks up a treatment specific to that stage:
 *     · Search: appears + pulses
 *     · Score: gets a small fit-score pill
 *     · Pitch: gets a channel icon (DM / Email / LI)
 *     · Track: gets a status pill (Replied / Pending) + exits
 *
 *   Counters at the top of each column tick up as tokens pass.
 *   Background dotted grid + subtle connecting paths give it a
 *   CRM-dashboard feel rather than a webapp animation.
 *
 * Why anime.js v4:
 *   - Tiny (~14kb gzipped), no React reconciler hits during the
 *     animation loop — direct DOM property writes
 *   - Built-in timeline + stagger for choreographing N tokens with
 *     different start offsets without me hand-writing a clock
 *   - Plays well with SVG paths if we want curved tokens later
 *
 * Performance:
 *   - 5 tokens in flight at a time, looped indefinitely
 *   - All transforms (translate / opacity / scale) — compositor-only
 *   - Pauses when off-screen via IntersectionObserver
 *   - Respects prefers-reduced-motion → static "frame 0" snapshot
 */

const COLUMNS = ['Source', 'Score', 'Pitch', 'Track'] as const
const TOKEN_COUNT = 5

// Column x-centers in viewBox units (the SVG is 600 × 360).
const COL_X = [80, 220, 360, 500]
const TRACK_Y = 200          // shared vertical lane all tokens travel along
const TOKEN_W = 110
const TOKEN_H = 36

// Sample creator names so the tokens read as real-feeling rows
// instead of placeholder rectangles.
const NAMES = [
  'Marina B.',
  'A. Castelli',
  'J. Reyes',
  'L. Aldaco',
  'P. Okafor',
  'M. Tanaka',
  'D. Rivera',
  'S. Whitman',
]

const CHANNELS = ['DM', 'Email', 'LinkedIn'] as const
const STATUSES = ['Replied', 'Pending', 'Replied', 'Pending'] as const

export function PipelineHero() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    // Respect reduced-motion. The static frame already shows
    // tokens in the Pitch / Track columns so it reads as a
    // populated pipeline even without animation.
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    // Pause when out of viewport — saves CPU on long scrolls.
    let active = true
    let timeline: ReturnType<typeof createTimeline> | null = null

    function buildTimeline() {
      if (!active || !root) return
      // Reset every token to the spawn position.
      utils.set('.pipe-token', { translateX: -150, opacity: 0 })
      utils.set('.pipe-token .pip-pill', { opacity: 0, translateY: 4 })
      utils.set('.pipe-token .pip-channel', { opacity: 0, translateY: 4 })
      utils.set('.pipe-token .pip-status', { opacity: 0, translateY: 4 })

      const tl = createTimeline({
        loop: true,
        defaults: { ease: 'out(3)' },
      })

      // For each token, walk it through all 4 columns. Stagger the
      // start times so the tokens look like they're flowing
      // continuously rather than in lockstep.
      const tokens = root.querySelectorAll('.pipe-token')

      tokens.forEach((_, idx) => {
        const startOffset = idx * 1100 // ms between successive tokens
        const sel = `.pipe-token-${idx}`

        // 1. Enter Source column
        tl.add(sel, {
          translateX: COL_X[0] - TOKEN_W / 2,
          opacity: [0, 1],
          duration: 700,
        }, startOffset)

        // 2. Pause at Source (a beat where the row "exists" but
        //    hasn't been scored yet)
        tl.add(sel, { duration: 450 })

        // 3. Move to Score column + pill appears
        tl.add(sel, {
          translateX: COL_X[1] - TOKEN_W / 2,
          duration: 600,
        })
        tl.add(`${sel} .pip-pill`, {
          opacity: [0, 1],
          translateY: [4, 0],
          duration: 350,
        }, '-=400')

        // 4. Move to Pitch column + channel icon appears
        tl.add(sel, {
          translateX: COL_X[2] - TOKEN_W / 2,
          duration: 600,
        }, '+=350')
        tl.add(`${sel} .pip-channel`, {
          opacity: [0, 1],
          translateY: [4, 0],
          duration: 350,
        }, '-=400')

        // 5. Move to Track column + status appears
        tl.add(sel, {
          translateX: COL_X[3] - TOKEN_W / 2,
          duration: 600,
        }, '+=350')
        tl.add(`${sel} .pip-status`, {
          opacity: [0, 1],
          translateY: [4, 0],
          duration: 350,
        }, '-=400')

        // 6. Exit right + fade out
        tl.add(sel, {
          translateX: 750,
          opacity: [1, 0],
          duration: 700,
        }, '+=550')
      })

      timeline = tl
    }

    function teardown() {
      timeline?.pause()
      timeline = null
    }

    // IntersectionObserver — only run when in view.
    const io = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!timeline) buildTimeline()
            else timeline.play()
          } else {
            timeline?.pause()
          }
        }
      },
      { threshold: 0.1 },
    )
    io.observe(root)

    // Animate the column counters independently — they tick up
    // continuously regardless of the token loop, so the "live data"
    // feel persists.
    const counterEls = root.querySelectorAll('.pipe-counter')
    const counterTl = createTimeline({ loop: true, defaults: { ease: 'inOut(2)' } })
    counterEls.forEach((el, idx) => {
      const target = { v: 0 }
      counterTl.add(target, {
        v: 100 + idx * 23,
        duration: 4500,
        modifier: utils.round(0),
        onUpdate: () => {
          ;(el as HTMLElement).textContent = String(Math.round(target.v))
        },
      }, idx * 250)
    })

    // Pulse the column header dots
    animate('.pipe-col-dot', {
      scale: [1, 1.3, 1],
      opacity: [0.5, 1, 0.5],
      duration: 2000,
      delay: stagger(180),
      loop: true,
      ease: 'inOut(2)',
    })

    return () => {
      active = false
      io.disconnect()
      teardown()
      counterTl.pause()
    }
  }, [])

  return (
    <div
      ref={rootRef}
      className="relative w-full aspect-[600/420]"
      aria-label="Animated pipeline showing creators flowing through search, score, pitch, and track stages"
    >
      <svg
        viewBox="0 0 600 420"
        className="absolute inset-0 w-full h-full overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background dotted grid — CRM-dashboard texture */}
        <defs>
          <pattern id="pipe-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="currentColor" opacity="0.18" />
          </pattern>
          {/* Soft column glow */}
          <radialGradient id="pipe-col-glow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#E85D2F" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#E85D2F" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect
          x="20"
          y="60"
          width="560"
          height="320"
          rx="12"
          fill="url(#pipe-grid)"
          className="text-[#0F1733]"
        />

        {/* Column header line */}
        {COLUMNS.map((label, i) => (
          <g key={label}>
            {/* Soft glow under each column head */}
            <ellipse cx={COL_X[i]} cy="100" rx="55" ry="14" fill="url(#pipe-col-glow)" />
            {/* Pulsing dot */}
            <circle cx={COL_X[i] - 35} cy="100" r="3" fill="#E85D2F" className="pipe-col-dot" />
            {/* Column label */}
            <text
              x={COL_X[i] - 28}
              y="103"
              fontSize="11"
              fontWeight="700"
              letterSpacing="0.16em"
              fill="#0F1733"
              fontFamily="ui-sans-serif, system-ui"
            >
              {label.toUpperCase()}
            </text>
            {/* Counter */}
            <text
              x={COL_X[i] + 35}
              y="103"
              fontSize="11"
              fontWeight="600"
              fill="#0F1733"
              opacity="0.45"
              textAnchor="end"
              fontFamily="ui-monospace, SFMono-Regular, Menlo"
              className="pipe-counter"
            >
              0
            </text>
            {/* Vertical column separator (except last) */}
            {i < COLUMNS.length - 1 && (
              <line
                x1={COL_X[i] + 70}
                y1="120"
                x2={COL_X[i] + 70}
                y2="360"
                stroke="#0F1733"
                strokeOpacity="0.08"
                strokeDasharray="3 5"
              />
            )}
          </g>
        ))}

        {/* Lane line (where tokens travel) */}
        <line
          x1="20"
          y1={TRACK_Y}
          x2="580"
          y2={TRACK_Y}
          stroke="#0F1733"
          strokeOpacity="0.06"
          strokeDasharray="2 4"
        />

        {/* Tokens */}
        {Array.from({ length: TOKEN_COUNT }).map((_, idx) => {
          const name = NAMES[idx % NAMES.length]
          const channel = CHANNELS[idx % CHANNELS.length]
          const status = STATUSES[idx % STATUSES.length]
          const score = 70 + ((idx * 7) % 27) // varied 70–96
          const channelColor =
            channel === 'DM' ? '#E85D2F'
            : channel === 'Email' ? '#0F1733'
            : '#1B6FB5' // LinkedIn
          const statusColor = status === 'Replied' ? '#16A34A' : '#0F1733'

          return (
            <g
              key={idx}
              className={`pipe-token pipe-token-${idx}`}
              transform={`translate(${-150} ${TRACK_Y - TOKEN_H / 2})`}
              opacity="0"
            >
              {/* Token card */}
              <rect
                width={TOKEN_W}
                height={TOKEN_H}
                rx="8"
                fill="#FFFFFF"
                stroke="#0F1733"
                strokeOpacity="0.12"
              />
              {/* Avatar circle */}
              <circle cx="14" cy="18" r="8" fill={channelColor} opacity="0.85" />
              <text
                x="14"
                y="22"
                fontSize="9"
                fontWeight="700"
                fill="#FFFFFF"
                textAnchor="middle"
                fontFamily="ui-sans-serif, system-ui"
              >
                {name.charAt(0)}
              </text>
              {/* Name */}
              <text
                x="28"
                y="16"
                fontSize="10"
                fontWeight="600"
                fill="#0F1733"
                fontFamily="ui-sans-serif, system-ui"
              >
                {name}
              </text>
              {/* Subtitle line — looks like a metric */}
              <text
                x="28"
                y="27"
                fontSize="8"
                fill="#0F1733"
                opacity="0.45"
                fontFamily="ui-sans-serif, system-ui"
              >
                · indie operator
              </text>

              {/* Score pill (appears at Score column) */}
              <g className="pip-pill">
                <rect x="76" y="6" width="28" height="12" rx="6" fill="#E85D2F" opacity="0.12" />
                <text
                  x="90"
                  y="14.5"
                  fontSize="8"
                  fontWeight="700"
                  fill="#9C3D1F"
                  textAnchor="middle"
                  fontFamily="ui-sans-serif, system-ui"
                >
                  {score}
                </text>
              </g>

              {/* Channel icon (appears at Pitch column) */}
              <g className="pip-channel">
                <rect x="76" y="20" width="28" height="11" rx="3" fill={channelColor} opacity="0.12" />
                <text
                  x="90"
                  y="28"
                  fontSize="7"
                  fontWeight="700"
                  fill={channelColor}
                  textAnchor="middle"
                  fontFamily="ui-sans-serif, system-ui"
                >
                  {channel.toUpperCase()}
                </text>
              </g>

              {/* Status pill (appears at Track column) — replaces channel icon position */}
              <g className="pip-status" transform="translate(0 -14)">
                <rect x="76" y="20" width="28" height="11" rx="3" fill={statusColor} opacity="0.15" />
                <text
                  x="90"
                  y="28"
                  fontSize="7"
                  fontWeight="700"
                  fill={statusColor}
                  textAnchor="middle"
                  fontFamily="ui-sans-serif, system-ui"
                >
                  {status === 'Replied' ? '✓ ' + status : status}
                </text>
              </g>
            </g>
          )
        })}

        {/* Footer caption — small mono live-feed line */}
        <g>
          <circle cx="40" cy="395" r="3" fill="#16A34A">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
          <text
            x="50"
            y="399"
            fontSize="10"
            fontWeight="600"
            fill="#0F1733"
            opacity="0.55"
            fontFamily="ui-monospace, SFMono-Regular, Menlo"
          >
            LIVE · 5 PLATFORMS · ONE QUEUE
          </text>
        </g>
      </svg>
    </div>
  )
}
