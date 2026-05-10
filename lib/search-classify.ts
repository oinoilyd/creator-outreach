/**
 * Classify a raw search input as either a URL/handle (look up a
 * specific account) or a phrase (run the existing keyword search).
 *
 * The downstream effect:
 *   - 'url' / 'handle' → /api/lookup-channel (returns 0–1 results)
 *   - 'phrase'         → /api/search (returns up to ~100 results)
 *
 * The data model is YouTube-centric: all lookups eventually resolve
 * to a YouTube channel even when the input is an Instagram or TikTok
 * URL. The user's active platform tab is just a filter on top of that
 * underlying YouTube data, so we don't switch tabs — we just look up
 * the same handle on YouTube. Most cross-platform creators reuse the
 * handle (mrbeast on Instagram, @MrBeast on YouTube, etc.).
 *
 * Heuristics for "bare token, no @" inputs:
 *   - tokens with `.`, `_`, or digits  → likely a handle (mr.beast,
 *     mr_beast, mrbeast420). Try lookup, fall back to keyword on
 *     miss so common-word collisions don't dead-end the user.
 *   - plain alphabetic tokens (marketing, cooking, fitness) → phrase.
 *     Conservative on purpose: a single common word is overwhelmingly
 *     an occupation/topic search, not someone's username. Users who
 *     mean a handle can prepend `@`.
 */

export type SearchKind = 'url' | 'handle' | 'phrase'

export type SearchClassification =
  | {
      // Full URL on a recognised social platform — high confidence,
      // no fallback. handle / channelId is whatever we extracted.
      kind: 'url'
      handle: string | null
      channelId: string | null
      sourcePlatform: SourcePlatform
      raw: string
    }
  | {
      // @-prefixed (high confidence, no fallback) or bare token with
      // handle-ish characters (with fallback to keyword on miss).
      kind: 'handle'
      handle: string
      explicit: boolean // true = had `@` prefix; false = bare token w/ special chars
      raw: string
    }
  | {
      // Multi-word, plain single word, or anything not matching the
      // patterns above. Falls through to existing /api/search flow.
      kind: 'phrase'
      raw: string
    }

export type SourcePlatform =
  | 'youtube'
  | 'instagram'
  | 'tiktok'
  | 'twitter'
  | 'linkedin'
  | 'unknown'

const YOUTUBE_CHANNEL_ID_RE = /^UC[\w-]{22}$/
const HANDLE_TOKEN_RE = /^[A-Za-z0-9._-]+$/

/**
 * Strip protocol/host garbage and try to parse a URL. Accepts inputs
 * like `instagram.com/mrbeast` (no protocol) and returns a real URL
 * object so downstream parsing can use `.hostname` / `.pathname`
 * instead of regex-tagging.
 */
function tryParseUrl(raw: string): URL | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  // Bare channel ID — synthesize a YouTube channel URL.
  if (YOUTUBE_CHANNEL_ID_RE.test(trimmed)) {
    return new URL(`https://www.youtube.com/channel/${trimmed}`)
  }
  // Looks URL-y if it has at least one `/` or starts with a host.
  // Most "fake" URLs (e.g. `mr.beast`) won't have a `/` and won't
  // match a known social hostname below, so they fall through.
  const looksUrlish =
    /^https?:\/\//i.test(trimmed) ||
    /^[a-z0-9.-]+\.[a-z]{2,}\//i.test(trimmed) ||
    /^[a-z0-9.-]+\.com\b/i.test(trimmed)
  if (!looksUrlish) return null
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, '')}`
  try {
    return new URL(withProto)
  } catch {
    return null
  }
}

function detectPlatformFromHostname(host: string): SourcePlatform {
  const h = host.toLowerCase()
  if (/(?:^|\.)youtube\.com$/.test(h) || h === 'youtu.be') return 'youtube'
  if (/(?:^|\.)instagram\.com$/.test(h)) return 'instagram'
  if (/(?:^|\.)tiktok\.com$/.test(h)) return 'tiktok'
  if (/(?:^|\.)twitter\.com$/.test(h) || /(?:^|\.)x\.com$/.test(h)) return 'twitter'
  if (/(?:^|\.)linkedin\.com$/.test(h)) return 'linkedin'
  return 'unknown'
}

/**
 * Pull a handle out of a parsed social URL. Each platform has its
 * own convention:
 *   YouTube    : /@handle, /c/CustomName, /user/legacy, /channel/UC...
 *   Instagram  : /<handle>
 *   TikTok     : /@<handle>
 *   X / Twitter: /<handle>
 *   LinkedIn   : /in/<handle>
 */
function extractHandleFromUrl(
  u: URL,
  platform: SourcePlatform,
): { handle: string | null; channelId: string | null } {
  const segments = u.pathname.split('/').filter(Boolean)
  if (platform === 'youtube') {
    const [first, second] = segments
    if (!first) return { handle: null, channelId: null }
    if (first === 'channel' && second && YOUTUBE_CHANNEL_ID_RE.test(second)) {
      return { handle: null, channelId: second }
    }
    if (first.startsWith('@')) {
      return { handle: first.slice(1), channelId: null }
    }
    if ((first === 'c' || first === 'user') && second) {
      return { handle: second, channelId: null }
    }
    // /youtu.be/<videoId> isn't a channel URL — caller falls through.
    return { handle: null, channelId: null }
  }
  if (platform === 'tiktok') {
    const first = segments[0] || ''
    if (first.startsWith('@')) return { handle: first.slice(1), channelId: null }
    return { handle: null, channelId: null }
  }
  if (platform === 'linkedin') {
    if (segments[0] === 'in' && segments[1]) {
      return { handle: segments[1], channelId: null }
    }
    return { handle: null, channelId: null }
  }
  // Instagram, Twitter/X — bare path segment IS the handle.
  if (segments[0]) return { handle: segments[0], channelId: null }
  return { handle: null, channelId: null }
}

/**
 * The main entry point. Pure: same input always classifies the same
 * way. Caller decides what to do with each kind.
 */
export function classifySearchInput(raw: string): SearchClassification {
  const input = (raw || '').trim()
  if (!input) return { kind: 'phrase', raw: input }

  // 1) URL / known-platform host detection.
  const url = tryParseUrl(input)
  if (url) {
    const platform = detectPlatformFromHostname(url.hostname)
    if (platform !== 'unknown') {
      const { handle, channelId } = extractHandleFromUrl(url, platform)
      if (handle || channelId) {
        return {
          kind: 'url',
          handle,
          channelId,
          sourcePlatform: platform,
          raw: input,
        }
      }
    }
    // URL we don't know how to parse (e.g. random domain) → phrase.
    return { kind: 'phrase', raw: input }
  }

  // 2) Explicit @handle (high confidence).
  if (input.startsWith('@')) {
    const rest = input.slice(1)
    if (HANDLE_TOKEN_RE.test(rest) && rest.length >= 2) {
      return { kind: 'handle', handle: rest, explicit: true, raw: input }
    }
    return { kind: 'phrase', raw: input }
  }

  // 3) Bare token with handle-ish characters (medium confidence,
  //    fall through to keyword on miss).
  if (!input.includes(' ')) {
    const looksLikeHandle =
      HANDLE_TOKEN_RE.test(input) &&
      input.length >= 3 &&
      /[._\d]/.test(input) // dot, underscore, OR digit somewhere
    if (looksLikeHandle) {
      return { kind: 'handle', handle: input, explicit: false, raw: input }
    }
  }

  // 4) Everything else.
  return { kind: 'phrase', raw: input }
}
