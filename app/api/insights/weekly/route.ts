/**
 * /api/insights/weekly — Claude-generated weekly analytics narrative.
 *
 * Takes the user's currently-computed metrics + previous-period
 * metrics from the client and returns 2-3 sentences of plain-English
 * narrative: what changed, the single most-newsworthy number, one
 * actionable suggestion. Lives at the top of the Analytics tab as
 * an "AI insight" card.
 *
 * Why client → server vs full server-side compute:
 *   computeMetrics already runs client-side and the result is small
 *   (< 2KB JSON). Re-computing server-side would duplicate logic and
 *   require a server-side Supabase query of the user's full outreach
 *   list. Sending the already-computed numbers is cheaper.
 *
 * Cost: at ~150 input + 100 output tokens per call, with Haiku 4.5
 *   pricing this is fractions of a cent. Rate-limited at 12/hour/user
 *   so a runaway client can't drain budget.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireUser, rateLimit } from '@/lib/api-auth'

const client = new Anthropic({ apiKey: process.env.AI_Score_Key })

interface InsightMetrics {
  total: number
  reachedOut: number
  responseReceived: number
  successful: number
  responseRate: number
  winRate: number
  pipelineValue: number
  addedLast7: number
  reachedLast7: number
  wonLast30: number
  totalBooked: number
  personalRevenue: number
  totalCollaboratorShare: number
  completedCount: number
  activeNow: number
  byMedium: Record<'Email' | 'LinkedIn' | 'Other', { reached: number; won: number }>
}

/** Analytics layouts surface different lenses on the same data. The
 *  insight is more useful when it leans into what the user is
 *  currently looking at, rather than narrating the whole pipeline
 *  every time. Each layout gets a different "focus" guidance line
 *  in the prompt. */
type InsightLayout = 'overview' | 'sales' | 'active' | 'cash' | 'activity'

interface InsightRequestBody {
  /** Current period metrics (already-computed client-side). */
  current: InsightMetrics
  /** Previous period of equal length, for delta narrative. Optional. */
  previous?: InsightMetrics
  /** Human label for the current period ("Last 30 days"). */
  rangeLabel: string
  /** Which analytics layout the user is viewing. Drives the prompt's
   *  focus line. Optional for backward compat (defaults to overview). */
  layout?: InsightLayout
}

interface InsightResponse {
  insight: string
  generatedAt: number
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const user = auth

  // 12 insights/hour/user — typical use is 1 on page load + 0-2 refreshes
  // per session. Bigger ceiling than rewrite-outreach (20) because the
  // payload is tiny; smaller than guidance (60) because each call
  // touches the model.
  const limited = rateLimit(user.id, 'insights-weekly', 12)
  if (limited) return limited

  let body: InsightRequestBody
  try {
    body = await req.json() as InsightRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.current || typeof body.current.total !== 'number') {
    return NextResponse.json({ error: 'Missing current metrics.' }, { status: 400 })
  }

  // Empty-state shortcut — don't pay for an AI call when there's
  // nothing to summarise. The UI handles its own empty state.
  if (body.current.total === 0) {
    return NextResponse.json<InsightResponse>({
      insight: 'No outreach yet. Add a few leads and check back — analytics get more interesting fast.',
      generatedAt: Date.now(),
    })
  }

  const safeRangeLabel = (body.rangeLabel || 'this period').slice(0, 60)
  const layout: InsightLayout = (
    body.layout === 'sales' || body.layout === 'active' ||
    body.layout === 'cash' || body.layout === 'activity'
  ) ? body.layout : 'overview'
  const prompt = buildPrompt(body.current, body.previous, safeRangeLabel, layout)

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 220,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = (message.content[0] as { text?: string }).text?.trim() || ''
    // Strip any accidental markdown / fencing and clamp to a sensible
    // visual length so a runaway model can't blow up the card.
    const clean = raw
      .replace(/^```[a-z]*\s*/i, '')
      .replace(/\s*```$/, '')
      .replace(/\*\*/g, '')
      .trim()
      .slice(0, 600)

