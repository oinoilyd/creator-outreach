import { NextRequest, NextResponse } from 'next/server'
import { Innertube } from 'youtubei.js'

const TOPIC_MAP: Record<string, string[]> = {
  basketball: ['basketball coach', 'basketball trainer', 'basketball analyst', 'NBA agent', 'basketball recruiter', 'basketball player YouTube', 'basketball content creator', 'basketball skills trainer', 'youth basketball coach'],
  football: ['football coach', 'NFL agent', 'football analyst', 'football recruiter', 'football trainer', 'football content creator', 'quarterback coach', 'football recruiting'],
  soccer: ['soccer coach', 'soccer agent', 'soccer trainer', 'soccer scout', 'soccer content creator', 'football coach Europe', 'soccer skills', 'youth soccer coach'],
  baseball: ['baseball coach', 'MLB agent', 'baseball analyst', 'baseball trainer', 'baseball scout', 'baseball content creator', 'pitching coach'],
  golf: ['golf coach', 'golf instructor', 'golf professional', 'golf analyst', 'golf content creator', 'golf swing coach', 'PGA instructor'],
  tennis: ['tennis coach', 'tennis instructor', 'tennis analyst', 'tennis content creator', 'tennis player YouTube'],
  sports: ['sports agent', 'sports coach', 'sports analyst', 'sports trainer', 'sports recruiter', 'sports content creator', 'sports marketer', 'athletic trainer', 'sports performance coach', 'sports management', 'youth sports coach', 'college recruiting coach'],
  banking: ['investment banker', 'bank executive', 'private banker', 'wealth manager', 'credit analyst', 'commercial banker', 'retail banking'],
  finance: ['financial advisor', 'investment banker', 'hedge fund manager', 'portfolio manager', 'financial planner', 'CFO', 'finance content creator', 'personal finance YouTube', 'stock market educator', 'financial independence', 'money coach'],
  investing: ['stock investor', 'real estate investor', 'venture capitalist', 'angel investor', 'investment advisor', 'portfolio manager', 'value investor', 'dividend investor', 'options trader'],
  crypto: ['crypto trader', 'blockchain developer', 'crypto investor', 'DeFi developer', 'crypto analyst', 'web3 founder', 'NFT creator', 'Bitcoin educator'],
  realestate: ['real estate agent', 'real estate investor', 'real estate developer', 'property manager', 'real estate broker', 'mortgage broker', 'house flipper', 'real estate wholesaler'],
  'real estate': ['real estate agent', 'real estate investor', 'real estate developer', 'property manager', 'real estate broker', 'mortgage broker', 'house flipper'],
  fitness: ['fitness coach', 'personal trainer', 'gym owner', 'strength coach', 'fitness content creator', 'bodybuilder YouTube', 'weight loss coach', 'calisthenics coach', 'powerlifting coach', 'online fitness coach'],
  health: ['health coach', 'nutritionist', 'wellness coach', 'dietitian', 'physical therapist', 'health content creator', 'functional medicine', 'holistic health', 'longevity coach'],
  nutrition: ['nutritionist', 'dietitian', 'nutrition coach', 'meal prep coach', 'sports nutritionist', 'wellness coach', 'food as medicine'],
  tech: ['software engineer YouTube', 'tech founder', 'startup CEO', 'developer advocate', 'tech content creator', 'coding educator', 'AI founder', 'SaaS founder', 'tech entrepreneur'],
  startup: ['startup founder', 'startup CEO', 'venture capitalist', 'startup advisor', 'entrepreneur YouTube', 'bootstrapped founder', 'SaaS founder', 'startup content creator'],
  business: ['entrepreneur YouTube', 'business coach', 'small business owner', 'CEO YouTube', 'business content creator', 'e-commerce entrepreneur', 'online business', 'side hustle', 'business strategy'],
  marketing: ['marketing consultant', 'digital marketer', 'social media marketer', 'SEO expert', 'brand strategist', 'marketing content creator', 'growth hacker', 'email marketer', 'paid ads expert'],
  music: ['music producer', 'music artist', 'music manager', 'A&R executive', 'music content creator', 'music educator', 'independent artist YouTube', 'music business'],
  film: ['film director', 'film producer', 'casting agent', 'screenwriter', 'film content creator', 'cinematographer', 'filmmaker YouTube'],
  fashion: ['fashion designer', 'fashion stylist', 'fashion content creator', 'fashion buyer', 'fashion influencer', 'brand consultant', 'streetwear entrepreneur'],
  food: ['chef YouTube', 'food blogger', 'restaurant owner', 'food content creator', 'food entrepreneur', 'recipe creator', 'meal prep'],
  travel: ['travel content creator', 'travel blogger', 'tour operator', 'travel influencer', 'digital nomad YouTube', 'travel vlogger'],
  education: ['educator YouTube', 'online tutor', 'education content creator', 'edtech founder', 'curriculum designer', 'teacher YouTube'],
  law: ['lawyer YouTube', 'attorney content creator', 'legal advisor', 'law firm partner', 'legal content creator', 'law educator'],
  medicine: ['doctor YouTube', 'physician content creator', 'medical educator', 'healthcare professional', 'nurse practitioner YouTube', 'surgeon YouTube'],
  hr: ['HR director', 'recruiter YouTube', 'talent acquisition', 'HR consultant', 'people operations', 'executive recruiter'],
  recruiting: ['recruiter YouTube', 'executive recruiter', 'talent acquisition', 'headhunter', 'HR professional', 'career coach'],
  mindset: ['mindset coach', 'life coach', 'motivational speaker YouTube', 'self improvement', 'personal development', 'productivity coach', 'mental performance coach'],
  ecommerce: ['ecommerce entrepreneur', 'dropshipping YouTube', 'Amazon FBA seller', 'Shopify entrepreneur', 'online store owner', 'product entrepreneur'],
  sales: ['sales trainer', 'sales coach', 'sales content creator', 'B2B sales', 'closing coach', 'sales strategy'],
}

