/**
 * /api/enrich/product — Results "Product" column summarizer.
 *
 * Given a creator's text signals, returns a short summary of what they
 * SELL (a course, coaching, membership, physical product, etc) — or
 * { sells: false } when there's no clear product. Drives the new
 * Results "Product" column. Distinct from the Outreach "Product"
 * column (which is the USER's own pitch).
 *
 * Cost discipline (this is the only AI call in the enrichment path):
 *   1. Cache first — creator_product_summary, keyed by channel id.
 *      Computed once, reused forever. A repeat search costs ~0.
 *   2. Keyword gate — corpusMentionsProduct() (the same set behind the
 *      has_product_mention guidance rule). No product keywords → cache a
 *      negative and return WITHOUT spending an AI call. The client gates
 *      too, so in practice the model only sees plausible sellers.
 *   3. Only then: a single Haiku call on the channel's /about + titles.
 *
 * Designed to run as a background phase in the client (after handles +
 * emails resolve), so it never blocks the perceived speed of search.
 * Any failure returns 200 with {} so the client treats it as "nothing
 * to show" and the row's other data is unaffected.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireUser, rateLimit } from '@/lib/api-auth'
import { clampString } from '@/lib/security'
import { corpusMentionsProduct } from '@/lib/guidance'
import { getProductSummary, saveProductSummary } from '@/lib/creator-product'

// Longest summary we'll store / show. The model is told <=12 words; this
// is a hard backstop so a runaway response can't bloat the cell.
const SUMMARY_MAX = 80
// Cap the text we feed the model — bounds token cost per call. The
// /about description + a handful of titles is plenty of signal.
const CORPUS_MAX = 2200
const FETCH_TIMEOUT_MS = 7000

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

/**
 * Pull the channel /about description out of ytInitialData. Mirrors the
 * working extraction in /api/enrich (fromYouTubeAbout): the description
 * lives on aboutChannelViewModel.description. Best-effort — returns ''
 * on any miss so the caller falls back to the passed-in text.
 */
function extractAboutDescription(html: string): string {
  const m = html.match(
    /(?:var\s+ytInitialData|window\["ytInitialData"\])\s*=\s*(\{[\s\S]*?\});\s*(?:<\/script>|var\s|window\[)/,
  )
  if (!m) return ''
  let data: unknown
  try {
    data = JSON.parse(m[1])
  } catch {
    return ''
  }
  let found = ''
  function walk(node: unknown, depth = 0): void {
    if (found || depth > 30 || !node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node) {
        if (found) return
        walk(item, depth + 1)
      }
      return
    }
    const obj = node as Record<string, unknown>
    const vm = obj.aboutChannelViewModel
    if (vm && typeof vm === 'object' && typeof (vm as Record<string, unknown>).description === 'string') {
      found = (vm as Record<string, unknown>).description as string
      return
    }
    for (const v of Object.values(obj)) {
      if (found) return
      walk(v, depth + 1)
    }
  }
  walk(data)
  return found
}

const PROMPT = (corpus: string) =>
  `You are analyzing a content creator to decide whether they SELL a product of their own — a course, coaching/consulting, membership/community, digital product, or physical goods (merch, supplements, books, etc). Just making videos or having sponsors does NOT count.

Creator text (channel description + recent video titles):
"""
${corpus}
"""

Reply with STRICT JSON and nothing else:
{"sells": true, "summary": "<what they sell, concrete, <=12 words>"}
or
{"sells": false, "summary": ""}

Rules:
- Only set sells=true when the text gives real evidence of something they sell. If it's ambiguous or they just make content, use sells=false.
- Do NOT invent a product that isn't evidenced in the text.
- Good summaries: "Online stock-trading course", "1:1 fitness coaching + meal plans", "Branded apparel and supplements", "Paid Discord trading community".`

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

  // Gated + cached, so most calls never reach the model — but cap to
  // bound worst-case AI spend (a search heavy with course-sellers).
  const limited = rateLimit(auth.id, 'enrich-product', 500, auth.email)
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

    // 2. Cheap keyword gate on what the client already has. If nothing
    //    smells like a product, cache the negative and skip the AI call.
    const clientCorpus = [name, description, ...titles].join('  ')
    if (!corpusMentionsProduct(clientCorpus)) {
      await saveProductSummary(channelId, false, '')
      return NextResponse.json({ sells: false, summary: '' })
    }

    // 3. Best-effort: enrich the signal with the channel's /about
    //    description (richer than the search snippet). Skip for ids
    //    that aren't standard YT channel ids — just use passed text.
    let aboutDesc = ''
    if (YT_CHANNEL_RE.test(channelId)) {
      const html = await fetchHtml(`https://www.youtube.com/channel/${channelId}/about`)
      if (html) aboutDesc = extractAboutDescription(html)
    }
    const corpus = clampString(
      [name, aboutDesc || description, ...titles].filter(Boolean).join('\n'),
      CORPUS_MAX,
    )

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

    // A "sells" verdict with no summary is useless to show — normalize
    // it to a negative so the column reads cleanly.
    const summary = clampString(parsed.summary, SUMMARY_MAX)
    const sells = parsed.sells && summary.length > 0
    const finalSummary = sells ? summary : ''

    await saveProductSummary(channelId, sells, finalSummary)
    return NextResponse.json({ sells, summary: finalSummary })
  } catch {
    // Fail-quiet: the column just stays blank for this row; everything
    // else about it is unaffected.
    return NextResponse.json({})
  }
}
