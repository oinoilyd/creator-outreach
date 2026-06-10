/**
 * /api/enrich/video-descs — Phase C coverage lift.
 *
 * Per Dylan 2026-05-21 — many creators don't link their IG / X / TikTok
 * on their channel /about page but DO mention them in every video
 * description ("Follow my IG: @handle"). The main /api/enrich endpoint
 * already scans the channel /about description body (added in edc6b37),
 * but if a creator only mentions socials in video descriptions, those
 * still get missed.
 *
 * This endpoint fetches the channel's /videos page, pulls out the
 * description fragments from each recent video, and runs the shared
 * extractSocialsFromText helper across the combined text. Designed to
 * run AFTER Phase A in the client (background), so the perceived speed
 * of "first row populated" doesn't regress — Phase C is pure additive
 * lift on coverage.
 *
 * Returns:
 *   { instagram?, twitter?, tiktok?, linkedin? }
 *
 * Errors return 200 with an empty object so the client can treat any
 * non-success as "nothing found" without breaking the row's flow.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUser, rateLimit } from '@/lib/api-auth'
import { clampString } from '@/lib/security'
import { extractSocialsFromText } from '@/lib/social-text-extract'

const MAX_VIDEOS_TO_SCAN = 6  // recent videos — most creators link socials in EVERY description
const FETCH_TIMEOUT_MS = 8000

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const r = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'accept-language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!r.ok) return null
    return await r.text()
  } catch {
    return null
  }
}

/**
 * Extract video-description fragments from a YouTube channel /videos page.
 *
 * YT's ytInitialData on the /videos page includes videoRenderer entries
 * with a `descriptionSnippet` field (truncated description, usually the
 * first ~150 chars). For finding "Follow my IG" patterns this is plenty
 * since creators tend to put their socials in the FIRST line.
 *
 * Returns up to MAX_VIDEOS_TO_SCAN distinct description snippets,
 * concatenated. The shared text extractor scans the combined blob.
 */
function extractVideoDescSnippets(html: string): string {
  // Pull ytInitialData out of the HTML. Pattern matches both
  // `var ytInitialData = {...}` and `window["ytInitialData"] = {...}`.
  const dataMatch = html.match(/(?:var\s+ytInitialData|window\["ytInitialData"\])\s*=\s*(\{[\s\S]*?\});\s*(?:<\/script>|var\s|window\[)/)
  if (!dataMatch) return ''
  let data: unknown
  try {
    data = JSON.parse(dataMatch[1])
  } catch {
    return ''
  }

  // Walk the object collecting any `descriptionSnippet.runs[*].text`
  // strings — there's a videoRenderer entry per video tile on the
  // /videos page. Cap at MAX_VIDEOS_TO_SCAN to bound work.
  const snippets: string[] = []
  function walk(node: unknown, depth = 0): void {
    if (snippets.length >= MAX_VIDEOS_TO_SCAN) return
    if (depth > 30 || !node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node) {
        if (snippets.length >= MAX_VIDEOS_TO_SCAN) return
        walk(item, depth + 1)
      }
      return
    }
    const obj = node as Record<string, unknown>
    if (obj.descriptionSnippet && typeof obj.descriptionSnippet === 'object') {
      const ds = obj.descriptionSnippet as { runs?: Array<{ text?: string }>; simpleText?: string }
      if (ds.simpleText) snippets.push(ds.simpleText)
      else if (Array.isArray(ds.runs)) {
        snippets.push(ds.runs.map(r => r.text || '').join(''))
      }
    }
    for (const v of Object.values(obj)) {
      if (snippets.length >= MAX_VIDEOS_TO_SCAN) return
      walk(v, depth + 1)
    }
  }
  walk(data)
  return snippets.join('\n\n')
}

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth

  // Phase C runs once per enrichment + 175 rows = 175/search at max.
  // 600/hr cap supports ~3 full searches per hour per user.
  const limited = rateLimit(auth.id, 'enrich-video-descs', 600, auth.email)
  if (limited) return limited

  const { searchParams } = new URL(req.url)
  const channelId = clampString(searchParams.get('channelId'), 100)
  if (!channelId) {
    return NextResponse.json({ error: 'channelId required' }, { status: 400 })
  }
  // Lightweight channelId shape check — UC + 22 chars is the standard
  // YouTube channel id format. Reject obviously bad input so we don't
  // burn a fetch on garbage.
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(channelId)) {
    // Permissive — older channel IDs and handles may not match. Just
    // return empty instead of failing.
    return NextResponse.json({})
  }

  const html = await fetchHtml(`https://www.youtube.com/channel/${channelId}/videos`)
  if (!html) return NextResponse.json({})

  const text = extractVideoDescSnippets(html)
  if (!text) return NextResponse.json({})

  const socials = extractSocialsFromText(text)
  return NextResponse.json(socials)
}
