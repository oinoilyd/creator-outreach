import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import * as cheerio from 'cheerio'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function fetchHtml(url: string): Promise<string> {
  const { data } = await axios.get(url, { timeout: 7000, headers: { 'User-Agent': UA } })
  return data as string
}

function findEmail(text: string): string {
  const mailtoMatch = text.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
  if (mailtoMatch) return mailtoMatch[1]
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
  return matches.find(e =>
    !e.includes('example') && !e.includes('duckduckgo') &&
    !e.includes('sentry') && !e.includes('wix') &&
    !e.endsWith('.png') && !e.endsWith('.jpg') &&
    !e.startsWith('no-reply') && !e.startsWith('noreply')
  ) || ''
}

function decodeYtRedirect(url: string): string {
  try {
    if (url.includes('youtube.com/redirect') || url.includes('/redirect?')) {
      const u = new URL(url.startsWith('http') ? url : 'https://youtube.com' + url)
      return decodeURIComponent(u.searchParams.get('q') || url)
    }
    return url
  } catch { return url }
}

// scrape YouTube channel about page to extract social links + email
async function scrapeYouTubeChannel(channelId: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  try {
    const html = await fetchHtml(`https://www.youtube.com/channel/${channelId}/about`)

    // extract ytInitialData JSON blob
    const match = html.match(/var ytInitialData\s*=\s*(\{[\s\S]+?\});\s*<\/script>/)
    if (!match) return result

    const data = JSON.parse(match[1])

    // walk the JSON looking for primaryLinks / secondaryLinks / links arrays
    const rawLinks: any[] = []

    function walk(obj: any, depth = 0): void {
      if (depth > 12 || !obj || typeof obj !== 'object') return
      if (Array.isArray(obj)) { obj.forEach(i => walk(i, depth + 1)); return }
      if (obj.primaryLinks) rawLinks.push(...(obj.primaryLinks || []))
      if (obj.secondaryLinks) rawLinks.push(...(obj.secondaryLinks || []))
      if (obj.channelExternalLinkViewModel) rawLinks.push(obj.channelExternalLinkViewModel)
      if (obj.businessEmailRevealRenderer) {
        const email = obj.businessEmailRevealRenderer?.email?.simpleText
        if (email) result.email = email
      }
      Object.values(obj).forEach(v => walk(v, depth + 1))
    }

    walk(data)

    for (const link of rawLinks) {
      const rawUrl: string =
        link?.navigationEndpoint?.urlEndpoint?.url ||
        link?.url?.url ||
        link?.link?.commandRuns?.[0]?.onTap?.innertubeCommand?.urlEndpoint?.url ||
        ''
      const url = decodeYtRedirect(rawUrl)
      if (!url) continue
      if (!result.instagram && url.includes('instagram.com')) result.instagram = url
      if (!result.twitter && (url.includes('twitter.com') || url.includes('x.com'))) result.twitter = url
      if (!result.tiktok && url.includes('tiktok.com')) result.tiktok = url
      if (!result.linkedin && url.includes('linkedin.com')) result.linkedin = url
      if (!result.website && !url.match(/instagram|twitter|tiktok|linkedin|youtube/i)) result.website = url
    }

    // also check description text for email
    if (!result.email) {
      const descMatch = html.match(/"description":\{"simpleText":"([^"]+)"/)
      if (descMatch) result.email = findEmail(descMatch[1])
    }
  } catch { /* scrape failed */ }
  return result
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name') || ''
  const channelId = searchParams.get('channelId') || ''
  const website = searchParams.get('website') || ''
  const instagram = searchParams.get('instagram') || ''
  const tiktok = searchParams.get('tiktok') || ''

  const result: Record<string, string> = {}

  // 1. scrape YouTube channel page directly — most reliable source
  if (channelId) {
    const ytData = await scrapeYouTubeChannel(channelId)
    Object.assign(result, ytData)
  }

  // 2. scrape linked website
  if (website && !result.email) {
    try {
      const html = await fetchHtml(website)
      const $ = cheerio.load(html)
      if (!result.email) result.email = findEmail(html)
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || ''
        if (!result.linkedin && href.includes('linkedin.com/in')) result.linkedin = href
        if (!result.instagram && href.includes('instagram.com')) result.instagram = href
        if (!result.twitter && (href.includes('twitter.com') || href.includes('x.com'))) result.twitter = href
        if (!result.tiktok && href.includes('tiktok.com')) result.tiktok = href
      })
    } catch { /* unreachable */ }
  }

  // 3. scrape Instagram bio for email
  const igUrl = instagram || result.instagram
  if (igUrl && !result.email) {
    try {
      const html = await fetchHtml(igUrl)
      const email = findEmail(html)
      if (email) result.email = email
    } catch { /* blocked */ }
  }

  // 4. scrape TikTok bio for email
  const ttUrl = tiktok || result.tiktok
  if (ttUrl && !result.email) {
    try {
      const html = await fetchHtml(ttUrl)
      const email = findEmail(html)
      if (email) result.email = email
    } catch { /* blocked */ }
  }

  // 5. DuckDuckGo LinkedIn
  if (!result.linkedin && name) {
    try {
      const q = encodeURIComponent(`"${name}" site:linkedin.com/in`)
      const html = await fetchHtml(`https://html.duckduckgo.com/html/?q=${q}`)
      const $ = cheerio.load(html)
      const links = $('a[href]').map((_, el) => $(el).attr('href') || '').get()
      const li = links.find(l => l.includes('linkedin.com/in'))
      if (li) result.linkedin = li.startsWith('http') ? li : `https://${li}`
    } catch { /* DDG failed */ }
  }

  // 6. DuckDuckGo email fallback
  if (!result.email && name) {
    try {
      const q = encodeURIComponent(`"${name}" contact email`)
      const html = await fetchHtml(`https://html.duckduckgo.com/html/?q=${q}`)
      const email = findEmail(html)
      if (email) result.email = email
    } catch { /* DDG failed */ }
  }

  return NextResponse.json(result)
}
