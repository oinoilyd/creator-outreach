'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { animate } from 'animejs'

/**
 * OperatorConsole — hero visual for the landing page.
 *
 * No browser chrome bar — the screenshot is the visual; the app's
 * own tabs/search bar do the framing. Aspect ratio is locked to the
 * source image's natural ratio (2472 × 1182) so the entire screenshot
 * fits without cropping.
 *
 * Anime.js overlays for live feel (intentionally minimal — Dylan
 * removed the queue counter and "+N new replies" toast as visual
 * clutter):
 *   - Floating LIVE pulse badge (top-left corner)
 *   - Cursor blink positioned at the end of the search query
 *   - Sweep highlight passes over rows every 3.5s
 *
 * The screenshot is also wrapped in `<ScreenshotZoom>` (in the page)
 * — click to view full-size, since the small embed makes the rows
 * hard to read at a glance.
 */

export function OperatorConsole() {
  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

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
    const sweep = animate('.oc-sweep', {
      translateY: ['0%', '700%'],
      opacity: [0, 0.6, 0],
      duration: 3500,
      delay: 1500,
      loop: true,
      ease: 'inOut(1)',
    })

    return () => {
      livePulse.pause()
      cursorBlink.pause()
      sweep.pause()
    }
  }, [])

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-[#0F1733]/10 dark:border-white/10 bg-[#0E121C]"
      style={{
        aspectRatio: '2472 / 1182',
        boxShadow: '0 50px 100px -40px rgba(15,23,51,0.30), 0 25px 50px -20px rgba(232,93,47,0.15)',
      }}
      aria-label="Creator Outreach app — live results table for a 'day trader' search across five platforms"
    >
      <Image
        src="/screenshots/results.png"
        alt="Creator Outreach Results table"
        fill
        priority
        sizes="(min-width: 1280px) 760px, 100vw"
        className="object-contain"
      />

      <div className="absolute inset-0 pointer-events-none">
        {/* Sweep highlight */}
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

        {/* Cursor blink at the end of "day trader" in the search bar */}
        <div
          className="oc-search-cursor absolute bg-white"
          style={{
            top: '5.2%',
            left: '14.6%',
            width: '1.5px',
            height: '2.6%',
          }}
        />

        {/* LIVE pulse badge — top-left corner */}
        <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] uppercase tracking-[0.18em] font-bold">
          <span className="oc-live-dot inline-block w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
          Live
        </div>
      </div>
    </div>
  )
}
