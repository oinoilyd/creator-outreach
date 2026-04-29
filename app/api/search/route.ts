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

    const seenIds = new Set<string>()
    const channelQueue: string[] = []

    // channel search
    try {
      const channelResults = await yt.search(keyword, { type: 'channel' })
      for (const item of (channelResults as any).channels || []) {
        if (item?.id && !seenIds.has(item.id)) {
          seenIds.add(item.id)
          channelQueue.push(item.id)
        }
      }
    } catch { /* channel search failed */ }

    // video search — pulls smaller channels that don't show up in channel search
    try {
      const videoResults = await yt.search(keyword, { type: 'video' })
      const videos = (videoResults as any).videos || (videoResults as any).results || []
      for (const v of videos) {
        const id = v?.author?.id || v?.channel?.id
        if (id && id.startsWith('UC') && !seenIds.has(id)) {
          seenIds.add(id)
          channelQueue.push(id)
        }
      }
    } catch { /* video search failed */ }

    const channels = []

    for (const channelId of channelQueue) {
      if (channels.length >= maxResults) break
      try {
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

        let email = extractEmail(description)
        let website = extractWebsite(description)
        let socials = extractSocials(description)

        // About page — decode YouTube redirect URLs to get real social links
        try {
          const about = await (channel as any).getAbout()
          const links: any[] = about?.primary_links || about?.links || []

          for (const link of links) {
            const rawUrl: string = link?.url || link?.endpoint?.payload?.url || ''
            const url = decodeYouTubeRedirect(rawUrl)
            if (!url) continue
            if (!socials.instagram && url.includes('instagram.com')) socials.instagram = url
            if (!socials.twitter && (url.includes('twitter.com') || url.includes('x.com'))) socials.twitter = url
            if (!socials.tiktok && url.includes('tiktok.com')) socials.tiktok = url
            if (!socials.linkedin && url.includes('linkedin.com')) socials.linkedin = url
            if (!website && !url.match(/instagram|twitter|tiktok|linkedin|youtube/i)) website = url
          }

          if (!email && about?.business_email) email = about.business_email
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
          email,
          website,
          relevanceScore: nameScore + bioScore,
          matchedVia,
          ...socials,
        })
      } catch { continue }
    }

    channels.sort((a, b) => b.relevanceScore - a.relevanceScore)
    return NextResponse.json({ channels })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// YouTube wraps external links in redirect URLs — decode to get the real URL
function decodeYouTubeRedirect(url: string): string {
  try {
    if (url.includes('youtube.com/redirect')) {
      const parsed = new URL(url)
      const q = parsed.searchParams.get('q')
      return q ? decodeURIComponent(q) : url
    }
    return url
  } catch {
    return url
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
