'use client'

/**
 * PlatformShade — VERY subtle always-on color tint on the Results
 * tab, tied to the active platform.
 *
 * 2026-05-10 v3 per Dylan:
 *   • Opacity reduced ~3.5× (uses the new PLATFORM_HUES.shade @ 3%
 *     instead of the old glow @ 10%). 'WAY more subtle — just a
 *     tiny easter-egg tint, not distracting.'
 *   • Tab transitions no longer choppy. Old version used
 *     AnimatePresence mode="wait" which forced a hard cut while
 *     waiting for the exiting layer to unmount. Now the container
 *     stays mounted always; only opacity transitions.
 *   • Platform-to-platform crossfade uses two stacked layers
 *     (current + previous) with the previous one fading out over
 *     900ms while the current fades in. No mount/unmount flicker.
 */

import { useEffect, useRef, useState } from 'react'
import type { PlatformId } from '@/lib/types'
import { PLATFORM_HUES } from '@/lib/backdrop-themes'

interface Props {
  platform: PlatformId
  visible: boolean
}

function radials(platform: PlatformId): React.CSSProperties[] {
  const shade = PLATFORM_HUES[platform].shade
  return [
    { background: `radial-gradient(circle 70vw at 50% -10%, ${shade}, transparent 65%)` },
    { background: `radial-gradient(circle 55vw at 85% 95%, ${shade}, transparent 60%)` },
  ]
}

export function PlatformShade({ platform, visible }: Props) {
  // Track the previous platform for the crossfade overlay.
  const [prevPlatform, setPrevPlatform] = useState<PlatformId>(platform)
  const fadeRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (platform === prevPlatform) return
    // Schedule the previous-platform layer to be cleared after the
    // crossfade duration completes (matches the CSS 900ms below).
    if (fadeRef.current) clearTimeout(fadeRef.current)
    fadeRef.current = setTimeout(() => setPrevPlatform(platform), 900)
    return () => {
      if (fadeRef.current) clearTimeout(fadeRef.current)
    }
  }, [platform, prevPlatform])

  const currentGradients = radials(platform)
  const prevGradients = radials(prevPlatform)

  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none overflow-hidden transition-opacity duration-700 ease-out"
      style={{ zIndex: 0, opacity: visible ? 1 : 0 }}
    >
      {/* Current platform layer — fades in (already at full opacity
          since the container handles visibility). */}
      <div className="absolute inset-0 transition-opacity duration-900 ease-out" style={currentGradients[0]} />
      <div className="absolute inset-0 transition-opacity duration-900 ease-out" style={currentGradients[1]} />
      {/* Previous platform layer — fades out over 900ms when
          platform changes, then unmounts when prevPlatform catches
          up. Two stacked layers cross-fade smoothly because the
          gradients themselves can't CSS-interpolate. */}
      {prevPlatform !== platform && (
        <>
          <div className="absolute inset-0 animate-shade-fade-out" style={prevGradients[0]} />
          <div className="absolute inset-0 animate-shade-fade-out" style={prevGradients[1]} />
        </>
      )}
      {/* Inline keyframes — keeps the component self-contained
          without adding to globals.css. */}
      <style>{`
        @keyframes shade-fade-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        .animate-shade-fade-out {
          animation: shade-fade-out 900ms ease-out forwards;
        }
      `}</style>
    </div>
  )
}
