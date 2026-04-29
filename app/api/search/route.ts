import { NextRequest, NextResponse } from 'next/server'
import { Innertube } from 'youtubei.js'

const TOPIC_MAP: Record<string, string[]> = {
  basketball: ['basketball coach', 'basketball trainer', 'basketball analyst', 'NBA agent', 'basketball recruiter', 'basketball content creator', 'basketball skills trainer', 'youth basketball coach', 'basketball player'],
  football: ['football coach', 'NFL agent', 'football analyst', 'football recruiter', 'football trainer', 'football content creator', 'quarterback coach', 'football player'],
  soccer: ['soccer coach', 'soccer agent', 'soccer trainer', 'soccer scout', 'soccer content creator', 'soccer skills', 'youth soccer coach', 'soccer player'],
  baseball: ['baseball coach', 'MLB agent', 'baseball analyst', 'baseball trainer', 'baseball scout', 'baseball content creator', 'pitching coach'],
  golf: ['golf coach', 'golf instructor', 'golf professional', 'golf analyst', 'golf content creator', 'golf swing coach', 'PGA instructor'],
  tennis: ['tennis coach', 'tennis instructor', 'tennis analyst', 'tennis content creator', 'tennis player'],
  sports: ['sports agent', 'sports coach', 'sports analyst', 'sports trainer', 'sports recruiter', 'sports content creator', 'sports marketer', 'athletic trainer', 'sports performance coach', 'youth sports coach', 'college recruiting coach', 'sports management'],
  banking: ['investment banker', 'bank executive', 'private banker', 'wealth manager', 'credit analyst', 'commercial banker', 'finance professional'],
  finance: ['financial advisor', 'investment banker', 'hedge fund manager', 'portfolio manager', 'financial planner', 'CFO', 'finance content creator', 'personal finance', 'stock market educator', 'financial independence', 'money coach', 'financial educator'],
  investing: ['stock investor', 'real estate investor', 'venture capitalist', 'angel investor', 'investment advisor', 'portfolio manager', 'value investor', 'dividend investor', 'options trader', 'stock trader'],
  crypto: ['crypto trader', 'blockchain developer', 'crypto investor', 'DeFi developer', 'crypto analyst', 'web3 founder', 'Bitcoin educator', 'crypto educator'],
  realestate: ['real estate agent', 'real estate investor', 'real estate developer', 'property manager', 'real estate broker', 'mortgage broker', 'house flipper', 'real estate wholesaler'],
  'real estate': ['real estate agent', 'real estate investor', 'real estate developer', 'property manager', 'real estate broker', 'mortgage broker', 'house flipper'],
  fitness: ['fitness coach', 'personal trainer', 'gym owner', 'strength coach', 'fitness content creator', 'bodybuilder', 'weight loss coach', 'calisthenics coach', 'powerlifting coach', 'online fitness coach', 'fitness influencer'],
  health: ['health coach', 'nutritionist', 'wellness coach', 'dietitian', 'physical therapist', 'health content creator', 'functional medicine', 'holistic health', 'longevity coach'],
  nutrition: ['nutritionist', 'dietitian', 'nutrition coach', 'meal prep coach', 'sports nutritionist', 'wellness coach'],
  tech: ['software engineer', 'tech founder', 'startup CEO', 'developer advocate', 'tech content creator', 'coding educator', 'AI founder', 'SaaS founder', 'tech entrepreneur', 'programmer'],
  startup: ['startup founder', 'startup CEO', 'venture capitalist', 'startup advisor', 'entrepreneur', 'bootstrapped founder', 'SaaS founder', 'startup content creator'],
  business: ['entrepreneur', 'business coach', 'small business owner', 'CEO', 'business content creator', 'e-commerce entrepreneur', 'online business', 'side hustle', 'business strategy'],
  marketing: ['marketing consultant', 'digital marketer', 'social media marketer', 'SEO expert', 'brand strategist', 'marketing content creator', 'growth hacker', 'email marketer', 'paid ads expert'],
  music: ['music producer', 'music artist', 'music manager', 'A&R executive', 'music content creator', 'music educator', 'independent artist', 'music business'],
  film: ['film director', 'film producer', 'casting agent', 'screenwriter', 'film content creator', 'cinematographer', 'filmmaker'],
  fashion: ['fashion designer', 'fashion stylist', 'fashion content creator', 'fashion buyer', 'fashion influencer', 'brand consultant', 'streetwear entrepreneur'],
  food: ['chef', 'food blogger', 'restaurant owner', 'food content creator', 'food entrepreneur', 'recipe creator', 'meal prep'],
  travel: ['travel content creator', 'travel blogger', 'tour operator', 'travel influencer', 'digital nomad', 'travel vlogger'],
  education: ['educator', 'online tutor', 'education content creator', 'edtech founder', 'curriculum designer', 'teacher'],
  law: ['lawyer', 'attorney content creator', 'legal advisor', 'law firm partner', 'legal content creator', 'law educator'],
  medicine: ['doctor', 'physician content creator', 'medical educator', 'healthcare professional', 'nurse practitioner', 'surgeon'],
  hr: ['HR director', 'recruiter', 'talent acquisition', 'HR consultant', 'people operations', 'executive recruiter'],
  recruiting: ['recruiter', 'executive recruiter', 'talent acquisition', 'headhunter', 'HR professional', 'career coach'],
  mindset: ['mindset coach', 'life coach', 'motivational speaker', 'self improvement', 'personal development', 'productivity coach', 'mental performance coach'],
  ecommerce: ['ecommerce entrepreneur', 'dropshipping', 'Amazon FBA seller', 'Shopify entrepreneur', 'online store owner', 'product entrepreneur'],
  sales: ['sales trainer', 'sales coach', 'sales content creator', 'B2B sales', 'closing coach', 'sales strategy'],
}

