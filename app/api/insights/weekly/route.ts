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

interface InsightRequestBody {
  /** Current period metrics (already-computed client-side). */
  current: InsightMetrics
  /** Previous period of equal length, for delta narrative. Optional. */
  previous?: InsightMetrics
  /** Human label for the current period ("Last 30 days"). */
  rangeLabel: string
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
  const prompt = buildPrompt(body.current, body.previous, safeRangeLabel)

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

function buildPrompt(current: InsightMetrics, previous: InsightMetrics | undefined, rangeLabel: string): string {
  // Surface the most newsworthy delta — bucket the current+previous
  // numbers into a clean comparison block. Model decides which to lead
  // with based on size of change.
  const deltaBlock = previous
    ? `Previous period (same length, immediately before):
${JSON.stringify(previous, null, 2)}`
    : '(No previous-period comparison available — narrate the current state in isolation.)'

  return `You are a sales analytics narrator for a creator-outreach SaaS. Given JSON metrics, write 2-3 sentences total (max 50 words) about what's going on for this user.

CRITICAL FORMATTING:
- Plain prose, no markdown, no bullet points, no emoji.
- Lead with the single most newsworthy trend or anomaly (biggest change vs previous, or biggest absolute number if no previous).
- Include at least one specific number from the data.
- Close with one short, opinionated, actionable suggestion ("double down on LinkedIn", "follow up on the 4 stale opens", etc.).
- Do NOT hedge ("you might consider", "perhaps"). Direct, useful, opinionated.
- Refer to the user in second person ("you", "your").

Current period (${rangeLabel}):
${JSON.stringify(current, null, 2)}

${deltaBlock}

Write the insight now. Output the prose only — no preamble like "Here's your insight:" or "Sure!". Just the 2-3 sentences.`
}
