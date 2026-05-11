'use client'

/**
 * PlatformBackdrop — animated theme layer (Rain / Drift / Fireworks).
 *
 * 2026-05-10 v5 per Dylan:
 *   • Fireworks is now spotlight-only — a phased ONE-SHOT 15-second
 *     show that auto-triggers when the user picks the theme. Phases:
 *       0–9s   scattered bursts at random points
 *       9–12s  ramp-up — bursts come faster and bigger
 *       12–15s GRAND FINALE — simultaneous mega-bursts ending with
 *              a "Creator Outreach" text easter-egg pop-up.
 *     If theme === 'fireworks' but spotlight is off, the whole layer
 *     returns null (no continuous loop). Re-trigger via the spotlight
 *     button or by re-selecting Fireworks.
 *
 * Earlier (v4):
 *   • Re-key INNER layer on platform change so icons restart with the
 *     new color/shape (dark-mode reads needed the fresh wave).
 *   • Icon counts boosted (rain 22→36, drift 12→20).
 *   • New `spotlight` prop. Renders the layer at high opacity ABOVE
 *     all content for 15 seconds, then parent flips back. Pointer
 *     events stay none so the spotlight doesn't block clicks.
 */

import { useMemo } from 'react'
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
  /** When true: render IN FRONT of content (z-index 50) at full
   *  saturation. Parent times the 15s window and flips back. */
  spotlight?: boolean
}

// Opacity multipliers — spotlight cranks every icon's visibility
// way up so the effect reads at 'full color' as Dylan requested.
const SPOTLIGHT_OPACITY_MULT = 6
const SPOTLIGHT_SCALE = 1.15

