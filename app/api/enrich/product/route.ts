/**
 * /api/enrich/product — Results "Product" column summarizer.
 *
 * Given a creator, returns a short summary of what they SELL (a course,
 * coaching, membership, physical product, etc) — or { sells: false }
 * when there's no clear product. Drives the new Results "Product"
 * column. Distinct from the Outreach "Product" column (the USER's pitch).
 *
 * 2026-06-12 hit-rate rework. The first cut gated on thin client text
 * (channel name + video titles) BEFORE fetching anything richer, so any
 * seller who didn't put "course/shop/etc" in their titles got skipped
 * before the model ever looked — return rate was ~5%. Now we gather the
 * signal that actually carries product mentions:
 *   • the channel /about description, AND
 *   • recent VIDEO DESCRIPTIONS (where creators plug "📚 my course:",
 *     "🛒 shop:", "join my membership:" in nearly every upload),
 * then run the keyword gate on THAT rich corpus, and feed it all to the
 * model. The cheap fetches happen for every creator the client sends;
 * the model only runs when the rich text actually mentions a product.
 *
 * Cost discipline:
 *   1. Cache first (creator_product_summary) — computed once, reused.
 *   2. Rich-text keyword gate — no product signal in /about + video
 *      descriptions + titles → cache a negative, no AI call.
 *   3. Only then: a single Haiku call.
 *
 * Runs as a background phase in the client, so it never blocks search.
 * Any failure returns 200 {} so the row just stays blank.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireUser, rateLimitRedis } from '@/lib/api-auth'
import { clampString } from '@/lib/security'
import { corpusMentionsProduct } from '@/lib/guidance'
import { getProductSummary, saveProductSummary } from '@/lib/creator-product'

// Longest summary we'll store / show. The model is told <=12 words; this
// is a hard backstop so a runaway response can't bloat the cell.
const SUMMARY_MAX = 90
// Cap the text we feed the model — bounds token cost per call.
const CORPUS_MAX = 3200
const FETCH_TIMEOUT_MS = 7000
const MAX_VIDEOS_TO_SCAN = 8

const YT_CHANNEL_RE = /^UC[a-zA-Z0-9_-]{22}$/

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const r = await fetch(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

function parseYtInitialData(html: string): unknown | null {
  const m = html.match(
    /(?:var\s+ytInitialData|window\["ytInitialData"\])\s*=\s*(\{[\s\S]*?\});\s*(?:<\/script>|var\s|window\[)/,
  )
  if (!m) return null
  try {
    return JSON.parse(m[1])
  } catch {
    return null
  }
}

/**
 * Channel /about description — where creators describe their business.
 * Lives on aboutChannelViewModel.description (mirrors /api/enrich's
 * fromYouTubeAbout). Best-effort; '' on any miss.
 */
function extractAboutDescription(data: unknown): string {
  let found = ''
  function walk(node: unknown, depth = 0): void {
    if (found || depth > 30 || !node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node) { if (found) return; walk(item, depth + 1) }
      return
    }
    const obj = node as Record<string, unknown>
    const vm = obj.aboutChannelViewModel
    if (vm && typeof vm === 'object' && typeof (vm as Record<string, unknown>).description === 'string') {
      found = (vm as Record<string, unknown>).description as string
      return
    }
    for (const v of Object.values(obj)) { if (found) return; walk(v, depth + 1) }
  }
  walk(data)
  return found
}

/**
 * Recent video-description snippets — the highest-signal place for
 * product mentions ("Get my course:", "Shop:", "Join the membership:").
 * YT's /videos ytInitialData carries a descriptionSnippet per tile.
 * Mirrors the extraction in /api/enrich/video-descs.
 */
function extractVideoDescSnippets(data: unknown): string {
  const snippets: string[] = []
  function walk(node: unknown, depth = 0): void {
    if (snippets.length >= MAX_VIDEOS_TO_SCAN || depth > 30 || !node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node) { if (snippets.length >= MAX_VIDEOS_TO_SCAN) return; walk(item, depth + 1) }
      return
    }
    const obj = node as Record<string, unknown>
    if (obj.descriptionSnippet && typeof obj.descriptionSnippet === 'object') {
      const ds = obj.descriptionSnippet as { runs?: Array<{ text?: string }>; simpleText?: string }
      if (ds.simpleText) snippets.push(ds.simpleText)
      else if (Array.isArray(ds.runs)) snippets.push(ds.runs.map(r => r.text || '').join(''))
    }
    for (const v of Object.values(obj)) { if (snippets.length >= MAX_VIDEOS_TO_SCAN) return; walk(v, depth + 1) }
  }
  walk(data)
  return snippets.join('\n')
}

