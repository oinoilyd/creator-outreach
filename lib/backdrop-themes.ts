/**
 * Backdrop theme system — per-platform animated background effects.
 *
 * 5 themes user can toggle in Profile → Theme:
 *   • off    — no backdrop (default)
 *   • rain   — brand icons falling from top, slow + low opacity
 *   • drift  — brand icons floating upward (bubble-like)
 *   • pulse  — soft radial glow in brand color, breathing
 *   • aura   — slow conic/radial gradient sweep in brand color
 *
 * Each theme is parameterized by the currently-selected platform.
 * Same theme + different platform = same animation language, different
 * color + icon. So all 5 themes have YouTube / IG / X / TikTok /
 * LinkedIn variants automatically (5 × 5 = 25 unique experiences).
 *
 * Performance: animations use transform + opacity ONLY (compositor-
 * friendly). No layout reflow. Element counts capped so 60fps stays
 * stable even on the heaviest theme (rain ~24 elements).
 */

import type { PlatformId } from './types'

// 2026-05-10 v4 per Dylan: added Tornado — a one-shot spotlight
// theme like Fireworks. A vertical swirling column of platform
// icons sweeps L→R then R→L across the page, twice, then fades.
// Both Fireworks and Tornado are spotlight-only (auto-trigger when
// picked; layer returns null when spotlight is off).
//
// v3 history: dropped Aura, added Fireworks. The two ambient themes
// (Pulse / Aura) both felt either flat or hokey; Fireworks gives the
// logos a real moment.
export type BackdropTheme = 'off' | 'rain' | 'drift' | 'fireworks' | 'tornado'

export const BACKDROP_THEMES: { id: BackdropTheme; label: string; description: string }[] = [
  { id: 'off',       label: 'Off',       description: 'No animation — color shade stays on by default.' },
  { id: 'rain',      label: 'Rain',      description: 'Platform logos fall from the top, slow + sparse.' },
  { id: 'drift',     label: 'Drift',     description: 'Logos float upward like bubbles. Subtle.' },
  { id: 'fireworks', label: 'Fireworks', description: 'Bursts of the platform icon explode outward, building to a dead-center mega-burst finale. Bold.' },
  { id: 'tornado',   label: 'Tornado',   description: 'A swirling column of platform logos sweeps the page twice, then disappears.' },
]

/** Per-platform brand hue tokens — feed the animations + shades. */
export interface PlatformHues {
  /** Hex for inline SVG strokes / fills. */
  color: string
  /** Translucent rgba — used by theme glow/aura layers (mid opacity). */
  glow: string
  /** Slightly more saturated rgba for ring/edge highlights. */
  glowStrong: string
  /**
   * VERY subtle tint for the always-on PlatformShade.
   * 2026-05-10 per Dylan: 'WAY more subtle, just a tiny easter-egg
   *  tint, not distracting.' Dropped from ~10% to ~3% opacity so
   *  it's basically a hint of color, not a wash.
   */
  shade: string
}

export const PLATFORM_HUES: Record<PlatformId, PlatformHues> = {
  youtube:   { color: '#ef4444', glow: 'rgba(239, 68, 68, 0.10)',   glowStrong: 'rgba(239, 68, 68, 0.20)',   shade: 'rgba(239, 68, 68, 0.028)'  },
  instagram: { color: '#ec4899', glow: 'rgba(236, 72, 153, 0.10)',  glowStrong: 'rgba(236, 72, 153, 0.22)',  shade: 'rgba(236, 72, 153, 0.028)' },
  tiktok:    { color: '#06b6d4', glow: 'rgba(6, 182, 212, 0.10)',   glowStrong: 'rgba(6, 182, 212, 0.22)',   shade: 'rgba(6, 182, 212, 0.028)'  },
  twitter:   { color: '#94a3b8', glow: 'rgba(148, 163, 184, 0.10)', glowStrong: 'rgba(148, 163, 184, 0.22)', shade: 'rgba(148, 163, 184, 0.028)' },
  linkedin:  { color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.10)',  glowStrong: 'rgba(59, 130, 246, 0.22)',  shade: 'rgba(59, 130, 246, 0.028)' },
}