const GENERIC_ROLES = ['coach', 'professional', 'expert', 'analyst', 'content creator', 'consultant', 'educator', 'entrepreneur', 'YouTube']

function expandTopic(keyword: string): string[] {
  const lower = keyword.toLowerCase().trim()
  if (TOPIC_MAP[lower]) return TOPIC_MAP[lower]
  for (const [key, roles] of Object.entries(TOPIC_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return roles
  }
  return [keyword, ...GENERIC_ROLES.map(r => `${keyword} ${r}`)]
}

// Broader fallback queries when primary search is thin
function fallbackQueries(keyword: string): string[] {
  return [keyword, `${keyword} YouTube`, `${keyword} channel`, `${keyword} creator`, `${keyword} vlog`]
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

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

function parseViewCount(text: string): number {
  if (!text) return NaN
  const t = text.replace(/,/g, '').toLowerCase()
  const m = t.match(/[\d.]+/)
  if (!m) return NaN
  const n = parseFloat(m[0])
  if (t.includes('b')) return Math.round(n * 1_000_000_000)
  if (t.includes('m')) return Math.round(n * 1_000_000)
  if (t.includes('k')) return Math.round(n * 1_000)
  return Math.round(n)
}

function extractVideoData(videos: any): { avgViews: number, videoTitles: string[], videoDates: string[] } {
  const richItems: any[] = videos?.current_tab?.content?.contents || []
  const videoItems = richItems.map((item: any) => item?.content).filter(Boolean).slice(0, 10)
  if (videoItems.length === 0) return { avgViews: -1, videoTitles: [], videoDates: [] }
  let total = 0, count = 0
  const videoTitles: string[] = []
  const videoDates: string[] = []
  for (const v of videoItems) {
    const text: string = v?.view_count?.text || v?.short_view_count?.text || ''
    const num = parseViewCount(text)
    if (!isNaN(num) && num >= 0) { total += num; count++ }
    const title: string = v?.title?.text || v?.title?.runs?.[0]?.text || ''
    if (title) videoTitles.push(title)
    const date: string = v?.published_time_text?.text || v?.published?.text || ''
    if (date) videoDates.push(date)
  }
  return {
    avgViews: count > 0 ? Math.round(total / count) : -1,
    videoTitles: videoTitles.slice(0, 3),
    videoDates: videoDates.slice(0, 2),
  }
}

function extractAboutData(about: any): { email: string, socials: Record<string, string>, subscribers: string } {
  const socials: Record<string, string> = {}
  let email = ''
  const meta = about?.metadata
  if (!meta) return { email, socials, subscribers: '' }
  const subscribers: string = String(meta.subscribers_count ?? meta.subscriber_count ?? '')
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
  return { email, socials, subscribers }
}

async function searchYouTube(yt: any, query: string, seenIds: Set<string>, retry = true): Promise<string[]> {
  const ids: string[] = []
  try {
    const chRes = await yt.search(query, { type: 'channel' })
    for (const item of (chRes as any).channels || []) {
      const id = item?.id || item?.author?.id
      if (id && !seenIds.has(id)) { seenIds.add(id); ids.push(id) }
    }
  } catch { /* continue */ }
  try {
    const vRes = await yt.search(query, { type: 'video' })
    const vids = (vRes as any).videos || (vRes as any).results || []
    for (const v of vids) {
      const id = v?.author?.id || v?.channel?.id
      if (id && id.startsWith('UC') && !seenIds.has(id)) { seenIds.add(id); ids.push(id) }
    }
  } catch { /* continue */ }
  // retry once on empty result
  if (ids.length === 0 && retry) {
    await delay(600)
    return searchYouTube(yt, query, seenIds, false)
  }
  return ids
}

// Run queries in staggered batches of 3 to avoid rate limiting
async function runQueriesBatched(yt: any, queries: string[], seenIds: Set<string>): Promise<string[]> {
  const allIds: string[] = []
  const BATCH = 3
  for (let i = 0; i < queries.length; i += BATCH) {
    const batch = queries.slice(i, i + BATCH)
    const results = await Promise.allSettled(batch.map(q => searchYouTube(yt, q, seenIds)))
    for (const r of results) {
      if (r.status === 'fulfilled') allIds.push(...r.value)
    }
    if (i + BATCH < queries.length) await delay(250)
  }
  return allIds
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const keyword = searchParams.get('keyword')
  const maxResults = parseInt(searchParams.get('maxResults') || '100')
  const minViews = parseInt(searchParams.get('minViews') || '0')
  const maxViews = parseInt(searchParams.get('maxViews') || '200000')

  if (!keyword) return NextResponse.json({ error: 'keyword is required' }, { status: 400 })

  const queries = expandTopic(keyword)
  const terms = keyword.toLowerCase().split(/\s+/)

  try {
    const yt = await Innertube.create({ retrieve_player: false })
    const seenIds = new Set<string>()

    // staggered batched queries — reduces rate limiting vs firing all at once
    let channelQueue = await runQueriesBatched(yt, queries, seenIds)

    // if thin results, try broader fallback queries
    if (channelQueue.length < 15) {
      const extra = await runQueriesBatched(yt, fallbackQueries(keyword), seenIds)
      channelQueue.push(...extra)
    }

    const channels: any[] = []
    const CHAN_BATCH = 4  // process 4 channels in parallel — faster than sequential

    for (let i = 0; i < channelQueue.length && channels.length < maxResults; i += CHAN_BATCH) {
      const batch = channelQueue.slice(i, i + CHAN_BATCH)
      const results = await Promise.allSettled(batch.map(async (channelId) => {
        const channel = await yt.getChannel(channelId)
        const videosPage = await channel.getVideos()
        const { avgViews, videoTitles, videoDates } = extractVideoData(videosPage)
        if (avgViews === -1 || avgViews < minViews || avgViews > maxViews) return null

        const meta = channel.metadata
        const channelName = meta?.title || 'Unknown'
        const description: string = meta?.description || ''
        const email = extractEmail(description)
        const nameScore = scoreBio(channelName.toLowerCase(), terms)
        const bioScore = scoreBio(description.toLowerCase(), terms)

        return {
          channelId,
          channelName,
          channelUrl: `https://www.youtube.com/channel/${channelId}`,
          avgViews,
          description,
          videoTitles,
          videoDates,
          subscribers: '',
          email,
          relevanceScore: nameScore + bioScore,
          matchedVia: nameScore > 0 ? 'name' : bioScore > 0 ? 'bio' : 'related',
          instagram: '', twitter: '', tiktok: '', linkedin: '', website: '',
        }
      }))

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value !== null && channels.length < maxResults) {
          channels.push(r.value)
        }
      }
    }

    channels.sort((a, b) => b.relevanceScore - a.relevanceScore)
    return NextResponse.json({ channels, expandedQueries: queries })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
