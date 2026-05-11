import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { isSafeExternalUrl, clampString } from '@/lib/security'
import { shouldSkip, recordFailure, recordSuccess, delay } from '@/lib/scrape-circuit-breaker'
import { withScrapeBackoff } from '@/lib/scrape-politeness'
import { requireUser, rateLimit } from '@/lib/api-auth'
import { cacheGet, cacheSet, enrichmentCacheKey, CACHE_TTL, cacheBumpCounter } from '@/lib/cache'
import { saveEnrichmentSnapshot, getLatestEnrichment } from '@/lib/creator-enrichment'
import { newMethodology, isPlausibleEmail } from '@/lib/newMethodology'
import { publishJob, isQStashConfigured } from '@/lib/qstash'
import { extractInstagramHandle, isInstagramGraphConfigured } from '@/lib/instagram-graph'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function fetchHtml(url: string, timeout = 8000): Promise<string> {
  // Wrapped in withScrapeBackoff (2026-05-10) so transient 429 / 5xx
  // from YouTube About pages, RSS feeds, /videos / /shorts tabs, and
  // DuckDuckGo HTML search don't silently return empty strings.
  // Empties cascade into missing emails, missing recency data, and
  // missing socials — visible quality regressions for the user.
  const { data } = await withScrapeBackoff(
    async () => axios.get(url, {
      timeout,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    }),
    {
      maxRetries: 2,
      retryStatuses: [429, 503, 504],
    },
  )
  return data as string
}

// Substring patterns that disqualify an extracted email upfront. Includes
// every platform-infra domain we've seen leak through, so the regex
// doesn't even surface them as candidates. Same nuclear list the admin
// scrub uses, applied at extraction time so bestEmail() never sees them.
// 2026-05-08 expanded to drop generic press / news / media inboxes.
// CBS News showed up as a top result for "travel agent" with a
// press@cbs.com style email — exactly the kind of result Dylan
// doesn\\'t want in the queue. The ^press|news|media|pr|editor|tips@
// alternation catches those without listing every news domain by hand.
const BAD_EMAIL = /stanwith|stan\.store|patreon\.com|@.+\.sentry\.io|@sentry\.io|buymeacoffee|ko-?fi|allmylinks|lnk\.bio|bio\.fm|solo\.to|pillar\.io|about\.me|msha\.ke|withkoji|campsite\.bio|beehiiv|substack|convertkit|mailchimp|gumroad|example|duckduckgo|wixpress|w3\.org|schema\.org|noreply|no-reply|@yourdomain|@yoursite|@yourcompany|dmarc-reports?@|aggregate@|forensic@|rua@|ruf@|@2x|\.png|\.jpg|\.svg|\.gif|\.webp|\.css|\.js|^(press|news|media|pr|editor|editors|tips|newsroom|newsdesk|releases|publicity|advertising)@|@(cbsnews|nbcnews|abcnews|foxnews|cnn|reuters|bbc|nytimes|wsj|bloomberg|axios|politico|theguardian|forbes|wired)\.|@(ap|reuters)\.org/i

function extractEmails(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
  return [...new Set(matches.filter(e => !BAD_EMAIL.test(e)))]
}

function bestEmail(emails: string[]): string {
  const priority = emails.find(e => /contact|info|hello|business|collab|partner|media|pr@|sponsor/i.test(e))
  return priority || emails[0] || ''
}

function normalizeUrl(url: string): string {
  if (!url) return ''
  const u = url.trim()
  if (u.startsWith('http://') || u.startsWith('https://')) return u
  return 'https://' + u
}

const SOCIAL_DOMAIN = /facebook\.com|instagram\.com|twitter\.com|x\.com|tiktok\.com|youtube\.com|linkedin\.com/i

function extractYtInitialData(html: string): any | null {
  try {
    const marker = 'var ytInitialData = '
    const start = html.indexOf(marker)
    if (start === -1) return null
    const jsonStart = html.indexOf('{', start)
    if (jsonStart === -1) return null
    let depth = 0
    let i = jsonStart
    for (; i < html.length; i++) {
      if (html[i] === '{') depth++
      else if (html[i] === '}') { depth--; if (depth === 0) break }
    }
    return JSON.parse(html.substring(jsonStart, i + 1))
  } catch { return null }
}

function deepCollect(obj: any, key: string, results: any[] = [], depth = 0): any[] {
  if (depth > 25 || !obj || typeof obj !== 'object') return results
  if (Array.isArray(obj)) { obj.forEach(v => deepCollect(v, key, results, depth + 1)); return results }
  if (obj[key] !== undefined) results.push(obj[key])
  Object.values(obj).forEach(v => deepCollect(v, key, results, depth + 1))
  return results
}

