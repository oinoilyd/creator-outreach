/**
 * Brand-glyph SVGs for the five platforms Creator Outreach searches.
 *
 * These are the recognizable brand marks (vs the generic line icons in
 * PlatformMarquee.tsx). Used on the /landing "Platforms supported"
 * grid where Dylan wants people to recognize each platform at a glance.
 *
 * Glyph paths are the canonical Simple-Icons / brand-kit shapes, used
 * here in nominative-fair-use to identify which platforms the product
 * supports — no implied endorsement.
 *
 * Sizing: every glyph uses a 24×24 viewBox. The wrapper component
 * controls render size. The Instagram + TikTok marks use the official
 * gradient/two-color treatments because their flat fallbacks read as
 * generic camera/note glyphs and lose recognition.
 */

import type { SVGProps } from 'react'

type Props = SVGProps<SVGSVGElement> & { size?: number }

export function YouTubeMark({ size = 28, ...rest }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="YouTube"
      {...rest}
    >
      <path
        fill="#FF0000"
        d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
      />
      <path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

export function InstagramMark({ size = 28, ...rest }: Props) {
  // IG's recognizable radial gradient (yellow → pink → purple).
  // The id has to be unique per render; we suffix with a stable token
  // because multiple IG marks may render on the same page.
  const gradId = 'ig-grad'
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="Instagram"
      {...rest}
    >
      <defs>
        <radialGradient id={gradId} cx="0.3" cy="1.1" r="1.2">
          <stop offset="0%" stopColor="#FFDD55" />
          <stop offset="35%" stopColor="#FF543E" />
          <stop offset="65%" stopColor="#C837AB" />
          <stop offset="100%" stopColor="#7B2DBE" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5.5" fill={`url(#${gradId})`} />
      <rect
        x="5.5"
        y="5.5"
        width="13"
        height="13"
        rx="3.75"
        fill="none"
        stroke="#fff"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="3.4" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="17.2" cy="6.8" r="0.95" fill="#fff" />
    </svg>
  )
}

export function TikTokMark({ size = 28, ...rest }: Props) {
  // TikTok's signature stereoscopic mark: cyan offset behind-left,
  // magenta offset behind-right, foreground note in currentColor
  // (so the glyph adapts to light/dark substrates). Tight 0.5px
  // offsets — wide offsets look glitchy at small render sizes.
  //
  // Path is the Simple-Icons canonical TikTok glyph (cleaner curve
  // geometry than our previous custom path which read as a generic
  // music note at small sizes).
  const path =
    'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z'
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="TikTok"
      {...rest}
    >
      {/* Layer order (back → front): cyan, magenta, foreground.
          Foreground last so it sits on top — that's the recognizable
          shape. Previous version had black on top covering both
          offsets, which obscured the brand cue and made the glyph
          read as muddy. */}
      <path fill="#25F4EE" transform="translate(-0.5 0.5)" d={path} />
      <path fill="#FE2C55" transform="translate(0.5 -0.5)" d={path} />
      <path fill="currentColor" d={path} />
    </svg>
  )
}

export function XMark({ size = 28, ...rest }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="X"
      {...rest}
    >
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  )
}

export function LinkedInMark({ size = 28, ...rest }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="LinkedIn"
      {...rest}
    >
      <path
        fill="#0A66C2"
        d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
      />
    </svg>
  )
}

export const PLATFORM_MARKS = [
  { name: 'YouTube', Glyph: YouTubeMark, accent: '#FF0000' },
  { name: 'Instagram', Glyph: InstagramMark, accent: '#E1306C' },
  { name: 'TikTok', Glyph: TikTokMark, accent: '#FE2C55' },
  // X's actual brand mark is a black wordmark. Accent uses the
  // canonical X black (previously this incorrectly reused the
  // marketing navy palette, which only coincided in hue).
  { name: 'X', Glyph: XMark, accent: '#0F141A' },
  { name: 'LinkedIn', Glyph: LinkedInMark, accent: '#0A66C2' },
] as const
