'use client'

/**
 * PlatformBackdrop — animated theme layer (Rain / Drift / Fireworks /
 * Tornado).
 *
 * 2026-05-10 v5 per Dylan:
 *   • Fireworks is now spotlight-only — a phased ONE-SHOT show that
 *     auto-triggers when the user picks the theme. Phases:
 *       0–4.5s   scattered bursts at random points
 *       4.5–5.4s grand finale — simultaneous mega-bursts ending on
 *                a dead-center capper.
 *     If theme === 'fireworks' but spotlight is off, the whole layer
 *     returns null (no continuous loop). Re-trigger via the spotlight
 *     button or by re-selecting Fireworks.
 *
 * 2026-05-23 per Dylan: dropped the "Creator Outreach" text easter
 * egg that previously closed the fireworks show. Wasn't landing.
 *
 * Earlier (v4):
 *   • Re-key INNER layer on platform change so icons restart with the
 *     new color/shape (dark-mode reads needed the fresh wave).
 *   • Icon counts boosted (rain 22→36, drift 12→20).
 *   • New `spotlight` prop. Renders the layer at high opacity ABOVE
 *     all content for 15 seconds, then parent flips back. Pointer
 *     events stay none so the spotlight doesn't block clicks.
 */

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import type { PlatformId } from '@/lib/types'
import {
  type BackdropTheme,
  PLATFORM_HUES,
  PLATFORM_ICON_PATH,
} from '@/lib/backdrop-themes'

interface Props {
  theme: BackdropTheme
  platform: PlatformId
  visible?: boolean
  /** Momentary burst — render IN FRONT of content (z-50) at full
   *  saturation. Parent times the window and flips back. This is
   *  also the gate for one-shot themes (Fireworks/Tornado) — they
   *  only mount + animate when this is true. */
  spotlight?: boolean
  /** Persistent visual intensity boost. When true (without `spotlight`),
   *  Rain/Drift render at boosted opacity but stay BEHIND content
   *  (z-0). Doesn't affect one-shot themes' play behavior. Default
   *  enabled via the theme settings popover. */
  intense?: boolean
}

// Opacity multipliers — spotlight cranks every icon's visibility
// way up so the effect reads at 'full color' as Dylan requested.
const SPOTLIGHT_OPACITY_MULT = 6
const SPOTLIGHT_SCALE = 1.15

export function PlatformBackdrop({ theme, platform, visible = true, spotlight = false, intense = false }: Props) {
  // Per Dylan 2026-05-11: rendered via Portal into document.body so
  // it's never affected by an ancestor's `transform`, `filter`, or
  // `will-change` (which would create a containing block and break
  // `position: fixed`). Guarantees themes stay locked at the top of
  // the viewport regardless of where the component sits in the JSX
  // tree.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (theme === 'off') return null
  // Fireworks + Tornado are one-shot spotlight-only shows. Gate ONLY
  // on `spotlight` (momentary burst), not `intense` — so the always-on
  // visual boost doesn't auto-mount the show on every render.
  if ((theme === 'fireworks' || theme === 'tornado') && !spotlight) return null
  if (!mounted) return null // SSR-safe: portal needs document
  const hue = PLATFORM_HUES[platform]
  const iconPath = PLATFORM_ICON_PATH[platform]
  // Effective visual intensity — burst OR persistent always-on.
  const boosted = spotlight || intense

  const node = (
    <div
      key={theme}
      aria-hidden
      // Themes play ONLY in the top banner strip (~88px tall), not
      // full-page. overflow-hidden clips animations to that band.
      //
      // 2026-05-23 per Dylan ("if someone scrolls while it is still
      // going the themes scroll with"): the Tailwind `fixed` class
      // alone was being defeated somewhere in the cascade (likely a
      // ancestor with `transform` / `will-change` creating an
      // unintended containing block — even with the portal). The
      // inline position/top/left/right styles below FORCE fixed
      // viewport positioning regardless of cascade order, with
      // !important-tier precedence over any Tailwind class.
      className="pointer-events-none overflow-hidden transition-opacity ease-out"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 88,
        // Spotlight pushes the layer above content (z-50). Otherwise
        // stays at z-0 — sits behind the banner's translucent bg so
        // icons show through.
        zIndex: spotlight ? 50 : 0,
        opacity: visible ? 1 : 0,
        transitionDuration: visible ? '300ms' : '1500ms',
      }}
    >
      {/* Inner layer keyed on platform — forces a clean restart of
          icons with the new color/shape when user switches platforms.
          Otherwise existing icons stay mid-flight and the color
          change is subtle (especially in dark mode where the brand
          hues read more similar). */}
      <div key={platform}>
        {theme === 'rain' && <RainLayer color={hue.color} iconPath={iconPath} boosted={boosted} />}
        {theme === 'drift' && <DriftLayer color={hue.color} iconPath={iconPath} boosted={boosted} />}
        {theme === 'fireworks' && <FireworksShow color={hue.color} iconPath={iconPath} />}
        {theme === 'tornado' && <TornadoShow color={hue.color} iconPath={iconPath} />}
      </div>
    </div>
  )

  return createPortal(node, document.body)
}

