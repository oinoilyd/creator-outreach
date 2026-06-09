/**
 * Simple metric insights for the top-bar dashboard pill.
 *
 * Voice: second-person, conversational. Each insight reads like
 * someone briefing the user on their numbers — not a stat ticker
 * with bare facts, not a chatbot with action verbs. Where it fits,
 * we connect the number to its consequence (e.g. "10 of 14 reached
 * out — 4 still need your attention").
 *
 * Style rules:
 *   • Vary openings: "You have...", "You've...", "Of X, ...",
 *     "On LinkedIn...", "Last 7 days:" — avoid every insight
 *     starting the same way.
 *   • Add a trailing clause that names the gap or implication where
 *     useful. Pure observation, never directive.
 *   • Mid-range values still get a narrative beat — context tags
 *     for every range, not just the extremes.
 *   • No action verbs ("set this", "fix that"). No clichés
 *     ("momentum", "next step"). No claims about industry stats.
 */

import type { DashboardMetrics } from './types'

function plural(n: number, singular: string, plural?: string): string {
  return `${n} ${n === 1 ? singular : (plural ?? singular + 's')}`
}

function rate(num: number, den: number): number {
  if (den <= 0) return 0
  return Math.round((num / den) * 100)
}

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000)    return `$${Math.round(n / 1_000)}k`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/**
 * Translate a percentage into a "1 in N" frequency — more readable
 * for human-scale numbers than a bare %. Used in response-rate and
 * win-rate trailing clauses.
 */
function inverseRate(pct: number): string {
  // Dylan 2026-06-08: bug fix — previously anything >= 50% returned
  // "roughly half are replying" which was wrong for 70%, 80%, etc.
  // Tiers re-banded so "roughly half" only fires for actually-half-ish
  // rates (45-55%) and higher rates get their own descriptors.
  if (pct >= 90) return 'almost everyone replies'
  if (pct >= 75) return 'most are replying'
  if (pct >= 60) return 'about two-thirds reply'
  if (pct >= 55) return 'a majority reply'
  if (pct >= 45) return 'roughly half are replying'
  if (pct >= 33) return 'about 1 in 3'
  if (pct >= 25) return 'about 1 in 4'
  if (pct >= 20) return 'about 1 in 5'
  if (pct >= 14) return 'about 1 in 7'
  if (pct >= 10) return 'about 1 in 10'
  return 'fewer than 1 in 10'
}

function inverseClose(pct: number): string {
  // Same fix as inverseRate — broader high-end so 70%+ isn't called
  // "over half closing" (technically true but understates the win).
  if (pct >= 75) return 'most are closing'
  if (pct >= 50) return 'over half closing'
  if (pct >= 33) return '1 in 3 closing'
  if (pct >= 25) return '1 in 4 closing'
  if (pct >= 15) return 'roughly 1 in 6'
  return 'most replies aren\'t converting'
}

/**
 * Each generator returns a sentence when the data is meaningful,
 * otherwise null (so we skip stats that would render as "0% of 0").
 */
