// "Educated assumption" — smart fallback that fires when the regular
// enrichment pipeline came up empty. Instead of blasting blunt patterns
// (info@/hello@/contact@) and hoping, we generate candidates AND require
// each to have evidence in the creator's own digital footprint.
//
// Flow per candidate:
//   1) Build an evidence corpus from website + linktree + social bios +
//      YouTube About (everything we'd pull during normal enrichment).
//   2) For each candidate (info@, hello@, firstname@, etc.) score it
//      against the corpus: direct hit, mailto, obfuscated ("info [at]
//      domain [dot] com"), local+domain co-occurrence, handle match.
//   3) MX-record check on the domain — drop every candidate if the
//      domain doesn't accept mail at all.
//   4) Return only candidates above a confidence threshold.
//
// Self-contained: re-fetches what it needs so we don't have to thread
// the raw HTML out of the production enrich pipeline.

import axios from 'axios'
import * as cheerio from 'cheerio'
import { promises as dns } from 'dns'

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

const MIN_CONFIDENCE = 0.50

const ROLE_LOCALS = [
  'info', 'hello', 'contact', 'team', 'hi',
  'press', 'partnerships', 'business', 'sponsor', 'sponsorships',
  'brand', 'collab', 'collabs', 'collaborations',
  'support', 'help', 'inquiries', 'booking', 'media',
]

const FREE_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com',
  'aol.com', 'icloud.com', 'me.com', 'protonmail.com', 'proton.me',
  'pm.me', 'mail.com', 'gmx.com', 'yandex.com', 'zoho.com',
])