// SOURCE 1: YouTube About page — uses current aboutChannelViewModel / channelExternalLinkViewModel structure
async function fromYouTubeAbout(channelId: string): Promise<{ emails: string[], socials: Record<string, string>, subscribers: string }> {
  const socials: Record<string, string> = {}
  const emails: string[] = []
  let subscribers = ''
  try {
    const html = await fetchHtml(`https://www.youtube.com/channel/${channelId}/about`)
    const data = extractYtInitialData(html)
    if (!data) return { emails, socials, subscribers }

    // aboutChannelViewModel holds description + subscriberCountText
    const aboutVMs: any[] = deepCollect(data, 'aboutChannelViewModel')
    const vm = aboutVMs[0]
    if (vm) {
      if (typeof vm.description === 'string') emails.push(...extractEmails(vm.description))
      if (typeof vm.subscriberCountText === 'string') {
        subscribers = vm.subscriberCountText.replace(/subscribers?/i, '').trim()
      }
    }

    // channelExternalLinkViewModel holds all external links (website, socials, and sometimes email links)
    const extLinks: any[] = deepCollect(data, 'channelExternalLinkViewModel')
    for (const ext of extLinks) {
      const rawUrl = ext.link?.content || ''
      if (!rawUrl) continue

      // Some creators list email as a link (e.g. title="📧 Email", url="info@example.com")
      if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(rawUrl) && !BAD_EMAIL.test(rawUrl)) {
        emails.push(rawUrl)
        continue
      }

      const url = normalizeUrl(rawUrl)
      if (!socials.instagram && rawUrl.includes('instagram.com')) socials.instagram = url
      if (!socials.twitter && (rawUrl.includes('twitter.com') || rawUrl.includes('x.com'))) socials.twitter = url
      if (!socials.tiktok && rawUrl.includes('tiktok.com')) socials.tiktok = url
      // accept both linkedin.com/in/ (personal) and linkedin.com/company/ (business)
      if (!socials.linkedin && rawUrl.includes('linkedin.com')) socials.linkedin = url
      if (!socials.website && !SOCIAL_DOMAIN.test(rawUrl)) socials.website = url
    }

  } catch { /* failed */ }
  return { emails, socials, subscribers }
}

// SOURCE 2a: YouTube RSS feed — exact ISO dates, works for most channels
async function fromRSS(channelId: string): Promise<string[]> {
  const xml = await fetchHtml(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, 6000)
  const entries = [...xml.matchAll(/<entry[\s\S]*?<\/entry>/g)]
  const dates: string[] = []
  for (const entry of entries) {
    if (dates.length >= 2) break
    const m = entry[0].match(/<published>([^<]+)<\/published>/)
    if (!m) continue
    const d = new Date(m[1])
    if (isNaN(d.getTime())) continue
    const days = Math.floor((Date.now() - d.getTime()) / 86400000)
    let label: string
    if (days === 0) label = 'today'
    else if (days < 30) label = `${days} day${days === 1 ? '' : 's'} ago`
    else if (days < 60) label = '1 month ago'
    else if (days < 365) label = `${Math.floor(days / 30)} months ago`
    else label = `${Math.floor(days / 365)} year${Math.floor(days / 365) === 1 ? '' : 's'} ago`
    dates.push(label)
  }
  if (dates.length === 0) throw new Error('no RSS entries')
  return dates
}

// SOURCE 2b: /videos page scrape — fallback when RSS returns 404
function parseViewText(raw: any): number {
  const text: string = typeof raw === 'string' ? raw : (raw?.simpleText || raw?.runs?.[0]?.text || '')
  if (!text) return NaN
  const t = text.replace(/,/g, '').toLowerCase()
  const m = t.match(/[\d.]+/)
  if (!m) return NaN
  const n = parseFloat(m[0])
  if (t.includes('b')) return Math.round(n * 1_000_000_000)
  if (t.includes('m')) return Math.round(n * 1_000_000)
  if (t.includes('k')) return Math.round(n * 1_000)
  return Math.round(n)
}

async function fromVideosPage(channelId: string): Promise<{ dates: string[], avgViews: number }> {
  const html = await fetchHtml(`https://www.youtube.com/channel/${channelId}/videos`, 8000)
  const data = extractYtInitialData(html)
  if (!data) return { dates: [], avgViews: NaN }

  const dates: string[] = []
  const publishedTexts: any[] = deepCollect(data, 'publishedTimeText')
  for (const t of publishedTexts) {
    const text: string = typeof t === 'string' ? t : (t?.simpleText || t?.runs?.[0]?.text || '')
    if (text && dates.length < 2) dates.push(text)
  }

  const viewCounts: number[] = []
  const viewTexts: any[] = deepCollect(data, 'viewCountText')
  for (const v of viewTexts) {
    const n = parseViewText(v)
    if (!isNaN(n) && n >= 0) viewCounts.push(n)
    if (viewCounts.length >= 10) break
  }
  // Median, not mean — viral outliers (one 5M-view hit among 9
  // thirty-K videos) drag the mean to a number that doesn't reflect
  // the channel's typical performance. Median answers "what does this
  // creator usually get?" which is the question users actually have
  // when they look at the avgViews column.
  const avgViews = viewCounts.length > 0 ? medianOf(viewCounts) : NaN

  return { dates, avgViews }
}

