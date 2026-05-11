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
      {theme === 'aura' && <AuraLayer glow={hue.glow} glowStrong={hue.glowStrong} />}
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

// ── Aura ─────────────────────────────────────────────────────────────

function AuraLayer({ glow, glowStrong }: { glow: string; glowStrong: string }) {
  return (
    <motion.div
      className="absolute inset-0"
      animate={{ rotate: [0, 360] }}
      transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
      style={{
        background: `conic-gradient(from 0deg at 50% 50%, transparent 0deg, ${glow} 60deg, ${glowStrong} 120deg, ${glow} 180deg, transparent 240deg, transparent 360deg)`,
        willChange: 'transform',
      }}
    />
  )
}