// ── Rain ─────────────────────────────────────────────────────────────

function RainLayer({ color, iconPath, boosted }: { color: string; iconPath: string; boosted: boolean }) {
  // 2026-05-11 banner-only redesign: rain falls THROUGH the 88px banner
  // strip instead of full viewport. Smaller icons, faster fall, more
  // drops so the banner reads as 'raining' at a glance.
  const drops = useMemo(() => {
    const N = 26 // adjusted for banner area
    return Array.from({ length: N }, (_, i) => ({
      key: i,
      left: Math.random() * 100,
      // Banner-scale icons — much smaller than full-page rain
      size: 10 + Math.floor(Math.random() * 8), // 10–18px
      delay: Math.random() * 4,
      duration: 2.5 + Math.random() * 2.5, // 2.5–5s fall (faster — short distance)
      opacity: 0.18 + Math.random() * 0.12,
    }))
  }, [])

  return (
    <>
      {drops.map(d => {
        const op = Math.min(1, d.opacity * (boosted ? SPOTLIGHT_OPACITY_MULT : 1))
        const size = d.size * (boosted ? SPOTLIGHT_SCALE : 1)
        return (
          <motion.svg
            key={d.key}
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill={color}
            // Percentages now refer to the 88px banner container, not vh.
            // -30% → starts ~26px above banner, 130% → ends ~26px below.
            initial={{ y: '-30%', opacity: 0 }}
            animate={{ y: '130%', opacity: [0, op, op, 0] }}
            transition={{
              duration: d.duration,
              delay: d.delay,
              repeat: Infinity,
              ease: 'linear',
              times: [0, 0.1, 0.9, 1],
            }}
            style={{ position: 'absolute', left: `${d.left}%`, top: 0, willChange: 'transform, opacity' }}
          >
            <path d={iconPath} />
          </motion.svg>
        )
      })}
    </>
  )
}

// ── Drift ────────────────────────────────────────────────────────────

function DriftLayer({ color, iconPath, boosted }: { color: string; iconPath: string; boosted: boolean }) {
  // 2026-05-11 banner-only redesign: bubbles float from below the
  // banner upward through it. Smaller icons + faster rise so they
  // read at banner scale.
  const bubbles = useMemo(() => {
    const N = 16
    return Array.from({ length: N }, (_, i) => ({
      key: i,
      left: Math.random() * 100,
      size: 14 + Math.floor(Math.random() * 10), // 14–24px
      delay: Math.random() * 5,
      duration: 4 + Math.random() * 4, // 4–8s rise
      sway: 8 + Math.random() * 14, // smaller sway for narrow banner
      opacity: 0.18 + Math.random() * 0.12,
    }))
  }, [])

  return (
    <>
      {bubbles.map(b => {
        const op = Math.min(1, b.opacity * (boosted ? SPOTLIGHT_OPACITY_MULT : 1))
        const size = b.size * (boosted ? SPOTLIGHT_SCALE : 1)
        return (
          <motion.svg
            key={b.key}
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill={color}
            // Percentages relative to the 88px container, not viewport.
            initial={{ y: '130%', x: 0, opacity: 0 }}
            animate={{
              y: '-30%',
              x: [0, b.sway / 2, -b.sway / 2, b.sway / 2, 0],
              opacity: [0, op, op, 0],
            }}
            transition={{
              duration: b.duration,
              delay: b.delay,
              repeat: Infinity,
              ease: 'linear',
              times: [0, 0.2, 0.5, 0.8, 1],
            }}
            style={{ position: 'absolute', left: `${b.left}%`, top: 0, willChange: 'transform, opacity' }}
          >
            <path d={iconPath} />
          </motion.svg>
        )
      })}
    </>
  )
}