/** Median of a numeric array, rounded to int. Returns NaN for empty. */
function medianOf(arr: number[]): number {
  if (arr.length === 0) return NaN
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

// SOURCE 2: try RSS first (exact dates), fall back to /videos page scrape
async function fromYouTubeVideos(channelId: string): Promise<{ dates: string[], avgViews: number }> {
  const [rssResult, videosResult] = await Promise.allSettled([
    fromRSS(channelId),
    fromVideosPage(channelId),
  ])
  const rss = rssResult.status === 'fulfilled' ? rssResult.value : []
  const videos = videosResult.status === 'fulfilled' ? videosResult.value : { dates: [], avgViews: NaN }
  const dates = rss.length > 0 ? rss : videos.dates
  return { dates, avgViews: videos.avgViews }
}

// Same shape as fromVideosPage but hits /shorts. Lets us track when
// the channel last posted a Short separately from a long-form video,
// since some creators post mostly Shorts and some never touch them.
async function fromShortsPage(channelId: string): Promise<string[]> {
  const html = await fetchHtml(`https://www.youtube.com/channel/${channelId}/shorts`, 8000)
  const data = extractYtInitialData(html)
  if (!data) return []
  const dates: string[] = []
  const publishedTexts: unknown[] = deepCollect(data, 'publishedTimeText')
  for (const t of publishedTexts) {
    const obj = t as { simpleText?: string; runs?: { text?: string }[] }
    const text: string = typeof t === 'string' ? t : (obj?.simpleText || obj?.runs?.[0]?.text || '')
    if (text && dates.length < 2) dates.push(text)
  }
  return dates
}

// SOURCE 3: DuckDuckGo — find LinkedIn profile for a creator by name
function decodeDDGUrl(raw: string): string {
  try {
    const u = new URL('https://duckduckgo.com' + (raw.startsWith('/') ? raw : '/' + raw))
    const uddg = u.searchParams.get('uddg')
    if (uddg) return decodeURIComponent(uddg)
  } catch { /* ignore */ }
  return raw
}

function extractLinkedInUrl(links: string[]): string {
  for (const raw of links) {
    const decoded = decodeDDGUrl(raw)
    if (decoded.includes('linkedin.com/in/') || decoded.includes('linkedin.com/company/')) {
      return decoded.startsWith('http') ? decoded : `https://${decoded}`
    }
  }
  return ''
}

async function fromDDGLinkedIn(name: string): Promise<string> {
  if (!name) return ''
  try {
    const q = encodeURIComponent(`"${name}" site:linkedin.com/in`)
    const html = await fetchHtml(`https://html.duckduckgo.com/html/?q=${q}`, 7000)
    const $ = cheerio.load(html)
    const links = $('a[href]').map((_, el) => $(el).attr('href') || '').get()
    const result = extractLinkedInUrl(links)
    if (result) return result
    // also try /company/ variant
    const q2 = encodeURIComponent(`"${name}" site:linkedin.com`)
    const html2 = await fetchHtml(`https://html.duckduckgo.com/html/?q=${q2}`, 5000)
    const $2 = cheerio.load(html2)
    const links2 = $2('a[href]').map((_, el) => $2(el).attr('href') || '').get()
    return extractLinkedInUrl(links2)
  } catch { /* failed */ }
  return ''
}

// SOURCE 4: DuckDuckGo — find email for a creator by name. Now always runs
// the full set of queries (used to be gated on a `deep` flag) so every
// enrichment gets the broader email coverage. `aggressive` adds another
// pass with brand / partnership-focused angles for a deeper retry.
async function fromDDGEmail(name: string, website: string, niche?: string, aggressive: boolean = false): Promise<string[]> {
  if (!name) return []
  const allEmails: string[] = []
  try {
    const site = website ? website.replace(/^https?:\/\//, '').replace(/\/$/, '') : ''
    const queries: string[] = [
      `"${name}" email`,
      `"${name}" contact email`,
      `"${name}" business email`,
      `"${name}" sponsor`,
      `"${name}" press contact`,
      `"${name}" partnership`,
      `"${name}" booking email`,
      `"${name}" "@gmail.com"`,
      `"${name}" "@protonmail.com"`,
      `"${name}" management contact`,
    ]
    if (site) {
      queries.push(`site:${site} email`)
      queries.push(`site:${site} contact`)
      queries.push(`site:${site} press`)
    }
    if (niche) {
      queries.push(`"${name}" ${niche} email`)
      queries.push(`"${name}" ${niche} contact`)
    }
    if (aggressive) {
      queries.push(
        `"${name}" press kit`,
        `"${name}" media kit`,
        `"${name}" rate card`,
        `"${name}" brand partnerships`,
        `"${name}" collab inquiries`,
        `"${name}" "@yahoo.com"`,
        `"${name}" "@outlook.com"`,
        `"${name}" "@icloud.com"`,
      )
      if (site) {
        queries.push(`site:${site} "@" press`)
        queries.push(`site:${site} sponsor`)
        queries.push(`site:${site} partnership`)
      }
    }
    // DDG circuit breaker — if we've been rate-limited recently, skip
    // entirely. Otherwise space queries 250ms apart to avoid bursting
    // DDG and triggering Vercel-IP bans.
    if (shouldSkip('ddg')) {
      // Circuit open — don't burn timeouts on calls that will fail.
      return allEmails
    }
    let ddgFailures = 0
    for (let i = 0; i < queries.length; i++) {
      if (i > 0) await delay(250)
      try {
        const q = encodeURIComponent(queries[i])
        const timeout = aggressive ? 9000 : 6000
        const html = await fetchHtml(`https://html.duckduckgo.com/html/?q=${q}`, timeout)
        allEmails.push(...extractEmails(html))
        recordSuccess('ddg')
      } catch {
        ddgFailures++
        // Only mark as a circuit-breaker failure for repeated misses
        // within this single enrichment — don't open the breaker on
        // single timeouts.
        if (ddgFailures >= 3) {
          recordFailure('ddg')
          break
        }
      }
    }
  } catch { /* failed */ }
  return allEmails
}

// SOURCE 5: scrape website contact pages for email and LinkedIn links.
// Now always tries the broader page set (used to be gated on deep). Higher
// success rate at the cost of ~1-2s extra per channel — acceptable.
async function fromWebsite(rawUrl: string): Promise<{ emails: string[], socials: Record<string, string> }> {
  const socials: Record<string, string> = {}
  const allEmails: string[] = []
  const url = normalizeUrl(rawUrl)
  if (!url || SOCIAL_DOMAIN.test(url)) return { emails: allEmails, socials }
  // SSRF guard: never fetch private/loopback addresses
  if (!isSafeExternalUrl(url)) return { emails: allEmails, socials }

  const base = url.replace(/\/$/, '')
  const pagesToTry = [
    url,
    `${base}/contact`, `${base}/about`, `${base}/contact-us`, `${base}/work-with-me`,
    `${base}/press`, `${base}/partnerships`, `${base}/collaborate`, `${base}/sponsor`,
    `${base}/booking`, `${base}/media`, `${base}/connect`, `${base}/hello`, `${base}/info`,
    `${base}/team`, `${base}/contact-me`, `${base}/get-in-touch`,
  ]

  await Promise.allSettled(pagesToTry.map(async (page) => {
    try {
      const html = await fetchHtml(page, 5000)
      const $ = cheerio.load(html)
      allEmails.push(...extractEmails(html))
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || ''
        if (href.startsWith('mailto:')) allEmails.push(...extractEmails(href))
        if (!socials.linkedin && href.includes('linkedin.com')) socials.linkedin = href
        if (!socials.instagram && href.includes('instagram.com')) socials.instagram = href
        if (!socials.twitter && (href.includes('twitter.com') || href.includes('x.com'))) socials.twitter = href
      })
    } catch { /* page not found */ }
  }))

  return { emails: allEmails, socials }
}

