'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { animate, utils } from 'animejs'

/**
 * OperatorConsole — hero visual for the landing page.
 *
 * No more faux browser chrome. The screenshot is the visual; we
 * frame it with a rounded card border and let the actual app's
 * built-in tabs / search bar serve as the "chrome."
 *
 * Aspect ratio is locked to the source image's natural ratio
 * (2472 × 1182) so `object-cover` / `object-contain` never crops
 * the sides — the entire screenshot fits cleanly in the card.
 *
 * Anime.js overlays for live feel:
 *   - Floating LIVE pulse badge (top-right corner, on top of the
 *     screenshot)
 *   - Cursor blink positioned at the end of the search query
 *   - Sweep highlight passes over rows every 3.5s (active processing)
 *   - Queue counter chip ticks up linear over 60s
 *   - "+2 new replies" toast pops up periodically
 */

export function OperatorConsole() {
  const counterRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      if (counterRef.current) counterRef.current.textContent = '1,433'
      return
    }

    const livePulse = animate('.oc-live-dot', {
      scale: [1, 1.4, 1],
      opacity: [1, 0.55, 1],
      duration: 1500,
      loop: true,
      ease: 'inOut(2)',
    })
    const cursorBlink = animate('.oc-search-cursor', {
      opacity: [1, 0],
      duration: 500,
      loop: true,
      alternate: true,
    })

    const counterTarget = { v: 1433 }
    const counterAnim = animate(counterTarget, {
      v: 1433 + 250,
      duration: 60_000,
      ease: 'linear',
      modifier: utils.round(0),
      loop: true,
      onUpdate: () => {
        if (counterRef.current) {
          counterRef.current.textContent = Math.round(counterTarget.v).toLocaleString()
        }
      },
    })

    const sweep = animate('.oc-sweep', {
      translateY: ['0%', '700%'],
      opacity: [0, 0.6, 0],
      duration: 3500,
      delay: 1500,
      loop: true,
      ease: 'inOut(1)',
    })

    const toast = animate('.oc-toast', {
      opacity: [0, 1, 1, 0],
      translateY: [-8, 0, 0, -8],
      duration: 3000,
      delay: 2000,
      loop: true,
      loopDelay: 4000,
      ease: 'out(2)',
    })

    return () => {
      livePulse.pause()
      cursorBlink.pause()
      counterAnim.pause()
      sweep.pause()
      toast.pause()
    }
  }, [])

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-[#0F1733]/10 dark:border-white/10 bg-[#0E121C]"
      style={{
        // Match the actual screenshot's aspect ratio exactly so
        // object-cover / object-contain doesn't crop anything.
        aspectRatio: '2472 / 1182',
        boxShadow: '0 50px 100px -40px rgba(15,23,51,0.30), 0 25px 50px -20px rgba(232,93,47,0.15)',
      }}
      aria-label="Creator Outreach app — live results table for a 'day trader' search across five platforms, with fit scores, emails, and outreach links per row"
    >
      {/* The actual app screenshot — fills the entire card. */}
      <Image
        src="/screenshots/results.png"
        alt="Creator Outreach Results table"
        fill
        priority
        sizes="(min-width: 1280px) 760px, 100vw"
        className="object-contain"
      />

      {/* Live overlay layer */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Sweep highlight — passes over the row area, plus-lighter so
            it brightens what it crosses without obscuring text. */}
        <div className="absolute inset-x-0 top-[18%] bottom-0 overflow-hidden">
          <div
            className="oc-sweep absolute inset-x-0 h-12"
            style={{
              top: 0,
              background: 'linear-gradient(180deg, transparent, rgba(232, 93, 47, 0.16), transparent)',
              mixBlendMode: 'plus-lighter',
            }}
          />
        </div>

        {/* Cursor blink at the end of "day trader" in the search bar.
            Coordinates expressed as % of the overall image so they
            stay aligned at any container size. */}
        <div
          className="oc-search-cursor absolute bg-white"
          style={{
            top: '5.2%',
            left: '14.6%',
            width: '1.5px',
            height: '2.6%',
          }}
        />

        {/* Floating LIVE badge — top-right corner of the screenshot
            (replaces the prior browser-chrome LIVE indicator). */}
        <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] uppercase tracking-[0.18em] font-bold">
          <span className="oc-live-dot inline-block w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
          Live
        </div>

        {/* Queue counter chip — top-right. */}
        <div className="absolute top-3 right-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 border border-white/10 text-white shadow-xl backdrop-blur-md">
          <span className="text-[9px] uppercase tracking-[0.18em] text-white/55 font-bold">Queue</span>
          <span ref={counterRef} className="text-[12px] font-bold tabular-nums">1,433</span>
        </div>

        {/* Periodic "+2 new replies" toast under the counter chip. */}
        <div
          className="oc-toast absolute right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/95 text-white shadow-xl"
          style={{ top: '52px', opacity: 0 }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-[0.12em]">+2 new replies</span>
        </div>
      </div>
    </div>
  )
}
