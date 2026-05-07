'use client'

import { AnimatePresence, motion, MotionProps } from 'motion/react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Magic UI WordRotate — fades through a list of words on a timer.
 * Used to make a static headline feel alive without resetting on
 * every render like TextGenerateEffect did.
 */
interface WordRotateProps {
  words: string[]
  duration?: number
  framerProps?: MotionProps
  className?: string
}

export function WordRotate({
  words,
  duration = 2500,
  framerProps = {
    initial: { opacity: 0, y: -50 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 50 },
    transition: { duration: 0.25, ease: 'easeOut' },
  },
  className,
}: WordRotateProps) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length)
    }, duration)
    return () => clearInterval(interval)
  }, [words, duration])

  return (
    <span className="overflow-hidden inline-flex">
      <AnimatePresence mode="wait">
        <motion.span key={words[index]} className={cn(className)} {...framerProps}>
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
