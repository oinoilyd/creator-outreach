// "Educated assumption" — evidence-only email discovery for creators that
// came up empty after primary enrichment. NEVER invents addresses; only
// returns ones whose pattern is literally written somewhere in the
// creator's footprint (website + Linktree + social bios + About).
//
// Two ways an address can be "found":
//   1) Direct: a literal `[local]@[creator's domain]` string anywhere in
//      the corpus, or a `mailto:[local]@[creator's domain]` href.
//   2) Obfuscated: scrape-resistant forms like `info [at] domain [dot]
//      com` — bracket/paren variants AND foreign-language wording
//      (Spanish "arroba"/"punto", French "arobase"/"point").
//
// No first-name guessing. No handle inference. No co-occurrence scoring.
// If the address pattern isn't in their actual content, we don't return it.

import axios from 'axios'
import * as cheerio from 'cheerio'
import { promises as dns } from 'dns'
import { withScrapeBackoffFor, type ScrapePlatform } from './scrape-politeness'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

export interface AssumptionInput {
  channelId: string
  channelName: string
  description?: string
  website?: string
  instagram?: string
  twitter?: string
  tiktok?: string
  linkedin?: string
}

export interface CandidateResult {
  email: string
  confidence: number
  evidence: string
}

export interface AssumptionOutput {
  email: string | null
  candidates: CandidateResult[]
  corpusBytes: number
  hadMx: boolean
}

const FREE_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com',
  'aol.com', 'icloud.com', 'me.com', 'protonmail.com', 'proton.me',
  'pm.me', 'mail.com', 'gmx.com', 'yandex.com', 'zoho.com',
])

