'use client'

import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

/**
 * Magic UI Meteors — shooting-star streaks that fall diagonally across
 * the parent container. Position the parent `relative overflow-hidden`
 * and drop this inside; meteors generate at random horizontal
 * positions on mount and animate a single diagonal sweep.
 */
interface MeteorsProps {
  number?: number
  className?: string
}

export function Meteors({ number = 20, className }: MeteorsProps) {
  const [styles, setStyles] = useState<React.CSSProperties[]>([])

  useEffect(() => {
    // Spread meteors across the parent's width, with random delay +
    // duration so the falling never feels in-sync.
    const out = Array.from({ length: number }).map(() => ({
      top: '-5%',
      left: `${Math.floor(Math.random() * 100)}%`,
      animationDelay: `${Math.random() * 1 + 0.2}s`,
      animationDuration: `${Math.floor(Math.random() * 8 + 2)}s`,
    }))
    setStyles(out)
  }, [number])

  return (
    <>
      {styles.map((style, idx) => (
        <span
          key={idx}
          className={cn(
            'pointer-events-none absolute size-0.5 rotate-[215deg] animate-meteor rounded-full bg-purple-500 shadow-[0_0_0_1px_#ffffff20]',
            "before:absolute before:top-1/2 before:h-[1px] before:w-[60px] before:-translate-y-[50%] before:transform before:bg-gradient-to-r before:from-purple-500 before:to-transparent before:content-['']",
            className,
          )}
          style={style}
          aria-hidden
        />
      ))}
    </>
  )
}
