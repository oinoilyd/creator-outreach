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
async function fromVideosPage(channelId: string): Promise<string[]> {
  const html = await fetchHtml(`https://www.youtube.com/channel/${channelId}/videos`, 8000)
  const data = extractYtInitialData(html)
  if (!data) return []
  const dates: string[] = []
  const publishedTexts: any[] = deepCollect(data, 'publishedTimeText')
  for (const t of publishedTexts) {
    const text: string = typeof t === 'string' ? t : (t?.simpleText || t?.runs?.[0]?.text || '')
    if (text && dates.length < 2) dates.push(text)
  }
  return dates
}

// SOURCE 2: try RSS first (exact dates), fall back to /videos page scrape
async function fromYouTubeVideos(channelId: string): Promise<string[]> {
  const [rssResult, videosResult] = await Promise.allSettled([
    fromRSS(channelId),
    fromVideosPage(channelId),
  ])
  const rss = rssResult.status === 'fulfilled' ? rssResult.value : []
  if (rss.length > 0) return rss
  return videosResult.status === 'fulfilled' ? videosResult.value : []
}

// SOURCE 3: scrape website contact pages for email and LinkedIn links
async function fromWebsite(rawUrl: string): Promise<{ emails: string[], socials: Record<string, string> }> {
  const socials: Record<string, string> = {}
  const allEmails: string[] = []
  const url = normalizeUrl(rawUrl)
  if (!url || SOCIAL_DOMAIN.test(url)) return { emails: allEmails, socials }

  const base = url.replace(/\/$/, '')
  const pagesToTry = [url, `${base}/contact`, `${base}/about`, `${base}/contact-us`, `${base}/work-with-me`]

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const channelId = searchParams.get('channelId') || ''
  const websiteParam = searchParams.get('website') || ''
  const instagramParam = searchParams.get('instagram') || ''
  const tiktokParam = searchParams.get('tiktok') || ''
  const description = searchParams.get('description') || ''

  const descEmails = extractEmails(description)

  // Phase 1: About page — discovers description emails, all social/website links, subscriber count
  const yt = await fromYouTubeAbout(channelId)
    .catch(() => ({ emails: [], socials: {} as Record<string, string>, subscribers: '' }))

  const website = yt.socials.website || websiteParam
  const instagram = yt.socials.instagram || instagramParam
  const tiktok = yt.socials.tiktok || tiktokParam

  // Phase 2: RSS feed for dates + website scraping with the URL we just discovered
  const [ytVideosResult, webResult] = await Promise.allSettled([
    fromYouTubeVideos(channelId),
    fromWebsite(website),
  ])

  const videoDates = ytVideosResult.status === 'fulfilled' ? ytVideosResult.value : []
  const web = webResult.status === 'fulfilled' ? webResult.value : { emails: [], socials: {} }

  const allEmails = [...descEmails, ...yt.emails, ...web.emails]
  const email = bestEmail(allEmails)

  const socials = {
    instagram: instagram || web.socials.instagram || '',
    twitter: yt.socials.twitter || web.socials.twitter || '',
    tiktok: tiktok || web.socials.tiktok || '',
    linkedin: yt.socials.linkedin || web.socials.linkedin || '',
    website: website || '',
  }

  return NextResponse.json({ email, subscribers: yt.subscribers, videoDates, ...socials })
}
