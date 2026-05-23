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
      // Sonnet, not Haiku — voice/observation quality matters far more
      // than latency for a single headline insight. Haiku produced
      // mechanical "you have X, do Y" sentences that read like a
      // chatbot. Sonnet handles voice + pattern detection meaningfully
      // better and is still cheap at one call per user per day.
      model: 'claude-sonnet-4-5',
      // Generous budget so the model can think a bit before producing
      // the JSON. 5 sentences × ~30 tokens + some overhead = 200ish,
      // but room to breathe matters for quality.
      max_tokens: 500,
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
/**
 * Empty-state — no entries, no recent searches. Same voice rules
 * as the live insights. Order mirrors the SURFACES list.
 */
const EMPTY_STATE_INSIGHTS: string[] = [
  'Nothing searched yet — the Results tab is where the work starts. Pick a niche and see who shows up.',
  'Your pipeline is empty. The first lead is the only one that feels hard to add.',
  "No follow-ups means no one to follow up with — that's about to change once you send your first message.",
  'Active Clients is still a forward-looking promise. Your first "Successful" creator graduates here automatically.',
  'Pitch line is empty. Tell the AI what you actually do before asking it to write about you.',
]

// ── Prompt ───────────────────────────────────────────────────────────

/**
 * The 5 surfaces of the app, in display order. Each insight lands on
 * one surface — that's the cross-tab guarantee — but the PROMPT
 * controls the voice. Voice rules + few-shot examples live below.
 */
const SURFACES = [
  { id: 'sourcing',  human: 'Results + Dismissed tabs',           lane: 'sourcing — resultsCount, dismissedCount, dismissalRatio, recentSearches' },
  { id: 'pipeline',  human: 'Outreach > Pipeline sub-tab',         lane: 'status mix — total, notOutreached, open, noResponse, rejected, leadsWithEmailNotReached, byMedium, responseRate, winRate' },
  { id: 'followups', human: 'Outreach > Follow-ups sub-tab',       lane: 'queue health — followupOverdue, followupDueToday, followupDueThisWeek' },
  { id: 'active',    human: 'Outreach > Active Clients sub-tab',   lane: 'engagement state — activeClientsTotal, activeNow, lifecyclePaused/Completed/Churned, totalBooked, personalRevenue, completedRealised, avgRating, repeatDefinitely/Likely/Maybe/No' },
  { id: 'workflow',  human: 'Profile + Settings + Templates',      lane: 'setup — workflow.hasPitchLine, gmailConnected, customEmailTemplate, hasFullName, hasPhysicalAddress, customIgTemplate, customLinkedinTemplate, mailClient' },
] as const

/**
 * Few-shot examples chosen to teach the model what "insightful"
 * actually means here — pattern detection, contrast, surprise,
 * micro-narrative. The bad examples are the failure mode we keep
 * landing in: chatbot framing, generic "you have X / do Y" prose.
 */
const GOOD_EXAMPLES = `
GOOD examples (write like these — voice, contrast, real observation):
- Sourcing:   "You've dismissed 1 in 3 results lately. Your niche is broader than your taste."
- Pipeline:   "Six leads have emails sitting idle. You're collecting them like Pokemon, not contacting them."
- Pipeline:   "Win rate is 38 percent — solid. The bottleneck isn't conversion, it's reach."
- Follow-ups: "Three follow-ups went stale today. That's not laziness, that's a queue with no design."
- Active:     "Your only paused client was your biggest budget. The most expensive form of busy is half-pausing."
- Active:     "Two completed engagements marked 'Definitely repeat' — that's two warm leads you haven't asked."
- Workflow:   "Your pitch line is empty. The AI is writing for someone who hasn't decided what they sell."
- Workflow:   "Gmail isn't connected. Every send right now is a copy-paste tax."`

const BAD_EXAMPLES = `
BAD examples (NEVER write like these — chatbot voice, generic, action-list):
- "You have 12 leads in your pipeline. Consider reaching out to start tracking responses."
- "Your LinkedIn outreach has a 32% conversion rate. Lean in there."
- "There are 3 follow-ups overdue. Clear them to keep momentum."
- "You've got 4 active engagements totaling $24,000 booked."
- "Set your pitch line in Profile to enable AI personalization."
What's wrong: corporate language ("Consider", "Lean in", "Leverage", "momentum"); action-step suffix tacked on; flat observation with no contrast or implication; reads like a dashboard tooltip, not a person noticing something.`

const VOICE_RULES = `
VOICE RULES (these are not negotiable):
- Forbidden words and phrases: "consider", "leverage", "next step", "momentum", "right now", "currently", "metric", "stat", "key", "insight" (yes, ironic), "make sure", "be sure to", "great job", "looking good", "nice work", "perhaps", "might want to".
- Forbidden sentence shapes: "You have X. [action verb]." / "Your X is Y. [action verb]." — the linked-pair-of-clauses pattern reads like a chatbot.
- DO use contrast ("X but Y", "X is fine, the problem is Y", "X — but [reframe]").
- DO use micro-narratives ("X happened, which means Y").
- DO use surprising framings — comparisons to ordinary life ("Pokemon", "wishlist", "tax"), playful word choices, observations that name a pattern.
- DO let yourself be slightly opinionated. The user wants a smart friend's read, not a status report.
- ONE sentence. No semicolons stringing two ideas. Max 22 words.
- Cite at least one real number or boolean state from the data. Never fabricate.
- Second person. No greeting words. No emoji. No quotes inside the string.`

function buildPrompt(
  metrics: DashboardMetrics,
  recentSearches: string[],
  isNew: boolean,
): string {
  const stageNote = isNew
    ? 'USER STATE: NEW (still ramping). Insights should still be observational and voice-driven, just naturally framed as next-step nudges instead of "you should know" observations.'
    : 'USER STATE: EXPERIENCED. Be opinionated. Point at patterns, contradictions, and easy wins they have not noticed.'

  const surfaceBlock = SURFACES.map((s, i) =>
    `${i + 1}. ${s.human}\n   Data in scope: ${s.lane}`,
  ).join('\n\n')

  const searchBlock = recentSearches.length > 0
    ? `Recent searches the user has run: ${recentSearches.slice(0, 5).map(s => `"${s.slice(0, 40)}"`).join(', ')}`
    : '(No recent search history available.)'

  return `You're a strategist looking over the shoulder of a freelance creator who uses an outreach CRM. You see their dashboard data. You're going to write FIVE one-sentence observations — the kind a smart friend leaning over the screen would make. Sharp, specific, slightly opinionated. Each one anchored to a different surface of the app so cycling through them gives a tour of where their attention should go.

OUTPUT FORMAT: Return ONLY a JSON array of exactly 5 strings, no preamble, no markdown.
["...", "...", "...", "...", "..."]

THE 5 SURFACES (one insight per surface, in this order — the user will see them in this order):

${surfaceBlock}

${VOICE_RULES}

${GOOD_EXAMPLES}

${BAD_EXAMPLES}

WHEN THE DATA IS THIN for a surface (e.g. followupOverdue=0 AND followupDueToday=0 AND followupDueThisWeek=0 — there's no story in the queue): name THAT — frame it as the absence ("Nothing on the follow-up queue — either you're between waves, or no leads have a date attached") — but stay observational, never default to "add a follow-up date next time you reach out" boilerplate.

${stageNote}

THE DATA:
${JSON.stringify(metrics, null, 2)}

${searchBlock}

Return the JSON array now. Five sharp observations, one per surface, in voice. No preamble.`
}
