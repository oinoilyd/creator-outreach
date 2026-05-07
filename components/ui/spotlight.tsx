'use client'

import { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

/**
 * Aceternity-style Spotlight — a soft cursor-tracking light that
 * follows the mouse over the parent container. Inspired by
 * ui.aceternity.com/components/spotlight.
 *
 * Wrap a section with `relative` and drop this inside.
 */
export function Spotlight({
  className,
  size = 600,
  color = 'rgba(168, 85, 247, 0.18)',
}: {
  className?: string
  size?: number
  color?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: -1000, y: -1000 })
  const [opacity, setOpacity] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const parent = el.parentElement
    if (!parent) return

    const handle = (e: MouseEvent) => {
      const rect = parent.getBoundingClientRect()
      setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
    const enter = () => setOpacity(1)
    const leave = () => setOpacity(0)

    parent.addEventListener('mousemove', handle)
    parent.addEventListener('mouseenter', enter)
    parent.addEventListener('mouseleave', leave)
    return () => {
      parent.removeEventListener('mousemove', handle)
      parent.removeEventListener('mouseenter', enter)
      parent.removeEventListener('mouseleave', leave)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 transition-opacity duration-300',
        className,
      )}
      style={{
        opacity,
        background: `radial-gradient(${size}px circle at ${pos.x}px ${pos.y}px, ${color}, transparent 60%)`,
      }}
    />
  )
}
