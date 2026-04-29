import { NextRequest, NextResponse } from 'next/server'
import { Innertube } from 'youtubei.js'

// Topic → related professions/roles to search
const TOPIC_MAP: Record<string, string[]> = {
  basketball: ['basketball player', 'basketball coach', 'basketball trainer', 'basketball analyst', 'NBA agent', 'basketball recruiter', 'basketball content creator'],
  football: ['football player', 'football coach', 'NFL agent', 'football analyst', 'football recruiter', 'football trainer', 'football content creator'],
  soccer: ['soccer player', 'soccer coach', 'soccer agent', 'football analyst', 'soccer trainer', 'soccer scout', 'soccer content creator'],
  baseball: ['baseball player', 'baseball coach', 'MLB agent', 'baseball analyst', 'baseball trainer', 'baseball scout'],
  golf: ['golf coach', 'golf instructor', 'golf professional', 'golf analyst', 'golf content creator', 'golf agent'],
  tennis: ['tennis coach', 'tennis player', 'tennis instructor', 'tennis analyst', 'tennis content creator'],
  sports: ['sports agent', 'sports coach', 'sports analyst', 'sports trainer', 'sports recruiter', 'sports content creator', 'sports marketer'],
  banking: ['investment banker', 'financial advisor', 'bank executive', 'private banker', 'finance professional', 'wealth manager', 'credit analyst'],
  finance: ['financial advisor', 'investment banker', 'hedge fund manager', 'portfolio manager', 'financial planner', 'CFO', 'finance content creator'],
  investing: ['stock investor', 'real estate investor', 'venture capitalist', 'angel investor', 'investment advisor', 'portfolio manager'],
  crypto: ['crypto trader', 'blockchain developer', 'crypto investor', 'DeFi developer', 'crypto analyst', 'web3 founder'],
  realestate: ['real estate agent', 'real estate investor', 'real estate developer', 'property manager', 'real estate broker', 'mortgage broker'],
  'real estate': ['real estate agent', 'real estate investor', 'real estate developer', 'property manager', 'real estate broker'],
  fitness: ['fitness coach', 'personal trainer', 'fitness influencer', 'gym owner', 'nutritionist', 'strength coach', 'fitness content creator'],
  health: ['health coach', 'nutritionist', 'wellness coach', 'dietitian', 'physical therapist', 'health content creator', 'functional medicine'],
  nutrition: ['nutritionist', 'dietitian', 'nutrition coach', 'meal prep coach', 'sports nutritionist', 'wellness coach'],
  tech: ['software engineer', 'tech founder', 'startup CEO', 'developer advocate', 'tech investor', 'product manager', 'tech content creator'],
  startup: ['startup founder', 'startup CEO', 'venture capitalist', 'startup advisor', 'entrepreneur', 'startup content creator'],
  marketing: ['marketing consultant', 'digital marketer', 'social media marketer', 'SEO expert', 'brand strategist', 'marketing content creator'],
  music: ['music producer', 'music artist', 'music manager', 'music agent', 'A&R executive', 'music content creator', 'music educator'],
  film: ['film director', 'film producer', 'casting agent', 'screenwriter', 'film content creator', 'cinematographer'],
  fashion: ['fashion designer', 'fashion stylist', 'fashion content creator', 'fashion buyer', 'fashion influencer', 'brand consultant'],
  food: ['chef', 'food blogger', 'restaurant owner', 'food content creator', 'nutritionist', 'food entrepreneur'],
  travel: ['travel content creator', 'travel agent', 'travel blogger', 'tour operator', 'travel influencer', 'digital nomad'],
  education: ['educator', 'tutor', 'education content creator', 'school principal', 'curriculum designer', 'edtech founder'],
  law: ['lawyer', 'attorney', 'legal advisor', 'law firm partner', 'paralegal', 'legal content creator', 'judge'],
  medicine: ['doctor', 'physician', 'surgeon', 'medical content creator', 'healthcare professional', 'nurse practitioner'],
  hr: ['HR director', 'recruiter', 'talent acquisition', 'HR consultant', 'people operations', 'executive recruiter'],
  recruiting: ['recruiter', 'executive recruiter', 'talent acquisition', 'headhunter', 'HR professional', 'staffing agency'],
}

// Generic profession suffixes for topics not in the map
const GENERIC_ROLES = ['coach', 'professional', 'expert', 'analyst', 'content creator', 'consultant', 'educator', 'entrepreneur']

