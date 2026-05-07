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
  // Faster, more dramatic per Dylan: "lava lamp should move faster
  // and more visually appealing." Movement amplitude bumped (~2x),
  // durations dropped (was 22-35s, now 12-18s), opacity bumped from
  // 0.18-0.32 → 0.30-0.45 so the colors actually register through
  // the section backdrop-blurs that occlude content areas.
  const orbs = [
    {
      size: 760, color: 'rgba(124, 58, 237, 0.42)', // violet
      top: '-20%', left: '-10%',
      x: [0, 160, -100, 60, 0],
      y: [0, -120, 80, -40, 0],
      scale: [1, 1.20, 0.88, 1.10, 1],
      duration: 14, delay: 0,
    },
    {
      size: 680, color: 'rgba(6, 182, 212, 0.34)', // cyan
      top: '12%', right: '-15%',
      x: [0, -140, 90, -50, 0],
      y: [0, 100, -70, 50, 0],
      scale: [1, 0.90, 1.18, 0.96, 1],
      duration: 16, delay: 3,
    },
    {
      size: 600, color: 'rgba(99, 102, 241, 0.36)', // indigo
      bottom: '-25%', left: '22%',
      x: [0, 110, -130, 40, 0],
      y: [0, -90, 60, -30, 0],
      scale: [1, 1.14, 0.92, 1.06, 1],
      duration: 17, delay: 6,
    },
    {
      size: 520, color: 'rgba(168, 85, 247, 0.32)', // brighter violet
      top: '38%', left: '46%',
      x: [0, -80, 120, -60, 0],
      y: [0, 70, -100, 40, 0],
      scale: [1, 1.08, 0.94, 1.16, 1],
      duration: 18, delay: 1.5,
    },
    {
      size: 460, color: 'rgba(34, 211, 238, 0.30)', // brighter cyan
      bottom: '12%', right: '6%',
      x: [0, 100, -60, 80, 0],
      y: [0, -50, 90, -20, 0],
      scale: [1, 0.94, 1.12, 0.90, 1],
      duration: 13, delay: 4,
    },
    {
      // Extra wandering orb in the lower-left for variety on long pages.
      size: 540, color: 'rgba(124, 58, 237, 0.28)', // violet, dimmer
      bottom: '-15%', left: '-8%',
      x: [0, 90, -70, 50, 0],
      y: [0, -100, 70, -40, 0],
      scale: [1, 1.10, 0.96, 1.04, 1],
      duration: 15, delay: 7,
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
