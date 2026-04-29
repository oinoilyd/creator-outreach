import { NextRequest, NextResponse } from 'next/server'
import { Innertube } from 'youtubei.js'

function decodeYtRedirect(url: string): string {
  try {
    if (url.includes('youtube.com/redirect') || url.includes('/redirect?')) {
      const u = new URL(url.startsWith('http') ? url : 'https://youtube.com' + url)
      return decodeURIComponent(u.searchParams.get('q') || url)
    }
    return url
  } catch { return url }
}

function extractEmail(text: string): string {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return match ? match[0] : ''
}

function extractSocialUrl(text: string, domain: string): string {
  const regex = new RegExp(`https?://(www\\.)?${domain.replace('.', '\\.')}[^\\s"'<>]*`)
  const match = text.match(regex)
  return match ? match[0] : ''
}

function scoreBio(text: string, terms: string[]): number {
  let score = 0
  for (const term of terms) {
    const matches = text.match(new RegExp(term, 'gi'))
    if (matches) score += matches.length
  }
  return score
}

// Extract average views from getVideos() result — handles current youtubei.js structure
function extractAvgViews(videos: any): number {
  // new structure: current_tab.content.contents[n].content (RichItem → Video)
  const richItems: any[] = videos?.current_tab?.content?.contents || []
  const videoItems = richItems
    .map((item: any) => item?.content)
    .filter(Boolean)
    .slice(0, 10)

  if (videoItems.length === 0) return -1

  let total = 0, count = 0
  for (const v of videoItems) {
    const text: string = v?.view_count?.text || v?.short_view_count?.text || ''
    const num = parseInt(text.replace(/[^0-9]/g, ''))
    if (!isNaN(num) && num >= 0) { total += num; count++ }
  }
  return count > 0 ? Math.round(total / count) : -1
}

// Extract socials and email from getAbout() — uses about.metadata.links
function extractAboutData(about: any): { email: string, socials: Record<string, string> } {
  const socials: Record<string, string> = {}
  let email = ''

  const meta = about?.metadata
  if (!meta) return { email, socials }

  // extract email from description text
  const desc: string = meta.description || ''
  email = extractEmail(desc)

  // extract socials from links array
  const links: any[] = meta.links || []
  for (const link of links) {
    // URL is nested inside link.runs[0].endpoint.payload.url
    const rawUrl: string =
      link?.link?.runs?.[0]?.endpoint?.payload?.url ||
      link?.url?.runs?.[0]?.endpoint?.payload?.url ||
      link?.navigationEndpoint?.urlEndpoint?.url || ''
    const url = decodeYtRedirect(rawUrl)
    if (!url) continue
    const fullUrl = url.startsWith('http') ? url : `https://${url}`
    if (!socials.instagram && fullUrl.includes('instagram.com')) socials.instagram = fullUrl
    if (!socials.twitter && (fullUrl.includes('twitter.com') || fullUrl.includes('x.com'))) socials.twitter = fullUrl
    if (!socials.tiktok && fullUrl.includes('tiktok.com')) socials.tiktok = fullUrl
    if (!socials.linkedin && fullUrl.includes('linkedin.com')) socials.linkedin = fullUrl
    if (!socials.website && !fullUrl.match(/instagram|twitter|tiktok|linkedin|youtube/i)) socials.website = fullUrl
  }

  // also check description for social URLs if links section was empty
  if (!socials.instagram) socials.instagram = extractSocialUrl(desc, 'instagram.com')
  if (!socials.twitter) socials.twitter = extractSocialUrl(desc, 'twitter.com') || extractSocialUrl(desc, 'x.com')
  if (!socials.tiktok) socials.tiktok = extractSocialUrl(desc, 'tiktok.com')
  if (!socials.linkedin) socials.linkedin = extractSocialUrl(desc, 'linkedin.com')

  return { email, socials }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const keyword = searchParams.get('keyword')
  const maxResults = parseInt(searchParams.get('maxResults') || '50')

  if (!keyword) return NextResponse.json({ error: 'keyword is required' }, { status: 400 })

  const terms = keyword.toLowerCase().split(/\s+/)

  try {
    const yt = await Innertube.create({ retrieve_player: false })

    const seenIds = new Set<string>()
    const channelQueue: string[] = []

    // channel search
    try {
      const res = await yt.search(keyword, { type: 'channel' })
      for (const item of (res as any).channels || []) {
        const id = item?.id || item?.author?.id
        if (id && !seenIds.has(id)) { seenIds.add(id); channelQueue.push(id) }
      }
    } catch { /* continue */ }

    // video search — surfaces smaller channels not in channel results
    try {
      const res = await yt.search(keyword, { type: 'video' })
      const vids = (res as any).videos || (res as any).results || []
      for (const v of vids) {
        const id = v?.author?.id || v?.channel?.id
        if (id && id.startsWith('UC') && !seenIds.has(id)) { seenIds.add(id); channelQueue.push(id) }
      }
    } catch { /* continue */ }

    const channels: any[] = []

    for (const channelId of channelQueue) {
      if (channels.length >= maxResults) break
      try {
        const channel = await yt.getChannel(channelId)

        // get videos and calculate avg views
        const videosPage = await channel.getVideos()
        const avgViews = extractAvgViews(videosPage)
        if (avgViews === -1) continue  // no videos found
        if (avgViews > 200000) continue

        // get about page for links + email
        let email = ''
        const socials: Record<string, string> = { instagram: '', twitter: '', tiktok: '', linkedin: '', website: '' }
        try {
          const about = await channel.getAbout()
          const extracted = extractAboutData(about)
          email = extracted.email
          Object.assign(socials, extracted.socials)
        } catch { /* no about page */ }

        const meta = channel.metadata
        const channelName = meta?.title || 'Unknown'
        const description: string = meta?.description || ''

        // fallback email from metadata description if about page missed it
        if (!email) email = extractEmail(description)

        const nameScore = scoreBio(channelName.toLowerCase(), terms)
        const bioScore = scoreBio(description.toLowerCase(), terms)
        const matchedVia = nameScore > 0 ? 'name' : bioScore > 0 ? 'bio' : 'related'

        channels.push({
          channelId,
          channelName,
          channelUrl: `https://www.youtube.com/channel/${channelId}`,
          avgViews,
          description,
          subscribers: (meta as any)?.subscriber_count || '',
          email,
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
