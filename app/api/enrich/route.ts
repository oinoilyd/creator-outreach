import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import * as cheerio from 'cheerio'

const SOCIAL_PATTERNS: Record<string, RegExp> = {
  linkedin: /https?:\/\/(www\.)?linkedin\.com\/in\/[^\s"'<>]+/i,
  instagram: /https?:\/\/(www\.)?instagram\.com\/[^\s"'<>]+/i,
  twitter: /https?:\/\/(www\.)?(twitter|x)\.com\/[^\s"'<>]+/i,
  tiktok: /https?:\/\/(www\.)?tiktok\.com\/@[^\s"'<>]+/i,
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name') || ''
  const website = searchParams.get('website') || ''

  const result: Record<string, string> = {}

  // scrape website for email + social links
  if (website) {
    try {
      const { data } = await axios.get(website, {
        timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      })
      const $ = cheerio.load(data)
      const fullHtml = data as string

      // extract email from full HTML (catches mailto: links too)
      if (!result.email) {
        const mailtoMatch = fullHtml.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
        const plainMatch = fullHtml.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
        result.email = mailtoMatch?.[1] || plainMatch?.[0] || ''
      }

      // extract socials from all href links
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || ''
        for (const [platform, pattern] of Object.entries(SOCIAL_PATTERNS)) {
          if (!result[platform] && pattern.test(href)) {
            result[platform] = href
          }
        }
      })

      // also scan raw HTML for social URLs not in anchor tags
      for (const [platform, pattern] of Object.entries(SOCIAL_PATTERNS)) {
        if (!result[platform]) {
          const match = fullHtml.match(pattern)
          if (match) result[platform] = match[0]
        }
      }
    } catch {
      // website unreachable
    }
  }

  // DuckDuckGo LinkedIn lookup if still missing
  if (!result.linkedin && name) {
    try {
      const query = encodeURIComponent(`"${name}" site:linkedin.com/in`)
      const { data } = await axios.get(`https://html.duckduckgo.com/html/?q=${query}`, {
        timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
      })
      const $ = cheerio.load(data)
      const links = $('a.result__url, a[href*="linkedin.com/in"]').map((_, el) => $(el).attr('href') || $(el).text()).get()
      const linkedinLink = links.find(l => l.includes('linkedin.com/in'))
      if (linkedinLink) {
        result.linkedin = linkedinLink.startsWith('http') ? linkedinLink : `https://${linkedinLink}`
      }
    } catch {
      // DDG failed
    }
  }

  // DuckDuckGo general contact search if still no email
  if (!result.email && name) {
    try {
      const query = encodeURIComponent(`"${name}" contact email`)
      const { data } = await axios.get(`https://html.duckduckgo.com/html/?q=${query}`, {
        timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
      })
      const emailMatch = (data as string).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
      if (emailMatch && !emailMatch[0].includes('duckduckgo') && !emailMatch[0].includes('example')) {
        result.email = emailMatch[0]
      }
    } catch {
      // DDG failed
    }
  }

  return NextResponse.json(result)
}
