import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import * as cheerio from 'cheerio'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name') || ''
  const website = searchParams.get('website') || ''

  const result: Record<string, string> = {}

  if (website) {
    try {
      const { data } = await axios.get(website, { timeout: 5000 })
      const $ = cheerio.load(data)
      const pageText = $.text()

      if (!result.email) {
        const emailMatch = pageText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
        if (emailMatch) result.email = emailMatch[0]
      }

      const links = $('a[href]').map((_, el) => $(el).attr('href') || '').get()
      for (const link of links) {
        if (!result.linkedin && link.includes('linkedin.com')) result.linkedin = link
        if (!result.instagram && link.includes('instagram.com')) result.instagram = link
        if (!result.twitter && (link.includes('twitter.com') || link.includes('x.com'))) result.twitter = link
        if (!result.tiktok && link.includes('tiktok.com')) result.tiktok = link
      }
    } catch {
      // website unreachable, continue
    }
  }

  if (!result.linkedin && name) {
    try {
      const query = encodeURIComponent(`site:linkedin.com/in "${name}"`)
      const url = `https://html.duckduckgo.com/html/?q=${query}`
      const { data } = await axios.get(url, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
      })
      const $ = cheerio.load(data)
      const firstResult = $('a.result__url').first().text().trim()
      if (firstResult.includes('linkedin.com')) {
        result.linkedin = firstResult.startsWith('http') ? firstResult : `https://${firstResult}`
      }
    } catch {
      // DDG unreachable, skip
    }
  }

  return NextResponse.json(result)
}
