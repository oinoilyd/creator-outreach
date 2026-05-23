/**
 * /api/insights/dashboard — Claude-generated one-liner for the top
 * header pill. Distinct from /api/insights/weekly (the analytics-tab
 * insight) in two ways:
 *
 *   • Shorter — single sentence, ~20 words max. Designed to fit in a
 *     header pill that can be glanced at.
 *   • Adaptive — branches on whether the user is "new" (no Successful
 *     entries yet, or a small total) vs experienced. New users get
 *     onboarding-flavored framing ("You've added 4 leads. Reach out
 *     to your first one to start tracking response rates."). Experienced
 *     users get actionable status ("3 follow-ups overdue today.").
 *
 * Cost: very small — ~80 input + 40 output tokens per call. Rate-
 * limited 24/hour/user (~once an hour with a few refreshes).
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireUser, rateLimit } from '@/lib/api-auth'

const client = new Anthropic({ apiKey: process.env.AI_Score_Key })

interface DashboardMetrics {
  total: number
  reachedOut: number
  responseReceived: number
  successful: number
  notOutreached: number
  open: number
  noResponse: number
  rejected: number
  responseRate: number
  winRate: number
  pipelineValue: number
  stale: number
  addedLast7: number
  reachedLast7: number
  wonLast30: number
  activeNow: number
  totalBooked: number
  personalRevenue: number
  byMedium: Record<'Email' | 'LinkedIn' | 'Other', { reached: number; won: number }>
}

interface DashboardRequestBody {
  metrics: DashboardMetrics
  /** Recent search keywords (last few) — captured client-side from
   *  localStorage so the AI can reference what the user has been
   *  hunting for. Empty array is fine. */
  recentSearches?: string[]
  /** Days since the user's first outreach entry (proxies "how long
   *  have they been using the app"). null = no entries at all. */
  daysSinceFirstEntry?: number | null
  /** Previously-rendered insight, if any. Sent on refresh so the
   *  prompt can explicitly steer Claude away from repeating it. */
  previousInsight?: string
  /** Monotonic counter incremented per manual refresh. Used to
   *  rotate which facet of the data we ask Claude to lean into,
   *  so successive refreshes surface materially different angles
   *  instead of paraphrasing the same priority bucket. */
  refreshIndex?: number
}

interface DashboardResponse {
  insight: string
  generatedAt: number
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const user = auth

  // 24/hour/user — comfortably above the 1-per-hour auto-refresh
  // cadence, with plenty of headroom for manual refreshes.
  const limited = rateLimit(user.id, 'insights-dashboard', 24)
  if (limited) return limited

  let body: DashboardRequestBody
  try {
    body = await req.json() as DashboardRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.metrics || typeof body.metrics.total !== 'number') {
    return NextResponse.json({ error: 'Missing metrics.' }, { status: 400 })
  }

  // Zero-data shortcut — no LLM call needed; the empty-state copy
  // is deterministic and doesn't benefit from variation.
  if (body.metrics.total === 0 && (!body.recentSearches || body.recentSearches.length === 0)) {
    return NextResponse.json<DashboardResponse>({
      insight: 'Start by running a search on the Results tab to find creators in your niche.',
      generatedAt: Date.now(),
    })
  }

  const isNew =
    body.metrics.total < 5 ||
    body.metrics.successful === 0 ||
    (body.daysSinceFirstEntry != null && body.daysSinceFirstEntry < 7)