function expandTopic(keyword: string): string[] {
  const lower = keyword.toLowerCase().trim()

  // check exact match
  if (TOPIC_MAP[lower]) return TOPIC_MAP[lower]

  // check partial match (e.g. "real estate investing" → "real estate")
  for (const [key, roles] of Object.entries(TOPIC_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return roles
  }

  // generic expansion — topic + each role
  return [keyword, ...GENERIC_ROLES.map(r => `${keyword} ${r}`)]
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

function extractVideoData(videos: any): { avgViews: number, videoTitles: string[] } {
  const richItems: any[] = videos?.current_tab?.content?.contents || []
  const videoItems = richItems.map((item: any) => item?.content).filter(Boolean).slice(0, 10)
  if (videoItems.length === 0) return { avgViews: -1, videoTitles: [] }
  let total = 0, count = 0
  const videoTitles: string[] = []
  for (const v of videoItems) {
    const text: string = v?.view_count?.text || v?.short_view_count?.text || ''
    const num = parseInt(text.replace(/[^0-9]/g, ''))
    if (!isNaN(num) && num >= 0) { total += num; count++ }
    const title: string = v?.title?.text || v?.title?.runs?.[0]?.text || ''
    if (title) videoTitles.push(title)
  }
  return {
    avgViews: count > 0 ? Math.round(total / count) : -1,
    videoTitles: videoTitles.slice(0, 3),
  }
}

function extractAboutData(about: any): { email: string, socials: Record<string, string> } {
  const socials: Record<string, string> = {}
  let email = ''
  const meta = about?.metadata
  if (!meta) return { email, socials }
  const desc: string = meta.description || ''
  email = extractEmail(desc)
  const links: any[] = meta.links || []
  for (const link of links) {
    const rawUrl: string = link?.link?.runs?.[0]?.endpoint?.payload?.url || link?.navigationEndpoint?.urlEndpoint?.url || ''
    const url = decodeYtRedirect(rawUrl)
    if (!url) continue
    const fullUrl = url.startsWith('http') ? url : `https://${url}`
    if (!socials.instagram && fullUrl.includes('instagram.com')) socials.instagram = fullUrl
    if (!socials.twitter && (fullUrl.includes('twitter.com') || fullUrl.includes('x.com'))) socials.twitter = fullUrl
    if (!socials.tiktok && fullUrl.includes('tiktok.com')) socials.tiktok = fullUrl
    if (!socials.linkedin && fullUrl.includes('linkedin.com')) socials.linkedin = fullUrl
    if (!socials.website && !fullUrl.match(/instagram|twitter|tiktok|linkedin|youtube/i)) socials.website = fullUrl
  }
  if (!socials.instagram) socials.instagram = extractSocialUrl(desc, 'instagram.com')
  if (!socials.twitter) socials.twitter = extractSocialUrl(desc, 'twitter.com') || extractSocialUrl(desc, 'x.com')
  if (!socials.tiktok) socials.tiktok = extractSocialUrl(desc, 'tiktok.com')
  if (!socials.linkedin) socials.linkedin = extractSocialUrl(desc, 'linkedin.com')
  return { email, socials }
}

async function searchYouTube(yt: any, query: string, seenIds: Set<string>): Promise<string[]> {
  const ids: string[] = []
  try {
    // channel search for this query
    const chRes = await yt.search(query, { type: 'channel' })
    for (const item of (chRes as any).channels || []) {
      const id = item?.id || item?.author?.id
      if (id && !seenIds.has(id)) { seenIds.add(id); ids.push(id) }
    }
  } catch { /* continue */ }
  try {
    // video search — surfaces smaller channels
    const vRes = await yt.search(query, { type: 'video' })
    const vids = (vRes as any).videos || (vRes as any).results || []
    for (const v of vids) {
      const id = v?.author?.id || v?.channel?.id
      if (id && id.startsWith('UC') && !seenIds.has(id)) { seenIds.add(id); ids.push(id) }
    }
  } catch { /* continue */ }
  return ids
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const keyword = searchParams.get('keyword')
  const maxResults = parseInt(searchParams.get('maxResults') || '50')
  const minViews = parseInt(searchParams.get('minViews') || '0')
  const maxViews = parseInt(searchParams.get('maxViews') || '200000')

  if (!keyword) return NextResponse.json({ error: 'keyword is required' }, { status: 400 })

  const queries = expandTopic(keyword)
  const terms = keyword.toLowerCase().split(/\s+/)

  try {
    const yt = await Innertube.create({ retrieve_player: false })
    const seenIds = new Set<string>()

    // run all query variants in parallel
    const queryResults = await Promise.allSettled(
      queries.map(q => searchYouTube(yt, q, seenIds))
    )

    // flatten all channel IDs in order
    const channelQueue: string[] = []
    for (const r of queryResults) {
      if (r.status === 'fulfilled') channelQueue.push(...r.value)
    }

    const channels: any[] = []

    for (const channelId of channelQueue) {
      if (channels.length >= maxResults) break
      try {
        const channel = await yt.getChannel(channelId)
        const videosPage = await channel.getVideos()
        const { avgViews, videoTitles } = extractVideoData(videosPage)
        if (avgViews === -1 || avgViews < minViews || avgViews > maxViews) continue

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
          videoTitles,
          subscribers: (meta as any)?.subscriber_count || '',
          email,
          relevanceScore: nameScore + bioScore,
          matchedVia,
          ...socials,
        })
      } catch { continue }
    }

    channels.sort((a, b) => b.relevanceScore - a.relevanceScore)
    return NextResponse.json({ channels, expandedQueries: queries })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