const GENERIC_ROLES = ['coach', 'expert', 'content creator', 'consultant', 'educator', 'entrepreneur', 'influencer']

function expandTopic(keyword: string): string[] {
  const lower = keyword.toLowerCase().trim()
  // broad variants always included so the raw topic surfaces general channels
  const broad = [lower, `${lower} YouTube`, `${lower} channel`, `${lower} tips`]

  if (TOPIC_MAP[lower]) return [...broad, ...TOPIC_MAP[lower]]

  for (const [key, roles] of Object.entries(TOPIC_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return [...broad, ...roles]
  }

  if (lower.includes(' ')) {
    return [keyword, `${keyword} channel`, `${keyword} YouTube`, `${keyword} tips`, `${keyword} advice`]
  }
  return [keyword, ...GENERIC_ROLES.map(r => `${keyword} ${r}`)]
}

function fallbackQueries(keyword: string): string[] {
  return [`${keyword}`, `${keyword} YouTube channel`, `${keyword} tips`, `${keyword} advice`, `how to ${keyword}`]
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

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

function extractEmail(text: string): string {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
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

interface VideoHit {
  channelId: string
  channelName: string
  viewCount: number
  title: string
  date: string
  subscribers: string
}

// Single search call — pulls data directly from search results, NO per-channel API calls
async function searchQuery(yt: any, query: string, retry = true): Promise<VideoHit[]> {
  const hits: VideoHit[] = []
  const seenInQuery = new Set<string>()

  try {
    const chRes = await yt.search(query, { type: 'channel' })
    for (const item of (chRes as any).channels || []) {
      const id = item?.id || item?.author?.id
      if (!id || seenInQuery.has(id)) continue
      seenInQuery.add(id)
      hits.push({ channelId: id, channelName: item?.author?.name || item?.name || '', viewCount: NaN, title: '', date: '', subscribers: '' })
    }
  } catch { /* continue */ }

  try {
    const vRes = await yt.search(query, { type: 'video' })
    const vids = (vRes as any).videos || (vRes as any).results || []
    for (const v of vids) {
      const id = v?.author?.id || v?.channel?.id
      if (!id || !id.startsWith('UC')) continue
      const viewText = v?.view_count?.text || v?.short_view_count?.text || ''
      const viewCount = parseViewCount(viewText)
      const title = v?.title?.text || v?.title?.runs?.[0]?.text || ''
      const date = v?.published?.text || v?.published_time_text?.text || ''
      const channelName = v?.author?.name || v?.channel?.name || ''
      hits.push({ channelId: id, channelName, viewCount, title, date, subscribers: '' })
    }
  } catch { /* continue */ }

  if (hits.length === 0 && retry) {
    await delay(700)
    return searchQuery(yt, query, false)
  }

  return hits
}

// Run query batches with stagger to avoid rate limiting
async function runBatched(yt: any, queries: string[]): Promise<VideoHit[]> {
  const all: VideoHit[] = []
  const BATCH = 3
  for (let i = 0; i < queries.length; i += BATCH) {
    const batch = queries.slice(i, i + BATCH)
    const results = await Promise.allSettled(batch.map(q => searchQuery(yt, q)))
    for (const r of results) {
      if (r.status === 'fulfilled') all.push(...r.value)
    }
    if (i + BATCH < queries.length) await delay(300)
  }
  return all
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

    let hits = await runBatched(yt, queries)

    // count unique channel IDs with actual view data
    const withViews = new Set(hits.filter(h => !isNaN(h.viewCount)).map(h => h.channelId))

    // fallback if thin — try broader queries
    if (withViews.size < 10) {
      const extra = await runBatched(yt, fallbackQueries(keyword))
      hits.push(...extra)
    }

    // aggregate by channel — collect all view samples, titles, dates, subscribers
    const channelMap = new Map<string, {
      name: string
      views: number[]
      titles: string[]
      dates: string[]
      subscribers: string
    }>()

    for (const h of hits) {
      if (!channelMap.has(h.channelId)) {
        channelMap.set(h.channelId, { name: h.channelName, views: [], titles: [], dates: [], subscribers: h.subscribers })
      }
      const entry = channelMap.get(h.channelId)!
      if (h.channelName && !entry.name) entry.name = h.channelName
      if (h.subscribers && !entry.subscribers) entry.subscribers = h.subscribers
      if (!isNaN(h.viewCount) && h.viewCount >= 0) entry.views.push(h.viewCount)
      if (h.title) entry.titles.push(h.title)
      if (h.date) entry.dates.push(h.date)
    }

    // build channel list — filter by avg views
    const channels: any[] = []

    for (const [channelId, data] of channelMap) {
      if (channels.length >= maxResults) break
      if (data.views.length === 0) continue

      const avgViews = Math.round(data.views.reduce((a, b) => a + b, 0) / data.views.length)
      if (avgViews < minViews || avgViews > maxViews) continue

      const channelName = data.name || 'Unknown'
      const nameScore = scoreBio(channelName.toLowerCase(), terms)

      channels.push({
        channelId,
        channelName,
        channelUrl: `https://www.youtube.com/channel/${channelId}`,
        avgViews,
        description: '',
        videoTitles: [...new Set(data.titles)].slice(0, 3),
        videoDates: [...new Set(data.dates)].slice(0, 2),
        subscribers: data.subscribers,
        email: '',
        relevanceScore: nameScore,
        matchedVia: nameScore > 0 ? 'name' : 'related',
        instagram: '', twitter: '', tiktok: '', linkedin: '', website: '',
      })
    }

    channels.sort((a, b) => b.relevanceScore - a.relevanceScore)
    return NextResponse.json({ channels, expandedQueries: queries })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
