'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { animate, utils } from 'animejs'

/**
 * OperatorConsole — hero visual for the landing page.
 *
 * After two prior iterations that synthesized the app's UI in code
 * (and got "this doesn't reflect the actual site" feedback both
 * times), this version uses the ACTUAL product screenshot as the
 * base layer. anime.js layers subtle "live" overlays on top so the
 * visual reads as a running app, not a static screenshot:
 *
 *   - Browser chrome row at top (Mac dots + creatoroutreach.net/results)
 *   - LIVE pulsing dot in the chrome
 *   - The real /screenshots/results.png fills the rest
 *   - Animated counter chip (top-right corner) ticks +1 / +2 every
 *     few seconds → suggests the queue is moving
 *   - Subtle sweep highlight passes over rows occasionally → suggests
 *     live processing
 *   - Cursor blink overlay positioned over the screenshot's search
 *     bar → suggests typing
 *
 * The real screenshot is the content. The overlays just say "this
 * is live, not a marketing render." If the app's UI changes,
 * recapture results.png and the visual reflects the change for free.
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

    // LIVE badge pulse + cursor blink (both continuous)
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

    // Counter ticks up — Sourced count climbs realistic-looking +1/+2 increments
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

    // Sweep highlight passes over the rows — every ~6 seconds — to suggest
    // active background processing without being distracting.
    const sweep = animate('.oc-sweep', {
      translateY: ['0%', '700%'],
      opacity: [0, 0.6, 0],
      duration: 3500,
      delay: 1500,
      loop: true,
      ease: 'inOut(1)',
    })

    // "+N new" toast pops up periodically — pairs with the counter
    // ticking to suggest "creators are flowing into your queue."
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
      className="relative w-full overflow-hidden rounded-2xl border border-[#0F1733]/10 bg-[#0E121C]"
      style={{
        aspectRatio: '1440/810',
        boxShadow: '0 50px 100px -40px rgba(15,23,51,0.30), 0 25px 50px -20px rgba(232,93,47,0.15)',
      }}
      aria-label="Creator Outreach app — live results table for a 'day trader' search across five platforms, with fit scores, emails, and outreach links per row"
    >
      {/* Browser chrome */}
      <div className="relative z-20 flex items-center gap-1.5 px-4 py-2.5 border-b border-[#0F1733]/10 bg-[#FCFAF6]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#0F1733]/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#0F1733]/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#0F1733]/15" />
        <span className="ml-3 text-[11px] text-[#0F1733]/45 font-medium font-mono">creatoroutreach.net / results</span>
        <div className="ml-auto inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-bold text-[#16A34A]">
          <span className="oc-live-dot inline-block w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
          Live
        </div>
      </div>

      {/* The actual app screenshot — the entire content. */}
      <div className="relative w-full" style={{ aspectRatio: '1440/770' }}>
        <Image
          src="/screenshots/results.png"
          alt="Creator Outreach Results table"
          fill
          priority
          sizes="(min-width: 1280px) 760px, 100vw"
          className="object-cover object-top"
        />

        {/* Sweep highlight overlay — suggests active row-by-row processing.
            Positioned over the table area, mix-blend-mode plus-lighter so
            it brightens whatever it passes over without obscuring text. */}
        <div className="absolute inset-x-0 top-[16%] bottom-0 pointer-events-none overflow-hidden">
          <div
            className="oc-sweep absolute inset-x-0 h-12 pointer-events-none"
            style={{
              top: 0,
              background: 'linear-gradient(180deg, transparent, rgba(232, 93, 47, 0.16), transparent)',
              mixBlendMode: 'plus-lighter',
            }}
          />
        </div>

        {/* Cursor blink overlay positioned over the search bar.
            The actual screenshot has "day trader" already in the search
            bar; we paint a tiny cursor at the end of that text to suggest
            the operator is mid-input. */}
        <div
          className="oc-search-cursor absolute pointer-events-none bg-white"
          style={{
            top: '4.5%',
            left: '15.2%',
            width: '1.5px',
            height: '2.2%',
          }}
        />

        {/* Live counter chip — top-right of the table area.
            "Queue: 1,433" with the number ticking up every minute.
            Anchors visual interest in the corner without obscuring rows. */}
        <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0E121C]/95 border border-white/10 text-white shadow-xl backdrop-blur-md">
          <span className="text-[9px] uppercase tracking-[0.18em] text-white/55 font-bold">Queue</span>
          <span ref={counterRef} className="text-[12px] font-bold tabular-nums">1,433</span>
        </div>

        {/* Toast — pops up beneath the counter chip, periodically. */}
        <div
          className="oc-toast absolute right-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/95 text-white shadow-xl"
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
