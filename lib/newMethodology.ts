// "New methodology" — a sandbox bundle of every additional email-discovery
// trick on top of the production /api/enrich pipeline. Admin email-test
// only. The goal is to push hit rate beyond what regex on the obvious
// pages can achieve.
//
// Methods bundled here:
//   1) Recent video descriptions — many creators paste a "Business
//      inquiries" template into every video's description but NOT the
//      channel About.
//   2) Sitemap discovery — fetches /sitemap.xml and scrapes any pages
//      we haven't already hit (work-with-me, say-hi, booking-info).
//   3) Newsletter/membership platform profiles — Substack, Beehiiv,
//      ConvertKit, Patreon expose author email on their profile pages.
//   4) Pinned Community-tab posts — creators sometimes drop "DM me at"
//      in pinned community content.
//   5) AI extraction pass — last resort: ask Claude to find emails the
//      regex missed (obfuscated forms, contextual implications, weird
//      formats). Only fires if everything else came up empty.

import axios from 'axios'
import * as cheerio from 'cheerio'
import { Innertube } from 'youtubei.js'
import Anthropic from '@anthropic-ai/sdk'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

// Emails at these domains are infrastructure / platform-owned, NOT
// creator contact addresses. We hit these scraping creator-platform
// profile pages (Patreon's own guidelines@patreon.com is the obvious
// offender, but every creator-tooling domain has equivalents).
const PLATFORM_DOMAINS = new Set([
  'patreon.com', 'substack.com', 'beehiiv.com', 'ck.page',
  'convertkit.com', 'mailchimp.com', 'gumroad.com', 'kajabi.com',
  'teachable.com', 'thinkific.com', 'memberstack.com', 'circle.so',
  'discord.com', 'discordapp.com', 'telegram.org',
  'linktr.ee', 'beacons.ai', 'stan.store', 'campsite.bio',
  'youtube.com', 'youtu.be', 'youtubei.googleapis.com',
  'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
  'tiktok.com', 'linkedin.com', 'snapchat.com', 'threads.net',
  'shopify.com', 'wix.com', 'squarespace.com', 'wordpress.com',
  'medium.com', 'cdninstagram.com', 'fbcdn.net',
  'spotify.com', 'apple.com', 'soundcloud.com',
  'stripe.com', 'paypal.com', 'square.com',
])

export interface MethodologyInput {
  channelId: string
  channelName: string
  description?: string
  website?: string
  instagram?: string
  twitter?: string
  tiktok?: string
  linkedin?: string
}

export interface MethodologyHit {
  email: string
  method: string
  evidence: string
}

export interface MethodologyOutput {
  email: string | null
  hits: MethodologyHit[]
  bytesScanned: number
}

