import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

// All recognized strategy keys, in canonical order. The admin UI maps
// 1:1 to this list; storing them sorted keeps "strategy" comparisons
// across runs deterministic.
const STRATEGY_KEYS = [
  'web_scrape',
  'biolink',
  'bio_pages',
  'ddg',
  'wayback',
  'domain_guess',
] as const

type StrategyKey = typeof STRATEGY_KEYS[number]

interface SearchChannel {
  channelId: string
  channelName: string
  description?: string
  videoTitles?: string[]
  website?: string
  instagram?: string
  tiktok?: string
}

interface EnrichResult {
  channelName: string
  channelId: string
  hasEmail: boolean
  email: string
  durationMs: number
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: {
    query?: string
    region?: string
    strategy?: string[]
    max?: number
    notes?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const query = (body.query || '').trim()
  if (!query) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 })
  }

  const region = (body.region || '').trim().slice(0, 8)
  const max = Math.min(Math.max(body.max ?? 15, 1), 30)
  const notes = (body.notes || '').trim().slice(0, 200) || null

  // Normalize + validate strategy. Empty array means "everything off"
  // (effectively just YouTube About + description regex). When the
  // caller omits strategy entirely we default to "everything on".
  const requested = Array.isArray(body.strategy) ? body.strategy : null
  const strategy: StrategyKey[] = requested
    ? STRATEGY_KEYS.filter(k => requested.includes(k))
    : [...STRATEGY_KEYS]
  const strategyCsv = strategy.join(',')

  const start = Date.now()

  // Use the request URL to derive origin for internal fetches. Forward
  // the auth cookie so the search/enrich routes accept the call.
  const origin = new URL(req.url).origin
  const cookie = req.headers.get('cookie') || ''

  // 1) Search → list of channels
  const searchUrl = new URL(`${origin}/api/search`)
  searchUrl.searchParams.set('keyword', query)
  if (region) searchUrl.searchParams.set('regions', region)
  searchUrl.searchParams.set('expanded', 'false')
  searchUrl.searchParams.set('uniqueOnly', 'true')

  let channels: SearchChannel[] = []
  try {
    const searchResp = await fetch(searchUrl.toString(), {
      headers: { cookie },
      cache: 'no-store',
    })
    if (!searchResp.ok) {
      const txt = await searchResp.text().catch(() => '')
      return NextResponse.json(
        { error: `Search failed: ${searchResp.status}`, detail: txt.slice(0, 300) },
        { status: 502 },
      )
    }
    const data = await searchResp.json()
    channels = (data.channels || []).slice(0, max)
  } catch (e) {
    return NextResponse.json(
      { error: `Search threw: ${(e as Error).message}` },
      { status: 502 },
    )
  }

  if (channels.length === 0) {
    return NextResponse.json({ error: 'Search returned no creators.' }, { status: 200 })
  }

  // 2) Enrich each channel in parallel (small batch, ok to fan out)
  const results: EnrichResult[] = await Promise.all(
    channels.map(async (c): Promise<EnrichResult> => {
      const t0 = Date.now()
      const enrichUrl = new URL(`${origin}/api/enrich`)
      enrichUrl.searchParams.set('channelId', c.channelId)
      enrichUrl.searchParams.set('name', c.channelName || '')
      if (c.website) enrichUrl.searchParams.set('website', c.website)
      if (c.instagram) enrichUrl.searchParams.set('instagram', c.instagram)
      if (c.tiktok) enrichUrl.searchParams.set('tiktok', c.tiktok)
      if (c.description) enrichUrl.searchParams.set('description', c.description.slice(0, 2000))
      enrichUrl.searchParams.set('strategy', strategyCsv)

      try {
        const r = await fetch(enrichUrl.toString(), {
          headers: { cookie },
          cache: 'no-store',
        })
        const j = r.ok ? await r.json() : { email: '' }
        return {
          channelName: c.channelName,
          channelId: c.channelId,
          hasEmail: !!j.email,
          email: j.email || '',
          durationMs: Date.now() - t0,
        }
      } catch {
        return {
          channelName: c.channelName,
          channelId: c.channelId,
          hasEmail: false,
          email: '',
          durationMs: Date.now() - t0,
        }
      }
    }),
  )

  const total = results.length
  const withEmail = results.filter(r => r.hasEmail).length
  const hitRate = total > 0 ? Number(((withEmail / total) * 100).toFixed(2)) : 0
  const tookMs = Date.now() - start

  // 3) Save the run record
  const { data: insertData, error: insertErr } = await supabase
    .from('email_test_runs')
    .insert({
      query,
      region: region || null,
      strategy: strategyCsv,
      total,
      with_email: withEmail,
      hit_rate: hitRate,
      took_ms: tookMs,
      notes,
    })
    .select('id, created_at')
    .single()

  if (insertErr) {
    console.error('[email-test] save failed:', insertErr.message)
  }

  return NextResponse.json({
    runId: insertData?.id ?? null,
    createdAt: insertData?.created_at ?? null,
    query,
    region: region || null,
    strategy: strategyCsv,
    total,
    withEmail,
    hitRate,
    tookMs,
    results,
  })
}