// ── Fireworks (one-shot 15s phased show) ────────────────────────────

/**
 * Phased fireworks show with three acts.
 *
 *   Act 1 (0–9s):    scattered bursts at random points — sparse so
 *                    the user can take it in and see the icons clearly.
 *   Act 2 (9–12s):   ramp — bursts come faster, scaled up slightly,
 *                    building pressure into the finale.
 *   Act 3 (12–14s):  GRAND FINALE — six near-simultaneous bursts
 *                    spread across the screen + one mega-burst dead
 *                    center.
 *
 * 2026-05-23 per Dylan: the "Creator Outreach" easter-egg text was
 * removed — "not good enough." Show now ends on the mega-burst with
 * no wordmark reveal. Component left in for now but no longer
 * referenced.
 *
 * No `repeat: Infinity` — every motion element plays exactly once,
 * so the layer goes idle after 15s. Parent clears spotlight at that
 * point and the whole layer returns null (gate at top of component).
 */
function FireworksShow({ color, iconPath }: { color: string; iconPath: string }) {
  // 2026-05-10 v3 per Dylan: another 3s off the build-up. Scattered
  // tightened from 4s → 1.5s, ramp from 3s → 1.5s. Finale shape +
  // easter-egg ending unchanged — same 6 bursts at the same relative
  // spacing, just sliding earlier again. Total now 8.5s (was 11.5,
  // originally 16.5).
  const bursts = useMemo(
    () => [
      // Act 1 — scattered (0.2–1.7s)
      { id: 's1', cx: 25, cy: 30, delay: 0.2, scale: 1.0 },
      { id: 's2', cx: 70, cy: 45, delay: 0.5, scale: 1.0 },
      { id: 's3', cx: 45, cy: 22, delay: 0.8, scale: 1.0 },
      { id: 's4', cx: 80, cy: 60, delay: 1.1, scale: 1.0 },
      { id: 's5', cx: 20, cy: 65, delay: 1.4, scale: 1.0 },
      { id: 's6', cx: 55, cy: 50, delay: 1.7, scale: 1.05 },
      // Act 2 — ramp (2.0–3.5s)
      { id: 'r1', cx: 35, cy: 35, delay: 2.0, scale: 1.15 },
      { id: 'r2', cx: 65, cy: 38, delay: 2.5, scale: 1.15 },
      { id: 'r3', cx: 50, cy: 60, delay: 3.0, scale: 1.2  },
      { id: 'r4', cx: 28, cy: 50, delay: 3.5, scale: 1.2  },
      // Act 3 — grand finale (4.5–5.4s) — UNCHANGED RELATIVE SPACING,
      // just shifted earlier. Same climactic feel.
      { id: 'f1', cx: 25, cy: 40, delay: 4.5, scale: 1.5  },
      { id: 'f2', cx: 75, cy: 40, delay: 4.6, scale: 1.5  },
      { id: 'f3', cx: 35, cy: 70, delay: 4.8, scale: 1.45 },
      { id: 'f4', cx: 65, cy: 70, delay: 4.9, scale: 1.45 },
      { id: 'f5', cx: 50, cy: 22, delay: 5.1, scale: 1.5  },
      { id: 'f6', cx: 50, cy: 50, delay: 5.4, scale: 1.85 }, // dead-center capper
    ],
    [],
  )

  const particles = useMemo(() => {
    // 2026-05-11 banner-only scale: particles are ~1/3 the size and
    // travel ~1/4 the distance in pixels (not vmin) so the burst fits
    // inside the 88px banner instead of exploding off-screen.
    return bursts.flatMap(burst =>
      Array.from({ length: 10 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.35
        const distance = 12 + Math.random() * 12 // px, not vmin
        return {
          key: `${burst.id}-${i}`,
          burst,
          dx: Math.cos(angle) * distance * burst.scale,
          dy: Math.sin(angle) * distance * burst.scale,
          size: (6 + Math.floor(Math.random() * 5)) * burst.scale, // 6–11px base, * burst scale
        }
      }),
    )
  }, [bursts])

  return (
    <>
      {particles.map(p => (
        <motion.svg
          key={p.key}
          viewBox="0 0 24 24"
          width={p.size}
          height={p.size}
          fill={color}
          initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
          animate={{
            // Pixel distances now — keeps bursts inside the 88px banner.
            x: p.dx,
            y: p.dy,
            scale: [0, 1.2, 0.9, 0],
            opacity: [0, 0.95, 0.6, 0],
          }}
          transition={{
            duration: 1.5,
            delay: p.burst.delay,
            ease: 'easeOut',
            times: [0, 0.18, 0.55, 1],
          }}
          style={{
            position: 'absolute',
            left: `${p.burst.cx}%`,
            top: `${p.burst.cy}%`,
            transformOrigin: 'center',
            willChange: 'transform, opacity',
          }}
        >
          <path d={iconPath} />
        </motion.svg>
      ))}

      {/* 2026-05-23 per Dylan: removed the "Creator Outreach"
          easter-egg wordmark — it wasn't landing. Show now ends on
          the dead-center mega-burst (5.4s) and goes idle, no text
          reveal. Spotlight still clears at the normal 8.5s mark. */}
    </>
  )
}

