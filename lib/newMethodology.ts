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
import { promises as dns } from 'dns'
import { Innertube } from 'youtubei.js'
import Anthropic from '@anthropic-ai/sdk'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

// Emails at these domains (or their subdomains) are infrastructure /
// platform / telemetry — never creator contact addresses. Embedded
// Sentry DSNs (hash@o123.ingest.us.sentry.io) and creator-platform
// boilerplate (guidelines@patreon.com) were the worst offenders.
const PLATFORM_DOMAIN_SUFFIXES = [
  // Creator/membership platforms
  'patreon.com', 'substack.com', 'beehiiv.com', 'ck.page',
  'convertkit.com', 'mailchimp.com', 'gumroad.com', 'kajabi.com',
  'teachable.com', 'thinkific.com', 'memberstack.com', 'circle.so',
  // Bio-link tools (and their team-side email domains where they
  // differ from the public-facing one — e.g. Stan Store mails from
  // stanwith.me, not stan.store)
  'linktr.ee', 'beacons.ai', 'stan.store', 'stanwith.me', 'campsite.bio',
  'allmylinks.com', 'lnk.bio', 'bio.fm', 'solo.to', 'pillar.io',
  'about.me', 'contact.me', 'msha.ke', 'withkoji.com',
  'buymeacoffee.com', 'ko-fi.com', 'kofi.com', 'paypalme.com',
  'tipjar.com', 'flowcode.com', 'koji.to', 'milkshake.app',
  // Socials + their CDNs
  'youtube.com', 'youtu.be', 'googleapis.com',
  'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
  'tiktok.com', 'linkedin.com', 'snapchat.com', 'threads.net',
  'cdninstagram.com', 'fbcdn.net',
  // Site builders + CMSs
  'shopify.com', 'wix.com', 'squarespace.com', 'wordpress.com',
  'medium.com', 'webflow.com',
  // Streaming + audio
  'spotify.com', 'apple.com', 'soundcloud.com',
  // Payments
  'stripe.com', 'paypal.com', 'square.com',
  // Chat/community
  'discord.com', 'discordapp.com', 'telegram.org', 'slack.com',
  // Error/observability/analytics — these are the Sentry-DSN
  // class of false positives, embedded in site source as DSN URLs
  'sentry.io', 'bugsnag.com', 'rollbar.com', 'logrocket.com',
  'datadoghq.com', 'newrelic.com', 'mixpanel.com', 'amplitude.com',
  'segment.com', 'segment.io', 'heap.io', 'hotjar.com',
  'fullstory.com', 'google-analytics.com', 'googletagmanager.com',
  'cloudflareinsights.com', 'cloudflare.com',
  // Common CDNs / cloud
  'amazonaws.com', 'cloudfront.net', 'azureedge.net', 'akamai.net',
  'fastly.net', 'jsdelivr.net', 'unpkg.com', 'github.io',
  // Email service providers (their own domains, not customer mail)
  'sendgrid.net', 'mailgun.net', 'postmarkapp.com', 'resend.com',
]

function isPlatformDomain(domain: string): boolean {
  const d = domain.toLowerCase()
  for (const suffix of PLATFORM_DOMAIN_SUFFIXES) {
    if (d === suffix || d.endsWith('.' + suffix)) return true
  }
  return false
}

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

// Decode Cloudflare's "Email Address Obfuscation" — a default-on
// feature that replaces every email on a site with a hex-encoded
// blob in `data-cfemail`. The first byte is the XOR key; remaining
// bytes are each XOR'd against it to reconstruct the address.
// This catches emails that are visible to a human in the footer
// but invisible to plain-HTML scrapers.
function decodeCfEmail(encoded: string): string {
  if (!/^[0-9a-f]+$/i.test(encoded) || encoded.length < 4 || encoded.length % 2 !== 0) return ''
  const key = parseInt(encoded.slice(0, 2), 16)
  let result = ''
  for (let i = 2; i < encoded.length; i += 2) {
    const code = parseInt(encoded.slice(i, i + 2), 16) ^ key
    result += String.fromCharCode(code)
  }
  return result
}

