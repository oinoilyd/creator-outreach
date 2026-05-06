'use client'

import { motion } from 'motion/react'
import { useTheme } from 'next-themes'

// Large blurred gradient orbs that slowly drift behind the hero.
// Replaces the old BackgroundBeams which were too subtle to register.
// Tones down opacity in light mode so the blurred orbs read as a soft
// pastel wash instead of washed-out greys.
export function Aurora({ className = '' }: { className?: string }) {
  const { resolvedTheme } = useTheme()
  const isLight = resolvedTheme === 'light'
  const a = isLight
    ? { purple: 0.20, blue: 0.18, pink: 0.14 }
    : { purple: 0.45, blue: 0.35, pink: 0.28 }
  const orbs = [
    { size: 700, color: `rgba(168, 85, 247, ${a.purple})`, top: '-20%', left: '-10%', duration: 22, delay: 0 },
    { size: 600, color: `rgba(59, 130, 246, ${a.blue})`,   top: '10%',  right: '-15%', duration: 26, delay: 4 },
    { size: 500, color: `rgba(236, 72, 153, ${a.pink})`,   bottom: '-25%', left: '15%', duration: 30, delay: 8 },
  ]

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
            top: o.top,
            left: o.left,
            right: o.right,
            bottom: o.bottom,
            background: o.color,
            filter: 'blur(120px)',
            borderRadius: '50%',
          }}
        />
      ))}
      {/* Grid overlay for texture */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      {/* Soft fade to surface color at the bottom so the hero blends into the next section */}
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-white dark:to-gray-950" />
    </div>
  )
}
