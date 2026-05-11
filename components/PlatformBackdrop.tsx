'use client'

/**
 * PlatformBackdrop — animated theme layer (Rain / Drift / Aura).
 *
 * 2026-05-10 v3:
 *   • Dropped 'pulse' — the static color tint that pulse produced
 *     graduated into the always-on PlatformShade layer.
 *   • Key on THEME only (not theme:platform). Changing the platform
 *     no longer remounts the layer — the existing icons stay
 *     mid-animation and just adopt the new color + shape. No more
 *     "stops" when the user switches platforms.
 *   • Icon position memo decoupled from iconPath. Positions are
 *     keyed on theme alone, so randomization stays stable across
 *     platform swaps. Color + path are live props.
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
}

export function PlatformBackdrop({ theme, platform, visible = true }: Props) {
  if (theme === 'off') return null
  const hue = PLATFORM_HUES[platform]
  const iconPath = PLATFORM_ICON_PATH[platform]

  return (
    <div
      // Key on THEME only — platform changes update color/path via
      // props, NOT a remount. That keeps existing icons mid-animation
      // and avoids the "stops and restarts" feel when switching
      // platforms.
      key={theme}
      aria-hidden
      className="fixed inset-0 pointer-events-none overflow-hidden transition-opacity ease-out"
      style={{
        zIndex: 0,
        opacity: visible ? 1 : 0,
        transitionDuration: visible ? '300ms' : '1500ms',
      }}
    >
      {theme === 'rain' && <RainLayer color={hue.color} iconPath={iconPath} />}
      {theme === 'drift' && <DriftLayer color={hue.color} iconPath={iconPath} />}
      {theme === 'fireworks' && <FireworksLayer color={hue.color} iconPath={iconPath} />}
    </div>
  )
}

// ── Rain ─────────────────────────────────────────────────────────────
// N icons fall from above viewport to below. Positions memoized on
// theme only (NOT iconPath) so swapping platforms keeps the same
// drops mid-flight — they just change color + shape live.

function RainLayer({ color, iconPath }: { color: string; iconPath: string }) {
  const drops = useMemo(() => {
    const N = 22
    return Array.from({ length: N }, (_, i) => ({
      key: i,
      left: Math.random() * 100,
      size: 14 + Math.floor(Math.random() * 18),
      delay: Math.random() * 12,
      duration: 12 + Math.random() * 16,
      opacity: 0.05 + Math.random() * 0.07,
    }))
    // Empty deps: regenerate ONLY on mount (which is once per theme
    // session). Platform changes don't re-randomize. The deliberate
    // disable on react-hooks/exhaustive-deps is the right call here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {drops.map(d => (
        <motion.svg
          key={d.key}
          viewBox="0 0 24 24"
          width={d.size}
          height={d.size}
          fill={color}
          initial={{ y: '-15vh', opacity: 0 }}
          animate={{ y: '115vh', opacity: [0, d.opacity, d.opacity, 0] }}
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
      ))}
    </>
  )
}

// ── Drift ────────────────────────────────────────────────────────────

function DriftLayer({ color, iconPath }: { color: string; iconPath: string }) {
  const bubbles = useMemo(() => {
    const N = 12
    return Array.from({ length: N }, (_, i) => ({
      key: i,
      left: Math.random() * 100,
      size: 24 + Math.floor(Math.random() * 22),
      delay: Math.random() * 22,
      duration: 22 + Math.random() * 18,
      sway: 30 + Math.random() * 50,
      opacity: 0.04 + Math.random() * 0.06,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {bubbles.map(b => (
        <motion.svg
          key={b.key}
          viewBox="0 0 24 24"
          width={b.size}
          height={b.size}
          fill={color}
          initial={{ y: '115vh', x: 0, opacity: 0 }}
          animate={{
            y: '-15vh',
            x: [0, b.sway / 2, -b.sway / 2, b.sway / 2, 0],
            opacity: [0, b.opacity, b.opacity, 0],
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
      ))}
    </>
  )
}

// ── Fireworks ────────────────────────────────────────────────────────
// 5 burst centers across the screen. Each burst spawns 10 platform
// icons that fan out radially, scaling up + fading. Each burst
// repeats on a 4-6s cycle, staggered so the screen always has at
// least one burst in flight. Bolder than rain/drift — meant for
// users who want a real moment when they switch platforms.

function FireworksLayer({ color, iconPath }: { color: string; iconPath: string }) {
  // Burst centers — random per session, stable across platform swaps
  // (positions don't re-randomize when the iconPath changes).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bursts = useMemo(() => {
    return Array.from({ length: 5 }, (_, b) => ({
      cx: 15 + Math.random() * 70, // 15-85% so bursts stay onscreen
      cy: 15 + Math.random() * 70,
      delay: b * 0.9 + Math.random() * 0.4, // stagger bursts ~1s apart
      cycle: 4 + Math.random() * 2.5, // 4-6.5s between bursts at this point
    }))
  }, [])

  // 10 particles per burst, fanning out at evenly-spaced angles
  // (with a touch of jitter so the pattern isn't a perfect snowflake).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const particles = useMemo(() => {
    return bursts.flatMap((burst, bi) =>
      Array.from({ length: 10 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.35
        const distance = 16 + Math.random() * 14 // 16-30vmin radius
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
            scale: [0, 1.15, 0.85, 0],
            opacity: [0, 0.45, 0.25, 0],
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
      ))}
    </>
  )
}
