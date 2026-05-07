import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPlausibleEmail } from '@/lib/newMethodology'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

// Hard-coded final scrub. This is belt-and-suspenders defense — every
// email-emitting code path SHOULD already filter via isPlausibleEmail,
// but if any of them is broken (deploy lag, missed source path,
// regression), this catches it as the absolute last step before the
// response leaves the server.
//
// If something keeps showing up despite the upstream blocklist,
// add the pattern here. Can't be bypassed.
const HARD_BLOCK_PATTERNS: RegExp[] = [
  /@stanwith\.me$/i,
  /@stan\.store$/i,
  /@patreon\.com$/i,
  /@buymeacoffee\.com$/i,
  /@ko-?fi\.com$/i,
  /@.+\.sentry\.io$/i,
  /@sentry\.io$/i,
  /@allmylinks\.com$/i,
  /@about\.me$/i,
  /@bio\.fm$/i,
  /@solo\.to$/i,
  /@pillar\.io$/i,
  /@lnk\.bio$/i,
  /@msha\.ke$/i,
  /@withkoji\.com$/i,
  /@campsite\.bio$/i,
  /@beehiiv\.com$/i,
  /@substack\.com$/i,
  /@convertkit\.com$/i,
  /@mailchimp\.com$/i,
  /@gumroad\.com$/i,
]

function isBlockedEmail(email: string): boolean {
  if (!email) return true
  const lc = email.toLowerCase().trim()
  if (HARD_BLOCK_PATTERNS.some(re => re.test(lc))) return true
  if (!isPlausibleEmail(lc)) return true
  return false
}

