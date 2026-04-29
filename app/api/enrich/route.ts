import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import * as cheerio from 'cheerio'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function fetchHtml(url: string, timeout = 7000): Promise<string> {
  const { data } = await axios.get(url, { timeout, headers: { 'User-Agent': UA } })
  return data as string
}

const BAD_EMAIL = /example|duckduckgo|sentry|wixpress|w3\.org|schema\.org|noreply|no-reply|@2x|\.png|\.jpg|\.svg/i

function extractEmails(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
  return matches.filter(e => !BAD_EMAIL.test(e))
}

function bestEmail(emails: string[]): string {
  // prefer emails that look like business contacts
  const priority = emails.find(e => /contact|info|hello|business|collab|partner|media|pr@/i.test(e))
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

// SOURCE 1: YouTube channel about page (ytInitialData JSON)
async function fromYouTubeAbout(channelId: string): Promise<{ emails: string[], socials: Record<string, string> }> {
  const socials: Record<string, string> = {}
  const emails: string[] = []
  try {
    const html = await fetchHtml(`https://www.youtube.com/channel/${channelId}/about`)
    const match = html.match(/var ytInitialData\s*=\s*(\{[\s\S]+?\});\s*<\/script>/)
    if (!match) return { emails, socials }
    const data = JSON.parse(match[1])
    const rawLinks: any[] = []

    function walk(obj: any, depth = 0): void {
      if (depth > 12 || !obj || typeof obj !== 'object') return
      if (Array.isArray(obj)) { obj.forEach(i => walk(i, depth + 1)); return }
      if (obj.primaryLinks) rawLinks.push(...(obj.primaryLinks || []))
      if (obj.secondaryLinks) rawLinks.push(...(obj.secondaryLinks || []))
      if (obj.channelExternalLinkViewModel) rawLinks.push(obj.channelExternalLinkViewModel)
      if (obj.businessEmailRevealRenderer?.email?.simpleText) emails.push(obj.businessEmailRevealRenderer.email.simpleText)
      Object.values(obj).forEach(v => walk(v, depth + 1))
    }
    walk(data)

    for (const link of rawLinks) {
      const rawUrl: string = link?.navigationEndpoint?.urlEndpoint?.url || link?.url?.url || link?.link?.commandRuns?.[0]?.onTap?.innertubeCommand?.urlEndpoint?.url || ''
      const url = decodeYtRedirect(rawUrl)
      if (!url) continue
      if (!socials.instagram && url.includes('instagram.com')) socials.instagram = url
      if (!socials.twitter && (url.includes('twitter.com') || url.includes('x.com'))) socials.twitter = url
      if (!socials.tiktok && url.includes('tiktok.com')) socials.tiktok = url
      if (!socials.linkedin && url.includes('linkedin.com')) socials.linkedin = url
      if (!socials.website && !url.match(/instagram|twitter|tiktok|linkedin|youtube/i)) socials.website = url
    }

    // also scan description text in the JSON
    const descMatch = html.match(/"description":\{"simpleText":"([^"]+)"/)
    if (descMatch) emails.push(...extractEmails(descMatch[1]))
  } catch { /* failed */ }
  return { emails, socials }
}

// SOURCE 2: scrape the channel's linked website
async function fromWebsite(url: string): Promise<{ emails: string[], socials: Record<string, string> }> {
  const socials: Record<string, string> = {}
  const emails: string[] = []
  if (!url) return { emails, socials }
  try {
    const html = await fetchHtml(url)
    const $ = cheerio.load(html)
    emails.push(...extractEmails(html))
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || ''
      if (!socials.linkedin && href.includes('linkedin.com/in')) socials.linkedin = href
      if (!socials.instagram && href.includes('instagram.com')) socials.instagram = href
      if (!socials.twitter && (href.includes('twitter.com') || href.includes('x.com'))) socials.twitter = href
      if (!socials.tiktok && href.includes('tiktok.com')) socials.tiktok = href
    })
  } catch { /* unreachable */ }
  return { emails, socials }
}

// SOURCE 3: scrape Instagram bio
async function fromInstagram(url: string): Promise<string[]> {
  if (!url) return []
  try {
    const html = await fetchHtml(url, 6000)
    return extractEmails(html)
  } catch { return [] }
}

// SOURCE 4: scrape TikTok bio
async function fromTikTok(url: string): Promise<string[]> {
  if (!url) return []
  try {
    const html = await fetchHtml(url, 6000)
    return extractEmails(html)
  } catch { return [] }
}

// SOURCE 5: DuckDuckGo — search for email directly
async function fromDDGEmail(name: string): Promise<string[]> {
  if (!name) return []
  try {
    const q = encodeURIComponent(`"${name}" email contact`)
    const html = await fetchHtml(`https://html.duckduckgo.com/html/?q=${q}`)
    return extractEmails(html)
  } catch { return [] }
}

// SOURCE 6: DuckDuckGo — LinkedIn
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

  // run all sources in parallel
  const [ytResult, webResult, igEmails, ttEmails, ddgEmails, ddgLinkedIn] = await Promise.allSettled([
    fromYouTubeAbout(channelId),
    fromWebsite(website),
    fromInstagram(instagram),
    fromTikTok(tiktok),
    fromDDGEmail(name),
    fromDDGLinkedIn(name),
  ])

  const yt = ytResult.status === 'fulfilled' ? ytResult.value : { emails: [], socials: {} }
  const web = webResult.status === 'fulfilled' ? webResult.value : { emails: [], socials: {} }
  const ig = igEmails.status === 'fulfilled' ? igEmails.value : []
  const tt = ttEmails.status === 'fulfilled' ? ttEmails.value : []
  const ddg = ddgEmails.status === 'fulfilled' ? ddgEmails.value : []
  const linkedin = ddgLinkedIn.status === 'fulfilled' ? ddgLinkedIn.value : ''

  // merge all emails, pick best
  const allEmails = [...yt.emails, ...web.emails, ...ig, ...tt, ...ddg]
  const email = bestEmail(allEmails)

  // merge socials — yt about page is most authoritative
  const socials = {
    instagram: yt.socials.instagram || web.socials.instagram || instagram || '',
    twitter: yt.socials.twitter || web.socials.twitter || '',
    tiktok: yt.socials.tiktok || web.socials.tiktok || tiktok || '',
    linkedin: yt.socials.linkedin || web.socials.linkedin || linkedin || '',
    website: yt.socials.website || web.socials.website || website || '',
  }

  return NextResponse.json({ email, ...socials })
}