  const refreshIndex = typeof body.refreshIndex === 'number' && Number.isFinite(body.refreshIndex)
    ? Math.max(0, Math.floor(body.refreshIndex))
    : 0
  const prompt = buildPrompt(
    body.metrics,
    body.recentSearches ?? [],
    isNew,
    refreshIndex,
    typeof body.previousInsight === 'string' ? body.previousInsight.slice(0, 280) : '',
  )

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 120,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = (message.content[0] as { text?: string }).text?.trim() || ''
    const clean = raw
      .replace(/^["'`]+|["'`]+$/g, '')   // strip wrapping quotes
      .replace(/^```[a-z]*\s*/i, '')
      .replace(/\s*```$/, '')
      .replace(/\*\*/g, '')
      .split(/\n\n/)[0]                  // first paragraph only
      .replace(/\n/g, ' ')               // collapse soft wraps
      .trim()
      .slice(0, 240)                     // hard cap

    return NextResponse.json<DashboardResponse>({
      insight: clean,
      generatedAt: Date.now(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[insights/dashboard] error:', msg)
    return NextResponse.json(
      { error: 'Top-bar insight is temporarily unavailable. Try again in a moment.' },
      { status: 500 },
    )
  }
}

/** Rotating focus facets for repeat refreshes. Each refresh advances
 *  the index so the model is pushed at a different slice of the data.
 *  Two lists — new vs experienced — because the relevant angles
 *  differ at each stage.
 *
 *  Note: the model can still pick anything if the active facet has no
 *  meaningful signal in the data (e.g. velocity facet but addedLast7=0).
 *  The prompt tells it to fall back to a different angle in that case
 *  rather than fabricate. */
const NEW_FACETS = [
  'WHAT THEY HAVE DONE: review concretely what the user has accomplished so far — leads added, channels explored, searches run. Honour their effort.',
  'NEXT CONCRETE STEP: pick the next 1-action move that unblocks them (reach out to a specific lead, add the first one from a search, set a follow-up date).',
  'SEARCH REFLECTION: comment on the recent searches they ran and what to do with them — narrower niche, broader, or add a creator from results.',
  'STATUS GAP: name a specific gap in their pipeline (entries added but none reached out, leads with emails sitting idle) and how to close it.',
  'MOMENTUM: comment on how recent their activity is — added in the last day/week, slowing down, or starting fresh — and what to do next.',
] as const

const EXPERIENCED_FACETS = [
  'ACTION QUEUE: stale follow-ups overdue, today\'s follow-ups, opens sitting too long without a touch.',
  'CONVERSION PERFORMANCE: response rate and win rate. Which medium (Email / LinkedIn / Other) is outperforming the rest? Lean in.',
  'REVENUE STATE: total booked, personal revenue, recent wins worth doubling-down on. Mention dollars.',
  'RECENT TRAJECTORY: addedLast7, reachedLast7, wonLast30 — are they speeding up or slowing down? Comment on the trend.',
  'ENGAGEMENT HEALTH: active clients right now, anything sitting paused, completed wins worth turning into repeats or referrals.',
  'UNTAPPED CAPACITY: leads with email but not reached, "Open" entries with no touchpoints recorded, segments with high reach but low win.',
] as const

function buildPrompt(
  metrics: DashboardMetrics,
  recentSearches: string[],
  isNew: boolean,
  refreshIndex: number,
  previousInsight: string,
): string {
  const facets = isNew ? NEW_FACETS : EXPERIENCED_FACETS
  const facet = facets[refreshIndex % facets.length]

  const newGuidance = `
USER STATE: NEW. They're still ramping up. Frame as a gentle next-step nudge based on what they've actually done so far.
- Mention specific numbers from the data ("you've added 3 leads", "all 4 sitting at Not Outreached").
- Voice: friendly but direct, no greeting words.`

  const experiencedGuidance = `
USER STATE: EXPERIENCED. Be opinionated and specific.
- Specific numbers required. Specific channel (Email / LinkedIn / Other) when relevant.
- Voice: direct, no hedging.`

  const searchBlock = recentSearches.length > 0
    ? `Recent searches: ${recentSearches.slice(0, 5).map(s => `"${s.slice(0, 40)}"`).join(', ')}`
    : '(No recent search history available.)'

  const previousBlock = previousInsight
    ? `\nPREVIOUSLY YOU SAID (do NOT repeat or paraphrase this — surface a different angle):\n"${previousInsight}"\n`
    : ''

  const facetBlock = `\nTHIS TURN'S FOCUS:\n${facet}\nIf the data does not support this focus (e.g. zero stale follow-ups when the focus is action queue), pick a different facet from the data that DOES have signal. Never fabricate numbers.\n`

  return `You are a heads-up display for a creator-outreach SaaS. Output exactly ONE sentence (max 22 words) summarizing the most useful thing the user should know or do RIGHT NOW.

CRITICAL FORMATTING:
- ONE sentence. Period or no period — your call. No semicolons stringing two thoughts.
- Plain prose, no markdown, no emoji, no quotes around the output.
- No greeting words ("Hey", "Hi", "Looking good"). Just the insight.
- No hedging ("might want to", "perhaps"). Direct, opinionated.
- Second person ("you", "your").
- Every number you cite MUST appear in the data block below. No making numbers up.

${isNew ? newGuidance : experiencedGuidance}
${facetBlock}${previousBlock}
Current state:
${JSON.stringify(metrics, null, 2)}

${searchBlock}

Write the one-liner now. Output the sentence only — no preamble, no quotes, no labels.`
}