    return NextResponse.json<InsightResponse>({
      insight: clean,
      generatedAt: Date.now(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[insights/weekly] error:', msg)
    return NextResponse.json(
      { error: 'AI insight is temporarily unavailable. Try again in a moment.' },
      { status: 500 },
    )
  }
}

/** Per-layout "focus" guidance — tells the model which slice of the
 *  metrics to lean into. The data block stays the full payload so the
 *  model still has context; the focus line shapes what gets surfaced. */
const LAYOUT_FOCUS: Record<InsightLayout, string> = {
  overview: 'FOCUS: broad pipeline view. Pick whichever metric moved most — outreach volume, conversion, revenue, or engagement. No single lens; surface what is most newsworthy across the whole funnel.',
  sales: 'FOCUS: outreach → win conversion. Lean into response rate, win rate, by-medium performance (Email vs LinkedIn vs DMs/other channels), velocity of reach-outs, stale follow-ups. Do NOT discuss engagement-side details (lifecycle, ratings, repeat likelihood) — those are a separate lens.',
  active: 'FOCUS: active-client health. Lean into how many are active right now, lifecycle distribution (paused / completed / churned), completed engagements, and — if data exists — average satisfaction and repeat likelihood. Do NOT discuss outreach response rates or by-medium volume.',
  cash: 'FOCUS: money. Lean into total booked, personal revenue (net of team splits), avg deal value, completed-engagement realised value, and pipeline $. If a team split exists (totalCollaboratorShare > 0), mention what fraction of booked the user keeps. Do NOT discuss lifecycle quality or response rates.',
  activity: 'FOCUS: cadence and velocity. Lean into addedLast7, reachedLast7, wonLast30 — how active has the user been recently? Are they speeding up or slowing down? Do NOT discuss lifecycle quality, satisfaction ratings, or medium breakdowns unless directly tied to a velocity change.',
}

/**
 * Rename `byMedium.Other` to `byMedium["DMs / other channels"]`
 * before serializing for the LLM. The literal "Other" enum value was
 * a holdover from the column UI — fine for an internal bucket key,
 * but the LLM kept echoing it verbatim into user-facing output
 * (e.g. "zero traction on Email and LinkedIn. Capitalize on what's
 * working in Other...") which reads as a capitalized proper noun
 * with no obvious meaning.
 *
 * "Other" in the app's medium enum covers Instagram DM, X DM,
 * TikTok DM, in-person, and any outreach attempted via a channel
 * besides Email or LinkedIn — surfacing that explicitly to the LLM
 * lets it use natural-language phrasing in the insight output.
 */
function metricsForPrompt(m: InsightMetrics): Omit<InsightMetrics, 'byMedium'> & {
  byMedium: Record<string, { reached: number; won: number }>
} {
  const { byMedium, ...rest } = m
  return {
    ...rest,
    byMedium: {
      Email: byMedium.Email,
      LinkedIn: byMedium.LinkedIn,
      'DMs / other channels': byMedium.Other,
    },
  }
}

function buildPrompt(
  current: InsightMetrics,
  previous: InsightMetrics | undefined,
  rangeLabel: string,
  layout: InsightLayout,
): string {
  // Surface the most newsworthy delta — bucket the current+previous
  // numbers into a clean comparison block. Model decides which to lead
  // with based on size of change AND the layout focus line below.
  const deltaBlock = previous
    ? `Previous period (same length, immediately before):
${JSON.stringify(metricsForPrompt(previous), null, 2)}`
    : '(No previous-period comparison available — narrate the current state in isolation.)'

  return `You are a sales analytics narrator for a creator-outreach SaaS. Given JSON metrics, write 2-3 sentences total (max 50 words) about what's going on for this user.

CRITICAL FORMATTING:
- Plain prose, no markdown, no bullet points, no emoji.
- Lead with the single most newsworthy trend or anomaly within the focus area (biggest change vs previous, or biggest absolute number if no previous).
- Include at least one specific number from the data.
- Close with one short, opinionated, actionable suggestion ("double down on LinkedIn", "follow up on the 4 stale opens", etc.).
- Do NOT hedge ("you might consider", "perhaps"). Direct, useful, opinionated.
- Refer to the user in second person ("you", "your").

VOCABULARY:
- When discussing byMedium["DMs / other channels"], refer to it in natural language as "DMs", "direct messages", "Instagram/X messages", or "other channels" — never use the literal word "Other" as a category name, and never capitalize a generic noun like "Other" as if it were a channel.
- "DMs / other channels" covers Instagram DM, X DM, TikTok DM, in-person, and any outreach via channels besides Email or LinkedIn.

${LAYOUT_FOCUS[layout]}

Current period (${rangeLabel}):
${JSON.stringify(metricsForPrompt(current), null, 2)}

${deltaBlock}

Write the insight now. Output the prose only — no preamble like "Here's your insight:" or "Sure!". Just the 2-3 sentences.`
}
