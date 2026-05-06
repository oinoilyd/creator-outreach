'use client'

// Animated gradient beam that travels along the border of a card.
// Use as a child of a `relative` parent: <BorderBeam />.
// Inspired by Magic UI's BorderBeam.
export function BorderBeam({
  size = 200,
  duration = 8,
  delay = 0,
  colorFrom = '#a855f7',
  colorTo = '#3b82f6',
}: {
  size?: number
  duration?: number
  delay?: number
  colorFrom?: string
  colorTo?: string
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit] [border:1px_solid_transparent] ![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(white,white)]"
      style={{
        '--size': `${size}px`,
        '--duration': `${duration}s`,
        '--delay': `-${delay}s`,
        '--color-from': colorFrom,
        '--color-to': colorTo,
      } as React.CSSProperties}
    >
      <span
        className="absolute aspect-square animate-[border-beam_var(--duration)_infinite_linear] [animation-delay:var(--delay)] [background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)] [offset-anchor:90%_50%] [offset-distance:0%] [offset-path:rect(0_auto_auto_0_round_var(--size))] w-[var(--size)]"
      />
    </div>
  )
}
