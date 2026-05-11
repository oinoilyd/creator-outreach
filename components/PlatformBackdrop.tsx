'use client'

/**
 * PlatformBackdrop — animated theme layer (Rain / Drift / Fireworks).
 *
 * 2026-05-10 v4 per Dylan:
 *   • Re-key the INNER layer on platform change so the icons clearly
 *     restart with new color/shape (was failing to read in dark mode
 *     because the old icons kept their old fill mid-animation; the
 *     re-key forces a fresh wave). The container still keyed on
 *     theme only so the fade-out → fade-in pattern reads as
 *     "platform swap" rather than "theme toggle."
 *   • Icon counts boosted across the board (rain 22→36, drift 12→20,
 *     fireworks 50→72) so the platform color change registers
 *     visibly and the animation has more presence overall.
 *   • New `spotlight` prop. When true, the layer renders at high
 *     opacity, ABOVE all content, for 15 seconds. After that the
 *     parent flips it back to false. Pointer-events stay none so
 *     the spotlight doesn't block clicks.
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
        {theme === 'fireworks' && <FireworksLayer color={hue.color} iconPath={iconPath} spotlight={spotlight} />}
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

// ── Fireworks ────────────────────────────────────────────────────────

function FireworksLayer({ color, iconPath, spotlight }: { color: string; iconPath: string; spotlight: boolean }) {
  // 6 burst centers (bumped from 5), 12 particles each = 72 motion
  // divs total. Still GPU-comp friendly, just denser.
  const bursts = useMemo(() => {
    return Array.from({ length: 6 }, (_, b) => ({
      cx: 12 + Math.random() * 76,
      cy: 12 + Math.random() * 76,
      delay: b * 0.7 + Math.random() * 0.5,
      cycle: 3.5 + Math.random() * 2.5,
    }))
  }, [])

  const particles = useMemo(() => {
    return bursts.flatMap((burst, bi) =>
      Array.from({ length: 12 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.35
        const distance = 14 + Math.random() * 18
        return {
          key: `${bi}-${i}`,
          burst,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          size: 16 + Math.floor(Math.random() * 10),
        }
      }),
    )
  }, [bursts])

  return (
    <>
      {particles.map(p => {
        const op = spotlight ? 0.95 : 0.45 // spotlight near-opaque
        const op2 = spotlight ? 0.6 : 0.25
        const size = p.size * (spotlight ? SPOTLIGHT_SCALE : 1)
        return (
          <motion.svg
            key={p.key}
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill={color}
            initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
            animate={{
              x: `${p.dx}vmin`,
              y: `${p.dy}vmin`,
              scale: [0, 1.15, 0.85, 0],
              opacity: [0, op, op2, 0],
            }}
            transition={{
              duration: 1.5,
              delay: p.burst.delay,
              repeat: Infinity,
              repeatDelay: p.burst.cycle - 1.5,
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
        )
      })}
    </>
  )
}
