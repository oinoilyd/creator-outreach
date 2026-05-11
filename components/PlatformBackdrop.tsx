'use client'

/**
 * PlatformBackdrop — full-viewport animated background driven by the
 * user's selected backdrop theme + the currently-active platform.
 *
 * Renders as a fixed, pointer-events-none layer BEHIND every app
 * surface (z-index: 0; chrome lives at z-30+). Transform + opacity
 * only — no layout reflow, GPU-composited animations. Caps element
 * counts so the heaviest theme (rain) stays at ~24 elements and
 * 60fps even on modest hardware.
 *
 * Re-rendering: keyed by `theme:platform` so changing either
 * remounts the underlying motion divs cleanly and the new animation
 * starts from frame 0 rather than mid-cycle.
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
  /** 2026-05-10 — controls a smooth opacity fade. Layer stays
   *  mounted (animations keep running) so toggling back on snaps
   *  to full speed instantly. Defaults true for backwards-compat. */
  visible?: boolean
}

export function PlatformBackdrop({ theme, platform, visible = true }: Props) {
  if (theme === 'off') return null
  const hue = PLATFORM_HUES[platform]
  const iconPath = PLATFORM_ICON_PATH[platform]

  return (
    <div
      key={`${theme}:${platform}`}
      aria-hidden
      className="fixed inset-0 pointer-events-none overflow-hidden transition-opacity ease-out"
      style={{
        zIndex: 0,
        opacity: visible ? 1 : 0,
        // Slow fade-out reads as deliberate; faster fade-in feels
        // responsive when the user just changed themes.
        transitionDuration: visible ? '300ms' : '1500ms',
      }}
    >
      {theme === 'rain' && <RainLayer color={hue.color} iconPath={iconPath} />}
      {theme === 'drift' && <DriftLayer color={hue.color} iconPath={iconPath} />}
      {theme === 'pulse' && <PulseLayer glow={hue.glow} glowStrong={hue.glowStrong} />}
      {theme === 'aura' && <AuraLayer glow={hue.glow} glowStrong={hue.glowStrong} />}
    </div>
  )
}

// ── Rain ─────────────────────────────────────────────────────────────
// N icons fall from above the viewport to below, randomized x, varied
// duration + delay so the field never looks rhythmic.

function RainLayer({ color, iconPath }: { color: string; iconPath: string }) {
  // useMemo so randomization is stable across re-renders (re-randomized
  // only when the platform changes — the key on the parent triggers
  // a remount, which builds a fresh array).
  const drops = useMemo(() => {
    const N = 22
    return Array.from({ length: N }, (_, i) => ({
      key: i,
      left: Math.random() * 100, // %
      size: 14 + Math.floor(Math.random() * 18), // 14-32 px
      delay: Math.random() * 12, // seconds — staggers entry
      duration: 12 + Math.random() * 16, // 12-28s top→bottom
      opacity: 0.05 + Math.random() * 0.07, // 5-12% so it stays atmospheric
    }))
  }, [iconPath])

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
// Larger, fewer icons floating UPWARD slowly — bubble-like. Each has
// a tiny horizontal sway so they don't read as a rigid column.

function DriftLayer({ color, iconPath }: { color: string; iconPath: string }) {
  const bubbles = useMemo(() => {
    const N = 12
    return Array.from({ length: N }, (_, i) => ({
      key: i,
      left: Math.random() * 100,
      size: 24 + Math.floor(Math.random() * 22),
      delay: Math.random() * 22,
      duration: 22 + Math.random() * 18,
      sway: 30 + Math.random() * 50, // px horizontal wobble
      opacity: 0.04 + Math.random() * 0.06,
    }))
  }, [iconPath])

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

// ── Pulse ────────────────────────────────────────────────────────────
// Two layered radial gradients in the brand color — anchored to
// top-center and bottom-right, breathing out of sync so the room
// feels alive but never thumping.

function PulseLayer({ glow, glowStrong }: { glow: string; glowStrong: string }) {
  return (
    <>
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          background: `radial-gradient(circle 60vw at 50% -10%, ${glowStrong}, ${glow} 40%, transparent 70%)`,
          willChange: 'opacity',
        }}
      />
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: [0.4, 0.9, 0.4] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 2.5 }}
        style={{
          background: `radial-gradient(circle 50vw at 85% 95%, ${glow}, transparent 60%)`,
          willChange: 'opacity',
        }}
      />
    </>
  )
}

// ── Aura ─────────────────────────────────────────────────────────────
// Conic gradient sweep — feels like a slow rotating spotlight in the
// brand color. Single layer, full screen, very low opacity.

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
