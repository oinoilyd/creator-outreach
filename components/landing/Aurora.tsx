'use client'

import { motion } from 'motion/react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

/**
 * Lava-lamp atmospheric orbs behind the entire page. Six blurred
 * blobs in the violet → indigo → cyan family, each on its own
 * movement orbit (non-mirrored x/y keyframes, different durations
 * and delays, independent scale "breathing" cycle).
 *
 * Theme-aware: dark mode keeps the saturated brand colors at high
 * opacity; light mode swaps to the same hues at lower opacity so
 * the orbs read as a soft pastel wash instead of harsh punches on
 * the near-white background.
 *
 * Performance:
 *   - All animation runs on transform + opacity (GPU accelerated).
 *   - willChange + fixed-size container = no layout cost on scroll.
 *   - Heavy blur (140px) lives on a transformed element so the
 *     compositor batches rather than re-rasterizing per frame.
 *   - prefers-reduced-motion respected via the global CSS rule.
 */
export function Aurora({ className = '' }: { className?: string }) {
  const { resolvedTheme } = useTheme()
  // SSR safety: useTheme returns undefined on first render. Default
  // to dark-mode colors until mounted to avoid hydration flash.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isLight = mounted && resolvedTheme === 'light'

  // Movement profiles are theme-agnostic — only colors swap. Per
  // Dylan: "speed the movement of the lava feel even more." Cycles
  // dropped 12-18s → 7-11s for that extra punch. Amplitude unchanged
  // (already ~2x what we started with).
  type OrbColors = { violet: string; cyan: string; indigo: string; vBright: string; cBright: string; vDim: string }
  const c: OrbColors = isLight
    ? {
        // Light mode: same hues at lower opacity. The bg is near-white
        // (oklch 0.97); 0.18-0.28 opacity reads as soft pastel washes
        // without the harsh dark-mode opacities punching through.
        violet:  'rgba(124, 58, 237, 0.22)',
        cyan:    'rgba(6, 182, 212, 0.18)',
        indigo:  'rgba(99, 102, 241, 0.20)',
        vBright: 'rgba(168, 85, 247, 0.18)',
        cBright: 'rgba(34, 211, 238, 0.16)',
        vDim:    'rgba(124, 58, 237, 0.16)',
      }
    : {
        // Dark mode: brand-saturated, register through section
        // backdrop-blurs that occlude content areas.
        violet:  'rgba(124, 58, 237, 0.42)',
        cyan:    'rgba(6, 182, 212, 0.34)',
        indigo:  'rgba(99, 102, 241, 0.36)',
        vBright: 'rgba(168, 85, 247, 0.32)',
        cBright: 'rgba(34, 211, 238, 0.30)',
        vDim:    'rgba(124, 58, 237, 0.28)',
      }

  const orbs = [
    {
      size: 760, color: c.violet, top: '-20%', left: '-10%',
      x: [0, 160, -100, 60, 0],
      y: [0, -120, 80, -40, 0],
      scale: [1, 1.20, 0.88, 1.10, 1],
      duration: 9, delay: 0,
    },
    {
      size: 680, color: c.cyan, top: '12%', right: '-15%',
      x: [0, -140, 90, -50, 0],
      y: [0, 100, -70, 50, 0],
      scale: [1, 0.90, 1.18, 0.96, 1],
      duration: 11, delay: 2,
    },
    {
      size: 600, color: c.indigo, bottom: '-25%', left: '22%',
      x: [0, 110, -130, 40, 0],
      y: [0, -90, 60, -30, 0],
      scale: [1, 1.14, 0.92, 1.06, 1],
      duration: 10, delay: 4,
    },
    {
      size: 520, color: c.vBright, top: '38%', left: '46%',
      x: [0, -80, 120, -60, 0],
      y: [0, 70, -100, 40, 0],
      scale: [1, 1.08, 0.94, 1.16, 1],
      duration: 11, delay: 1,
    },
    {
      size: 460, color: c.cBright, bottom: '12%', right: '6%',
      x: [0, 100, -60, 80, 0],
      y: [0, -50, 90, -20, 0],
      scale: [1, 0.94, 1.12, 0.90, 1],
      duration: 8, delay: 3,
    },
    {
      // Extra wandering orb in the lower-left for variety on long pages.
      size: 540, color: c.vDim, bottom: '-15%', left: '-8%',
      x: [0, 90, -70, 50, 0],
      y: [0, -100, 70, -40, 0],
      scale: [1, 1.10, 0.96, 1.04, 1],
      duration: 9, delay: 5,
    },
  ]

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden>
      {orbs.map((o, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{
            opacity: 1,
            x: o.x,
            y: o.y,
            scale: o.scale,
          }}
          transition={{
            opacity: { duration: 1.5 },
            x: { duration: o.duration, repeat: Infinity, ease: [0.45, 0.05, 0.55, 0.95], delay: o.delay },
            y: { duration: o.duration, repeat: Infinity, ease: [0.45, 0.05, 0.55, 0.95], delay: o.delay },
            scale: { duration: o.duration * 0.7, repeat: Infinity, ease: 'easeInOut', delay: o.delay },
          }}
          style={{
            position: 'absolute',
            width: o.size,
            height: o.size,
            top: 'top' in o ? o.top : undefined,
            left: 'left' in o ? o.left : undefined,
            right: 'right' in o ? o.right : undefined,
            bottom: 'bottom' in o ? o.bottom : undefined,
            background: o.color,
            // Bigger blur than before (120 → 140) — heavier blob
            // softness keeps the high-graphics lava-lamp impression
            // even with 5 elements simultaneously moving.
            filter: 'blur(140px)',
            borderRadius: '50%',
            // Promote to its own compositor layer for smooth GPU
            // transforms; otherwise the browser would re-rasterize
            // the giant blurred surface every frame on movement.
            willChange: 'transform, opacity',
          }}
        />
      ))}
      {/* Subtle grid texture so the orbs have something to land against. */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
    </div>
  )
}