// Pick the platform profile from the URL host. The "educated
// assumption" pipeline scrapes creator websites + their public social
// pages — IG-grade retry on every URL was the wrong default. Platform-
// aware backoff cuts the worst case from ~4.5s/page on 503 down to
// ~1s on the lighter profiles. 2026-05-12 per Dylan.
function platformForUrl(url: string): ScrapePlatform {
  if (/(^|\.)youtube\.com\/|youtu\.be\//.test(url)) return 'youtube'
  if (/(^|\.)tiktok\.com\//.test(url)) return 'tiktok'
  if (/(^|\.)(twitter|x)\.com\//.test(url)) return 'twitter'
  if (/(^|\.)linkedin\.com\//.test(url)) return 'linkedin'
  if (/(^|\.)instagram\.com\//.test(url)) return 'instagram'
  return 'generic'
}

async function safeFetch(url: string, timeoutMs = 5000): Promise<string> {
  // Wrapped in withScrapeBackoffFor (2026-05-12) so 429 / 5xx don't
  // silently produce empty corpora — but on a right-sized retry
  // budget per platform.
  try {
    const resp = await withScrapeBackoffFor(
      platformForUrl(url),
      async () => axios.get(url, {
        timeout: timeoutMs,
        maxRedirects: 3,
        validateStatus: () => true,
        headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
        responseType: 'text',
      }),
    )
    if (typeof resp.data === 'string') return resp.data
    return ''
  } catch {
    return ''
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

function ogDescription(html: string): string {
  if (!html) return ''
  try {
    const $ = cheerio.load(html)
    const og = $('meta[property="og:description"]').attr('content') || ''
    const tw = $('meta[name="twitter:description"]').attr('content') || ''
    const desc = $('meta[name="description"]').attr('content') || ''
    return [og, tw, desc].filter(Boolean).join(' \n ')
  } catch {
    return ''
  }
}

function visibleText(html: string): string {
  if (!html) return ''
  try {
    const $ = cheerio.load(html)
    $('script, style, noscript').remove()
    return $('body').text().replace(/\s+/g, ' ').slice(0, 50000)
  } catch {
    return html.slice(0, 50000)
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function buildCorpus(input: AssumptionInput): Promise<{ corpus: string; byMx: boolean; domain: string }> {
  const domain = input.website ? extractDomain(input.website) : ''

  const sources: string[] = []
  if (input.description) sources.push(input.description)

  // Website: a few high-signal paths. Keep raw HTML in the corpus too —
  // mailto:foo@x.com inside an href attribute won't survive .text().
  if (input.website) {
    const base = input.website.startsWith('http') ? input.website : `https://${input.website}`
    const paths = ['', '/contact', '/about', '/press', '/partnerships']
    const fetches = await Promise.all(paths.map(p => safeFetch(base.replace(/\/$/, '') + p, 4000)))
    for (const html of fetches) {
      sources.push(visibleText(html))
      sources.push(html.slice(0, 30000))
    }
  }

  // Social profiles via og:description + visible body
  const socialUrls = [input.instagram, input.twitter, input.tiktok, input.linkedin].filter(Boolean) as string[]
  const socialFetches = await Promise.all(socialUrls.map(u => safeFetch(u, 4000)))
  for (const html of socialFetches) {
    sources.push(ogDescription(html))
    sources.push(visibleText(html).slice(0, 5000))
  }

  // MX check — domain must accept mail at all
  let byMx = false
  if (domain) {
    try {
      const records = await dns.resolveMx(domain)
      byMx = records.length > 0
    } catch {
      byMx = false
    }
  }

  return { corpus: sources.join('\n').toLowerCase(), byMx, domain }
}

// Sweep the corpus for any address at the creator's domain — direct
// hits and mailto: links both fall out of a single regex because mailto
// URLs contain the address verbatim.
function findDirect(corpus: string, domain: string): CandidateResult[] {
  const re = new RegExp(`[a-z0-9._%+-]+@${escapeRe(domain)}\\b`, 'gi')
  const out: CandidateResult[] = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(corpus)) !== null) {
    const email = m[0].toLowerCase()
    if (seen.has(email)) continue
    seen.add(email)
    out.push({
      email,
      confidence: 0.95,
      evidence: 'direct address found in scraped corpus',
    })
  }
  return out
}

// Sweep for obfuscated forms: any local part "at" the creator's domain
// "dot" tld, with bracket / paren variants, English / Spanish / French
// wording. Captures only addresses where the domain matches — same
// guarantee as findDirect: the address has to actually be on their
// content, just intentionally hidden.
function findObfuscated(corpus: string, domain: string): CandidateResult[] {
  const parts = domain.split('.')
  const at = '\\s*[\\[\\(\\{]?\\s*(?:at|@|arroba|arobase)\\s*[\\]\\)\\}]?\\s*'
  const dotJoin = parts
    .map(p => escapeRe(p))
    .join('\\s*[\\[\\(\\{]?\\s*(?:dot|punto|point)\\s*[\\]\\)\\}]?\\s*')
  const re = new RegExp(`([a-z0-9._-]{1,40})${at}${dotJoin}`, 'gi')

  const out: CandidateResult[] = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(corpus)) !== null) {
    const local = m[1].toLowerCase()
    // Skip noise: local can't be a digit-only sequence or super-short.
    if (local.length < 2 || /^\d+$/.test(local)) continue
    const email = `${local}@${domain}`
    if (seen.has(email)) continue
    seen.add(email)
    out.push({
      email,
      confidence: 0.85,
      evidence: `obfuscated form on page: "${m[0].slice(0, 80)}"`,
    })
  }
  return out
}

export async function educatedAssumption(input: AssumptionInput): Promise<AssumptionOutput> {
  const { corpus, byMx, domain } = await buildCorpus(input)

  if (!domain || FREE_DOMAINS.has(domain)) {
    return { email: null, candidates: [], corpusBytes: corpus.length, hadMx: byMx }
  }
  if (!byMx) {
    return { email: null, candidates: [], corpusBytes: corpus.length, hadMx: false }
  }

  const direct = findDirect(corpus, domain)
  const obfuscated = findObfuscated(corpus, domain)

  // Direct wins on dedupe — same email found both ways = direct.
  const seen = new Set(direct.map(c => c.email))
  const all = [...direct, ...obfuscated.filter(c => !seen.has(c.email))]
  all.sort((a, b) => b.confidence - a.confidence)

  return {
    email: all[0]?.email ?? null,
    candidates: all,
    corpusBytes: corpus.length,
    hadMx: true,
  }
}