// SOURCE 6 (deep): expand a Linktree / Beacons / bio-link page — these list
// email + every social in one place.
const BIOLINK_RE = /(linktr\.ee|beacons\.ai|bio\.link|stan\.store|allmylinks\.com|carrd\.co|koji\.to|withkoji\.com|gleam\.io)/i

async function fromBioLink(url: string): Promise<{ emails: string[], socials: Record<string, string> }> {
  const socials: Record<string, string> = {}
  const emails: string[] = []
  if (!url || !BIOLINK_RE.test(url)) return { emails, socials }
  if (!isSafeExternalUrl(url)) return { emails, socials }
  try {
    const html = await fetchHtml(url, 7000)
    emails.push(...extractEmails(html))
    const $ = cheerio.load(html)
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || ''
      if (href.startsWith('mailto:')) emails.push(...extractEmails(href))
      if (!socials.linkedin && href.includes('linkedin.com')) socials.linkedin = href
      if (!socials.instagram && href.includes('instagram.com')) socials.instagram = href
      if (!socials.twitter && (href.includes('twitter.com') || href.includes('x.com'))) socials.twitter = href
      if (!socials.tiktok && href.includes('tiktok.com')) socials.tiktok = href
    })
  } catch { /* fail silently */ }
  return { emails, socials }
}

// SOURCE 7: scrape email out of public social bios. Twitter / Instagram
// often display bio-text emails in og:description meta tags even when the page
// itself blocks bots. Best-effort — these endpoints are often rate-limited.
// Always runs (used to be deep-only).
async function fromBioPages(socials: Record<string, string>): Promise<string[]> {
  const urls = [socials.twitter, socials.instagram, socials.tiktok, socials.linkedin].filter(Boolean) as string[]
  const emails: string[] = []
  await Promise.allSettled(urls.map(async (u) => {
    try {
      const safe = normalizeUrl(u)
      if (!isSafeExternalUrl(safe)) return
      const html = await fetchHtml(safe, 5000)
      // og:description / twitter:description usually carry the bio text
      const allMetas = [...html.matchAll(/<meta[^>]+(?:property|name)="(?:og:description|twitter:description|description)"[^>]+content="([^"]+)"/gi)]
      for (const m of allMetas) emails.push(...extractEmails(m[1]))
      // also raw HTML scan as fallback
      emails.push(...extractEmails(html))
    } catch { /* blocked / failed */ }
  }))
  return emails
}

