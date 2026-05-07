'use client'

import Image from 'next/image'
import { useState } from 'react'

/**
 * Brutalist replacement for AppPreview.
 *
 * What this isn't: glassy frame, violet/cyan glow, live-pulse dot,
 * carousel arrows with motion easing, four pill buttons, animated
 * tab transitions. All AI-flavored chrome.
 *
 * What this is: a flat 1px-bordered plate with the screenshot inside,
 * a numbered tab strip below (mono, all caps, no rounded corners),
 * and a footnoted caption. Click a tab → image swaps. No motion.
 *
 * The screenshots themselves are dark — that contrast inside the
 * light brutalist substrate is the visual interest, no decoration
 * needed on top.
 */

type View = 'results' | 'outreach' | 'followups' | 'analytics'

const VIEWS: { id: View; tag: string; caption: string; src: string }[] = [
  {
    id: 'results',
    tag: 'FIG. A',
    caption: 'Search results — five platforms, scored by fit, reach, recency.',
    src: '/screenshots/results.png',
  },
  {
    id: 'outreach',
    tag: 'FIG. B',
    caption: 'Outreach board — status, channel, lead detail per row.',
    src: '/screenshots/outreach.png',
  },
  {
    id: 'followups',
    tag: 'FIG. C',
    caption: 'Follow-ups — auto-cadence pings you when a reply lapses.',
    src: '/screenshots/followups.png',
  },
  {
    id: 'analytics',
    tag: 'FIG. D',
    caption: 'Analytics — win rate, response rate, pipeline value.',
    src: '/screenshots/analytics.png',
  },
]

export function ScreenshotPlate() {
  const [idx, setIdx] = useState(0)
  const view = VIEWS[idx]

  return (
    <figure className="border border-ink bg-paper">
      {/* Plate header — figure tag + filename, mono. */}
      <div className="flex items-center justify-between border-b border-ink/70 px-3 py-2 font-[family-name:var(--font-ibm-plex-mono)] text-[10px] uppercase tracking-[0.18em] text-ink/80">
        <span>
          <span className="font-semibold text-ink">{view.tag}</span>
          <span aria-hidden className="opacity-40 mx-2">/</span>
          <span>{view.id.toUpperCase()}.PNG</span>
        </span>
        <span className="opacity-50">[ SCREEN CAPTURE / 1440×900 ]</span>
      </div>

      {/* Image plate — flat, no glow, no rounded corners. */}
      <div className="relative aspect-[1440/900] bg-[#0A0A0A]">
        <Image
          src={view.src}
          alt={`${view.id} view of Creator Outreach`}
          fill
          priority={idx === 0}
          sizes="(min-width: 1024px) 1024px, 100vw"
          className="object-cover object-top"
        />
      </div>

      {/* Tab strip — mono, no radius, hazard underline on active. */}
      <nav
        aria-label="Screenshot tabs"
        className="grid grid-cols-4 border-t border-ink/70 font-[family-name:var(--font-ibm-plex-mono)] text-[10px] uppercase tracking-[0.18em]"
      >
        {VIEWS.map((v, i) => {
          const active = i === idx
          return (
            <button
              key={v.id}
              onClick={() => setIdx(i)}
              className={
                'border-r border-ink/30 last:border-r-0 px-3 py-3 text-left transition-colors ' +
                (active
                  ? 'bg-ink text-paper'
                  : 'bg-paper text-ink/70 hover:text-ink hover:bg-ink/5')
              }
            >
              <div className="text-[9px] opacity-60 mb-0.5">{v.tag}</div>
              <div className="font-semibold">{v.id}</div>
            </button>
          )
        })}
      </nav>

      {/* Caption — small serif-italic feel via mono italic. Footnoted. */}
      <figcaption className="border-t border-ink/40 px-3 py-2 text-[12px] text-ink/80 font-[family-name:var(--font-ibm-plex-mono)]">
        <span className="text-hazard mr-1.5">▸</span>
        {view.caption}
      </figcaption>
    </figure>
  )
}
