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

/**
 * Cross-tab metrics payload. Client builds this in
 * DashboardInsightPill.projectMetrics() — keep the shape in sync.
 */
interface DashboardMetrics {
  // Outreach Pipeline sub-tab
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
  leadsWithEmailNotReached: number
  byMedium: Record<'Email' | 'LinkedIn' | 'Other', { reached: number; won: number }>

  // Follow-ups sub-tab
  followupOverdue: number
  followupDueToday: number
  followupDueThisWeek: number

  // Analytics sub-tab (velocity)
  addedLast7: number
  reachedLast7: number
  wonLast30: number

  // Active Clients sub-tab
  activeClientsTotal: number
  activeNow: number
  lifecyclePaused: number
  lifecycleCompleted: number
  lifecycleChurned: number
  totalBooked: number
  personalRevenue: number
  completedRealised: number
  avgRating: number | null
  repeatDefinitely: number
  repeatLikely: number
  repeatMaybe: number
  repeatNo: number

  // Results + Dismissed tabs (sourcing)
  resultsCount: number
  dismissedCount: number
  dismissalRatio: number

  // Profile + Settings + Templates (workflow setup)
  workflow: {
    hasPitchLine: boolean
    hasFullName: boolean
    hasPhysicalAddress: boolean
    gmailConnected: boolean
    customEmailTemplate: boolean
    customIgTemplate: boolean
    customLinkedinTemplate: boolean
    mailClient: string
  }
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

/**
 * Empty-state starter prompts — one anchored to each tab so a brand-
 * new user cycling through gets a tour of the surfaces:
 *
 *   1. Workflow Setup (Profile / Settings)
 *   2. Sourcing (Results tab)
 *   3. Pipeline (Outreach > Pipeline sub-tab)
 *   4. Follow-ups (Outreach > Follow-ups sub-tab)
 *   5. Active Clients (Outreach > Active Clients sub-tab)
 */
const EMPTY_STATE_INSIGHTS: string[] = [
  'Set your pitch line in Profile before sending — Claude pulls it into every personalized rewrite.',
  'Run your first search on the Results tab; start broad (e.g. "fitness") then narrow once scoring settles.',
  'Add a few creators from Results into the Outreach Pipeline before sending — you can edit each one first.',
  'Once you reach out, set a follow-up date on the lead so it shows up in the Follow-ups queue automatically.',
  'A creator who marks Successful turns into an Active Client — budget, milestones, and team splits live there.',
]

// ── Prompt ───────────────────────────────────────────────────────────

/**
 * Per-facet briefs. THIS IS THE KEY CONSTRAINT: each facet must
 * anchor on a DIFFERENT TAB of the app so cycling through all 5
 * gives a tour of distinct surfaces, not 5 framings of one
 * outreach observation.
 *
 * NEW and EXPERIENCED variants use the same 5 surfaces, with
 * stage-appropriate framing.
 */
const NEW_FACETS = [
  { name: 'SOURCING (Results + Dismissed tabs)',
    brief: 'Reflect on their search activity on the Results tab. Use resultsCount (how many creators are on screen now), recentSearches array (what they have been looking for), and dismissedCount (whether they have already dismissed any). If they have searched but added 0, push them to add a lead. If no searches at all, suggest a starting niche. Do NOT discuss outreach status — that is a different facet.' },
  { name: 'PIPELINE (Outreach > Pipeline sub-tab)',
    brief: 'Anchor on the Pipeline sub-tab specifically. Use total, notOutreached, leadsWithEmailNotReached. If they have added leads but reached out to nobody, name that. If they have entries with email captured but sitting at Not Outreached, name THAT specifically. Do NOT mention follow-ups, active clients, or analytics — those are other facets.' },
  { name: 'FOLLOW-UPS (Outreach > Follow-ups sub-tab)',
    brief: 'Anchor on the Follow-ups sub-tab. Use followupOverdue, followupDueToday, followupDueThisWeek, and open count. If all those are 0, frame this as "no follow-ups scheduled yet — set a follow-up date when you reach out to your first lead so this queue starts filling in." Do NOT discuss the Pipeline status mix.' },
  { name: 'ACTIVE CLIENTS (Outreach > Active Clients sub-tab)',
    brief: 'Anchor on the Active Clients sub-tab. Use activeClientsTotal, activeNow, totalBooked, personalRevenue. If activeClientsTotal is 0, frame it as a forward-looking nudge: "Your first Successful response will create an Active Client where you track budget, milestones, and team splits." Do NOT discuss outreach status.' },
  { name: 'WORKFLOW SETUP (Profile + Settings + Templates)',
    brief: 'Anchor on the workflow object. Pick the single most impactful missing piece: !hasPitchLine (urgent — needed for AI rewrites), !gmailConnected (urgent — required to send from app), !customEmailTemplate (nice-to-have), !hasFullName (cosmetic). Name the specific thing missing and how to set it. Do NOT discuss data metrics.' },
] as const

const EXPERIENCED_FACETS = [
  { name: 'SOURCING (Results + Dismissed tabs)',
    brief: 'Anchor on the Results + Dismissed tabs. Use resultsCount, dismissedCount, dismissalRatio, addedLast7. If dismissalRatio is high (>30%), comment that the niche may be too broad. If addedLast7 is low and resultsCount is high, name the gap — they are sourcing but not committing. If dismissalRatio is 0, suggest they are being too generous. Do NOT discuss follow-ups, conversion, or active clients.' },
  { name: 'PIPELINE (Outreach > Pipeline sub-tab)',
    brief: 'Anchor on the Pipeline sub-tab. Use total, status mix (notOutreached / open / noResponse / rejected / successful), responseRate, winRate, byMedium. Surface the biggest imbalance — too many Opens with no follow-up scheduled? A medium dominating? leadsWithEmailNotReached too high? Do NOT touch the Follow-ups queue specifically (that is a separate facet).' },
  { name: 'FOLLOW-UPS (Outreach > Follow-ups sub-tab)',
    brief: 'Anchor on the Follow-ups sub-tab. Use followupOverdue, followupDueToday, followupDueThisWeek. If followupOverdue > 0 that is the lead. If followupDueToday > 0 prompt them to clear it. If all those are 0 but open > 5, point out the Open entries without follow-up dates set. Be specific with counts. Do NOT discuss conversion rates.' },
  { name: 'ACTIVE CLIENTS (Outreach > Active Clients sub-tab)',
    brief: 'Anchor on the Active Clients sub-tab. Use activeClientsTotal, activeNow, lifecyclePaused, lifecycleCompleted, totalBooked, personalRevenue, completedRealised, avgRating, repeatDefinitely + repeatLikely. Prioritise: paused clients to reactivate → completed clients with repeatDefinitely/Likely to follow up with for repeats → ratio of personalRevenue to totalBooked if team splits eat a lot. Do NOT discuss outreach metrics.' },
  { name: 'WORKFLOW + ANALYTICS (Profile + Settings + Analytics tab)',
    brief: 'Anchor on workflow setup OR Analytics trends. Pick whichever is more interesting: a missing workflow piece (!hasPitchLine, !gmailConnected, !customEmailTemplate) OR a velocity trend from addedLast7 / reachedLast7 / wonLast30 worth commenting on. Do NOT repeat what the other facets cover.' },
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

  return `You are a heads-up display for a creator-outreach SaaS. The app has 5 distinct surfaces: the Results tab, the Outreach > Pipeline sub-tab, the Outreach > Follow-ups sub-tab, the Outreach > Active Clients sub-tab, and the user's Profile + Settings + Templates area. Write FIVE one-sentence insights, ONE per surface, in the order listed below.

OUTPUT FORMAT: Return ONLY a JSON array of exactly 5 strings, no other text. Example:
["Insight 1...", "Insight 2...", "Insight 3...", "Insight 4...", "Insight 5..."]

EACH INSIGHT MUST:
- Be ONE sentence, max 22 words.
- Plain prose. No markdown, no emoji, no quotes inside the strings (use plain text only).
- Cite at least one specific number from the data block below (or a workflow boolean for the WORKFLOW facet).
- Be in second person ("you", "your").
- Be opinionated and direct. No greeting words. No hedging.
- Cite numbers that actually appear in the data block. Never fabricate.

CRITICAL — TAB ANCHORING:
- Insight #1 talks ONLY about sourcing — Results tab and Dismissed tab signal.
- Insight #2 talks ONLY about the Pipeline sub-tab — overall status mix of leads.
- Insight #3 talks ONLY about the Follow-ups sub-tab — overdue / due-today / due-this-week.
- Insight #4 talks ONLY about Active Clients sub-tab — engagement count / lifecycle / revenue / repeats.
- Insight #5 talks ONLY about Workflow Setup or Analytics trends — never raw outreach metrics.

If two facets would overlap (e.g. both citing total entries), reframe one so it stays in its own lane. A reader cycling through should see five completely different parts of the app discussed.

${guidance}

THE 5 FACETS (use exactly these 5, in this order):

${facetBlock}

If a facet has truly no signal in the data (e.g. FOLLOW-UPS but all three follow-up counts are 0), still write something useful — frame it as a forward-looking nudge about that surface ("no follow-ups scheduled yet — set a date when you reach out next") — do NOT skip the slot and do NOT pivot to another facet's territory.

Current state:
${JSON.stringify(metrics, null, 2)}

${searchBlock}

Return the JSON array now. No preamble, no labels, no markdown fences.`
}
