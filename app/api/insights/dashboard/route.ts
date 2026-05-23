/**
 * /api/insights/dashboard — top-bar pill insights.
 *
 * No LLM. After five iterations trying to make Sonnet write like a
 * sharp colleague instead of a chatbot, we accepted the reality and
 * switched to deterministic pattern detection in
 * lib/insights/detect.ts. The detectors look for real patterns
 * (channel disparity, stockpiling, repeat-warm-uncontacted, team-
 * takes-too-much, etc.) and emit pre-written sentences with real
 * numbers interpolated. Every output is grounded in real data and
 * carries a single human voice.
 *
 * This route is now a thin glue: validate request → run detectors →
 * pick top 5 with surface diversity → return as { insights, generatedAt }.
 * Same response shape as the LLM version so the client pill is
 * unchanged.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUser, rateLimit } from '@/lib/api-auth'
import { detectFindings, pickTopFindings, absenceObservations } from '@/lib/insights/detect'
import type { DashboardMetrics } from '@/lib/insights/types'

interface DashboardRequestBody {
  metrics: DashboardMetrics
  /** Kept for forward compatibility — currently unused by the
   *  detector layer but included in the request body so we don't
   *  break old clients. */
  recentSearches?: string[]
  daysSinceFirstEntry?: number | null
}

interface DashboardResponse {
  insights: string[]
  generatedAt: number
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const user = auth

  // Generous limit — the work is in-process and the cost is
  // basically zero, but we keep a ceiling so a runaway client
  // can't hammer the route.
  const limited = rateLimit(user.id, 'insights-dashboard', 60)
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

  const findings = detectFindings(body.metrics)
  const sentences = findings.length > 0
    ? pickTopFindings(findings, 5)
    : absenceObservations(body.metrics)

  return NextResponse.json<DashboardResponse>({
    insights: sentences,
    generatedAt: Date.now(),
  })
}
