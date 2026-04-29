import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import * as cheerio from 'cheerio'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function fetchHtml(url: string, timeout = 8000): Promise<string> {
  const { data } = await axios.get(url, {
    timeout,
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  })
  return data as string
}

const BAD_EMAIL = /example|duckduckgo|sentry|wixpress|w3\.org|schema\.org|noreply|no-reply|@2x|\.png|\.jpg|\.svg|\.gif|\.webp|\.css|\.js/i

function extractEmails(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
  return [...new Set(matches.filter(e => !BAD_EMAIL.test(e)))]
}

function bestEmail(emails: string[]): string {
  const priority = emails.find(e => /contact|info|hello|business|collab|partner|media|pr@|sponsor/i.test(e))
  return priority || emails[0] || ''
}

function decodeYtRedirect(url: string): string {
  try {
    if (url.includes('/redirect')) {
      const u = new URL(url.startsWith('http') ? url : 'https://youtube.com' + url)
      return decodeURIComponent(u.searchParams.get('q') || url)
    }
    return url
  } catch { return url }
}

// Safely extract ytInitialData from YouTube page HTML
function extractYtInitialData(html: string): any | null {
  try {
    const marker = 'var ytInitialData = '
    const start = html.indexOf(marker)
    if (start === -1) return null
    const jsonStart = html.indexOf('{', start)
    if (jsonStart === -1) return null
    // find the end of the JSON by walking braces
    let depth = 0
    let i = jsonStart
    for (; i < html.length; i++) {
      if (html[i] === '{') depth++
      else if (html[i] === '}') { depth--; if (depth === 0) break }
    }
    return JSON.parse(html.substring(jsonStart, i + 1))
  } catch { return null }
}

// Walk an object recursively and collect values at any depth
function deepCollect(obj: any, key: string, results: any[] = [], depth = 0): any[] {
  if (depth > 15 || !obj || typeof obj !== 'object') return results
  if (Array.isArray(obj)) { obj.forEach(v => deepCollect(v, key, results, depth + 1)); return results }
  if (obj[key] !== undefined) results.push(obj[key])
  Object.values(obj).forEach(v => deepCollect(v, key, results, depth + 1))
  return results
}

// SOURCE 1: YouTube channel About page — extract description, links, and business email
async function fromYouTubeAbout(channelId: string): Promise<{ emails: string[], socials: Record<string, string> }> {
  const socials: Record<string, string> = {}
  const emails: string[] = []
  try {
    const html = await fetchHtml(`https://www.youtube.com/channel/${channelId}/about`)
    const data = extractYtInitialData(html)
    if (!data) return { emails, socials }

    // grab all description text blobs
    const simpleTexts: string[] = deepCollect(data, 'simpleText')
    for (const t of simpleTexts) {
      if (typeof t === 'string') emails.push(...extractEmails(t))
    }

    // grab business email (YouTube sometimes puts it in a dedicated field)
    const businessEmails: any[] = deepCollect(data, 'businessEmail')
    for (const e of businessEmails) {
      if (typeof e === 'string') emails.push(...extractEmails(e))
    }

    // grab all URLs from the links section and decode YouTube redirects
    const urlObjects: any[] = deepCollect(data, 'urlEndpoint')
    for (const obj of urlObjects) {
      const raw = obj?.url || ''
      const url = decodeYtRedirect(raw)
      if (!url || url.includes('youtube.com')) continue
      if (!socials.instagram && url.includes('instagram.com')) socials.instagram = url
      if (!socials.twitter && (url.includes('twitter.com') || url.includes('x.com'))) socials.twitter = url
      if (!socials.tiktok && url.includes('tiktok.com')) socials.tiktok = url
      if (!socials.linkedin && url.includes('linkedin.com')) socials.linkedin = url
      if (!socials.website && !url.match(/instagram|twitter|tiktok|linkedin|youtube/i)) socials.website = url
    }

    // also try the channelMetadataRenderer description
    const metaDescriptions: any[] = deepCollect(data, 'description')
    for (const d of metaDescriptions) {
      if (typeof d === 'string') emails.push(...extractEmails(d))
    }
  } catch { /* failed */ }
  return { emails, socials }
}

