/**
 * /api/insights/dashboard — Claude-generated insights for the top
 * header pill. Distinct from /api/insights/weekly in two ways:
 *
 *   • Returns FIVE insights per call (not one). Each tied to a
 *     different facet of the user's data — action queue, conversion,
 *     revenue, trajectory, engagement health — so the client can
 *     cycle through them on refresh and surface genuinely different
 *     framings, not paraphrases of the same one.
 *   • Adaptive — branches on whether the user is "new" (no Successful
 *     entries yet, or a small total) vs experienced. New users get
 *     onboarding-flavored framing.
 *
 * One model call returns the whole array. Claude sees all 5 prompts
 * simultaneously and is told to make them mutually different, which
 * is much more reliable than calling 5 times independently.
 *
 * Cost: ~150 input + 200 output tokens per call, Haiku 4.5. Still
 * fractions of a cent. Rate-limited 24/hour/user.
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
  recentSearches?: string[]
  daysSinceFirstEntry?: number | null
}

interface DashboardResponse {
  /** Five mutually-different insights — client cycles through on
   *  refresh. */
  insights: string[]
  generatedAt: number
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const user = auth

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

  // Zero-data shortcut — five deterministic prompts, no LLM call.
  if (body.metrics.total === 0 && (!body.recentSearches || body.recentSearches.length === 0)) {
    return NextResponse.json<DashboardResponse>({
      insights: EMPTY_STATE_INSIGHTS,
      generatedAt: Date.now(),
    })
  }

  const isNew =
    body.metrics.total < 5 ||
    body.metrics.successful === 0 ||
    (body.daysSinceFirstEntry != null && body.daysSinceFirstEntry < 7)

  const prompt = buildPrompt(body.metrics, body.recentSearches ?? [], isNew)

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      // 5 sentences × ~25 tokens each + some structure overhead.
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = (message.content[0] as { text?: string }).text?.trim() || ''
    const insights = parseFiveInsights(raw)

    if (insights.length < 3) {
      // Model returned something we couldn't parse — log + fall back
      // to a single best-effort string so the UI doesn't break.
      console.error('[insights/dashboard] parse failed, raw:', raw.slice(0, 300))
      return NextResponse.json<DashboardResponse>({
        insights: insights.length > 0 ? insights : [raw.slice(0, 240) || 'Insight temporarily unavailable.'],
        generatedAt: Date.now(),
      })
    }

    return NextResponse.json<DashboardResponse>({
      insights,
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

// ── Parsing ──────────────────────────────────────────────────────────

/**
 * Parse a Claude response into exactly the insight strings. We ask
 * for a JSON array of 5 strings but Claude occasionally adds prose
 * preambles or markdown fences. This is tolerant of both.
 */
function parseFiveInsights(raw: string): string[] {
  // Try strict JSON parse first.
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try {
    const parsed = JSON.parse(stripped)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((v): v is string => typeof v === 'string')
        .map(s => sanitizeInsight(s))
        .filter(Boolean)
        .slice(0, 5)
    }
  } catch { /* fall through to permissive parsing */ }

  // Permissive: split on numbered bullets ("1." / "1)") or newlines,
  // strip prose preamble, keep only sentence-shaped lines.
  const candidates = stripped
    .split(/\n+/)
    .map(line => line.trim())
    .map(line => line.replace(/^["'\d)(\[\]\.\-\*\s•]+/, '').trim())
    .filter(line => line.length >= 12 && line.length <= 280)
    .map(s => sanitizeInsight(s))
    .filter(Boolean)
  return candidates.slice(0, 5)
}

function sanitizeInsight(s: string): string {
  return s
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)
}

// ── Empty state ──────────────────────────────────────────────────────

const EMPTY_STATE_INSIGHTS: string[] = [
  'Start by running a search on the Results tab to find creators in your niche.',
  'Try a broad niche first (e.g. "fitness" or "cooking"), then narrow once you see how scoring behaves.',
  'Add creators from results to your Outreach pipeline before sending — you can review and edit before any message goes out.',
  'Connect Gmail via the hamburger menu to send outreach directly from the app rather than copying templates.',
  'Set your pitch line in your profile before sending — Claude uses it to personalize each message.',
]

// ── Prompt ───────────────────────────────────────────────────────────

/**
 * Per-facet briefs. Each facet is one of the 5 insights returned.
 * Two lists — NEW vs EXPERIENCED — because the relevant angles
 * differ at each user stage.
 */
const NEW_FACETS = [
  { name: 'WHAT YOU HAVE DONE',
    brief: 'Concretely review what the user has accomplished — leads added, channels explored, searches run. Honour their effort. Specific numbers ("you have added 3 leads", "you have run 5 searches").' },
  { name: 'NEXT CONCRETE STEP',
    brief: 'Pick the next 1-action move that unblocks them. If they have leads but reached out to nobody → tell them to reach out. If they have entries with email but never reached out → name that gap. If only searches but no entries added → tell them to add a lead.' },
  { name: 'SEARCH REFLECTION',
    brief: 'Comment on the recent searches they ran (use the strings provided). Suggest a sharper variant or broader variant, or recommend adding a creator from those results. If no recent searches, skip this facet and write about the most relevant other gap.' },
  { name: 'STATUS GAP',
    brief: 'Name a specific gap in their pipeline: entries sitting at Not Outreached, Opens with no follow-up date, leads with emails sitting idle. Then say what to do about it.' },
  { name: 'MOMENTUM',
    brief: 'Comment on how recent their activity is — addedLast7, reachedLast7. Are they ramping up or stalling? Cite specific numbers. End with a next-step.' },
] as const

const EXPERIENCED_FACETS = [
  { name: 'ACTION QUEUE',
    brief: 'Stale follow-ups overdue (stale field), todays follow-ups, Opens sitting too long without a touch. Be specific about counts. If stale=0 and there are no obvious overdue items, surface a different action item instead.' },
  { name: 'CONVERSION PERFORMANCE',
    brief: 'responseRate and winRate. Which medium (Email / LinkedIn / Other) is outperforming the rest in the byMedium block? Cite the percentage. Recommend leaning in there.' },
  { name: 'REVENUE STATE',
    brief: 'totalBooked, personalRevenue, recent wins (wonLast30) worth doubling-down on. Mention dollars. If totalBooked is 0 but pipelineValue > 0, comment on pipeline-vs-realised.' },
  { name: 'RECENT TRAJECTORY',
    brief: 'addedLast7, reachedLast7, wonLast30 — are they speeding up or slowing down? Compare to prior pace if possible. Cite numbers.' },
  { name: 'ENGAGEMENT HEALTH',
    brief: 'activeNow vs successful (how many of the wins are still active). Anything sitting paused (look at completed/churned if mentioned). Completed wins are repeat-candidates. If activeNow=0 but successful>0, that itself is the story.' },
] as const

function buildPrompt(metrics: DashboardMetrics, recentSearches: string[], isNew: boolean): string {
  const facets = isNew ? NEW_FACETS : EXPERIENCED_FACETS

  const facetBlock = facets
    .map((f, i) => `${i + 1}. ${f.name}\n   ${f.brief}`)
    .join('\n\n')

  const guidance = isNew
    ? `USER STATE: NEW. Frame all 5 insights as gentle next-step nudges. Friendly but direct.`
    : `USER STATE: EXPERIENCED. Be opinionated and specific. No hedging.`

  const searchBlock = recentSearches.length > 0
    ? `Recent searches: ${recentSearches.slice(0, 5).map(s => `"${s.slice(0, 40)}"`).join(', ')}`
    : '(No recent search history available — skip search-reflection facet if it applies.)'

  return `You are a heads-up display for a creator-outreach SaaS. Write FIVE distinct one-sentence insights about the user's current state. Each one anchored to a different facet of the data — they MUST cover materially different ground, not five rewordings of the same observation.

OUTPUT FORMAT: Return ONLY a JSON array of exactly 5 strings, no other text. Example:
["Insight 1...", "Insight 2...", "Insight 3...", "Insight 4...", "Insight 5..."]

EACH INSIGHT MUST:
- Be ONE sentence, max 22 words.
- Plain prose. No markdown, no emoji, no quotes inside the strings (use plain text only).
- Cite at least one specific number from the data block below.
- Be in second person ("you", "your").
- Be opinionated and direct. No greeting words. No hedging ("might want to", "perhaps").
- Cite numbers that actually appear in the data block. Never fabricate.

${guidance}

THE 5 FACETS (use exactly these 5, in this order):

${facetBlock}

If a facet has truly no signal in the data (e.g. ACTION QUEUE but stale=0 AND open=0), still write something useful by reframing within that facet — do NOT skip the slot and do NOT repeat another facet's framing.

The 5 insights must read as 5 different framings of 5 different parts of the data. A reader cycling through them should learn 5 distinct things about themselves.

Current state:
${JSON.stringify(metrics, null, 2)}

${searchBlock}

Return the JSON array now. No preamble, no labels, no markdown fences.`
}
