'use client'

import { motion } from 'motion/react'

/**
 * Atmospheric gradient orbs behind the hero. Two-color palette only —
 * violet primary + cyan secondary — to match the new design tokens.
 * No theme conditional needed: both modes are dark-spectrum, so the
 * same orb opacities work in both.
 *
 * Orbs use heavy blur (120px) so they read as soft washes of color,
 * not hard shapes. Slow drift via Framer Motion (22-30s loops).
 */
export function Aurora({ className = '' }: { className?: string }) {
  /*
    Per taste-skill "Lila Ban": tone the violet/cyan saturation way
    down (was 0.55 / 0.42 / 0.40 → now 0.30 / 0.20 / 0.22) so the
    orbs read as subtle atmosphere not as the brand identity. Brand
    is carried by typography + CTA + accent-word gradient instead.
  */
  const orbs = [
    { size: 720, color: 'rgba(124, 58, 237, 0.30)', top: '-22%', left: '-12%', duration: 22, delay: 0 },
    { size: 620, color: 'rgba(6, 182, 212, 0.20)',  top: '8%',   right: '-15%', duration: 26, delay: 4 },
    { size: 540, color: 'rgba(99, 102, 241, 0.22)', bottom: '-28%', left: '20%', duration: 30, delay: 8 },
  ] as const

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden>
      {orbs.map((o, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            x: [0, 60, -40, 0],
            y: [0, -40, 30, 0],
          }}
          transition={{
            opacity: { duration: 1.5 },
            x: { duration: o.duration, repeat: Infinity, ease: 'easeInOut', delay: o.delay },
            y: { duration: o.duration, repeat: Infinity, ease: 'easeInOut', delay: o.delay },
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
            filter: 'blur(120px)',
            borderRadius: '50%',
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
