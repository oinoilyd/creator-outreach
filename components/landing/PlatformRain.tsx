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

// Per-platform drop counts (Dylan 2026-05-23: YouTube is the lead
// target audience — weight it heavier than the others so the rain
// reads as "YouTube-led, also these" rather than "five platforms
// equally"). YouTube gets ~50% of the drops; the other four split
// the rest evenly. Total density bumped from 24 → 32 so the heavier
// YouTube weighting reads as "lots of YouTube" not "less of the
// others." Tweak DROPS_PER_PLATFORM if you want to rebalance.
const DROPS_PER_PLATFORM: Record<(typeof PLATFORM_MARKS)[number]['name'], number> = {
  YouTube: 16,
  Instagram: 4,
  TikTok: 4,
  X: 4,
  LinkedIn: 4,
}

// Deterministic pseudo-random helper — same input always returns the
// same output, so the SSR markup matches the client markup.
//
// The previous implementation used Math.sin(), which LOOKS deterministic
// but isn't bit-reproducible across JS engines: transcendental functions
// can differ in their low-order bits between the SSR runtime (Node) and
// the browser. That produced e.g. server `left: "34.0572%"` vs client
// `left: "34.05721816935693%"` — a React hydration mismatch on every
// auth page. This mulberry32-style generator uses only integer bit-ops
// plus a final 2^32 divide, all of which ARE bit-identical across
// engines; we also round the result so the stringified values can't
// diverge. Nothing here depends on cryptographic randomness.
function pseudoRandom(seed: number, mod: number): number {
  let t = (seed + 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const unit = ((t ^ (t >>> 14)) >>> 0) / 4294967296 // [0, 1)
  // Round to 4 decimals — keeps inline-style strings short and collapses
  // any theoretical divergence to a single identical value.
  return Math.round(unit * mod * 10000) / 10000
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
  // Iterate platforms in a fixed order (PLATFORM_MARKS) so each id
  // is deterministic — SSR and client agree on positions/delays.
  // Within each platform, generate `count` drops with a unique id
  // seed so pseudoRandom produces varied positions even for the
  // heavily-weighted YouTube drops.
  let id = 0
  for (const mark of PLATFORM_MARKS) {
    const count = DROPS_PER_PLATFORM[mark.name]
    for (let i = 0; i < count; i++) {
      drops.push({
        id,
        Glyph: mark.Glyph,
        // Spread across width with some jitter — multiplier on id
        // keeps neighbouring drops from clustering visually.
        leftPct: ((id * 17) % 100 + pseudoRandom(id, 8)) % 100,
        // 0-12s delay window — staggers entry so drops don't all
        // hit the top at once.
        delay: pseudoRandom(id + 100, 12),
        // 7-13s fall — slower than UI-typical so the rain reads as
        // ambient atmosphere, not aggressive activity.
        duration: 7 + pseudoRandom(id + 200, 6),
        // Three size buckets for depth: 22 / 30 / 38 px
        size: 22 + Math.floor(pseudoRandom(id + 300, 3)) * 8,
      })
      id++
    }
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
            // animation-fill-mode: backwards applies the 0% keyframe
            // state (opacity: 0) during the `delay` period BEFORE the
            // animation actually starts. Without this, drops render
            // at default opacity (1) and "pop in" at full brightness
            // when the animation finally kicks in — read as glitchy
            // chunks in early testing.
            animation: `platform-rain-fall ${duration}s linear ${delay}s infinite backwards`,
            // Initial state matches the 0% keyframe so even before
            // styles compute, the drop isn't a flash of full-opacity
            // brand glyph. Defense in depth with the fill-mode.
            opacity: 0,
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