async function safeFetch(url: string, timeoutMs = 5000): Promise<string> {
  try {
    const resp = await axios.get(url, {
      timeout: timeoutMs,
      maxRedirects: 3,
      validateStatus: () => true,
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xml,*/*' },
      responseType: 'text',
    })
    return typeof resp.data === 'string' ? resp.data : ''
  } catch {
    return ''
  }
}

function extractEmails(text: string): string[] {
  if (!text) return []
  const found = text.match(EMAIL_RE) || []
  return [...new Set(found.map(e => e.toLowerCase()))]
}

// Filter junk (image filenames misread as emails, platform-owned infra
// addresses, etc.)
function isPlausibleEmail(email: string): boolean {
  if (email.length < 6 || email.length > 80) return false
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/.test(email)) return false
  if (/^[0-9.@-]+$/.test(email)) return false
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false
  if (PLATFORM_DOMAINS.has(domain)) return false
  // Common noreply patterns even on creator domains — useless for outreach
  if (/^(no-?reply|donot-?reply|notifications?|alerts?|automated|system)@/i.test(email)) return false
  return true
}

// ---------- Method 1: Recent video descriptions ----------
async function recentVideoDescriptions(channelId: string): Promise<string[]> {
  try {
    const yt = await Innertube.create({ retrieve_player: false })
    const channel = await yt.getChannel(channelId)
    const videosTab = await channel.getVideos()
    const sources: string[] = []
    const items = (videosTab.videos || []).slice(0, 5)
    for (const v of items) {
      try {
        // The video object's description may be truncated; fetch the full one.
        const id = (v as { id?: string }).id
        if (!id) continue
        const info = await yt.getInfo(id)
        const desc = info.basic_info?.short_description ?? ''
        if (desc) sources.push(desc)
      } catch {
        // skip individual video failures
      }
    }
    return sources
  } catch {
    return []
  }
}

// ---------- Method 2: Sitemap discovery ----------
async function fromSitemap(website: string): Promise<string[]> {
  if (!website) return []
  const base = website.startsWith('http') ? website : `https://${website}`
  const root = base.replace(/\/$/, '')
  const xml = await safeFetch(`${root}/sitemap.xml`, 4000)
  if (!xml) return []

  // Extract URLs (loose match — matches both <loc> and href patterns)
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
  // Filter to interesting paths we haven't already scraped via /api/enrich's standard set
  const skip = new Set(['/', '/contact', '/about', '/press', '/partnerships', '/collaborate', '/sponsor', '/booking', '/media', '/connect', '/hello', '/info', '/team', '/contact-me', '/get-in-touch', '/work-with-me', '/contact-us'])
  const interesting = urls
    .filter(u => {
      try {
        const path = new URL(u).pathname
        return !skip.has(path) && /(contact|booking|press|hire|reach|email|inquir|partner|brand)/i.test(path)
      } catch {
        return false
      }
    })
    .slice(0, 6)

  const fetches = await Promise.all(interesting.map(u => safeFetch(u, 4000)))
  return fetches
}

// ---------- Method 3: Newsletter/membership platform profiles ----------
async function fromCreatorPlatforms(input: MethodologyInput): Promise<string[]> {
  const sources: string[] = []
  // Pull creator handle candidates — first word of channel name lowercase + handles from social URLs
  const tokens = input.channelName.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean)
  const handle = tokens[0] || ''
  if (!handle) return []

  const candidates = [
    `https://${handle}.substack.com/about`,
    `https://www.patreon.com/${handle}`,
    `https://${handle}.beehiiv.com/about`,
    `https://${handle}.ck.page`,
  ]

  const fetches = await Promise.all(candidates.map(u => safeFetch(u, 4000)))
  // Only retain the responses that actually loaded something (filter 404/empty bodies that still came back as ok)
  for (const html of fetches) {
    if (html && html.length > 200) sources.push(html)
  }
  return sources
}

// ---------- Method 4: Pinned community/comment content ----------
async function fromCommunityTab(channelId: string): Promise<string[]> {
  try {
    const yt = await Innertube.create({ retrieve_player: false })
    const channel = await yt.getChannel(channelId)
    // Try the community tab
    const tab = await channel
      .getCommunity()
      .catch(() => null)
    if (!tab) return []
    const posts = (tab as { posts?: unknown[] }).posts || []
    const sources: string[] = []
    for (const p of posts.slice(0, 10)) {
      const txt = JSON.stringify(p)
      if (txt) sources.push(txt)
    }
    return sources
  } catch {
    return []
  }
}

// ---------- Method 5: AI extraction over the assembled corpus ----------
async function aiExtract(corpus: string): Promise<{ email: string; reasoning: string } | null> {
  const apiKey = process.env.AI_Score_Key
  if (!apiKey) return null
  if (!corpus.trim()) return null

  const trimmed = corpus.slice(0, 20000)
  const client = new Anthropic({ apiKey })

  try {
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `You're helping find a creator's contact email from public content they wrote. Below is text from their website, social bios, and video descriptions. Find the most likely **direct contact email FOR THE CREATOR THEMSELVES**.

Look for:
- Direct addresses
- Obfuscated forms ("info at domain dot com")
- Phrases like "reach me at" / "DM me at" / "business inquiries"
- Any pattern that's clearly a contact, even if formatted oddly

DO NOT return:
- Emails at platform/infrastructure domains (patreon.com, substack.com, mailchimp.com, beehiiv.com, ck.page, gumroad.com, etc.) — these are NEVER the creator's email, they're the platform's own contact addresses
- Emails at social-network domains (linkedin.com, twitter.com, instagram.com, tiktok.com)
- noreply@, notifications@, automated@, system@ style addresses
- Generic catch-all emails on the platform (guidelines@patreon.com, support@substack.com, etc.)

Reply with strict JSON only — {"email": "address@domain.com", "reasoning": "1-line why"} or {"email": null, "reasoning": "1-line why nothing was found"}. Do not invent emails. Only return one if it's actually present in the text AND is the creator's own contact.

CONTENT:
${trimmed}`,
      }],
    })

    const text = resp.content
      .filter(b => b.type === 'text')
      .map(b => (b as { text: string }).text)
      .join('')

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0]) as { email: string | null; reasoning: string }
    if (!parsed.email || !isPlausibleEmail(parsed.email.toLowerCase())) return null

    // Sanity check — make sure the email actually appears in the corpus.
    // The model should only return emails it found, but guard against
    // hallucination by requiring the local part to appear somewhere.
    const local = parsed.email.split('@')[0].toLowerCase()
    const lowerCorpus = corpus.toLowerCase()
    if (!lowerCorpus.includes(local) && !lowerCorpus.includes(parsed.email.toLowerCase())) {
      return null
    }

    return { email: parsed.email.toLowerCase(), reasoning: parsed.reasoning || 'AI extraction' }
  } catch {
    return null
  }
}

// ---------- Orchestrator ----------
export async function newMethodology(input: MethodologyInput): Promise<MethodologyOutput> {
  // Run independent sources in parallel
  const [videoDescs, sitemapHtmls, platformHtmls, communityChunks] = await Promise.all([
    recentVideoDescriptions(input.channelId),
    input.website ? fromSitemap(input.website) : Promise.resolve<string[]>([]),
    fromCreatorPlatforms(input),
    fromCommunityTab(input.channelId),
  ])

  const hits: MethodologyHit[] = []
  const seen = new Set<string>()

  function tryAdd(emails: string[], method: string, evidence: string) {
    for (const e of emails) {
      const lc = e.toLowerCase()
      if (!isPlausibleEmail(lc) || seen.has(lc)) continue
      seen.add(lc)
      hits.push({ email: lc, method, evidence })
    }
  }

  for (const d of videoDescs) tryAdd(extractEmails(d), 'video_description', 'in a recent video description')
  for (const html of sitemapHtmls) tryAdd(extractEmails(html), 'sitemap_page', 'on a sitemap-discovered page')
  for (const html of platformHtmls) tryAdd(extractEmails(html), 'creator_platform', 'on Substack/Patreon/etc. profile')
  for (const c of communityChunks) tryAdd(extractEmails(c), 'community_post', 'in a Community-tab post')

  // Build the AI extraction corpus from everything we just collected
  // plus the input description (covers cases where the obvious
  // sources had something but in an obfuscated form).
  const corpus = [
    input.description || '',
    ...videoDescs,
    ...sitemapHtmls.map(h => cheerio.load(h)('body').text().slice(0, 8000)),
    ...platformHtmls.map(h => cheerio.load(h)('body').text().slice(0, 8000)),
    ...communityChunks,
  ].join('\n').slice(0, 20000)

  // AI fallback only fires if the regex sources came up empty —
  // saves money on creators we already found via cheaper means.
  if (hits.length === 0 && corpus.trim()) {
    const ai = await aiExtract(corpus)
    if (ai) {
      hits.push({
        email: ai.email,
        method: 'ai_extraction',
        evidence: ai.reasoning,
      })
    }
  }

  return {
    email: hits[0]?.email ?? null,
    hits,
    bytesScanned: corpus.length,
  }
}