function generators(m: DashboardMetrics): Array<string | null> {
  return [
    // ── Pipeline overview ────────────────────────────────────────
    // Single richer insight that names the count AND the gap, rather
    // than two thin observations side by side.

    m.total > 0
      ? (() => {
          // Lean shape: pipeline + how many not yet reached.
          if (m.reachedOut === 0) {
            return `You have ${plural(m.total, 'lead')} in pipeline, none reached out yet.`
          }
          if (m.reachedOut === m.total) {
            return `You have ${plural(m.total, 'lead')} in pipeline, all reached out — fully in motion.`
          }
          const left = m.total - m.reachedOut
          const pct = rate(m.reachedOut, m.total)
          return `You have ${plural(m.total, 'lead')} in pipeline, ${m.reachedOut} reached out (${pct}%) — ${left} still need your attention.`
        })()
      : null,

    // Response rate — concrete frequency translation, not vague "solid".
    m.reachedOut >= 5
      ? `${m.responseRate}% of your ${plural(m.reachedOut, 'reach-out')} got a response — ${inverseRate(m.responseRate)}.`
      : null,

    // Win rate — same treatment: translate to frequency.
    m.responseReceived >= 5
      ? `${m.successful} of ${m.responseReceived} responses closed (${m.winRate}%) — ${inverseClose(m.winRate)}.`
      : null,

    // Pipeline value — per-lead avg gives the number a useful frame.
    m.pipelineValue > 0
      ? (() => {
          const nonRejected = m.total - m.rejected
          if (nonRejected >= 3) {
            const perLead = Math.round(m.pipelineValue / nonRejected)
            return `${money(m.pipelineValue)} in pipeline value, averaging ${money(perLead)} per non-rejected lead.`
          }
          return `${money(m.pipelineValue)} in pipeline value across non-rejected leads.`
        })()
      : null,

    // ── Activity (recency) ──────────────────────────────────────

    (m.addedLast7 > 0 || m.reachedLast7 > 0)
      ? (() => {
          const base = `Last 7 days: ${m.addedLast7} added, ${m.reachedLast7} reached out`
          if (m.addedLast7 >= 3 && m.addedLast7 >= m.reachedLast7 * 2) {
            return `${base} — sourcing is outpacing outreach.`
          }
          if (m.reachedLast7 >= 3 && m.reachedLast7 >= m.addedLast7 * 2) {
            return `${base} — working the existing pipeline.`
          }
          return `${base}.`
        })()
      : null,

    m.wonLast30 > 0
      ? `You've won ${plural(m.wonLast30, 'deal')} in the last 30 days.`
      : null,

    // ── Follow-up queue ─────────────────────────────────────────

    m.followupOverdue > 0
      ? `You have ${plural(m.followupOverdue, 'follow-up')} overdue.`
      : null,

    m.followupDueToday > 0
      ? `You have ${plural(m.followupDueToday, 'follow-up')} due today.`
      : null,

    m.followupDueThisWeek > 0 && m.followupOverdue === 0
      ? `You have ${plural(m.followupDueThisWeek, 'follow-up')} due this week.`
      : null,

    // ── Active clients ──────────────────────────────────────────

    m.activeClientsTotal > 0
      ? (() => {
          if (m.activeNow === m.activeClientsTotal) {
            return `You have ${plural(m.activeClientsTotal, 'active client')}, all currently engaged.`
          }
          // Surface the non-active breakdown so the count is meaningful.
          const inactive = m.activeClientsTotal - m.activeNow
          const parts: string[] = []
          if (m.lifecyclePaused > 0)    parts.push(`${m.lifecyclePaused} paused`)
          if (m.lifecycleCompleted > 0) parts.push(`${m.lifecycleCompleted} completed`)
          if (m.lifecycleChurned > 0)   parts.push(`${m.lifecycleChurned} churned`)
          const breakdown = parts.length > 0 ? parts.join(', ') : `${inactive} not active`
          return `You have ${plural(m.activeClientsTotal, 'active client')} — ${m.activeNow} engaged, ${breakdown}.`
        })()
      : null,

    // Booked — add per-engagement avg for context.
    m.totalBooked > 0 && m.activeClientsTotal > 0
      ? (() => {
          const perEngagement = Math.round(m.totalBooked / m.activeClientsTotal)
          if (m.activeClientsTotal >= 2) {
            return `You've booked ${money(m.totalBooked)} across ${plural(m.activeClientsTotal, 'engagement', 'engagements')}, averaging ${money(perEngagement)} each.`
          }
          return `You've booked ${money(m.totalBooked)} across ${plural(m.activeClientsTotal, 'engagement', 'engagements')}.`
        })()
      : null,

    (m.totalBooked > 0 && m.personalRevenue > 0 && m.personalRevenue < m.totalBooked * 0.95)
      ? `Of your ${money(m.totalBooked)} booked, you keep ${money(m.personalRevenue)} (${rate(m.personalRevenue, m.totalBooked)}%) — the rest goes to team splits.`
      : null,

    m.lifecycleCompleted >= 1 && m.completedRealised > 0
      ? `You've realised ${money(m.completedRealised)} across ${plural(m.lifecycleCompleted, 'completed engagement')}.`
      : null,

    m.avgRating != null && m.lifecycleCompleted >= 1
      ? m.avgRating >= 4.5
        ? `Your clients rate you ${m.avgRating}/5 across ${plural(m.lifecycleCompleted, 'completed engagement')} — high enough to ask for a quote.`
        : m.avgRating >= 4.0
          ? `Your clients rate you ${m.avgRating}/5 across ${plural(m.lifecycleCompleted, 'completed engagement')}.`
          : `Your clients rate you ${m.avgRating}/5 across ${plural(m.lifecycleCompleted, 'completed engagement')} — worth checking what's pulling the average down.`
      : null,

    // ── Channels ────────────────────────────────────────────────

    bestChannelStat(m),

    // ── Sourcing ────────────────────────────────────────────────

    m.resultsCount > 0
      ? `You have ${plural(m.resultsCount, 'creator')} showing in your current Results.`
      : null,

    m.dismissedCount >= 3
      ? m.dismissalRatio >= 50
        ? `You've dismissed ${plural(m.dismissedCount, 'creator')} (${m.dismissalRatio}% of those considered) — rejecting more than you keep.`
        : `You've dismissed ${plural(m.dismissedCount, 'creator')} (${m.dismissalRatio}% of those considered).`
      : null,
  ]
}

