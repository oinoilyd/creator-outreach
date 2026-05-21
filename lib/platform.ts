import type { Creator, PlatformConfig, PlatformId } from './types'

// Order: YouTube → Instagram → X → TikTok → LinkedIn. X is hoisted
// above TikTok (2026-05-11) because it's flagged as 'suggested' in
// the PlatformDropdown and we want suggested options to surface
// earlier. The PlatformDropdown iterates this list directly, so this
// is the single source of truth for ordering everywhere.
export const PLATFORM_CONFIGS: PlatformConfig[] = [
  { id: 'youtube',   label: 'YouTube',    emoji: '▶️',  activeBg: 'bg-red-700 border-red-600 text-white',      condition: null,            column: null,        chipLabel: '',                    chipWeight: 0  },
  { id: 'instagram', label: 'Instagram',  emoji: '📸',  activeBg: 'bg-pink-700 border-pink-500 text-white',    condition: 'has_instagram', column: 'instagram', chipLabel: 'Active on Instagram', chipWeight: 20 },
  { id: 'twitter',   label: 'X',          emoji: '🐦',  activeBg: 'bg-gray-800 border-gray-500 text-white',    condition: 'has_twitter',   column: 'twitter',   chipLabel: 'Active on X',         chipWeight: 20 },
  { id: 'tiktok',    label: 'TikTok',     emoji: '🎵',  activeBg: 'bg-cyan-700 border-cyan-500 text-white',    condition: 'has_tiktok',    column: 'tiktok',    chipLabel: 'Active on TikTok',    chipWeight: 20 },
  { id: 'linkedin',  label: 'LinkedIn',   emoji: '💼',  activeBg: 'bg-blue-800 border-blue-600 text-white',    condition: 'has_linkedin',  column: 'linkedin',  chipLabel: 'Has LinkedIn',        chipWeight: 20 },
]

export const PLATFORM_LOCK_ID = '__platform__'

/**
 * Pick the right destination URL for the "click on creator name" link
 * in the Results table based on the active platform toggle.
 *
 * YouTube is always the search backbone, but when the user is browsing
 * in Instagram / X / TikTok / LinkedIn mode the table should feel like
 * those platforms — clicking a name opens that platform's profile,
 * not the YouTube channel.
 *
 * Returns the YouTube URL as a safety fallback whenever the platform-
 * specific field is empty (e.g. during the streaming + enrichment
 * window when a row is visible but its IG handle hasn't landed yet,
 * or for a row that just doesn't have a handle on that platform).
 * The fallback prevents dead clicks; in steady state the platform
 * filter only shows rows that have the handle, so the fallback is
 * effectively never hit.
 */
export function getPrimaryUrlForPlatform(c: Creator, platform: PlatformId): string {
  switch (platform) {
    case 'instagram': return (c.instagram?.trim() || c.channelUrl)
    case 'twitter':   return (c.twitter?.trim()   || c.channelUrl)
    case 'tiktok':    return (c.tiktok?.trim()    || c.channelUrl)
    case 'linkedin':  return (c.linkedin?.trim()  || c.channelUrl)
    case 'youtube':
    default:          return c.channelUrl
  }
}

/**
 * Extract the bare handle (no @, no URL prefix) for the active
 * platform from a creator's stored URLs. Returns null when the
 * platform field is empty OR the stored value doesn't look like
 * a recognizable handle. Used by the Results table to render
 * "@handle" as the primary label in IG/X/TikTok modes.
 */
export function getHandleForPlatform(c: Creator, platform: PlatformId): string | null {
  switch (platform) {
    case 'instagram': return extractHandle(c.instagram, /instagram\.com\/([^/?#]+)/i)
    case 'twitter':   return extractHandle(c.twitter,   /(?:twitter|x)\.com\/@?([^/?#]+)/i)
    case 'tiktok':    return extractHandle(c.tiktok,    /tiktok\.com\/@?([^/?#]+)/i)
    case 'linkedin':  return extractHandle(c.linkedin,  /linkedin\.com\/(?:in|company)\/([^/?#]+)/i)
    case 'youtube':
    default:          return null
  }
}

function extractHandle(raw: string | undefined | null, urlPattern: RegExp): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  // If it's a URL, pull the handle segment.
  const m = trimmed.match(urlPattern)
  if (m && m[1]) {
    const handle = decodeURIComponent(m[1]).trim().replace(/^@/, '')
    // LinkedIn handles can contain hyphens + underscores; everyone else
    // uses [a-zA-Z0-9._]. Permissive enough that we don't false-reject.
    if (handle.length > 0 && handle.length <= 100) return handle
    return null
  }
  // Bare handle (no URL prefix). Accept conservatively.
  if (/^@?[a-zA-Z0-9._\-]{1,100}$/.test(trimmed)) {
    return trimmed.replace(/^@/, '')
  }
  return null
}
