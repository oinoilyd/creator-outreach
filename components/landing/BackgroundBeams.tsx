'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'

// Animated diagonal beams behind the hero. Pure SVG, no images.
export function BackgroundBeams({ className = '' }: { className?: string }) {
  const paths = [
    'M-380 -189C-380 -189 -312 216 152 343C616 470 684 875 684 875',
    'M-373 -197C-373 -197 -305 208 159 335C623 462 691 867 691 867',
    'M-366 -205C-366 -205 -298 200 166 327C630 454 698 859 698 859',
    'M-359 -213C-359 -213 -291 192 173 319C637 446 705 851 705 851',
    'M-352 -221C-352 -221 -284 184 180 311C644 438 712 843 712 843',
    'M-345 -229C-345 -229 -277 176 187 303C651 430 719 835 719 835',
    'M-338 -237C-338 -237 -270 168 194 295C658 422 726 827 726 827',
    'M-331 -245C-331 -245 -263 160 201 287C665 414 733 819 733 819',
  ]

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden>
      <svg
        className="absolute inset-0 w-full h-full opacity-60"
        viewBox="0 0 696 316"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {paths.map((d, i) => (
          <motion.path
            key={i}
            d={d}
            stroke={`url(#beam-grad-${i})`}
            strokeOpacity="0.45"
            strokeWidth="0.6"
          />
        ))}
        <defs>
          {paths.map((_, i) => (
            <motion.linearGradient
              key={i}
              id={`beam-grad-${i}`}
              gradientUnits="userSpaceOnUse"
              initial={{ x1: '0%', x2: '0%', y1: '0%', y2: '0%' }}
              animate={{
                x1: ['0%', '100%'],
                x2: ['0%', '95%'],
                y1: ['0%', '100%'],
                y2: ['0%', '105%'],
              }}
              transition={{
                duration: Math.random() * 8 + 8,
                ease: 'easeInOut',
                repeat: Infinity,
                delay: Math.random() * 8,
              }}
            >
              <stop stopColor="#7c3aed" stopOpacity="0" />
              <stop offset="0.5" stopColor="#a855f7" />
              <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
            </motion.linearGradient>
          ))}
        </defs>
      </svg>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gray-950" />
    </div>
  )
}
