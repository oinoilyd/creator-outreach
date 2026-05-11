'use client'

/**
 * PlatformShade — always-on subtle brand-color tint on the Results
 * tab, tied to the currently-active platform.
 *
 * Born from Dylan's 2026-05-10 feedback: 'I LOVE the shaded color
 * the pulse theme does when you switch icons. Have that stay on by
 * default, never disappear, on the entire Results tab — tied to
 * the color of the social media.'
 *
 * Behavior:
 *   • Always visible on Results tab; hidden on Outreach / Dismissed
 *     so the action surfaces stay clean utility
 *   • Two layered radial gradients in the active platform color
 *     (top-center + bottom-right), STATIC — no breathing, no
 *     rotation, no shimmer. Just presence.
 *   • Re-keyed on platform so the color transition is a quick
 *     opacity crossfade (handled by the existing fade-out of the
 *     previous instance + fade-in of the new one)
 *   • Below all toggleable backdrop themes (rain / drift / aura)
 *     in z-order, so layered effects stack cleanly
 *
 * Performance: pure CSS gradient on a single div. Zero JS animation
 * cost. Forever-on is fine.
 */

import { motion, AnimatePresence } from 'motion/react'
import type { PlatformId } from '@/lib/types'
import { PLATFORM_HUES } from '@/lib/backdrop-themes'

interface Props {
  platform: PlatformId
  /** When true, render. When false (e.g. on Outreach / Dismissed
   *  tabs), don't. Visibility decision lives in the parent so this
   *  component stays dumb. */
  visible: boolean
}

export function PlatformShade({ platform, visible }: Props) {
  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key={platform}
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="fixed inset-0 pointer-events-none overflow-hidden"
          style={{ zIndex: 0 }}
        >
          {/* Two layered radials. Top-center carries the strong-tint
              glow; bottom-right is a soft secondary so the screen
              isn't symmetric. Both static — Dylan asked specifically
              for 'shade' not 'animation'. */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle 70vw at 50% -10%, ${PLATFORM_HUES[platform].glowStrong}, ${PLATFORM_HUES[platform].glow} 40%, transparent 70%)`,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle 55vw at 85% 95%, ${PLATFORM_HUES[platform].glow}, transparent 60%)`,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
