/**
 * Simple metric insights for the top-bar dashboard pill.
 *
 * Earlier iterations tried detector-style pattern matching ("you're
 * stockpiling", "channel disparity") — useful in theory but the
 * judgmental voice + "what does this mean" interpretation kept
 * reading as nag-y AI prose. The user asked for plain metric
 * insights, so this is now a flat list of stat-style sentences.
 *
 * Each generator is a tiny function: takes the metrics, returns a
 * single stat sentence OR null if the data isn't meaningful (e.g.
 * skip "0% response rate" when no one's been reached yet).
 *
 * Style:
 *   • One fact per sentence, with light context (denominator or
 *     time window) so the number is interpretable.
 *   • No analysis, no inference, no "you should". Just stats.
 *   • Plain sentences with end punctuation — feels like a stat
 *     ticker, not a coach.
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
 * The full set of metric generators, in display order. Each returns
 * a string when the underlying data is meaningful, otherwise null
 * (so we skip stats that would render as "0% of 0" or similar).
 */
function generators(m: DashboardMetrics): Array<string | null> {
  return [
    // ── Pipeline overview ────────────────────────────────────────
    m.total > 0
      ? `${plural(m.total, 'lead')} in your pipeline.`
      : null,

    m.reachedOut > 0 && m.total > 0
      ? `${m.reachedOut} of ${m.total} reached out (${rate(m.reachedOut, m.total)}%).`
      : null,

    m.reachedOut >= 3
      ? `${m.responseRate}% response rate across ${plural(m.reachedOut, 'reach-out')}.`
      : null,

    m.responseReceived >= 3
      ? `${m.winRate}% win rate (${m.successful} of ${m.responseReceived} responses).`
      : null,

    m.pipelineValue > 0
      ? `${money(m.pipelineValue)} in pipeline value.`
      : null,

    // ── Activity (recency) ──────────────────────────────────────
    (m.addedLast7 > 0 || m.reachedLast7 > 0)
      ? `${m.addedLast7} added, ${m.reachedLast7} reached out in the last 7 days.`
      : null,

    m.wonLast30 > 0
      ? `${plural(m.wonLast30, 'win')} in the last 30 days.`
      : null,

    // ── Follow-up queue ─────────────────────────────────────────
    m.followupOverdue > 0
      ? `${plural(m.followupOverdue, 'follow-up')} overdue.`
      : null,

    m.followupDueToday > 0
      ? `${plural(m.followupDueToday, 'follow-up')} due today.`
      : null,

    m.followupDueThisWeek > 0 && m.followupOverdue === 0
      ? `${plural(m.followupDueThisWeek, 'follow-up')} due this week.`
      : null,

    // ── Active clients ──────────────────────────────────────────
    m.activeClientsTotal > 0
      ? `${plural(m.activeClientsTotal, 'active client')} (${m.activeNow} currently active).`
      : null,

    m.totalBooked > 0
      ? `${money(m.totalBooked)} booked across ${plural(m.activeClientsTotal, 'engagement', 'engagements')}.`
      : null,

    // Only show personal revenue separately if there's a meaningful gap.
    (m.totalBooked > 0 && m.personalRevenue > 0 && m.personalRevenue < m.totalBooked * 0.95)
      ? `${money(m.personalRevenue)} personal revenue after team splits.`
      : null,

    m.lifecycleCompleted >= 1 && m.completedRealised > 0
      ? `${money(m.completedRealised)} realised across ${plural(m.lifecycleCompleted, 'completed engagement')}.`
      : null,

    m.avgRating != null && m.lifecycleCompleted >= 1
      ? `${m.avgRating}/5 average rating across ${plural(m.lifecycleCompleted, 'completed engagement')}.`
      : null,

    // ── Channels ────────────────────────────────────────────────
    bestChannelStat(m),

    // ── Sourcing ────────────────────────────────────────────────
    m.resultsCount > 0
      ? `${plural(m.resultsCount, 'creator')} in your current Results.`
      : null,

    m.dismissedCount >= 3
      ? `${plural(m.dismissedCount, 'creator')} dismissed (${m.dismissalRatio}% of those you've considered).`
      : null,
  ]
}

