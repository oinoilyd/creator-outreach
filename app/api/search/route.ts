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

    // run two searches: exact keyword + broader related search
    const [results1, results2] = await Promise.allSettled([
      yt.search(keyword, { type: 'channel' }),
      yt.search(keyword, { type: 'video' }),
    ])

    const channelIds = new Set<string>()
    const channelQueue: string[] = []

    if (results1.status === 'fulfilled') {
      for (const item of results1.value.channels || []) {
        if (item.id && !channelIds.has(item.id)) {
          channelIds.add(item.id)
          channelQueue.push(item.id)
        }
      }
    }

    // pull unique channels from video results too
    if (results2.status === 'fulfilled') {
      for (const item of (results2.value as any).videos || []) {
        const cid = item?.author?.id || item?.channel_id
        if (cid && !channelIds.has(cid)) {
          channelIds.add(cid)
          channelQueue.push(cid)
        }
      }
    }

    const channels = []

    for (const channelId of channelQueue) {
      if (channels.length >= maxResults) break
      try {
        const channel = await yt.getChannel(channelId)
        const videos = await channel.getVideos()
        const videoItems = videos.videos?.slice(0, 10) || []
        if (videoItems.length === 0) continue

        // avg views filter — extended to 200k
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

        // pull from About page for business email + social links
        let email = extractEmail(description)
        let website = extractWebsite(description)
        let socials = extractSocials(description)

        try {
          const about = await (channel as any).getAbout()
          const links: any[] = about?.primary_links || about?.links || []

          for (const link of links) {
            const url: string = link?.url || link?.endpoint?.payload?.url || ''
            const title: string = (link?.title?.text || link?.title || '').toLowerCase()
            if (!url) continue
            if (!socials.instagram && (url.includes('instagram.com') || title.includes('instagram'))) socials.instagram = url
            if (!socials.twitter && (url.includes('twitter.com') || url.includes('x.com') || title.includes('twitter'))) socials.twitter = url
            if (!socials.tiktok && (url.includes('tiktok.com') || title.includes('tiktok'))) socials.tiktok = url
            if (!socials.linkedin && (url.includes('linkedin.com') || title.includes('linkedin'))) socials.linkedin = url
            if (!website && !url.match(/instagram|twitter|tiktok|linkedin|youtube/i)) website = url
          }

          if (!email) {
            const bizEmail = about?.business_email || about?.contact_links?.find((l: any) => l?.type === 'email')?.value
            if (bizEmail) email = bizEmail
          }
        } catch {
          // getAbout failed, use description data only
        }

        // score relevance — but include ALL channels that passed view filter
        const bioScore = scoreBio(description, terms)
        const nameScore = scoreBio(channelName.toLowerCase(), terms)
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
      } catch {
        continue
      }
    }

    // sort: exact matches first, then bio matches, then related
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
