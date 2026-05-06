'use client'

import { motion, useInView, useMotionValue, useSpring } from 'motion/react'
import { useEffect, useRef } from 'react'

// Animated count-up. Used on stat cards. Tweens from 0 → value over ~800ms
// once the element enters the viewport. Plays once.
export function NumberTicker({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
}: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(0)
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 100 })
  const inView = useInView(ref, { once: true, margin: '0px' })

  useEffect(() => {
    if (inView) motionValue.set(value)
  }, [inView, motionValue, value])

  useEffect(() => {
    return springValue.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = prefix + Number(latest.toFixed(decimals)).toLocaleString() + suffix
      }
    })
  }, [springValue, prefix, suffix, decimals])

  return <motion.span ref={ref} className={className}>{prefix}0{suffix}</motion.span>
}
