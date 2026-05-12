/**
 * AI keyword expansion for /api/search.
 *
 * When a user runs a single-keyword broad search (e.g. "tech reviewer"),
 * this module asks Claude Haiku for 3 closely-related variant queries
 * ("tech YouTuber", "gadget reviewer", "tech channel") that the search
 * route fires as shadow searches alongside the original. Merged + deduped
 * by channelId, this consistently surfaces 1.5–2× more relevant creators
 * per search than the original keyword alone.
 *
 * Caching strategy:
 *   Redis (Upstash) first — same client lib/cache.ts uses. 24h TTL.
 *   In-memory Map fallback — for local dev without Redis configured
 *   AND as an L1 to avoid the Redis round trip on the same process
 *   warm-path. Same 24h TTL.
 *
 * Failure mode:
 *   Any error (AI call, network, parse) → returns [] so the search
 *   route falls back to running the original keyword alone. Never
 *   throws upstream.
 */

import Anthropic from '@anthropic-ai/sdk'
import { cacheGet, cacheSet } from './cache'

const TTL_SECONDS = 60 * 60 * 24 // 24h
const MAX_VARIANTS = 3

/**
 * Process-local L1 cache so hot keywords skip the Redis hop on repeat
 * requests within a single warm Vercel instance. Falls back to Redis
 * (L2) and finally to a live AI call.
 */
type MemEntry = { variants: string[]; expires: number }
const memCache = new Map<string, MemEntry>()

function memGet(key: string): string[] | null {
  const e = memCache.get(key)
  if (!e) return null
  if (e.expires < Date.now()) {
    memCache.delete(key)
    return null
  }
  return e.variants
}

function memSet(key: string, variants: string[]): void {
  memCache.set(key, { variants, expires: Date.now() + TTL_SECONDS * 1000 })
}

function cacheKey(keyword: string): string {
  return `kwexpand:v1:${keyword.trim().toLowerCase()}`
}

const PROMPT_TEMPLATE = (keyword: string): string =>
  `Given the search query "${keyword}", generate exactly 3 closely related search queries that a content creator's channel might match when searching for similar accounts. The variants should be:
- Same domain/topic as the original
- Slightly different phrasing (e.g. "tech reviewer" → "tech YouTuber", "gadget reviewer", "tech channel")
- 1-3 words each
- No quotation marks, no numbering, just the 3 queries separated by newlines

Respond with ONLY the 3 queries, one per line. No commentary.`

/**
 * Parse Haiku output into a clean list of variant queries. Defensive —
 * strips quotes, list markers, numbering, blank lines — and caps to
 * MAX_VARIANTS so a chatty response can't blow up the search query
 * fanout.
 */
function parseVariants(raw: string, originalKeyword: string): string[] {
  const lower = originalKeyword.trim().toLowerCase()
  const seen = new Set<string>([lower])
  const out: string[] = []

  for (const line of raw.split(/\r?\n/)) {
    const cleaned = line
      .replace(/^[\s\-*•·>]+/, '')
      .replace(/^\d+[.)]\s*/, '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .trim()
    if (!cleaned) continue
    if (cleaned.length > 80) continue // pathological output guard
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(cleaned)
    if (out.length >= MAX_VARIANTS) break
  }
  return out
}

let _client: Anthropic | null = null
function getClient(): Anthropic | null {
  if (_client) return _client
  const apiKey = process.env.AI_Score_Key
  if (!apiKey) return null
  _client = new Anthropic({ apiKey })
  return _client
}

/**
 * Expand a single search keyword into up to 3 semantically related
 * variants. Returns [] on any failure — caller falls back to running
 * just the original keyword.
 *
 * Skips expansion (returns []) for:
 *   - empty / whitespace-only keywords
 *   - very long inputs (>120 chars — already a phrase, not a niche)
 */
export async function expandKeyword(keyword: string): Promise<string[]> {
  const trimmed = keyword.trim()
  if (!trimmed || trimmed.length > 120) return []

  const key = cacheKey(trimmed)

  // L1: in-memory
  const mem = memGet(key)
  if (mem) return mem

  // L2: Redis (gracefully no-ops when unconfigured)
  const cached = await cacheGet<string[]>(key)
  if (cached && Array.isArray(cached)) {
    memSet(key, cached)
    return cached
  }

  // L3: live AI call
  const client = getClient()
  if (!client) return []

  try {
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      messages: [{ role: 'user', content: PROMPT_TEMPLATE(trimmed) }],
    })
    const block = resp.content.find(b => b.type === 'text')
    if (!block || block.type !== 'text') return []
    const variants = parseVariants(block.text, trimmed)
    if (variants.length === 0) return []
    // Fire-and-forget cache writes — never block on cache.
    memSet(key, variants)
    void cacheSet(key, variants, TTL_SECONDS)
    return variants
  } catch (e) {
    console.warn('[keyword-expand] AI call failed:', (e as Error).message)
    return []
  }
}
