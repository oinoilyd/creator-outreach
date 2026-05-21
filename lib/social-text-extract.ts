/**
 * Scan free-form text (channel description, video description, bio) for
 * social handle mentions on Instagram / X / TikTok / LinkedIn.
 *
 * Two strategies:
 *   1. URL form — instagram.com/handle, twitter.com/handle, x.com/handle,
 *      tiktok.com/@handle, linkedin.com/in/handle. Highest confidence.
 *   2. @handle with platform context — "Instagram: @handle", "IG: @handle",
 *      "Twitter: @handle", "X: @handle", "TikTok: @handle". The platform
 *      label disambiguates which network the handle belongs to (bare
 *      @handle alone is ambiguous and ignored).
 *
 * Shared between /api/enrich (scans channel /about description) and
 * /api/enrich/video-descs (scans recent video descriptions for Phase C
 * background coverage lift). Both surfaces use the same regex set so
 * extraction behavior is consistent.
 */

export interface ExtractedSocials {
  instagram?: string
  twitter?: string
  tiktok?: string
  linkedin?: string
}

export function extractSocialsFromText(text: string): ExtractedSocials {
  const out: ExtractedSocials = {}
  if (!text) return out

  // URL form first — highest confidence.
  const igUrl = text.match(/(?:https?:\/\/(?:www\.)?)?instagram\.com\/([a-zA-Z0-9._]{1,30})/i)
  if (igUrl) {
    const h = igUrl[1]
    if (!/^(p|reel|reels|stories|explore|tv|accounts)$/i.test(h)) {
      out.instagram = `https://instagram.com/${h}`
    }
  }
  const xUrl = text.match(/(?:https?:\/\/(?:www\.)?)?(?:twitter|x)\.com\/@?([a-zA-Z0-9_]{1,15})/i)
  if (xUrl) {
    const h = xUrl[1]
    if (!/^(i|home|search|notifications|messages|explore)$/i.test(h)) {
      out.twitter = `https://twitter.com/${h}`
    }
  }
  const ttUrl = text.match(/(?:https?:\/\/(?:www\.)?)?tiktok\.com\/@?([a-zA-Z0-9._]{1,24})/i)
  if (ttUrl) out.tiktok = `https://tiktok.com/@${ttUrl[1]}`
  const liUrl = text.match(/(?:https?:\/\/(?:www\.)?)?linkedin\.com\/(?:in|company)\/([a-zA-Z0-9_-]{1,100})/i)
  if (liUrl) out.linkedin = `https://linkedin.com/in/${liUrl[1]}`

  // @handle with explicit platform context — disambiguation pattern.
  if (!out.instagram) {
    const m = text.match(/\b(?:instagram|insta|ig)\s*[:\-=]?\s*@?([a-zA-Z0-9._]{2,30})\b/i)
    if (m && m[1].length >= 2) out.instagram = `https://instagram.com/${m[1]}`
  }
  if (!out.twitter) {
    const m = text.match(/\b(?:twitter|x|tweet|tweets)\s*[:\-=]?\s*@?([a-zA-Z0-9_]{2,15})\b/i)
    if (m && m[1].length >= 2 && !/^(on|to|at|from|or)$/i.test(m[1])) {
      out.twitter = `https://twitter.com/${m[1]}`
    }
  }
  if (!out.tiktok) {
    const m = text.match(/\b(?:tiktok|tt)\s*[:\-=]?\s*@?([a-zA-Z0-9._]{2,24})\b/i)
    if (m && m[1].length >= 2) out.tiktok = `https://tiktok.com/@${m[1]}`
  }

  return out
}
