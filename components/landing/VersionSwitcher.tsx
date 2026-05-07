'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Sticky version-switcher bar — sits at the very top of every
 * /landing/v* route so Dylan can flip between five wildly different
 * design directions on the same preview deployment without leaving
 * the tab.
 *
 * Each version has its own visual identity below this bar; the bar
 * itself is intentionally neutral (white-on-black, pure system font)
 * so it doesn't clash with any of them.
 */

const VERSIONS: { slug: string; label: string; sub: string }[] = [
  { slug: 'v1', label: 'V1', sub: 'Apollo / Clay-style' },
  { slug: 'v2', label: 'V2', sub: 'HubSpot / Lemlist' },
  { slug: 'v3', label: 'V3', sub: 'Pipedrive multi-page' },
]

export function VersionSwitcher() {
  const pathname = usePathname() ?? ''
  const active = VERSIONS.find(v => pathname.includes(`/landing/${v.slug}`))?.slug

  return (
    <div className="sticky top-0 z-[100] bg-black text-white border-b border-white/10 font-mono">
      <div className="max-w-[1400px] mx-auto px-4 py-2 flex items-center gap-3 text-[11px]">
        <span className="text-white/50 uppercase tracking-[0.18em] hidden sm:inline">
          REDESIGN&nbsp;CONCEPTS&nbsp;/&nbsp;CLICK&nbsp;TO&nbsp;COMPARE
        </span>
        <span className="text-white/50 uppercase tracking-[0.18em] sm:hidden">
          COMPARE
        </span>
        <span className="text-white/30 hidden sm:inline">›</span>
        <nav className="flex items-center gap-1.5 flex-wrap">
          {VERSIONS.map(v => {
            const isActive = active === v.slug
            return (
              <Link
                key={v.slug}
                href={`/landing/${v.slug}`}
                className={
                  'inline-flex items-center gap-1.5 px-2.5 py-1 transition-colors ' +
                  (isActive
                    ? 'bg-white text-black'
                    : 'bg-white/5 text-white/80 hover:bg-white/10 hover:text-white')
                }
              >
                <span className="font-semibold">{v.label}</span>
                <span className={isActive ? 'text-black/70' : 'text-white/50'}>
                  · {v.sub}
                </span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
