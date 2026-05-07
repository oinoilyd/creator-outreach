'use client'

import { Marquee } from '@/components/ui/marquee'

/**
 * Platform support strip — single horizontal row showing the platforms
 * Creator Outreach actually searches: YouTube, Instagram, TikTok, X,
 * LinkedIn. Replaces the previous "5 platforms / 13 niches" stats card
 * with accurate motion.
 *
 * The installed lucide-react (v1.14) predates the brand-icon set, so
 * all 5 marks are hand-rolled inline SVGs in the same stroke style
 * (1.5px, currentColor, 24×24 viewBox).
 */

type IconProps = { className?: string }

function YouTubeIcon({ className = '' }: IconProps) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </svg>
  )
}

function InstagramIcon({ className = '' }: IconProps) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

function LinkedInIcon({ className = '' }: IconProps) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

function TikTokIcon({ className = '' }: IconProps) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  )
}

function XIcon({ className = '' }: IconProps) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4l16 16M20 4 4 20" />
    </svg>
  )
}

const PLATFORMS = [
  { name: 'YouTube',   Icon: YouTubeIcon,   tint: 'text-red-400' },
  { name: 'Instagram', Icon: InstagramIcon, tint: 'text-pink-400' },
  { name: 'TikTok',    Icon: TikTokIcon,    tint: 'text-cyan-300' },
  { name: 'X',         Icon: XIcon,         tint: 'text-foreground' },
  { name: 'LinkedIn',  Icon: LinkedInIcon,  tint: 'text-blue-400' },
] as const

function PlatformCard({ p }: { p: (typeof PLATFORMS)[number] }) {
  const Icon = p.Icon
  return (
    <div className="flex items-center gap-2.5 px-5 py-3 mx-2 rounded-xl border border-border bg-card shadow-sm whitespace-nowrap dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-sm dark:shadow-none">
      <Icon className={`w-5 h-5 ${p.tint}`} />
      <span className="text-sm font-medium text-foreground">{p.name}</span>
    </div>
  )
}

export function PlatformMarquee() {
  return (
    <div className="relative max-w-5xl mx-auto">
      <div className="text-[11px] uppercase tracking-[0.2em] text-brand mb-3 text-center">
        Works across
      </div>
      <Marquee pauseOnHover className="[--duration:30s] [--gap:0px]">
        {PLATFORMS.map((p) => (
          <PlatformCard key={p.name} p={p} />
        ))}
      </Marquee>
      {/* Edge fades so cards visually disappear into the page */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/6 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/6 bg-gradient-to-l from-background to-transparent" />
    </div>
  )
}