function scrubResult<T extends { hasEmail: boolean; email: string; source: 'primary' | 'new_methodology' | 'educated_assumption' | null }>(r: T): T {
  if (!r.hasEmail || !r.email) return r
  if (isBlockedEmail(r.email)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[email-test scrub] dropping ${r.email} (source=${r.source})`)
    } else {
      console.warn(`[email-test scrub] dropped junk email source=${r.source}`)
    }
    return { ...r, hasEmail: false, email: '', source: null }
  }
  return r
}

// All recognized toggle keys, in canonical order. Keys ending with the
// /api/enrich-recognized set are sent through; new_methodology and
// verify_deliverability are admin-side post-process toggles handled
// here in the orchestrator.
const STRATEGY_KEYS = [
  'web_scrape',
  'biolink',
  'bio_pages',
  'ddg',
  'wayback',
  'domain_guess',
  'new_methodology',
] as const

const ENRICH_KEYS = ['web_scrape', 'biolink', 'bio_pages', 'ddg', 'wayback'] as const

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
  source: 'primary' | 'new_methodology' | 'educated_assumption' | null
  method?: string
  confidence?: number
  evidence?: string
  durationMs: number
  // Socials returned by /api/enrich — surfaced here so the benchmark
  // can compute per-platform success rates without re-fetching.
  linkedin?: string
  instagram?: string
  twitter?: string
  tiktok?: string
  website?: string
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
  const max = Math.min(Math.max(body.max ?? 15, 1), 50)
  const notes = (body.notes || '').trim().slice(0, 200) || null

  // Normalize + validate strategy. Empty array means "everything off"
  // (effectively just YouTube About + description regex). When the
  // caller omits strategy entirely we default to "everything on".
  const requested = Array.isArray(body.strategy) ? body.strategy : null
  const strategy: StrategyKey[] = requested
    ? STRATEGY_KEYS.filter(k => requested.includes(k))
    : [...STRATEGY_KEYS]

  // The "domain_guess" toggle means "run the educated-assumption
  // fallback for creators with no email after primary".
  const useEducatedAssumption = strategy.includes('domain_guess')

  // The "new_methodology" toggle means "after primary enrichment, run
  // the bundle of new email-discovery methods (recent video desc,
  // sitemap, creator platforms, community posts, AI extraction) for
  // any creator still empty". When on, every primary strategy is
  // forced on regardless of individual toggles — the point is to
  // measure the upper bound of what's possible.
  const useNewMethodology = strategy.includes('new_methodology' as StrategyKey)

  // Enrichment strategy: only the /api/enrich-recognized keys. When
  // new_methodology is on, we force every enrich method on regardless
  // of individual toggles (the point is to measure upper-bound yield).
  const enrichStrategy = useNewMethodology
    ? [...ENRICH_KEYS]
    : ENRICH_KEYS.filter(k => strategy.includes(k as StrategyKey))
  const strategyCsv = enrichStrategy.join(',')

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
        const j = r.ok ? await r.json() : { email: '', website: '', instagram: '', twitter: '', tiktok: '', linkedin: '' }

        const socials = {
          linkedin: j.linkedin || '',
          instagram: j.instagram || c.instagram || '',
          twitter: j.twitter || '',
          tiktok: j.tiktok || c.tiktok || '',
          website: j.website || c.website || '',
        }

        // If the primary pipeline found a real email, we're done.
        // Validate first — production /api/enrich extracts emails with a
        // plain regex and has no platform-domain blocklist, so it can
        // surface junk like friends@stanwith.me from a Linktree-expanded
        // Stan profile page. We strip those here and let the fallbacks
        // try instead.
        if (j.email && isPlausibleEmail(String(j.email).toLowerCase())) {
          return {
            channelName: c.channelName,
            channelId: c.channelId,
            hasEmail: true,
            email: j.email,
            source: 'primary' as const,
            durationMs: Date.now() - t0,
            ...socials,
          }
        }

        // Second pass — new methodology bundle. Fires BEFORE educated
        // assumption because it has access to more sources (recent
        // video descriptions, sitemap pages, creator-platform profiles,
        // community posts, AI extraction). If anything here lands, we
        // skip educated assumption entirely.
        if (useNewMethodology) {
          const nmResp = await fetch(`${origin}/api/admin/new-methodology`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie },
            cache: 'no-store',
            body: JSON.stringify({
              channelId: c.channelId,
              channelName: c.channelName || '',
              description: c.description,
              website: j.website || c.website,
              instagram: j.instagram || c.instagram,
              twitter: j.twitter,
              tiktok: j.tiktok || c.tiktok,
              linkedin: j.linkedin,
            }),
          })
          const nm = nmResp.ok ? await nmResp.json() : { email: null, hits: [] }
          if (nm.email) {
            const top = nm.hits?.[0]
            return {
              channelName: c.channelName,
              channelId: c.channelId,
              hasEmail: true,
              email: nm.email,
              source: 'new_methodology' as const,
              method: top?.method,
              evidence: top?.evidence,
              durationMs: Date.now() - t0,
              ...socials,
            }
          }
        }

        // Third pass — educated assumption (evidence-only pattern matching).
        if (useEducatedAssumption) {
          const eaUrl = `${origin}/api/admin/educated-assumption`
          const eaResp = await fetch(eaUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie },
            cache: 'no-store',
            body: JSON.stringify({
              channelId: c.channelId,
              channelName: c.channelName || '',
              description: c.description,
              website: j.website || c.website,
              instagram: j.instagram || c.instagram,
              twitter: j.twitter,
              tiktok: j.tiktok || c.tiktok,
              linkedin: j.linkedin,
            }),
          })
          const ea = eaResp.ok ? await eaResp.json() : { email: null, candidates: [] }
          if (ea.email && isPlausibleEmail(String(ea.email).toLowerCase())) {
            const top = ea.candidates?.[0]
            return {
              channelName: c.channelName,
              channelId: c.channelId,
              hasEmail: true,
              email: ea.email,
              source: 'educated_assumption' as const,
              confidence: top?.confidence,
              evidence: top?.evidence,
              durationMs: Date.now() - t0,
              ...socials,
            }
          }
        }

        return {
          channelName: c.channelName,
          channelId: c.channelId,
          hasEmail: false,
          email: '',
          source: null,
          durationMs: Date.now() - t0,
          ...socials,
        }
      } catch {
        return {
          channelName: c.channelName,
          channelId: c.channelId,
          hasEmail: false,
          email: '',
          source: null,
          durationMs: Date.now() - t0,
        }
      }
    }),
  )

  // FINAL SCRUB — the last line of defense, no mutation tricks. Build
  // a fresh array of cleaned results and use it for ALL downstream
  // computation + the response itself. Any aggregate computed off the
  // raw `results` array would skip the scrub.
  const cleanedResults = results.map(r => {
    if (!r.hasEmail || !r.email) return r
    if (isBlockedEmail(r.email)) {
      console.warn(`[email-test scrub] DROPPING email="${r.email}" source=${r.source}`)
      return { ...r, hasEmail: false, email: '', source: null as null }
    }
    return r
  })

  // From here on, everything reads from cleanedResults — never `results`.
  const total = cleanedResults.length
  const withEmail = cleanedResults.filter(r => r.hasEmail).length
  const hitRate = total > 0 ? Number(((withEmail / total) * 100).toFixed(2)) : 0
  const tookMs = Date.now() - start

  // Track which fallback (if any) was responsible for each win — useful
  // for understanding where the lift is coming from.
  const fromAssumption = cleanedResults.filter(r => r.source === 'educated_assumption').length
  const fromMethodology = cleanedResults.filter(r => r.source === 'new_methodology').length
  const fromPrimary = withEmail - fromAssumption - fromMethodology

  // 3) Save the run record. Saved strategy reflects what was REQUESTED
  // (including domain_guess) so the runs table is honest about what
  // was tested, even though we routed it to educated-assumption.
  const fullStrategy = strategy.join(',')
  const { data: insertData, error: insertErr } = await supabase
    .from('email_test_runs')
    .insert({
      query,
      region: region || null,
      strategy: fullStrategy,
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
    strategy: fullStrategy,
    total,
    withEmail,
    fromPrimary,
    fromMethodology,
    fromAssumption,
    hitRate,
    tookMs,
    results: cleanedResults,
  })
}
