import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import * as cheerio from 'cheerio'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function fetchHtml(url: string): Promise<string> {
  const { data } = await axios.get(url, { timeout: 6000, headers: { 'User-Agent': UA } })
  return data as string
}

function findEmail(html: string): string {
  const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
  if (mailtoMatch) return mailtoMatch[1]
  const plainMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
  if (plainMatch) {
    return plainMatch.find(e =>
      !e.includes('example') &&
      !e.includes('duckduckgo') &&
      !e.includes('sentry') &&
      !e.includes('@2x') &&
      !e.endsWith('.png') &&
      !e.endsWith('.jpg')
    ) || ''
  }
  return ''
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name') || ''
  const website = searchParams.get('website') || ''
  const instagram = searchParams.get('instagram') || ''
  const tiktok = searchParams.get('tiktok') || ''

  const result: Record<string, string> = {}

  // 1. scrape website
  if (website) {
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

  // 2. scrape Instagram bio for email
  const igUrl = instagram || result.instagram
  if (igUrl && !result.email) {
    try {
      const html = await fetchHtml(igUrl)
      const emailFound = findEmail(html)
      if (emailFound) result.email = emailFound
    } catch { /* blocked or unavailable */ }
  }

  // 3. scrape TikTok bio for email
  const ttUrl = tiktok || result.tiktok
  if (ttUrl && !result.email) {
    try {
      const html = await fetchHtml(ttUrl)
      const emailFound = findEmail(html)
      if (emailFound) result.email = emailFound
    } catch { /* blocked or unavailable */ }
  }

  // 4. DuckDuckGo LinkedIn lookup
  if (!result.linkedin && name) {
    try {
      const query = encodeURIComponent(`"${name}" site:linkedin.com/in`)
      const html = await fetchHtml(`https://html.duckduckgo.com/html/?q=${query}`)
      const $ = cheerio.load(html)
      const links = $('a[href]').map((_, el) => $(el).attr('href') || '').get()
      const linkedinLink = links.find(l => l.includes('linkedin.com/in'))
      if (linkedinLink) result.linkedin = linkedinLink.startsWith('http') ? linkedinLink : `https://${linkedinLink}`
    } catch { /* DDG failed */ }
  }

  // 5. DuckDuckGo email search if still nothing
  if (!result.email && name) {
    try {
      const query = encodeURIComponent(`"${name}" contact OR email`)
      const html = await fetchHtml(`https://html.duckduckgo.com/html/?q=${query}`)
      const emailFound = findEmail(html)
      if (emailFound) result.email = emailFound
    } catch { /* DDG failed */ }
  }

  return NextResponse.json(result)
}