async function safeFetch(url: string, timeoutMs = 5000): Promise<string> {
  try {
    const resp = await axios.get(url, {
      timeout: timeoutMs,
      maxRedirects: 3,
      validateStatus: () => true,
      headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
      responseType: 'text',
    })
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

function parseFirstName(channelName: string): string {
  const cleaned = channelName.replace(/[^A-Za-z\s]/g, ' ').trim()
  const first = cleaned.split(/\s+/)[0] || ''
  return first.toLowerCase()
}

function parseHandle(url: string): string {
  if (!url) return ''
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    const seg = u.pathname.split('/').filter(Boolean)[0] || ''
    return seg.replace(/^@/, '').toLowerCase()
  } catch {
    return ''
  }
}

async function buildCorpus(input: AssumptionInput): Promise<{ corpus: string; byMx: boolean; domain: string }> {
  const domain = input.website ? extractDomain(input.website) : ''

  const sources: string[] = []
  if (input.description) sources.push(input.description)

  // Website: a few high-signal paths
  if (input.website) {
    const base = input.website.startsWith('http') ? input.website : `https://${input.website}`
    const paths = ['', '/contact', '/about', '/press', '/partnerships']
    const fetches = await Promise.all(paths.map(p => safeFetch(base.replace(/\/$/, '') + p, 4000)))
    for (const html of fetches) {
      sources.push(visibleText(html))
      // also keep raw HTML — mailto: and obfuscation patterns may live in attrs
      sources.push(html.slice(0, 30000))
    }
  }

  // Social bios via og:description
  const socialUrls = [input.instagram, input.twitter, input.tiktok, input.linkedin].filter(Boolean) as string[]
  const socialFetches = await Promise.all(socialUrls.map(u => safeFetch(u, 4000)))
  for (const html of socialFetches) {
    sources.push(ogDescription(html))
    sources.push(visibleText(html).slice(0, 5000))
  }

  // MX check is a cheap parallel
  let byMx = false
  if (domain) {
    try {
      const records = await dns.resolveMx(domain)
      byMx = records.length > 0
    } catch {
      byMx = false
    }
  }

  const corpus = sources.join('\n').toLowerCase()
  return { corpus, byMx, domain }
}

// Build the candidate set: role aliases + the creator's first name +
// social handles + simple firstname/lastname combos.
function generateCandidates(input: AssumptionInput, domain: string): string[] {
  if (!domain || FREE_DOMAINS.has(domain)) return []

  const locals = new Set<string>()
  for (const r of ROLE_LOCALS) locals.add(r)

  const first = parseFirstName(input.channelName)
  if (first.length >= 2) {
    locals.add(first)
    locals.add(first[0])
  }

  const tokens = input.channelName.replace(/[^A-Za-z\s]/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (tokens.length >= 2) {
    const f = tokens[0].toLowerCase()
    const l = tokens[tokens.length - 1].toLowerCase()
    locals.add(`${f}${l}`)
    locals.add(`${f}.${l}`)
    locals.add(`${f[0]}${l}`)
    locals.add(`${f}${l[0]}`)
    locals.add(`${f}.${l[0]}`)
  }

  for (const url of [input.instagram, input.twitter, input.tiktok, input.linkedin]) {
    const h = parseHandle(url || '')
    if (h && /^[a-z0-9._-]{2,30}$/.test(h)) locals.add(h)
  }

  return [...locals].filter(l => /^[a-z0-9._-]{1,40}$/.test(l)).map(l => `${l}@${domain}`)
}

// Detect obfuscated email patterns: "local at domain dot tld" with
// brackets/parens/spaces and English/Spanish/French wording.
function obfuscationRegex(local: string, domain: string): RegExp {
  const parts = domain.split('.')
  const dPattern = parts.map(p => escape(p)).join('\\s*[\\[\\(]?\\s*(?:dot|punto|point)\\s*[\\]\\)]?\\s*')
  const at = '\\s*[\\[\\(]?\\s*(?:at|@|arroba|arobase)\\s*[\\]\\)]?\\s*'
  return new RegExp(escape(local) + at + dPattern, 'i')
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function scoreCandidate(email: string, domain: string, corpus: string, input: AssumptionInput): { confidence: number; evidence: string } {
  const local = email.split('@')[0]
  const lower = email.toLowerCase()

  // 0.95 — Direct address literal in the corpus
  if (corpus.includes(lower)) {
    return { confidence: 0.95, evidence: `direct address found in corpus` }
  }
  // 0.95 — mailto: form (already lowercased)
  if (corpus.includes(`mailto:${lower}`)) {
    return { confidence: 0.95, evidence: `mailto: link in source` }
  }
  // 0.85 — Obfuscated form
  const obf = obfuscationRegex(local, domain)
  const m = corpus.match(obf)
  if (m) {
    return { confidence: 0.85, evidence: `obfuscated form: "${m[0].slice(0, 60)}"` }
  }
  // 0.50 — Co-occurrence within ~50 words
  const localIdx = corpus.indexOf(local)
  const domainIdx = corpus.indexOf(domain)
  if (localIdx >= 0 && domainIdx >= 0) {
    const distance = Math.abs(localIdx - domainIdx)
    if (distance < 300) {
      return { confidence: 0.50, evidence: `local "${local}" + domain "${domain}" co-occur within ~50 words` }
    }
  }
  // 0.45 — Handle confirmation: local matches a social handle that's also referenced in corpus
  for (const url of [input.instagram, input.twitter, input.tiktok, input.linkedin]) {
    const h = parseHandle(url || '')
    if (h && h === local && corpus.includes(h)) {
      return { confidence: 0.45, evidence: `local matches social handle "${h}" referenced on profile` }
    }
  }
  // 0.30 — First-name only
  const first = parseFirstName(input.channelName)
  if (first && local === first) {
    return { confidence: 0.30, evidence: `local matches creator's first name "${first}"` }
  }

  // 0.10 — Generic role pattern with no other evidence (filtered out by threshold)
  return { confidence: 0.10, evidence: `role pattern, no evidence in corpus` }
}

export async function educatedAssumption(input: AssumptionInput): Promise<AssumptionOutput> {
  const { corpus, byMx, domain } = await buildCorpus(input)

  if (!domain) {
    return { email: null, candidates: [], corpusBytes: corpus.length, hadMx: false }
  }
  if (!byMx) {
    return { email: null, candidates: [], corpusBytes: corpus.length, hadMx: false }
  }

  const raw = generateCandidates(input, domain)
  const scored: CandidateResult[] = raw.map(email => {
    const { confidence, evidence } = scoreCandidate(email, domain, corpus, input)
    return { email, confidence, evidence }
  })

  // Filter to threshold, dedupe, sort
  const seen = new Set<string>()
  const passed = scored
    .filter(c => c.confidence >= MIN_CONFIDENCE)
    .filter(c => {
      if (seen.has(c.email)) return false
      seen.add(c.email)
      return true
    })
    .sort((a, b) => b.confidence - a.confidence)

  return {
    email: passed[0]?.email ?? null,
    candidates: passed,
    corpusBytes: corpus.length,
    hadMx: true,
  }
}
