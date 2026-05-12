'use client'

/**
 * PlatformRain — background animation that "rains" the five platform
 * brand marks (YouTube, Instagram, TikTok, X, LinkedIn) down the
 * viewport. Used on /auth/* pages behind the sign-in / sign-up card
 * to reinforce what the product does at the moment of first
 * impression.
 *
 * Design notes:
 *
 *   • Subtle by design — drops render at ~15% opacity so they don't
 *     compete with the foreground card or form copy.
 *   • Pure CSS animation (single keyframes block). No requestAnimation
 *     Frame, no JS-driven motion. Each drop is an independent absolutely-
 *     positioned glyph with its own animation-delay + animation-duration,
 *     all looping infinitely.
 *   • Drop configuration is generated deterministically from the index
 *     so the SSR markup matches the client markup. No `Math.random()` —
 *     would cause hydration warnings.
 *   • prefers-reduced-motion respected: animations halt + opacity flips
 *     to 0, leaving a clean static background for users who can't
 *     tolerate motion (vestibular disorders, motion sickness, etc.).
 *   • pointer-events: none so clicks pass through to whatever is
 *     beneath (the Aurora gradient + auth form).
 *
 * Placement: render INSIDE AuthShell, AFTER the Aurora gradient
 * but BEFORE the form content. The z-index stack is:
 *   z-0: Aurora gradient (radial bg)
 *   z-5: PlatformRain   (this — drops above Aurora, below content)
 *   z-10: form card     (above the rain)
 */

import { PLATFORM_MARKS } from './PlatformBrandMarks'

// Count balanced for visual density vs. perf cost. 24 drops × 5
// platforms = each platform gets ~4-5 drops on screen at once.
const DROP_COUNT = 24

// Deterministic pseudo-random helpers — same input always returns
// the same output, so SSR and client agree. Avoids hydration mismatch
// warnings that Math.random() would cause.
function pseudoRandom(seed: number, mod: number): number {
  // Simple LCG-style hash. Good enough for visual variety; nothing
  // depends on cryptographic randomness here.
  return Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % mod
}

interface Drop {
  id: number
  Glyph: (typeof PLATFORM_MARKS)[number]['Glyph']
  /** Horizontal position as a percentage of viewport width. */
  leftPct: number
  /** Animation delay in seconds — staggers the drops over time. */
  delay: number
  /** Full fall duration in seconds — varying speeds add depth. */
  duration: number
  /** Glyph render size in pixels. Mix of sizes implies parallax. */
  size: number
}

function buildDrops(): Drop[] {
  const drops: Drop[] = []
  for (let i = 0; i < DROP_COUNT; i++) {
    const platform = PLATFORM_MARKS[i % PLATFORM_MARKS.length]
    drops.push({
      id: i,
      Glyph: platform.Glyph,
      // Spread evenly across width with some jitter
      leftPct: ((i * 17) % 100 + pseudoRandom(i, 8)) % 100,
      // 0-12s delay window
      delay: pseudoRandom(i + 100, 12),
      // 7-13s fall — slower than UI-typical so the rain reads as
      // ambient atmosphere, not aggressive activity.
      duration: 7 + pseudoRandom(i + 200, 6),
      // Three size buckets for depth: 22 / 30 / 38 px
      size: 22 + Math.floor(pseudoRandom(i + 300, 3)) * 8,
    })
  }
  return drops
}

export function PlatformRain() {
  const drops = buildDrops()

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden z-[5]"
      aria-hidden="true"
    >
      {/* Inline keyframes so the component is self-contained — no
          dependency on globals.css or a CSS module file. The vh
          values overshoot the viewport so drops enter/exit cleanly
          off-screen. The rotation gives each drop a slight wobble
          for organic motion. */}
      <style>{`
        @keyframes platform-rain-fall {
          0%   { transform: translate3d(0, -18vh, 0) rotate(-6deg); opacity: 0; }
          12%  { opacity: 0.16; }
          88%  { opacity: 0.16; }
          100% { transform: translate3d(0, 118vh, 0) rotate(6deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .platform-rain-drop {
            animation: none !important;
            opacity: 0 !important;
          }
        }
      `}</style>
      {drops.map(({ id, Glyph, leftPct, delay, duration, size }) => (
        <div
          key={id}
          className="platform-rain-drop absolute top-0"
          style={{
            left: `${leftPct}%`,
            animation: `platform-rain-fall ${duration}s linear ${delay}s infinite`,
            // Slight blur on the smaller drops adds atmospheric depth
            filter: size < 26 ? 'blur(0.3px)' : undefined,
            willChange: 'transform, opacity',
          }}
        >
          <Glyph size={size} />
        </div>
      ))}
    </div>
  )
}
