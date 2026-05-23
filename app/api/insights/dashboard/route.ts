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
    const insights = parseInsights(raw)

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
 * Parse a Claude response into the insight strings. We ask for a
 * JSON array of 3 strings; this is tolerant of stray markdown
 * fences and preamble.
 */
function parseInsights(raw: string): string[] {
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
    .filter(line => line.length >= 12 && line.length <= 320)
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
 * Empty-state — no entries, no recent searches. Three observations
 * in the same voice as the live ones.
 */
const EMPTY_STATE_INSIGHTS: string[] = [
  'Nothing searched yet. The Results tab is where the work starts — pick a niche and see who shows up.',
  'Pipeline is empty. The first lead is the only one that feels hard to add.',
  'Pitch line is blank. Tell the AI what you actually do before asking it to write on your behalf.',
]

// ── Prompt ───────────────────────────────────────────────────────────

/**
 * Few-shot examples chosen to teach the model what real insight
 * looks like: fact + contrast + inference. Direct voice, no cute
 * metaphors (those just produce parody on the next call).
 *
 * The bad examples capture the failure mode we have repeatedly hit:
 * "you have X. do Y." chatbot prose.
 */
const GOOD_EXAMPLES = `
GOOD examples — read like a sharp colleague spotting the real story:

Pattern + inference:
- "LinkedIn replies are at 38%, Email at 12%. You're sending three times more Email than you should."
- "60% of recent results dismissed. The keyword is broader than what you'll actually pitch."
- "Six leads with emails captured, zero reach-outs. You've built a contact list, not a pipeline."
- "5 follow-ups overdue while 12 new leads landed this week. You're sourcing faster than you're closing."

Contrast that names something they hadn't framed yet:
- "Win rate is 38% — that's not the bottleneck. You only reached 7 people this week."
- "Two completed clients marked 'Definitely repeat' but neither has a follow-up date. Those are warm leads, not done deals."
- "Booked $12,000, kept $4,800 after team splits. Either raise prices or rework the share structure."
- "Pitch line is empty. Every AI rewrite is starting from 'you do… something'."

Honest absence (when data is thin, name the void cleanly):
- "Nothing in the follow-up queue. Either you're between cycles or every Open lead is missing a date."
- "No completed engagements yet. Once one wraps, this view shows realised revenue and repeat-likelihood data."
`

const BAD_EXAMPLES = `
BAD examples — these are what we are NOT writing:

Chatbot voice with action-step suffix:
- "You have 12 leads in your pipeline. Consider reaching out to start tracking responses."
- "There are 3 follow-ups overdue. Clear them to keep momentum."
- "Set your pitch line in Profile to enable AI personalization."

Flat number recitation with no observation:
- "You've got 4 active engagements totaling $24,000 booked."
- "Your LinkedIn outreach has a 32% conversion rate."

Forced cleverness — trying too hard:
- "You're collecting them like Pokemon, not contacting them like prospects."
- "The most expensive form of busy is half-pausing."
- "Your only paused client was the biggest. That's the most expensive form of busy."

What's wrong with the cute examples: forced metaphors read as performance, not observation. A real friend doesn't reach for analogies — they just name the pattern. Write like the GOOD examples, not the cute ones.
`

const VOICE_RULES = `
VOICE RULES:
- Forbidden filler words: "consider", "leverage", "next step", "momentum", "right now", "currently", "make sure", "be sure to", "great job", "looking good", "nice work", "perhaps", "might want to".
- Forbidden shape: "You have X. [Verb] it." — the dashboard-tooltip pattern. Always pair a fact with an inference or contrast, never with a bare action.
- Cite at least one real number or boolean state from the JSON. Round numbers, but never invent. If you say "lately" or "this week", the number must come from addedLast7 / reachedLast7 / wonLast30.
- Do NOT claim trends ("is rising", "dropping", "improving") — there is only one snapshot. You can compare two fields within the snapshot (X vs Y), but not the same field over time.
- 1-2 sentences. Max 35 words. Direct, sharp, slightly opinionated.
- Second person. No greetings. No emoji. No quotes inside the JSON strings.
`

function buildPrompt(
  metrics: DashboardMetrics,
  recentSearches: string[],
  isNew: boolean,
): string {
  const stageNote = isNew
    ? 'STAGE: The user is still ramping. Observations should be observational first, mildly nudge-y second. Do not overreach — if there are 3 leads, do not pretend there is a deep pattern to draw out.'
    : 'STAGE: The user is experienced. Point at contradictions, easy wins they have not noticed, or patterns the dashboard does not surface on its own.'

  const searchBlock = recentSearches.length > 0
    ? `Recent searches: ${recentSearches.slice(0, 5).map(s => `"${s.slice(0, 40)}"`).join(', ')}`
    : '(No recent searches captured.)'

  return `You are reading a freelance creator's outreach-CRM dashboard. Write THREE observations — the kind a sharp colleague would make leaning over the screen. Each one points at the ACTUAL story in the data: a contradiction, a gap, a contrast worth noticing.

OUTPUT FORMAT: Return ONLY a JSON array of exactly 3 strings, no preamble, no markdown.
["...", "...", "..."]

WHAT MAKES THIS HARD:
The data is small. Most of the time there is no glaring drama. Your job is to find the real signal, not invent drama where there is none. If only one thing is genuinely interesting, the other two slots can be honest "absence" observations (see GOOD examples below) — never filler nags.

DO NOT enforce one-per-tab variety. Pick the 3 most interesting things in the data, regardless of which surface they came from. If two of the three are about the Pipeline because Pipeline is where the story is, fine.

${VOICE_RULES}

${GOOD_EXAMPLES}

${BAD_EXAMPLES}

ANTI-FABRICATION:
- Only cite values that LITERALLY appear in the JSON below. If the JSON has responseRate=0, you cannot say "response rate is low" — there's no signal because no one has been reached. Say "Nothing reached out yet" instead.
- The byMedium block has reached + won counts. You can compare ratios across mediums BUT only if reached > 3 for each side of the comparison. With tiny samples, the difference is noise.
- Workflow booleans (hasPitchLine, gmailConnected, etc.) can be cited as-is.
- recentSearches strings can be cited as quotes ("you've been searching cooking, fitness, dance").

${stageNote}

THE DATA:
${JSON.stringify(metrics, null, 2)}

${searchBlock}

Return the JSON array of 3 strings now. No preamble.`
}