// Three-pass email extraction from raw HTML:
//  1. Plain regex over the full HTML (catches text + most attribute values)
//  2. mailto: href sweep — covers cases where the email lives only in
//     <a href="mailto:..."> with non-email link text ('Contact us')
//  3. Cloudflare data-cfemail decoding — see decodeCfEmail above
// Used in lieu of plain extractEmails() anywhere we're scraping HTML.
function extractEmailsFromHtml(html: string): string[] {
  if (!html) return []
  const out = new Set<string>()

  // Pass 1: standard regex
  for (const e of html.match(EMAIL_RE) || []) {
    out.add(e.toLowerCase())
  }

  // Pass 2: mailto: hrefs
  for (const m of html.matchAll(/mailto:([^"'?#\s>]+)/gi)) {
    try {
      const decoded = decodeURIComponent(m[1]).toLowerCase()
      if (decoded.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(decoded)) {
        out.add(decoded)
      }
    } catch {
      // Malformed URI escape — skip
    }
  }

  // Pass 3: Cloudflare obfuscation
  for (const m of html.matchAll(/data-cfemail=["']([0-9a-fA-F]+)["']/g)) {
    const decoded = decodeCfEmail(m[1]).toLowerCase()
    if (decoded.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(decoded)) {
      out.add(decoded)
    }
  }

  return [...out]
}

// Placeholder / example domains that show up in JSON-LD templates,
// theme defaults, schema.org examples, etc. — never real creator addresses.
const PLACEHOLDER_DOMAINS = new Set([
  'example.com', 'example.org', 'example.net', 'example.co',
  'domain.com', 'yourdomain.com', 'yoursite.com', 'mysite.com',
  'mydomain.com', 'site.com', 'website.com', 'company.com',
  'yourcompany.com', 'yourbusiness.com', 'yourbrand.com',
  'test.com', 'foo.com', 'foobar.com', 'sample.com',
  'placeholder.com', 'lorem.com',
  'email.com', // common placeholder text
])

// Local-part patterns for DMARC reporting / postmaster-style addresses
// dredged out of DNS TXT records — real addresses but they only ever
// receive aggregate reports, never useful for outreach.
const DMARC_REPORT_LOCAL = /^(dmarc(-reports?|-failures?|-aggr(egate)?)?|aggregate|forensic|rua|ruf|postmaster|abuse|reports?)$/i

// Placeholder local parts seen in templates / examples
const PLACEHOLDER_LOCAL = /^(your-?(name|email)|name|email|firstname|lastname|test|placeholder|lorem|ipsum|sample|profile|user|admin|example)$/i

// Filter junk (image filenames misread as emails, platform-owned infra
// addresses, hash-shaped DSN local parts, DMARC reporting boxes,
// template placeholders, etc.).
// Exported so the admin email-test orchestrator can apply the same
// blocklist to emails coming out of the production /api/enrich pipeline.
export function isPlausibleEmail(email: string): boolean {
  if (email.length < 6 || email.length > 80) return false
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/.test(email)) return false
  if (/^[0-9.@-]+$/.test(email)) return false

  const [local, domain] = email.split('@')
  if (!local || !domain) return false

  // Platform / infrastructure domain (subdomain-aware)
  if (isPlatformDomain(domain)) return false

  // Placeholder / example domains
  if (PLACEHOLDER_DOMAINS.has(domain.toLowerCase())) return false

  // Domains that are obvious examples even if not in our list
  if (/^(your|my|sample|example|placeholder|test|foo)[a-z]*\.(com|net|org|co)$/i.test(domain)) return false

  // Hash-shaped local parts (Sentry DSNs, API keys, etc.)
  if (/^[a-f0-9]{16,}$/i.test(local)) return false

  // Common noreply patterns
  if (/^(no-?reply|donot-?reply|notifications?|alerts?|automated|system)$/i.test(local)) return false

  // DMARC reporting / postmaster local parts — real, but useless for outreach
  if (DMARC_REPORT_LOCAL.test(local)) return false

  // Placeholder local parts (your-name, profile, name, email, etc.)
  if (PLACEHOLDER_LOCAL.test(local)) return false

  return true
}

// ---------- Method 0: Creator website with enhanced extraction ----------
// Re-fetches a few core paths of the creator's site and runs the
// HTML-aware extractor (Cloudflare decode + mailto: sweep + plain
// regex) — catches the cases where the email IS in the footer but
// the production pipeline missed it because the address was hidden
// by Cloudflare's email-protection feature or was only present in
// a mailto: href attribute (not the visible text).
async function fromCreatorWebsiteEnhanced(website: string): Promise<string[]> {
  if (!website) return []
  const base = website.startsWith('http') ? website : `https://${website}`
  const root = base.replace(/\/$/, '')
  const paths = [
    '', '/contact', '/about', '/contact-us', '/get-in-touch',
    '/work-with-me', '/say-hi', '/booking', '/connect',
  ]
  const fetches = await Promise.all(paths.map(p => safeFetch(root + p, 4000)))
  const all = new Set<string>()
  for (const html of fetches) {
    for (const e of extractEmailsFromHtml(html)) all.add(e)
  }
  return [...all]
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

  // Extended platform coverage: newsletters + memberships + tipping +
  // bio-link aggregators. All public profile URLs that often expose the
  // creator's contact email.
  const candidates = [
    // Newsletters / memberships
    `https://${handle}.substack.com/about`,
    `https://www.patreon.com/${handle}`,
    `https://${handle}.beehiiv.com/about`,
    `https://${handle}.ck.page`,
    // Tipping / coffee
    `https://buymeacoffee.com/${handle}`,
    `https://ko-fi.com/${handle}`,
    `https://www.paypal.com/paypalme/${handle}`,
    // Bio-link aggregators (long tail beyond Linktree)
    `https://allmylinks.com/${handle}`,
    `https://lnk.bio/${handle}`,
    `https://bio.fm/${handle}`,
    `https://solo.to/${handle}`,
    `https://stan.store/${handle}`,
    `https://pillar.io/${handle}`,
    `https://about.me/${handle}`,
    `https://contact.me/${handle}`,
    `https://campsite.bio/${handle}`,
    `https://msha.ke/${handle}`,
    `https://withkoji.com/@${handle}`,
  ]

  const fetches = await Promise.all(candidates.map(u => safeFetch(u, 4000)))
  // Only retain the responses that actually loaded something (filter 404/empty bodies that still came back as ok)
  for (const html of fetches) {
    if (html && html.length > 200) sources.push(html)
  }
  return sources
}

// ---------- Method 6: Substack post-level scraping ----------
// Profile pages don't always show the email, but recent posts often
// have "reply to this email" footers or visible contact info.
async function fromSubstackPosts(handle: string): Promise<string[]> {
  if (!handle) return []
  const archive = await safeFetch(`https://${handle}.substack.com/archive`, 4000)
  if (!archive) return []
  // Grab the first 3 post URLs from the archive page
  const urlMatches = [...archive.matchAll(/href="(https:\/\/[^"]*?\.substack\.com\/p\/[^"]+)"/g)]
  const postUrls = [...new Set(urlMatches.map(m => m[1]))].slice(0, 3)
  if (postUrls.length === 0) return []
  return Promise.all(postUrls.map(u => safeFetch(u, 4000)))
}

// ---------- Method 7: Podcast RSS feed itunes:email ----------
// Apple Podcasts requires every show to expose <itunes:email> in its
// RSS feed. If a creator has a podcast linked anywhere, this is the
// single most reliable source.
async function fromPodcastFeed(input: MethodologyInput): Promise<string[]> {
  const haystack = [
    input.description ?? '',
    input.website ?? '',
    input.instagram ?? '',
    input.twitter ?? '',
    input.tiktok ?? '',
  ].join(' ')

  // Find candidate podcast platform URLs
  const podcastPatterns = [
    /https?:\/\/podcasts\.apple\.com\/[^\s"'<>]+/g,
    /https?:\/\/open\.spotify\.com\/show\/[^\s"'<>]+/g,
    /https?:\/\/[^\s"'<>]*?(?:anchor\.fm|buzzsprout\.com|libsyn\.com|podbean\.com|simplecast\.com|transistor\.fm|captivate\.fm|spreaker\.com)\/[^\s"'<>]*/g,
  ]
  const candidates = new Set<string>()
  for (const re of podcastPatterns) {
    for (const m of haystack.matchAll(re)) candidates.add(m[0])
  }
  if (candidates.size === 0) return []

  // For each platform URL, try to find/derive the RSS feed
  const emails: string[] = []
  for (const url of [...candidates].slice(0, 3)) {
    let rssUrl: string | null = null
    try {
      // Apple Podcasts: scrape the show page for the rss link in JSON
      if (/podcasts\.apple\.com/.test(url)) {
        const html = await safeFetch(url, 4000)
        const m = html.match(/"feedUrl"\s*:\s*"([^"]+)"/) || html.match(/feed[Uu]rl["']?[\s:=]+["']([^"']+)["']/)
        if (m) rssUrl = m[1].replace(/\\\//g, '/')
      }
      // Spotify: harder, but show pages reference the RSS sometimes
      else if (/open\.spotify\.com/.test(url)) {
        const html = await safeFetch(url, 4000)
        const m = html.match(/(https?:\/\/[^"'<>\s]+\.(?:rss|xml)[^"'<>\s]*)/i)
        if (m) rssUrl = m[1]
      }
      // Anchor / Buzzsprout / Libsyn: append /rss or have known feed URL on page
      else {
        const html = await safeFetch(url, 4000)
        const m = html.match(/(https?:\/\/[^"'<>\s]+(?:rss|feed|xml)[^"'<>\s]*)/i)
        if (m) rssUrl = m[1]
      }

      if (rssUrl) {
        const rss = await safeFetch(rssUrl, 4000)
        // <itunes:email>x@y.com</itunes:email>
        const itunesEmail = rss.match(/<itunes:email[^>]*>([^<]+)<\/itunes:email>/i)
        if (itunesEmail) emails.push(itunesEmail[1].trim().toLowerCase())
        // <managingEditor>x@y.com (Name)</managingEditor>
        const editor = rss.match(/<managingEditor[^>]*>([^<]+)<\/managingEditor>/i)
        if (editor) {
          const email = editor[1].match(EMAIL_RE)
          if (email) emails.push(email[0].toLowerCase())
        }
      }
    } catch {
      // skip individual failures
    }
  }
  return [...new Set(emails)]
}

// ---------- Method 8: JSON-LD / schema.org markup ----------
// Many sites embed `<script type="application/ld+json">{...}</script>`
// for SEO. Person / Organization / WebSite schemas often include
// "email": "...". We walk every JSON-LD block in every HTML we have.
function fromJsonLd(htmls: string[]): string[] {
  const out = new Set<string>()
  for (const html of htmls) {
    if (!html) continue
    const matches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    for (const m of matches) {
      try {
        const data = JSON.parse(m[1].trim())
        walkForEmail(data, out)
      } catch {
        // unparseable — try regex fallback on the raw block
        const fallback = m[1].match(EMAIL_RE)
        if (fallback) for (const e of fallback) out.add(e.toLowerCase())
      }
    }
  }
  return [...out]
}

function walkForEmail(node: unknown, out: Set<string>): void {
  if (!node) return
  if (typeof node === 'string') {
    // Some schemas put email as a top-level string at the "email" key
    if (node.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(node)) {
      out.add(node.toLowerCase())
    }
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) walkForEmail(item, out)
    return
  }
  if (typeof node === 'object') {
    for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
      if (key.toLowerCase().includes('email') && typeof val === 'string') {
        const cleaned = val.replace(/^mailto:/i, '').trim().toLowerCase()
        if (cleaned.includes('@')) out.add(cleaned)
      } else {
        walkForEmail(val, out)
      }
    }
  }
}

// ---------- Method 9: Multi-TLD probing ----------
// Creator's website is at joesmith.com — but they may also own
// joesmith.{co, me, io, studio, net, xyz}. Some host their actual
// "contact" or business presence on the alternate TLD.
async function fromAlternateTlds(handle: string): Promise<string[]> {
  if (!handle || handle.length < 3) return []
  const tlds = ['co', 'me', 'io', 'studio', 'net', 'xyz', 'app', 'dev']
  const candidates = tlds.map(tld => `https://${handle}.${tld}`)
  const fetches = await Promise.all(candidates.map(u => safeFetch(u, 3000)))
  return fetches.filter(html => html && html.length > 500)
}

// ---------- Method 10: Cert transparency log subdomain discovery ----------
// crt.sh exposes every SSL cert ever issued for a domain. The cert SAN
// list reveals subdomains we don't otherwise know about — e.g.
// hire@speak.creator.com only exists if 'speak.creator.com' is findable.
async function fromCertTransparency(domain: string): Promise<string[]> {
  if (!domain) return []
  try {
    const resp = await axios.get(`https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`, {
      timeout: 6000,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      validateStatus: () => true,
    })
    if (typeof resp.data === 'string' || !Array.isArray(resp.data)) return []
    const subs = new Set<string>()
    for (const row of resp.data as Array<{ name_value?: string; common_name?: string }>) {
      const names = [...(row.name_value?.split(/\n/) ?? []), row.common_name ?? '']
      for (const n of names) {
        const clean = n.trim().toLowerCase()
        if (!clean || clean.includes('*')) continue
        if (clean === domain || !clean.endsWith('.' + domain)) continue
        // Skip noisy infrastructure subdomains
        if (/^(www|cpanel|webmail|mail|smtp|ftp|cdn|static|assets|api)\./.test(clean)) continue
        subs.add(clean)
      }
    }
    // Probe up to 5 most "promising" subdomains (shortest names typically)
    const candidates = [...subs].sort((a, b) => a.length - b.length).slice(0, 5)
    const htmls = await Promise.all(candidates.map(s => safeFetch(`https://${s}`, 4000)))
    return htmls
  } catch {
    return []
  }
}

// ---------- Method 11: Multi-snapshot Wayback ----------
// Pre-GDPR (≤ 2018) site captures often had visible emails in places
// the current site doesn't. Hits multiple snapshots over time so we
// don't miss because of a single bad capture.
async function fromMultiSnapshotWayback(domain: string): Promise<string[]> {
  if (!domain) return []
  const years = [2017, 2019, 2021]
  const sources: string[] = []
  for (const year of years) {
    try {
      const avail = await axios.get(
        `https://archive.org/wayback/available?url=${encodeURIComponent(domain)}&timestamp=${year}0601`,
        { timeout: 5000, headers: { 'User-Agent': UA }, validateStatus: () => true },
      )
      const snap = (avail.data as { archived_snapshots?: { closest?: { url?: string } } })?.archived_snapshots?.closest?.url
      if (snap) {
        const html = await safeFetch(snap, 4000)
        if (html) sources.push(html)
      }
    } catch {
      // skip
    }
  }
  return sources
}

// ---------- Method 12: DNS TXT records (DMARC/SPF) ----------
// DMARC TXT records often include `rua=mailto:dmarc-reports@domain.com`.
// SPF records sometimes embed admin contacts. Real addresses, even if
// not great for outreach.
async function fromDnsTxt(domain: string): Promise<string[]> {
  if (!domain) return []
  const out = new Set<string>()
  const lookups = [domain, `_dmarc.${domain}`]
  for (const host of lookups) {
    try {
      const records = await dns.resolveTxt(host)
      for (const segs of records) {
        const joined = segs.join('')
        for (const m of joined.matchAll(/mailto:([^,;\s]+@[^,;\s]+)/gi)) {
          out.add(m[1].toLowerCase())
        }
      }
    } catch {
      // no records / NXDOMAIN
    }
  }
  return [...out]
}

// ---------- Method 13: AI vision on channel banner ----------
// Many creators put email in big text on their banner image to defeat
// scrapers. Claude vision reads the banner directly. Same model the
// AI extraction uses, just multimodal.
async function fromBannerVision(channelId: string): Promise<string | null> {
  const apiKey = process.env.AI_Score_Key
  if (!apiKey) return null
  try {
    const yt = await Innertube.create({ retrieve_player: false })
    const channel = await yt.getChannel(channelId)
    // Pull banner URL from the channel header — different shapes across
    // Innertube versions, so probe several
    const raw = JSON.stringify(channel)
    const bannerMatch = raw.match(/https?:\/\/yt3\.googleusercontent\.com\/[A-Za-z0-9_/=-]+(?:=w\d+)?[^"'\s]*/g)
    const bannerUrl = bannerMatch?.find(u => u.includes('banner') || u.length > 80)
    if (!bannerUrl) return null

    // Fetch the image bytes so we can pass as base64 to Claude
    const imgResp = await axios.get(bannerUrl, {
      responseType: 'arraybuffer',
      timeout: 5000,
      headers: { 'User-Agent': UA },
      validateStatus: () => true,
    })
    if (imgResp.status !== 200) return null
    const buf = Buffer.from(imgResp.data as ArrayBuffer)
    if (buf.length === 0 || buf.length > 5_000_000) return null

    const client = new Anthropic({ apiKey })
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: String(imgResp.headers['content-type'] || '').includes('png') ? 'image/png' : 'image/jpeg',
              data: buf.toString('base64'),
            },
          },
          {
            type: 'text',
            text: `Look at this YouTube channel banner. Is there an email address visible in the image? Reply with strict JSON: {"email": "address@domain.com"} if you see one, or {"email": null} if not. Do not invent.`,
          },
        ],
      }],
    })

    const text = resp.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('')
    const m = text.match(/\{[\s\S]*?\}/)
    if (!m) return null
    const parsed = JSON.parse(m[0]) as { email: string | null }
    if (parsed.email && parsed.email.includes('@')) return parsed.email.toLowerCase()
    return null
  } catch {
    return null
  }
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
  const tokens = input.channelName.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean)
  const handle = tokens[0] || ''
  const websiteDomain = input.website ? extractDomain(input.website) : ''

  // Per-method timeout helper — if any single method hangs, it returns
  // its empty default and the orchestrator continues. Without this, a
  // slow crt.sh or wayback lookup can block the whole Promise.all and
  // push the orchestrator past its Vercel function timeout.
  const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
    ])

  // Run all the cheap sources in parallel — DNS, HTTP fetches, RSS,
  // youtubei calls. ~13 methods firing simultaneously, each with its
  // own per-method timeout budget.
  const empty: string[] = []
  const [
    videoDescs,
    sitemapHtmls,
    platformHtmls,
    communityChunks,
    websiteEmails,
    podcastEmails,
    altTldHtmls,
    certHtmls,
    waybackHtmls,
    dnsTxtEmails,
    substackPosts,
  ] = await Promise.all([
    withTimeout(recentVideoDescriptions(input.channelId), 12_000, empty),
    input.website ? withTimeout(fromSitemap(input.website), 8_000, empty) : Promise.resolve(empty),
    withTimeout(fromCreatorPlatforms(input), 10_000, empty),
    withTimeout(fromCommunityTab(input.channelId), 8_000, empty),
    input.website ? withTimeout(fromCreatorWebsiteEnhanced(input.website), 10_000, empty) : Promise.resolve(empty),
    withTimeout(fromPodcastFeed(input), 8_000, empty),
    handle ? withTimeout(fromAlternateTlds(handle), 6_000, empty) : Promise.resolve(empty),
    websiteDomain ? withTimeout(fromCertTransparency(websiteDomain), 8_000, empty) : Promise.resolve(empty),
    websiteDomain ? withTimeout(fromMultiSnapshotWayback(websiteDomain), 8_000, empty) : Promise.resolve(empty),
    // DNS TXT method disabled — returns ~100% DMARC reporting addresses
    // which are real but useless for outreach. Keep the function around
    // in case we want to revisit, but skip it from the orchestrator.
    Promise.resolve<string[]>([]),
    handle ? withTimeout(fromSubstackPosts(handle), 8_000, empty) : Promise.resolve(empty),
  ])

  // JSON-LD parsing across every HTML we fetched — sites embed
  // person/org schemas with email fields directly, no scraping needed.
  const jsonLdEmails = fromJsonLd([
    ...sitemapHtmls,
    ...platformHtmls,
    ...altTldHtmls,
    ...certHtmls,
    ...waybackHtmls,
    ...substackPosts,
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

  // Highest-trust sources first (later inserts of the same email
  // are dropped by the seen-set so the BEST evidence wins).
  tryAdd(podcastEmails, 'podcast_feed', 'in <itunes:email> of an RSS feed')
  tryAdd(jsonLdEmails, 'json_ld', 'in JSON-LD / schema.org markup')
  for (const d of videoDescs) tryAdd(extractEmails(d), 'video_description', 'in a recent video description')
  tryAdd(websiteEmails, 'website_enhanced', 'on creator website (Cloudflare-decoded or mailto:)')
  for (const html of sitemapHtmls) tryAdd(extractEmailsFromHtml(html), 'sitemap_page', 'on a sitemap-discovered page')
  for (const html of platformHtmls) tryAdd(extractEmailsFromHtml(html), 'creator_platform', 'on Substack/Patreon/Ko-fi/etc. profile')
  for (const html of substackPosts) tryAdd(extractEmailsFromHtml(html), 'substack_post', 'in a recent Substack post')
  for (const html of altTldHtmls) tryAdd(extractEmailsFromHtml(html), 'alternate_tld', 'on a sibling-TLD domain')
  for (const html of certHtmls) tryAdd(extractEmailsFromHtml(html), 'subdomain_discovery', 'on a subdomain found via cert transparency')
  for (const html of waybackHtmls) tryAdd(extractEmailsFromHtml(html), 'wayback_snapshot', 'in an older Wayback snapshot')
  tryAdd(dnsTxtEmails, 'dns_txt', 'in DMARC/SPF DNS record')
  for (const c of communityChunks) tryAdd(extractEmails(c), 'community_post', 'in a Community-tab post')

  // Build AI corpus + AI fallback (text-only, cheap)
  const corpus = [
    input.description || '',
    ...videoDescs,
    ...sitemapHtmls.map(h => cheerio.load(h)('body').text().slice(0, 5000)),
    ...platformHtmls.map(h => cheerio.load(h)('body').text().slice(0, 5000)),
    ...altTldHtmls.map(h => cheerio.load(h)('body').text().slice(0, 5000)),
    ...substackPosts.map(h => cheerio.load(h)('body').text().slice(0, 5000)),
    ...communityChunks,
  ].join('\n').slice(0, 20000)

  if (hits.length === 0 && corpus.trim()) {
    const ai = await withTimeout(aiExtract(corpus), 12_000, null as { email: string; reasoning: string } | null)
    if (ai) hits.push({ email: ai.email, method: 'ai_extraction', evidence: ai.reasoning })
  }

  // Last-resort: AI vision on the channel banner. Only fires if every
  // text-based method came up empty. Many creators put email in big
  // text on their banner art specifically to defeat regex scrapers.
  if (hits.length === 0) {
    const visionEmail = await withTimeout(fromBannerVision(input.channelId), 15_000, null as string | null)
    if (visionEmail && isPlausibleEmail(visionEmail)) {
      hits.push({
        email: visionEmail,
        method: 'banner_vision',
        evidence: 'visible in channel banner image (AI vision)',
      })
    }
  }

  return {
    email: hits[0]?.email ?? null,
    hits,
    bytesScanned: corpus.length,
  }
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}
