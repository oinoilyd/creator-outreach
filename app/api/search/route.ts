import { NextRequest, NextResponse } from 'next/server'
import { Innertube } from 'youtubei.js'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const keyword = searchParams.get('keyword')
  const maxResults = parseInt(searchParams.get('maxResults') || '20')

  if (!keyword) {
    return NextResponse.json({ error: 'keyword is required' }, { status: 400 })
  }

  const terms = keyword.toLowerCase().split(/\s+/)

  try {
    const yt = await Innertube.create({ retrieve_player: false })
    const results = await yt.search(keyword, { type: 'channel' })
    const channels = []

    for (const item of (results as any).channels.slice(0, maxResults * 3)) {
      try {
        const channelId = item.id
        if (!channelId) continue

        const channel = await yt.getChannel(channelId)
        const videos = await channel.getVideos()
        const videoItems = (videos as any).videos?.slice(0, 10) || []
        if (videoItems.length === 0) continue

        let totalViews = 0
        let count = 0
        for (const v of videoItems) {
          const viewText = (v as any)?.view_count?.text || ''
          const num = parseInt(viewText.replace(/[^0-9]/g, ''))
          if (!isNaN(num)) { totalViews += num; count++ }
        }
        if (count === 0) continue
        const avgViews = Math.round(totalViews / count)
        if (avgViews > 200000) continue

        const metadata = channel.metadata
        const channelName = metadata?.title || 'Unknown'
        const description = metadata?.description || ''
        const email = extractEmail(description)
        const website = extractWebsite(description)
        const socials = extractSocials(description)

        // try About page for extra links
        let aboutEmail = email
        let aboutWebsite = website
        let aboutSocials = { ...socials }
        try {
          const about = await (channel as any).getAbout()
          const links: any[] = about?.primary_links || about?.links || []
          for (const link of links) {
            const url: string = link?.url || link?.endpoint?.payload?.url || ''
            if (!url) continue
            if (!aboutSocials.instagram && url.includes('instagram.com')) aboutSocials.instagram = url
            if (!aboutSocials.twitter && (url.includes('twitter.com') || url.includes('x.com'))) aboutSocials.twitter = url
            if (!aboutSocials.tiktok && url.includes('tiktok.com')) aboutSocials.tiktok = url
            if (!aboutSocials.linkedin && url.includes('linkedin.com')) aboutSocials.linkedin = url
            if (!aboutWebsite && !url.match(/instagram|twitter|tiktok|linkedin|youtube/i)) aboutWebsite = url
          }
          if (!aboutEmail && about?.business_email) aboutEmail = about.business_email
        } catch { /* no about page */ }

        const nameScore = scoreBio(channelName.toLowerCase(), terms)
        const bioScore = scoreBio(description.toLowerCase(), terms)
        const matchedVia = nameScore > 0 ? 'name' : bioScore > 0 ? 'bio' : 'related'

        channels.push({
          channelId,
          channelName,
          channelUrl: `https://www.youtube.com/channel/${channelId}`,
          avgViews,
          subscribers: (metadata as any)?.subscriber_count || '',
          email: aboutEmail,
          website: aboutWebsite,
          relevanceScore: nameScore + bioScore,
          matchedVia,
          ...aboutSocials,
        })

        if (channels.length >= maxResults) break
      } catch { continue }
    }

    channels.sort((a, b) => b.relevanceScore - a.relevanceScore)
    return NextResponse.json({ channels })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function scoreBio(text: string, terms: string[]): number {
  let score = 0
  for (const term of terms) {
    const matches = text.match(new RegExp(term, 'gi'))
    if (matches) score += matches.length
  }
  return score
}

function extractEmail(text: string): string {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return match ? match[0] : ''
}

function extractWebsite(text: string): string {
  const match = text.match(/https?:\/\/(?!(?:www\.)?(youtube|instagram|twitter|x\.com|tiktok|linkedin))[^\s]+/)
  return match ? match[0] : ''
}

function extractSocials(text: string) {
  return {
    instagram: extractSocialUrl(text, 'instagram.com'),
    twitter: extractSocialUrl(text, 'twitter.com') || extractSocialUrl(text, 'x.com'),
    tiktok: extractSocialUrl(text, 'tiktok.com'),
    linkedin: extractSocialUrl(text, 'linkedin.com'),
  }
}

function extractSocialUrl(text: string, domain: string): string {
  const regex = new RegExp(`https?://(www\\.)?${domain.replace('.', '\\.')}[^\\s]*`)
  const match = text.match(regex)
  return match ? match[0] : ''
}
