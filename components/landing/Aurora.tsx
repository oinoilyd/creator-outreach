'use client'

import { motion } from 'motion/react'

/**
 * Lava-lamp atmospheric orbs behind the hero. Replaces the previous
 * Aurora + Spotlight pair — Dylan's note: "spotlight follows the
 * cursor it is laggy and chunky, let's just have the same colors do
 * a lava lamp type effect."
 *
 * Five blurred blobs in the violet→indigo→cyan family, each on its
 * own movement orbit (different x/y curves, different durations,
 * different delays, different scale "breathing" cycles). The
 * combined motion gives the slow molten-blob feel without the
 * cursor-coupled jitter.
 *
 * Performance:
 *   - All animation runs on transform + opacity only (GPU
 *     accelerated, never animate width/height/top/left).
 *   - The container is fixed-size pointer-events-none, so no
 *     layout cost on scroll.
 *   - Heavy blur (140px) lives on a transformed element, which the
 *     compositor batches; doesn't re-rasterize per frame.
 *   - prefers-reduced-motion respects via the existing CSS rule.
 */
export function Aurora({ className = '' }: { className?: string }) {
  // Each orb has its own organic movement profile. The x/y arrays
  // are intentionally NOT mirrored — staggered keyframes prevent
  // the orbs from looking like a synchronized dance.
  const orbs = [
    {
      size: 720, color: 'rgba(124, 58, 237, 0.32)', // violet
      top: '-22%', left: '-12%',
      x: [0, 80, -50, 30, 0],
      y: [0, -60, 40, -20, 0],
      scale: [1, 1.15, 0.92, 1.08, 1],
      duration: 22, delay: 0,
    },
    {
      size: 640, color: 'rgba(6, 182, 212, 0.22)', // cyan
      top: '8%', right: '-15%',
      x: [0, -70, 45, -25, 0],
      y: [0, 50, -35, 25, 0],
      scale: [1, 0.94, 1.12, 0.98, 1],
      duration: 27, delay: 4,
    },
    {
      size: 560, color: 'rgba(99, 102, 241, 0.24)', // indigo
      bottom: '-28%', left: '20%',
      x: [0, 55, -65, 20, 0],
      y: [0, -45, 30, -15, 0],
      scale: [1, 1.10, 0.96, 1.04, 1],
      duration: 31, delay: 8,
    },
    {
      size: 480, color: 'rgba(168, 85, 247, 0.20)', // brighter violet
      top: '40%', left: '45%',
      x: [0, -40, 60, -30, 0],
      y: [0, 35, -50, 20, 0],
      scale: [1, 1.06, 0.98, 1.12, 1],
      duration: 35, delay: 2,
    },
    {
      size: 420, color: 'rgba(34, 211, 238, 0.18)', // brighter cyan
      bottom: '15%', right: '8%',
      x: [0, 50, -30, 40, 0],
      y: [0, -25, 45, -10, 0],
      scale: [1, 0.96, 1.08, 0.94, 1],
      duration: 29, delay: 6,
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
