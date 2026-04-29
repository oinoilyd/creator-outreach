import { NextRequest, NextResponse } from 'next/server'
import { Innertube } from 'youtubei.js'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const keyword = searchParams.get('keyword')
  const maxResults = parseInt(searchParams.get('maxResults') || '20')

  if (!keyword) {
    return NextResponse.json({ error: 'keyword is required' }, { status: 400 })
  }

  try {
    const yt = await Innertube.create({ retrieve_player: false })
    const results = await yt.search(keyword, { type: 'channel' })

    const channels = []

    for (const item of results.channels.slice(0, maxResults)) {
      try {
        const channelId = item.id
        if (!channelId) continue

        const channel = await yt.getChannel(channelId)
        const videos = await channel.getVideos()

        const videoItems = videos.videos?.slice(0, 10) || []
        if (videoItems.length === 0) continue

        let totalViews = 0
        let count = 0
        for (const v of videoItems) {
          const viewText = (v as any)?.view_count?.text || ''
          const num = parseInt(viewText.replace(/[^0-9]/g, ''))
          if (!isNaN(num)) {
            totalViews += num
            count++
          }
        }

        if (count === 0) continue
        const avgViews = Math.round(totalViews / count)

        if (avgViews > 100000) continue

        const metadata = channel.metadata
        const channelName = metadata?.title || 'Unknown'
        const channelUrl = `https://www.youtube.com/channel/${channelId}`
        const description = metadata?.description || ''
        const email = extractEmail(description)
        const website = (metadata as any)?.vanity_url || extractWebsite(description)
        const socials = extractSocials(description)

        channels.push({
          channelId,
          channelName,
          channelUrl,
          avgViews,
          subscribers: (metadata as any)?.subscriber_count || '',
          email,
          website,
          ...socials,
        })
      } catch {
        continue
      }
    }

    return NextResponse.json({ channels })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function extractEmail(text: string): string {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return match ? match[0] : ''
}

function extractWebsite(text: string): string {
  const match = text.match(/https?:\/\/(?!youtube|instagram|twitter|tiktok|linkedin)[^\s]+/)
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