// SOURCE 8: Wayback Machine fallback. If the live website blocks scraping,
// the most recent archive snapshot often still works and contains the same
// contact info. Useful for old creator sites that returned 403/404 in
// fromWebsite.
async function fromWayback(rawUrl: string): Promise<string[]> {
  if (!rawUrl) return []
  const url = normalizeUrl(rawUrl)
  if (!url || SOCIAL_DOMAIN.test(url)) return []
  try {
    const apiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`
    const { data } = await axios.get(apiUrl, { timeout: 5000 })
    const snapshot = data?.archived_snapshots?.closest?.url
    if (!snapshot || typeof snapshot !== 'string') return []
    const html = await fetchHtml(snapshot, 6000)
    return extractEmails(html)
  } catch {
    return []
  }
}

// SOURCE 9 (aggressive only): explicit email-pattern guesses against the
// website domain. Only used when the refresh icon is clicked AND no email
// has been found yet. These are common standard role addresses (info@,
// hello@, contact@, press@, etc.) — they're plausible but unverified.
// We mark them with a leading "[guess] " prefix in the source array so
// bestEmail() picks a verified one over a guess if both exist.
async function fromDomainGuesses(website: string, foundEmails: string[]): Promise<string[]> {
  if (!website) return []
  if (foundEmails.length > 0) return [] // skip if we already have real emails
  try {
    const u = new URL(website.startsWith('http') ? website : `https://${website}`)
    const domain = u.hostname.replace(/^www\./, '')
    if (!domain || domain.includes('.') === false) return []
    if (SOCIAL_DOMAIN.test(domain)) return []
    const patterns = ['info', 'hello', 'contact', 'press', 'business', 'partnerships', 'sponsor', 'team', 'hi']
    return patterns.map(p => `${p}@${domain}`)
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth

  const limited = rateLimit(auth.id, 'enrich', 500)
  if (limited) return limited

  const { searchParams } = new URL(req.url)

  // Validate channelId — YouTube channel IDs are always "UC" + 22 base64 chars
  const channelId = clampString(searchParams.get('channelId'), 30)
  if (!channelId || !/^UC[\w-]{22}$/.test(channelId)) {
    return NextResponse.json({ error: 'Invalid channelId' }, { status: 400 })
  }

  const websiteParam  = clampString(searchParams.get('website'), 200)
  const instagramParam = clampString(searchParams.get('instagram'), 200)
  const tiktokParam   = clampString(searchParams.get('tiktok'), 200)
  const description   = clampString(searchParams.get('description'), 2000)
  const niche         = clampString(searchParams.get('niche'), 80)
  const aggressive    = searchParams.get('aggressive') === 'true'

  // Fast mode: skip every slow source (DDG search, biolink scrape,
  // bio-pages, wayback, domain-guess, new-methodology fallback) and
  // return only YouTube /about + videos + shorts. The /about scrape
  // alone gives us subscribers + every social handle (IG/TT/X/LI/web)
  // a creator has linked from their channel — which is enough for
  // platform-filtered searches (the IG / TT / X / LinkedIn tabs).
  // Email discovery still happens in a second pass without ?fast,
  // so the email column fills in moments later in the background.
  //
  // Latency: fast mode is ~1.5–2s per creator vs. ~5–12s for full.
  // For a 100-result search at BATCH=20, that's ~5–10s of fast
  // enrichment vs. ~50–120s of full sequential.
  const fastMode      = searchParams.get('fast') === 'true'

  // Strategy toggle — comma-separated list of enabled enrichment sources
  // for the admin email-test harness. When absent, every source runs
  // (production behavior unless fastMode is on). Recognized keys:
  //   web_scrape, biolink, bio_pages, ddg, wayback, domain_guess
  // (yt_about and description-extract always run — they're free.)
  const strategyParam = searchParams.get('strategy')
  const isEnabled = (key: string): boolean => {
    if (fastMode) return false   // fast mode disables every optional source
    if (strategyParam == null) return true
    return strategyParam.split(',').map(s => s.trim()).includes(key)
  }

  // ── Backend cache check ─────────────────────────────────────────
  // Skip the cache when:
  //   1. strategyParam is set — admin email-test harness needs fresh
  //      runs to compare strategy variants
  //   2. aggressive=true — user explicitly opted into the slow deep
  //      search and expects fresh results
  //   3. fastMode — fast results are intentionally partial (no email
  //      data); writing them to cache would poison subsequent full
  //      reads. Reading is OK though: a prior full-enrichment cache
  //      entry has everything fast mode would return AND more, so
  //      use it.
  const skipCache = strategyParam != null || aggressive
  if (!skipCache) {
    // L1 — Redis hot cache (sub-10ms).
    const cached = await cacheGet<unknown>(enrichmentCacheKey(channelId))
    if (cached) {
      void cacheBumpCounter('enrich:hit:l1')
      return NextResponse.json(cached)
    }
    void cacheBumpCounter('enrich:miss:l1')

    // L2 — Postgres durable cache (PHASE 2, 2026-05-08). Hit when
    // Redis has evicted the row but we resolved this channel for any
    // user within the freshness window. Saves a 5–12s live pipeline
    // run. Staleness window:
    //   - 90 days if we found an email previously
    //   - 7 days if we tried + found none (small chance the email
    //     surfaces on a later DDG/wayback re-fetch)
    // Bounce-aware: a row marked email_bounced=true forces a re-fetch
    // regardless of age. That's the recovery path when a user hits
    // Mark Bounced on a stale email.
    const pgRow = await getLatestEnrichment(channelId)
    if (pgRow) {
      const ageMs = Date.now() - new Date(pgRow.fetched_at).getTime()
      const day = 24 * 60 * 60 * 1000
      const freshnessMs = pgRow.email ? 90 * day : 7 * day
      const isFresh = ageMs < freshnessMs
      // 2026-05-08: search-only rows (written by bulkSaveSearchResults)
      // have email=null because /api/search never runs the email
      // pipeline. They're a "we saw this channel" marker, NOT a "we
      // tried and failed" verdict. Without this guard, bulk-seed
      // would short-circuit on its own search writes and the live
      // pipeline would never run — emails would never get resolved.
      const rawSource =
        (pgRow.raw_response_json as { source?: string } | null)?.source
      const isSearchOnlyPlaceholder = !pgRow.email && rawSource === 'search_route'
      const usable = isFresh && !pgRow.email_bounced && !isSearchOnlyPlaceholder
      if (usable) {
        // Reconstruct the response payload shape the route normally
        // returns, then warm Redis so the next read is L1-fast.
        const reconstructed = {
          email: pgRow.email || '',
          subscribers: pgRow.subscribers != null ? String(pgRow.subscribers) : '',
          videoDates: Array.isArray(pgRow.recent_video_dates) ? pgRow.recent_video_dates : [],
          shortDates: [] as string[],
          avgViews: pgRow.avg_views ?? undefined,
          instagram: pgRow.instagram_handle || '',
          twitter: pgRow.twitter_handle || '',
          tiktok: '', // not tracked yet; null = empty for the response
          linkedin: pgRow.linkedin_url || '',
          website: pgRow.website || '',
        }
        console.log(`[cache PG-HIT] channel=${channelId} ageDays=${(ageMs / day).toFixed(1)}`)
        void cacheBumpCounter('enrich:hit:l2')
        void cacheSet(enrichmentCacheKey(channelId), reconstructed, CACHE_TTL.creatorEnrichment)
        return NextResponse.json(reconstructed)
      }
      if (isSearchOnlyPlaceholder) {
        console.log(`[cache PG-MISS-SEARCH-ONLY] channel=${channelId} — search-time placeholder, running live pipeline`)
        void cacheBumpCounter('enrich:miss:l2-search-only')
      } else {
        console.log(`[cache PG-MISS-STALE] channel=${channelId} ageDays=${(ageMs / day).toFixed(1)} bounced=${pgRow.email_bounced}`)
        void cacheBumpCounter('enrich:miss:l2-stale')
      }
    } else {
      void cacheBumpCounter('enrich:miss:l2-cold')
    }
  }
  // ───────────────────────────────────────────────────────────────

  const descEmails = extractEmails(description)

  // Phase 1: About page — discovers description emails, all social/website
  // links, subscriber count.
  const yt = await fromYouTubeAbout(channelId)
    .catch(() => ({ emails: [], socials: {} as Record<string, string>, subscribers: '' }))

  const website = yt.socials.website || websiteParam
  const instagram = yt.socials.instagram || instagramParam
  const tiktok = yt.socials.tiktok || tiktokParam
  const channelName = searchParams.get('name') || searchParams.get('channelName') || ''

  // Phase 2: email-finding sources in parallel, gated by strategy.
  // Methods that are disabled return their no-op default so downstream
  // merging logic stays unchanged.
  const noWeb = { emails: [] as string[], socials: {} as Record<string, string> }
  const [ytVideosResult, ytShortsResult, webResult, ddgLinkedInResult, ddgEmailResult, biolinkResult] = await Promise.allSettled([
    fromYouTubeVideos(channelId),
    fromShortsPage(channelId),
    isEnabled('web_scrape') ? fromWebsite(website) : Promise.resolve(noWeb),
    // DDG LinkedIn — wrapped in fast-mode gate. DDG is the slowest
    // source in the pipeline (3–8s); skipping it cuts fast-mode
    // latency in half.
    fastMode ? Promise.resolve('') : fromDDGLinkedIn(channelName),
    isEnabled('ddg') ? fromDDGEmail(channelName, website, niche, aggressive) : Promise.resolve([] as string[]),
    isEnabled('biolink') ? fromBioLink(website) : Promise.resolve(noWeb),
  ])

  const ytVideos = ytVideosResult.status === 'fulfilled' ? ytVideosResult.value : { dates: [], avgViews: NaN }
  const videoDates = ytVideos.dates
  const shortDates = ytShortsResult.status === 'fulfilled' ? ytShortsResult.value : []
  const avgViews = isNaN(ytVideos.avgViews) ? undefined : ytVideos.avgViews
  const web = webResult.status === 'fulfilled' ? webResult.value : noWeb
  const ddgLinkedIn = ddgLinkedInResult.status === 'fulfilled' ? ddgLinkedInResult.value : ''
  const ddgEmails = ddgEmailResult.status === 'fulfilled' ? ddgEmailResult.value : []
  const biolink = biolinkResult.status === 'fulfilled' ? biolinkResult.value : noWeb

  const socials = {
    instagram: instagram || web.socials.instagram || biolink.socials.instagram || '',
    twitter: yt.socials.twitter || web.socials.twitter || biolink.socials.twitter || '',
    tiktok: tiktok || web.socials.tiktok || biolink.socials.tiktok || '',
    linkedin: yt.socials.linkedin || web.socials.linkedin || biolink.socials.linkedin || ddgLinkedIn || '',
    website: website || '',
  }

  // Phase 3: scrape each known social bio + try Wayback for the website if
  // we got nothing from the live site. Done after Phase 2 so we have the
  // discovered socials to crawl.
  const wayBackNeeded = isEnabled('wayback') && web.emails.length === 0 && !!website
  const [bioEmailsResult, waybackEmailsResult] = await Promise.allSettled([
    isEnabled('bio_pages') ? fromBioPages(socials) : Promise.resolve([] as string[]),
    wayBackNeeded ? fromWayback(website) : Promise.resolve([] as string[]),
  ])
  const bioEmails = bioEmailsResult.status === 'fulfilled' ? bioEmailsResult.value : []
  const waybackEmails = waybackEmailsResult.status === 'fulfilled' ? waybackEmailsResult.value : []

  const realEmails = [...descEmails, ...yt.emails, ...web.emails, ...biolink.emails, ...ddgEmails, ...bioEmails, ...waybackEmails]
  // Domain pattern guesses — only if every real source came up empty
  // AND domain_guess is enabled (also requires aggressive in production).
  const wantGuess = isEnabled('domain_guess') && (strategyParam != null || aggressive)
  const guessEmails = wantGuess ? await fromDomainGuesses(website, realEmails).catch(() => []) : []
  const allEmails = [...realEmails, ...guessEmails]
  let email = bestEmail(allEmails)

  // Source attribution — which strategy produced the winning email.
  // Used by the durable cache for debugging + retry priority. We
  // check sources in order of trust (most-direct first). Set to null
  // when no email was found.
  const lc = (s: string) => (s || '').toLowerCase()
  const emailSource: string | null = !email
    ? null
    : descEmails.some(e => lc(e) === lc(email))
    ? 'youtube_about'
    : yt.emails.some(e => lc(e) === lc(email))
    ? 'youtube_about'
    : web.emails.some(e => lc(e) === lc(email))
    ? 'web_scrape'
    : biolink.emails.some(e => lc(e) === lc(email))
    ? 'biolink'
    : ddgEmails.some(e => lc(e) === lc(email))
    ? 'ddg'
    : bioEmails.some(e => lc(e) === lc(email))
    ? 'bio_pages'
    : waybackEmails.some(e => lc(e) === lc(email))
    ? 'wayback'
    : guessEmails.some(e => lc(e) === lc(email))
    ? 'domain_guess'
    : 'unknown'

  // Filter out platform-infra junk that the production primary pipeline
  // doesn't have native awareness of (stanwith.me, sentry.io, etc.).
  if (email && !isPlausibleEmail(email.toLowerCase())) {
    email = ''
  }

  // NEW METHODOLOGY FALLBACK — fires when primary came up empty.
  // Recent video descriptions, sitemap discovery, JSON-LD parsing,
  // creator-platform profiles, alternate TLD probing, cert transparency,
  // multi-snapshot Wayback, AI text extraction, AI vision on banner.
  // Each method is timeout-bounded so this is safe to run inline.
  //
  // Skipped when the admin benchmark passes a strategy that doesn't
  // include 'new_methodology' — that's how the benchmark's "current
  // methodology" baseline stays a fair comparison.
  // Skip the heavy new-methodology fallback in fast mode — its AI
  // vision + Wayback multi-snapshot work is the heaviest single
  // pass in the pipeline (can add 8–15s on its own).
  const wantsFallback = !fastMode && (strategyParam == null
    || strategyParam.split(',').map(s => s.trim()).includes('new_methodology'))

  // emailSource is `let`-able after this point so the new-methodology
  // fallback can override it.
  let finalEmailSource = emailSource

  if (!email && wantsFallback) {
    try {
      const nm = await newMethodology({
        channelId,
        channelName,
        description,
        website,
        instagram: socials.instagram,
        twitter: socials.twitter,
        tiktok: socials.tiktok,
        linkedin: socials.linkedin,
      })
      if (nm.email && isPlausibleEmail(nm.email)) {
        email = nm.email
        finalEmailSource = 'new_methodology'
      }
    } catch (e) {
      console.error('[enrich] new-methodology fallback failed:', (e as Error).message)
    }
  }

  // ABSOLUTE FINAL SCRUB — same nuclear substring filter the admin
  // email-test orchestrator uses. Any email whose lowercased form
  // contains a known platform/infra/placeholder/DMARC substring gets
  // nuked here, no matter what code path produced it.
  const NUCLEAR_SUBSTRINGS = [
    'stanwith', 'stan.store',
    'patreon.com', 'sentry.io',
    'buymeacoffee', 'ko-fi', 'kofi',
    'allmylinks', 'lnk.bio', 'bio.fm',
    'beehiiv', 'substack', 'mailchimp',
    'campsite.bio', 'about.me', 'msha.ke',
    'gumroad', 'convertkit',
    '@example.com', '@example.org', '@example.net',
    '@yourdomain', '@yoursite', '@yourcompany',
    'dmarc-reports@', 'aggregate@', 'forensic@', 'rua@', 'ruf@',
  ]
  if (email) {
    const lc = email.toLowerCase()
    const hit = NUCLEAR_SUBSTRINGS.find(s => lc.includes(s))
    if (hit) {
      console.warn(`[enrich nuclear] DROPPED email="${email}" (matched substring "${hit}") channelId=${channelId}`)
      email = ''
    }
  }

  // Forensic logging — this fires on every enrich call. Designed so
  // we can confirm the scrub-filter chain ran without dumping cleartext
  // PII into Vercel logs (logs are persisted; PII in logs = potential
  // GDPR / SOC2 issue at scale).
  //
  // What we log:
  //   - the email we resolved (only the local part redacted to *** + domain)
  //   - the count of candidate emails seen
  //   - if any flagged-substring candidate was filtered, log the substring
  //     that matched + the count, NOT the full email list
  function redactEmail(e: string): string {
    if (!e) return ''
    const at = e.indexOf('@')
    if (at <= 0) return '***'
    const local = e.slice(0, at)
    const domain = e.slice(at)
    const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1)
    return `${visible}***${domain}`
  }
  console.log(`[enrich done] channelId=${channelId} email="${redactEmail(email)}" candidates=${allEmails.length}`)

  // Flag suspicious-substring leaks WITHOUT logging the full email list.
  const suspicious = ['stanwith', 'stan.store', 'patreon.com', 'sentry.io']
  for (const sub of suspicious) {
    const hits = allEmails.filter(e => e.toLowerCase().includes(sub)).length
    if (hits > 0) {
      console.warn(`[enrich CANDIDATE LEAK CHECK] channelId=${channelId} substring="${sub}" hits=${hits} (filtered before output: ${email && email.includes(sub) ? 'NO — filter missed!' : 'yes'})`)
    }
  }

  const payload = { email, subscribers: yt.subscribers, videoDates, shortDates, avgViews, ...socials }

  // Redis cache write — fire-and-forget. Skip when strategy/aggressive
  // paths ran (per skipCache check above) — those want fresh data
  // each time and shouldn't poison the cache for normal flows. Also
  // skip fastMode: its result is intentionally partial (no email
  // data), and a later full-enrich call for the same channel will
  // populate the cache properly.
  if (!skipCache && !fastMode) {
    void cacheSet(enrichmentCacheKey(channelId), payload, CACHE_TTL.creatorEnrichment)
  }

  // Postgres durable snapshot — separate gate from Redis. The
  // durable log is append-only history and SHOULD record every live
  // pipeline run, including aggressive ones. Previously this was
  // gated behind `!skipCache`, which meant bulk-enrich (always sets
  // aggressive=true) found emails but never persisted them. Bug
  // diagnosed 2026-05-08.
  //
  // Still skip for:
  //   - fastMode: intentionally partial result, no email data
  //   - strategyParam (admin email-test harness): synthetic single-
  //     strategy runs would pollute the durable history with
  //     non-production results
  if (!fastMode && strategyParam == null) {
    const recentDates = (videoDates || []).slice(0, 12)
    const lastVideoIso = recentDates[0]
      ? (() => {
          // Best effort: videoDates entries are relative ("3 days
          // ago", "2024-08-12", etc). Try Date.parse and fall back.
          const t = Date.parse(recentDates[0])
          return Number.isFinite(t) ? new Date(t).toISOString() : null
        })()
      : null
    void saveEnrichmentSnapshot({
      yt_channel_id: channelId,
      channel_name: channelName || null,
      niche: niche || null,
      email: email || null,
      // Source tracking wired 2026-05-08 — now records which of the
      // 7+ strategies resolved each email (youtube_about / web_scrape /
      // biolink / ddg / bio_pages / wayback / domain_guess /
      // new_methodology / unknown). Null when we found no email.
      email_source: email ? finalEmailSource : null,
      linkedin_url: socials.linkedin || null,
      instagram_handle: socials.instagram || null,
      twitter_handle: socials.twitter || null,
      website: socials.website || null,
      // yt.subscribers is sometimes a formatted string ("245K") —
      // coerce to a number when possible, null otherwise. Database
      // column is BIGINT so we want clean integers.
      subscribers: typeof yt.subscribers === 'number'
        ? yt.subscribers
        : (() => {
            const n = Number(String(yt.subscribers ?? '').replace(/[^0-9.]/g, ''))
            return Number.isFinite(n) && n > 0 ? Math.round(n) : null
          })(),
      avg_views: typeof avgViews === 'number' ? avgViews : null,
      last_video_at: lastVideoIso,
      recent_video_dates: recentDates.length ? recentDates : null,
      raw_response_json: payload,
    })
  }

  // Fire-and-forget: kick off Meta Graph API enrichment in the
  // background (only if QStash + Meta are both configured). The
  // worker will write results to Redis (hot cache) + Postgres
  // (historical log). Frontend polls /api/instagram-status to fill
  // in real follower counts / engagement once they land. Dedup is
  // handled by QStash + the worker's cache check.
  const igHandle = extractInstagramHandle(socials.instagram)
  if (igHandle && isQStashConfigured() && isInstagramGraphConfigured()) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}`
    const destination = `${baseUrl}/api/instagram-fetch`
    void publishJob(destination, { handle: igHandle, ytChannelId: channelId }, {
      // Dedup window: same handle within 6 hours = same job, no extra
      // Meta API call. Tightens our 200/hr rate limit budget.
      deduplicationId: `ig-fetch:${igHandle}:${Math.floor(Date.now() / (1000 * 60 * 60 * 6))}`,
    })
  }

  return NextResponse.json(payload)
}