/**
 * Pick the channel (Email / LinkedIn / top mediumOther sub-channel)
 * with the most wins. Returns null if no channel has wins yet.
 *
 * Plain stat — no comparison ("X% better than..."), just naming the
 * leader and its numbers. The user can draw their own conclusion.
 */
function bestChannelStat(m: DashboardMetrics): string | null {
  const candidates: Array<{ name: string; reached: number; won: number }> = [
    { name: 'Email',    reached: m.byMedium.Email.reached,    won: m.byMedium.Email.won    },
    { name: 'LinkedIn', reached: m.byMedium.LinkedIn.reached, won: m.byMedium.LinkedIn.won },
  ]
  // Surface the top mediumOther sub-channel by name (rather than
  // the generic "Other" lump) so the stat is meaningful.
  if (m.topMediumOther.length > 0) {
    const top = m.topMediumOther[0]
    candidates.push({ name: top.name, reached: top.reached, won: top.won })
  }
  const ranked = candidates
    .filter(c => c.won > 0)
    .sort((a, b) => b.won - a.won)
  if (ranked.length === 0) return null
  const top = ranked[0]
  return `${top.name}: ${plural(top.won, 'win')} from ${plural(top.reached, 'reach-out')}.`
}

/**
 * Public entry point — produce the cycling list of metric insights.
 * Skips generators that returned null. Caps at MAX_INSIGHTS so the
 * cycle doesn't drag.
 *
 * If absolutely nothing has any signal (genuinely brand new account),
 * falls back to the empty-state nudges so the pill is never blank.
 */
const MAX_INSIGHTS = 8

export function generateMetricInsights(m: DashboardMetrics): string[] {
  const all = generators(m).filter((s): s is string => typeof s === 'string' && s.length > 0)
  if (all.length === 0) return absenceObservations(m)
  return all.slice(0, MAX_INSIGHTS)
}

/**
 * Empty-state — for users with no data at all. Three short prompts
 * that point at where to start. No analysis (there's no data to
 * analyze), just a clean "here's what to look at first."
 */
export function absenceObservations(m: DashboardMetrics): string[] {
  if (m.total === 0 && m.resultsCount === 0) {
    return [
      'No leads or searches yet — start on the Results tab.',
      'Pitch line is blank. Set it in Profile (hamburger menu) before reaching out.',
      'Once you find creators in Results, click the + on any row to start your pipeline.',
    ]
  }
  if (m.total === 0 && m.resultsCount > 0) {
    return [
      `${plural(m.resultsCount, 'creator')} in Results, none added to outreach yet.`,
      'Click the + on any creator card to add them to your pipeline.',
      !m.workflow.hasPitchLine
        ? 'Pitch line is blank. Set it in Profile before the first reach-out.'
        : 'Pipeline is empty — the first lead is the only one that feels hard to add.',
    ]
  }
  if (m.total > 0 && m.reachedOut === 0) {
    return [
      `${plural(m.total, 'lead')} added, ${m.reachedOut === 0 ? 'none reached out yet' : `${m.reachedOut} reached out`}.`,
      !m.workflow.hasPitchLine
        ? 'Pitch line is blank. Set it in Profile so AI rewrites have something to work with.'
        : 'Click the email or LinkedIn link on any row to start outreach.',
      'Set a follow-up date when you reach out — overdue ones surface in the Follow-ups sub-tab.',
    ]
  }
  // Genuinely nothing flagged (rare) — return a couple of honest
  // observations so the pill isn't empty.
  return [
    `${plural(m.total, 'lead')} in pipeline, ${plural(m.reachedOut, 'reach-out')} sent.`,
    'No specific signal flagged right now.',
  ]
}