// SOURCE 2: scrape website — main page + contact/about subpages
async function fromWebsite(url: string): Promise<{ emails: string[], socials: Record<string, string> }> {
  const socials: Record<string, string> = {}
  const allEmails: string[] = []
  if (!url) return { emails: allEmails, socials }

  const base = url.replace(/\/$/, '')
  const pagesToTry = [url, `${base}/contact`, `${base}/about`, `${base}/contact-us`, `${base}/work-with-me`, `${base}/sponsorship`]

  await Promise.allSettled(pagesToTry.map(async (page) => {
    try {
      const html = await fetchHtml(page, 6000)
      const $ = cheerio.load(html)
      allEmails.push(...extractEmails(html))
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || ''
        if (href.startsWith('mailto:')) allEmails.push(...extractEmails(href))
        if (!socials.linkedin && href.includes('linkedin.com/in')) socials.linkedin = href
        if (!socials.instagram && href.includes('instagram.com')) socials.instagram = href
        if (!socials.twitter && (href.includes('twitter.com') || href.includes('x.com'))) socials.twitter = href
        if (!socials.tiktok && href.includes('tiktok.com')) socials.tiktok = href
      })
    } catch { /* page not found */ }
  }))

  return { emails: allEmails, socials }
}

// SOURCE 3: scan Instagram page HTML for email in bio
async function fromInstagram(url: string): Promise<string[]> {
  if (!url) return []
  try {
    const html = await fetchHtml(url, 6000)
    return extractEmails(html)
  } catch { return [] }
}

// SOURCE 4: scan TikTok page HTML for email in bio
async function fromTikTok(url: string): Promise<string[]> {
  if (!url) return []
  try {
    const html = await fetchHtml(url, 6000)
    return extractEmails(html)
  } catch { return [] }
}

// SOURCE 5: DuckDuckGo — search for creator email
async function fromDDGEmail(name: string, website: string): Promise<string[]> {
  const queries = [
    `"${name}" email`,
    `"${name}" contact email`,
    website ? `site:${new URL(website).hostname} email` : '',
  ].filter(Boolean)

  const emails: string[] = []
  await Promise.allSettled(queries.map(async (q) => {
    try {
      const html = await fetchHtml(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, 6000)
      emails.push(...extractEmails(html))
    } catch { /* failed */ }
  }))
  return emails
}

// SOURCE 6: DuckDuckGo — find LinkedIn profile URL
async function fromDDGLinkedIn(name: string): Promise<string> {
  if (!name) return ''
  try {
    const q = encodeURIComponent(`"${name}" site:linkedin.com/in`)
    const html = await fetchHtml(`https://html.duckduckgo.com/html/?q=${q}`)
    const $ = cheerio.load(html)
    const links = $('a[href]').map((_, el) => $(el).attr('href') || '').get()
    const li = links.find(l => l.includes('linkedin.com/in'))
    if (li) return li.startsWith('http') ? li : `https://${li}`
  } catch { /* failed */ }
  return ''
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name') || ''
  const channelId = searchParams.get('channelId') || ''
  const website = searchParams.get('website') || ''
  const instagram = searchParams.get('instagram') || ''
  const tiktok = searchParams.get('tiktok') || ''
  const description = searchParams.get('description') || ''

  // emails already in description (passed from search)
  const descEmails = extractEmails(description)

  // run all sources in parallel
  const [ytResult, webResult, igEmails, ttEmails, ddgEmails, ddgLinkedIn] = await Promise.allSettled([
    fromYouTubeAbout(channelId),
    fromWebsite(website),
    fromInstagram(instagram),
    fromTikTok(tiktok),
    fromDDGEmail(name, website),
    fromDDGLinkedIn(name),
  ])

  const yt = ytResult.status === 'fulfilled' ? ytResult.value : { emails: [], socials: {} }
  const web = webResult.status === 'fulfilled' ? webResult.value : { emails: [], socials: {} }
  const ig = igEmails.status === 'fulfilled' ? igEmails.value : []
  const tt = ttEmails.status === 'fulfilled' ? ttEmails.value : []
  const ddg = ddgEmails.status === 'fulfilled' ? ddgEmails.value : []
  const linkedin = ddgLinkedIn.status === 'fulfilled' ? ddgLinkedIn.value : ''

  const allEmails = [...descEmails, ...yt.emails, ...web.emails, ...ig, ...tt, ...ddg]
  const email = bestEmail(allEmails)

  const socials = {
    instagram: yt.socials.instagram || web.socials.instagram || instagram || '',
    twitter: yt.socials.twitter || web.socials.twitter || '',
    tiktok: yt.socials.tiktok || web.socials.tiktok || tiktok || '',
    linkedin: yt.socials.linkedin || web.socials.linkedin || linkedin || '',
    website: yt.socials.website || web.socials.website || website || '',
  }

  return NextResponse.json({ email, ...socials })
}