export function PlatformBackdrop({ theme, platform, visible = true, spotlight = false }: Props) {
  if (theme === 'off') return null
  // Fireworks is a one-shot 15s show — only renders during spotlight.
  // When spotlight ends (parent clears it after 15s), the layer
  // returns null. Re-pick Fireworks or hit the spotlight button to
  // replay. Keeps idle CPU at zero between shows.
  if (theme === 'fireworks' && !spotlight) return null
  const hue = PLATFORM_HUES[platform]
  const iconPath = PLATFORM_ICON_PATH[platform]

  return (
    <div
      key={theme}
      aria-hidden
      className="fixed inset-0 pointer-events-none overflow-hidden transition-opacity ease-out"
      style={{
        // Spotlight pushes the layer above content (z-50). Otherwise
        // stays at z-0 in the background.
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
        {theme === 'rain' && <RainLayer color={hue.color} iconPath={iconPath} spotlight={spotlight} />}
        {theme === 'drift' && <DriftLayer color={hue.color} iconPath={iconPath} spotlight={spotlight} />}
        {theme === 'fireworks' && <FireworksShow color={hue.color} iconPath={iconPath} />}
      </div>
    </div>
  )
}

// ── Rain ─────────────────────────────────────────────────────────────

function RainLayer({ color, iconPath, spotlight }: { color: string; iconPath: string; spotlight: boolean }) {
  const drops = useMemo(() => {
    const N = 36 // bumped from 22 — denser feel per Dylan
    return Array.from({ length: N }, (_, i) => ({
      key: i,
      left: Math.random() * 100,
      size: 14 + Math.floor(Math.random() * 18),
      delay: Math.random() * 14,
      duration: 11 + Math.random() * 16,
      opacity: 0.05 + Math.random() * 0.07,
    }))
  }, [])

  return (
    <>
      {drops.map(d => {
        const op = Math.min(1, d.opacity * (spotlight ? SPOTLIGHT_OPACITY_MULT : 1))
        const size = d.size * (spotlight ? SPOTLIGHT_SCALE : 1)
        return (
          <motion.svg
            key={d.key}
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill={color}
            initial={{ y: '-15vh', opacity: 0 }}
            animate={{ y: '115vh', opacity: [0, op, op, 0] }}
            transition={{
              duration: d.duration,
              delay: d.delay,
              repeat: Infinity,
              ease: 'linear',
              times: [0, 0.1, 0.9, 1],
            }}
            style={{ position: 'absolute', left: `${d.left}%`, willChange: 'transform, opacity' }}
          >
            <path d={iconPath} />
          </motion.svg>
        )
      })}
    </>
  )
}

// ── Drift ────────────────────────────────────────────────────────────

function DriftLayer({ color, iconPath, spotlight }: { color: string; iconPath: string; spotlight: boolean }) {
  const bubbles = useMemo(() => {
    const N = 20 // bumped from 12 — denser feel
    return Array.from({ length: N }, (_, i) => ({
      key: i,
      left: Math.random() * 100,
      size: 24 + Math.floor(Math.random() * 22),
      delay: Math.random() * 22,
      duration: 22 + Math.random() * 18,
      sway: 30 + Math.random() * 50,
      opacity: 0.04 + Math.random() * 0.06,
    }))
  }, [])

  return (
    <>
      {bubbles.map(b => {
        const op = Math.min(1, b.opacity * (spotlight ? SPOTLIGHT_OPACITY_MULT : 1))
        const size = b.size * (spotlight ? SPOTLIGHT_SCALE : 1)
        return (
          <motion.svg
            key={b.key}
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill={color}
            initial={{ y: '115vh', x: 0, opacity: 0 }}
            animate={{
              y: '-15vh',
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
            style={{ position: 'absolute', left: `${b.left}%`, willChange: 'transform, opacity' }}
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
 *   Easter egg (13–15s): "Creator Outreach" text drops in, peaks at
 *                    ~14s with platform-color glow, fades by 15s.
 *
 * No `repeat: Infinity` — every motion element plays exactly once,
 * so the layer goes idle after 15s. Parent clears spotlight at that
 * point and the whole layer returns null (gate at top of component).
 */
function FireworksShow({ color, iconPath }: { color: string; iconPath: string }) {
  const bursts = useMemo(
    () => [
      // Act 1 — scattered (0–9s)
      { id: 's1', cx: 25, cy: 30, delay: 0.4, scale: 1.0 },
      { id: 's2', cx: 70, cy: 45, delay: 1.9, scale: 1.0 },
      { id: 's3', cx: 45, cy: 22, delay: 3.4, scale: 1.0 },
      { id: 's4', cx: 80, cy: 60, delay: 5.0, scale: 1.0 },
      { id: 's5', cx: 20, cy: 65, delay: 6.6, scale: 1.0 },
      { id: 's6', cx: 55, cy: 50, delay: 8.0, scale: 1.05 },
      // Act 2 — ramp (9–12s)
      { id: 'r1', cx: 35, cy: 35, delay: 9.2,  scale: 1.15 },
      { id: 'r2', cx: 65, cy: 38, delay: 9.9,  scale: 1.15 },
      { id: 'r3', cx: 50, cy: 60, delay: 10.6, scale: 1.2  },
      { id: 'r4', cx: 28, cy: 50, delay: 11.3, scale: 1.2  },
      // Act 3 — grand finale (12–14s) — overlapping mega-bursts
      { id: 'f1', cx: 25, cy: 40, delay: 12.5, scale: 1.5  },
      { id: 'f2', cx: 75, cy: 40, delay: 12.6, scale: 1.5  },
      { id: 'f3', cx: 35, cy: 70, delay: 12.8, scale: 1.45 },
      { id: 'f4', cx: 65, cy: 70, delay: 12.9, scale: 1.45 },
      { id: 'f5', cx: 50, cy: 22, delay: 13.1, scale: 1.5  },
      { id: 'f6', cx: 50, cy: 50, delay: 13.4, scale: 1.85 }, // dead-center capper
    ],
    [],
  )

  const particles = useMemo(() => {
    return bursts.flatMap(burst =>
      Array.from({ length: 12 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.35
        const distance = 14 + Math.random() * 18
        return {
          key: `${burst.id}-${i}`,
          burst,
          dx: Math.cos(angle) * distance * burst.scale,
          dy: Math.sin(angle) * distance * burst.scale,
          size: (16 + Math.floor(Math.random() * 10)) * burst.scale,
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
            x: `${p.dx}vmin`,
            y: `${p.dy}vmin`,
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

      {/* Easter-egg text — drops in during the finale, peaks at ~14s,
          fades out by 15s. x/y translate stays at -50% throughout so
          framer's `scale` keyframes don't clobber the centering. */}
      <motion.div
        initial={{ x: '-50%', y: '-50%', scale: 0.3, opacity: 0 }}
        animate={{
          x: '-50%',
          y: '-50%',
          scale: [0.3, 1.18, 1.0, 1.0, 0.96],
          opacity: [0, 1, 1, 1, 0],
        }}
        transition={{
          duration: 2.0,
          delay: 13.0,
          ease: [0.16, 1, 0.3, 1],
          times: [0, 0.22, 0.42, 0.85, 1],
        }}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          willChange: 'transform, opacity',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontSize: 'clamp(2.5rem, 7vw, 5.5rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color,
            textShadow: `0 0 24px ${color}, 0 0 56px ${color}, 0 0 96px ${color}`,
            whiteSpace: 'nowrap',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          Creator Outreach
        </div>
      </motion.div>
    </>
  )
}