const PROMPT = (corpus: string) =>
  `You are analyzing a content creator to decide whether they SELL something of their own. Count ANY of these as selling: an online course or class, coaching/consulting, a membership or paid community (Patreon, Discord, etc), a digital product (ebook, presets, templates, guides, downloads, software/app), a newsletter or subscription, or physical goods (merch, books, supplements, gear). Just making videos, or having brand sponsors, does NOT count.

Creator text (channel description + recent video descriptions + titles):
"""
${corpus}
"""

Reply with STRICT JSON and nothing else:
{"sells": true, "summary": "<what they sell, concrete, <=12 words>"}
or
{"sells": false, "summary": ""}

Rules:
- If there's reasonable evidence of something they sell — a store/course/membership link, a "get my…", "shop", "enroll", "join", "download", "my book/course/app", a Patreon/Gumroad/Teachable/Substack mention — set sells=true and name it.
- Don't invent a product with no support in the text. If it's genuinely just content with no offer, sells=false.
- Good summaries: "Online stock-trading course", "1:1 fitness coaching + meal plans", "Lightroom presets + photo course", "Paid Discord trading community", "Branded apparel and supplements".`

function parseModelJson(raw: string): { sells: boolean; summary: string } | null {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0]) as { sells?: unknown; summary?: unknown }
    const sells = parsed.sells === true
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : ''
    return { sells, summary }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth

  // Gated + cached, so most calls never reach the model (cache hits and
  // gated negatives spend no AI). Broad client trigger → more requests
  // per search, so the cap is generous; the AI cost stays bounded by the
  // rich-text gate, not this number.
  const limited = await rateLimitRedis(auth.id, 'enrich-product', 800, auth.email)
  if (limited) return limited

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const b = (body ?? {}) as Record<string, unknown>
  const channelId = clampString(typeof b.channelId === 'string' ? b.channelId : '', 100)
  if (!channelId) {
    return NextResponse.json({ error: 'channelId required' }, { status: 400 })
  }
  const name = clampString(typeof b.name === 'string' ? b.name : '', 200)
  const description = clampString(typeof b.description === 'string' ? b.description : '', 1500)
  const titles = Array.isArray(b.videoTitles)
    ? (b.videoTitles as unknown[])
        .filter((t): t is string => typeof t === 'string')
        .slice(0, 12)
        .map(t => clampString(t, 160))
    : []

  try {
    // 1. Cache — computed once, reused forever.
    const cached = await getProductSummary(channelId)
    if (cached) {
      return NextResponse.json({ sells: cached.sells, summary: cached.summary })
    }

    // 2. Gather the RICH signal. For standard YT channels, fetch the
    //    /about description AND recent video descriptions in parallel —
    //    that's where products actually get mentioned. For anything else
    //    (non-UC ids), fall back to the text the client provided.
    let aboutDesc = ''
    let videoDescs = ''
    if (YT_CHANNEL_RE.test(channelId)) {
      const [aboutHtml, videosHtml] = await Promise.all([
        fetchHtml(`https://www.youtube.com/channel/${channelId}/about`),
        fetchHtml(`https://www.youtube.com/channel/${channelId}/videos`),
      ])
      if (aboutHtml) {
        const data = parseYtInitialData(aboutHtml)
        if (data) aboutDesc = extractAboutDescription(data)
      }
      if (videosHtml) {
        const data = parseYtInitialData(videosHtml)
        if (data) videoDescs = extractVideoDescSnippets(data)
      }
    }
    const corpus = clampString(
      [name, aboutDesc || description, videoDescs, ...titles].filter(Boolean).join('\n'),
      CORPUS_MAX,
    )

    // 3. Keyword gate on the RICH corpus — no product signal anywhere →
    //    cache the negative, no AI call.
    if (!corpusMentionsProduct(corpus)) {
      await saveProductSummary(channelId, false, '')
      return NextResponse.json({ sells: false, summary: '' })
    }

    const apiKey = process.env.AI_Score_Key
    if (!apiKey) {
      // No key configured — don't cache (so it recomputes once set).
      return NextResponse.json({})
    }

    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 120,
      messages: [{ role: 'user', content: PROMPT(corpus) }],
    })
    const raw = (message.content[0] as { text?: string }).text?.trim() || ''
    const parsed = parseModelJson(raw)
    if (!parsed) {
      // Couldn't parse — don't cache a bad result; allow a retry later.
      return NextResponse.json({})
    }

    // A "sells" verdict with no summary is useless to show — normalize to
    // a negative so the column reads cleanly.
    const summary = clampString(parsed.summary, SUMMARY_MAX)
    const sells = parsed.sells && summary.length > 0
    const finalSummary = sells ? summary : ''

    await saveProductSummary(channelId, sells, finalSummary)
    return NextResponse.json({ sells, summary: finalSummary })
  } catch {
    return NextResponse.json({})
  }
}