/**
 * Best channel (Email / LinkedIn / top mediumOther) by total wins.
 * Conversational framing — names the channel as something the user
 * is doing, not just a row in a stats block.
 */
function bestChannelStat(m: DashboardMetrics): string | null {
  const candidates: Array<{ name: string; reached: number; won: number }> = [
    { name: 'Email',    reached: m.byMedium.Email.reached,    won: m.byMedium.Email.won    },
    { name: 'LinkedIn', reached: m.byMedium.LinkedIn.reached, won: m.byMedium.LinkedIn.won },
  ]
  if (m.topMediumOther.length > 0) {
    const top = m.topMediumOther[0]
    candidates.push({ name: top.name, reached: top.reached, won: top.won })
  }
  const ranked = candidates
    .filter(c => c.won > 0)
    .sort((a, b) => b.won - a.won)
  if (ranked.length === 0) return null
  const top = ranked[0]
  const winRate = rate(top.won, top.reached)
  // Tag the standout channel only when there's a real contrast — another
  // channel has 3+ reach-outs but zero wins.
  const otherWithoutWins = candidates.find(c =>
    c.name !== top.name && c.reached >= 3 && c.won === 0,
  )
  const tag = otherWithoutWins ? ' — your strongest channel by a clear margin' : ''
  return `On ${top.name}, you've closed ${top.won} of ${plural(top.reached, 'reach-out')} (${winRate}%)${tag}.`
}

const MAX_INSIGHTS = 8

export function generateMetricInsights(m: DashboardMetrics): string[] {
  const all = generators(m).filter((s): s is string => typeof s === 'string' && s.length > 0)
  if (all.length === 0) return absenceObservations(m)
  return all.slice(0, MAX_INSIGHTS)
}

/**
 * Empty-state — for users with no data at all. Same conversational
 * voice as the live insights.
 */
export function absenceObservations(m: DashboardMetrics): string[] {
  if (m.total === 0 && m.resultsCount === 0) {
    return [
      "You haven't searched yet — the Results tab is where the work starts.",
      'Your pitch line is blank. Set it in Profile (hamburger menu) before reaching out.',
      'Once creators show up in Results, click the + on any row to start your pipeline.',
    ]
  }
  if (m.total === 0 && m.resultsCount > 0) {
    return [
      `You have ${plural(m.resultsCount, 'creator')} showing in Results but none added to outreach yet.`,
      'Click the + on any creator card to add them to your pipeline.',
      !m.workflow.hasPitchLine
        ? 'Your pitch line is blank. Set it in Profile before the first reach-out.'
        : 'The first lead is the only one that feels hard to add.',
    ]
  }
  if (m.total > 0 && m.reachedOut === 0) {
    return [
      `You've added ${plural(m.total, 'lead')} but reached out to none yet.`,
      !m.workflow.hasPitchLine
        ? 'Your pitch line is blank. Set it in Profile so AI rewrites have something to work with.'
        : 'Click the email or LinkedIn link on any row to start outreach.',
      'When you reach out, set a follow-up date so overdue ones surface in the Follow-ups sub-tab.',
    ]
  }
  return [
    `You have ${plural(m.total, 'lead')} in pipeline and ${plural(m.reachedOut, 'reach-out')} sent.`,
    'Nothing specific flagged right now.',
  ]
}