/**
 * SVG path d-attribute strings for each platform's icon — used by the
 * Rain + Drift themes which render lots of mini SVGs. Kept as bare
 * paths (no full <svg> wrapper) so the consumer chooses viewBox/size.
 *
 * All paths normalized to a 24×24 viewBox. Single-path simplified
 * versions of the brand marks for performance + visual consistency
 * when rendered small.
 */
export const PLATFORM_ICON_PATH: Record<PlatformId, string> = {
  // Filled play button in a rounded rectangle — recognizable YouTube shape
  youtube:   'M21.582 6.186a2.506 2.506 0 0 0-1.768-1.768C18.254 4 12 4 12 4s-6.254 0-7.814.418a2.506 2.506 0 0 0-1.768 1.768C2 7.746 2 12 2 12s0 4.254.418 5.814c.227.834.871 1.478 1.768 1.768C5.746 20 12 20 12 20s6.254 0 7.814-.418a2.506 2.506 0 0 0 1.768-1.768C22 16.254 22 12 22 12s0-4.254-.418-5.814zM10 15V9l5.196 3L10 15z',
  // Camera-square outline — Instagram's universal mark
  instagram: 'M12 2.16c3.2 0 3.584.012 4.85.07 1.17.054 1.804.249 2.227.413.56.218.96.479 1.38.899.42.42.681.819.899 1.38.164.422.36 1.058.413 2.227.058 1.266.07 1.65.07 4.85s-.012 3.584-.07 4.85c-.054 1.17-.249 1.804-.413 2.227a3.71 3.71 0 0 1-.899 1.38c-.42.42-.819.681-1.38.899-.422.164-1.058.36-2.227.413-1.266.058-1.65.07-4.85.07s-3.584-.012-4.85-.07c-1.17-.054-1.804-.249-2.227-.413a3.71 3.71 0 0 1-1.38-.899 3.71 3.71 0 0 1-.899-1.38c-.164-.422-.36-1.058-.413-2.227-.058-1.266-.07-1.65-.07-4.85s.012-3.584.07-4.85c.054-1.17.249-1.804.413-2.227.218-.56.479-.96.899-1.38.42-.42.819-.681 1.38-.899.422-.164 1.058-.36 2.227-.413 1.266-.058 1.65-.07 4.85-.07M12 0C8.741 0 8.332.014 7.052.072 5.775.131 4.902.333 4.14.63a5.882 5.882 0 0 0-2.124 1.384A5.883 5.883 0 0 0 .63 4.14C.333 4.902.131 5.775.072 7.052.014 8.332 0 8.741 0 12s.014 3.668.072 4.948c.059 1.277.261 2.15.558 2.912a5.882 5.882 0 0 0 1.384 2.126 5.883 5.883 0 0 0 2.126 1.384c.762.296 1.635.499 2.912.557C8.332 23.986 8.741 24 12 24s3.668-.014 4.948-.072c1.277-.059 2.15-.261 2.912-.558a5.882 5.882 0 0 0 2.126-1.384 5.883 5.883 0 0 0 1.384-2.126c.296-.762.499-1.635.557-2.912.058-1.28.072-1.689.072-4.948s-.014-3.668-.072-4.948c-.059-1.277-.261-2.15-.558-2.912a5.882 5.882 0 0 0-1.384-2.124A5.883 5.883 0 0 0 19.86.631C19.098.333 18.225.131 16.948.072 15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z',
  // Musical-note silhouette — TikTok's iconic mark, simplified
  tiktok:    'M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.05 3.36-2.55V9.66c-3.4-.45-6.38 2.2-6.38 5.55 0 3.27 2.71 5.59 5.59 5.59 3.09 0 5.59-2.5 5.59-5.59V9.01a7.65 7.65 0 0 0 4.47 1.43V7.36s-1.88.09-3.29-1.54z',
  // X (Twitter) — single-line ✕ shape
  twitter:   'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z',
  // LinkedIn 'in' — simplified
  linkedin:  'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
}