// ── Tornado (one-shot two-pass funnel, NO easter egg) ───────────────

/**
 * Iconic tornado: WIDE funnel cloud at the top, taper down to a
 * narrow tail at the bottom. Sweeps the page L→R, pause, R→L, fade.
 * No easter-egg text — that's Fireworks-only.
 *
 * Timeline (~11.5s):
 *   0.0–4.5s   pass 1 (L→R)
 *   4.5–5.5s   pause at the right edge
 *   5.5–10.5s  pass 2 (R→L)
 *   10.5–11.5s fade out at the left
 *
 * Shape (per Dylan 2026-05-10 v3 — flipped from v2):
 *   • Top (5vh):  orbit radius ~110px → wide funnel cloud
 *   • Middle:     tapers steeply via power curve
 *   • Bottom (83vh): orbit radius ~10px → narrow tail
 *   • Density bias toward the top so the cloud has visual weight.
 *
 * Effects:
 *   • Rotating cloud blob at the top (radial gradient, scales)
 *   • TWO vertical wind-streak layers at different blurs for depth
 *   • Per-icon drop-shadow + 0.3px blur → motion smear / depth
 *   • Orbital sweep (cos + sin) → real circular motion, not wobble
 *   • Pulsing ground shadow ellipse + dust cloud
 *   • Debris streaming out + upward from the spine
 */
function TornadoShow({ color, iconPath }: { color: string; iconPath: string }) {
  // 2026-05-11 banner-only redesign: the original tornado spanned the
  // full viewport (88vh tall, 110px-wide funnel). It can't fit in an
  // 88px banner. Reimagined as a compact ~60px tall funnel that sweeps
  // horizontally across the banner width. Same two-pass timeline; same
  // visual language (swirl + cloud + streak); just sized for the strip.
  const icons = useMemo(() => {
    const N = 16
    return Array.from({ length: N }, (_, i) => {
      // Bias slightly toward top — funnel-cloud weight.
      const r = Math.random()
      const yT = r * r
      const y = 6 + yT * 56 // 6–62px vertically (within 88px banner)
      const taper = (y - 6) / 56 // 0=top, 1=bottom
      // Banner-scaled orbit radii: 4px (bottom tail) → 22px (top cloud).
      const orbitRadius = 4 + Math.pow(1 - taper, 1.3) * 18
      const yWobble = orbitRadius * 0.3
      // Tiny icons — banner scale.
      const size = 7 + (1 - taper) * 6 + Math.floor(Math.random() * 2) // 7–15px
      const period = 0.45 + taper * 0.4 + Math.random() * 0.2
      const phase = Math.random() * Math.PI * 2
      const op = 0.6 + (1 - taper) * 0.35
      return { key: i, y, orbitRadius, yWobble, size, period, phase, op }
    })
  }, [])

  return (
    <motion.div
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 0,
        height: '88px',
        willChange: 'transform, opacity',
      }}
      // Same two-pass timeline as before, just in a banner-sized canvas.
      animate={{
        x: ['-10vw', '-10vw', '110vw', '110vw', '-10vw', '-10vw'],
        opacity: [0, 1, 1, 1, 1, 0],
      }}
      transition={{
        duration: 11.5,
        times: [0, 0.04, 0.42, 0.50, 0.92, 1],
        ease: ['linear', 'easeInOut', 'linear', 'easeInOut', 'easeOut'],
      }}
    >
      {/* Funnel cloud — small rotating blob at the top. */}
      <motion.div
        animate={{ rotate: [0, 360], scale: [1, 1.08, 1] }}
        transition={{
          rotate: { duration: 2.4, repeat: Infinity, ease: 'linear' },
          scale: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
        }}
        style={{
          position: 'absolute',
          left: '-26px',
          top: '0px',
          width: '52px',
          height: '18px',
          background: `radial-gradient(ellipse at 50% 70%, ${color}55 0%, ${color}28 35%, ${color}12 60%, transparent 85%)`,
          filter: 'blur(5px)',
          transformOrigin: 'center 80%',
          willChange: 'transform',
          pointerEvents: 'none',
        }}
      />

      {/* Tight inner streak — sharp line down the spine. */}
      <motion.div
        animate={{ opacity: [0.25, 0.45, 0.28, 0.42, 0.25] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          left: '-2px',
          top: '10px',
          width: '4px',
          height: '60px',
          background: `linear-gradient(to bottom, transparent 0%, ${color} 30%, ${color} 70%, transparent 100%)`,
          filter: 'blur(3px)',
          willChange: 'opacity',
          pointerEvents: 'none',
        }}
      />

      {/* Ground shadow — small ellipse at the base. */}
      <motion.div
        animate={{ scaleX: [1, 1.22, 0.88, 1.22, 1] }}
        transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          left: '-22px',
          top: '70px',
          width: '44px',
          height: '8px',
          background: `radial-gradient(ellipse at center, ${color}66 0%, ${color}30 40%, transparent 75%)`,
          filter: 'blur(3px)',
          transformOrigin: 'center',
          willChange: 'transform',
          pointerEvents: 'none',
        }}
      />

      {/* Core swirl — 16 icons orbiting the spine. */}
      {icons.map(ic => {
        const sx = Math.cos(ic.phase) * ic.orbitRadius
        const sy = Math.sin(ic.phase) * ic.yWobble
        return (
          <motion.svg
            key={ic.key}
            viewBox="0 0 24 24"
            width={ic.size}
            height={ic.size}
            fill={color}
            animate={{
              x: [sx, ic.orbitRadius, -sx, -ic.orbitRadius, sx],
              y: [sy, ic.yWobble, -sy, -ic.yWobble, sy],
              rotate: [0, 360],
            }}
            transition={{
              duration: ic.period,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{
              position: 'absolute',
              left: 0,
              top: `${ic.y}px`,
              opacity: ic.op,
              transformOrigin: 'center',
              filter: `drop-shadow(0 1px 3px ${color}aa) blur(0.3px)`,
              willChange: 'transform, opacity',
            }}
          >
            <path d={iconPath} />
          </motion.svg>
        )
      })}
    </motion.div>
  )
}
