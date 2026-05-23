/**
 * Deterministic pattern detection for the top-bar dashboard insight.
 *
 * Why no LLM:
 *   We iterated five times on the LLM approach with Sonnet + voice
 *   rules + few-shot. Every version reverted to chatbot prose because
 *   that's the model's default failure mode for "summarize this JSON"
 *   tasks. Switching to rules eliminates the voice problem (one human
 *   wrote the templates) AND the accuracy problem (we never fabricate
 *   because we only render values pulled from real fields).
 *
 * How it works:
 *   detectFindings(metrics) walks the data and returns a Finding[]
 *   ranked by interestingness. Each detector is a tiny function that
 *   looks for ONE specific pattern (not a single fact) and emits a
 *   pre-written sentence with real values interpolated.
 *
 *   The patterns we look for are the kind a human would notice
 *   leaning over your shoulder — gaps, contrasts, stockpile signals,
 *   stale-while-busy, channel disparities, repeat candidates left
 *   cold. Not "you have N leads."
 *
 *   The API route picks the top N findings with surface diversity
 *   (no two from the same lane unless that's where all the signal is).
 */

import type { DashboardMetrics } from './types'

export type Severity = 'high' | 'medium' | 'low'

export interface Finding {
  /** Stable id — used for de-dup and analytics if we ever instrument. */
  id: string
  severity: Severity
  /** Which surface the observation comes from. Drives diversity
   *  ranking — we'd rather show three findings from three different
   *  surfaces than three from the same one. */
  surface: 'sourcing' | 'pipeline' | 'followups' | 'active' | 'workflow'
  /** The actual rendered sentence shown to the user. */
  sentence: string
}

/** Plural helper — keeps templates clean. */
function plural(n: number, singular: string, plural?: string): string {
  return `${n} ${n === 1 ? singular : (plural ?? singular + 's')}`
}

/** Rate as percent (integer). */
function rate(num: number, den: number): number {
  if (den <= 0) return 0
  return Math.round((num / den) * 100)
}

export function detectFindings(m: DashboardMetrics): Finding[] {
  const findings: Finding[] = []

  // ── SOURCING (Results + Dismissed) ──────────────────────────────

  // Window-shopping: lots of results visible, few added.
  if (m.resultsCount >= 15 && m.addedLast7 < 3 && m.total > 0) {
    findings.push({
      id: 'sourcing.window-shopping',
      severity: 'medium',
      surface: 'sourcing',
      sentence: `${m.resultsCount} creators on screen but only ${plural(m.addedLast7, 'added')} this week — browsing isn't sourcing.`,
    })
  }

  // High dismissal — keyword too broad, or being too picky.
  if (m.dismissalRatio >= 50 && m.dismissedCount >= 5) {
    findings.push({
      id: 'sourcing.high-dismissal',
      severity: 'medium',
      surface: 'sourcing',
      sentence: `${m.dismissalRatio}% of recent results dismissed — the keyword's broader than what you'll actually pitch.`,
    })
  }

  // Zero dismissals + lots added — possibly too generous.
  if (m.dismissedCount === 0 && m.total >= 15) {
    findings.push({
      id: 'sourcing.no-filter',
      severity: 'low',
      surface: 'sourcing',
      sentence: `${m.total} leads added with nothing dismissed. Either your keyword is razor-sharp or you're letting in noise.`,
    })
  }

  // ── PIPELINE (Outreach > Pipeline) ──────────────────────────────

  // Leads with email captured, never reached out — biggest "easy win".
  if (m.leadsWithEmailNotReached >= 5) {
    findings.push({
      id: 'pipeline.email-not-reached',
      severity: 'high',
      surface: 'pipeline',
      sentence: `${plural(m.leadsWithEmailNotReached, 'lead')} with emails captured, none reached out. Pick the easiest and send today.`,
    })
  } else if (m.leadsWithEmailNotReached >= 2) {
    findings.push({
      id: 'pipeline.email-not-reached-soft',
      severity: 'medium',
      surface: 'pipeline',
      sentence: `${plural(m.leadsWithEmailNotReached, 'lead')} with emails ready to go. They're not getting warmer sitting there.`,
    })
  }

  // Stockpiling: adding far faster than reaching out.
  if (m.addedLast7 >= 5 && m.addedLast7 >= m.reachedLast7 * 2 && m.reachedLast7 < 5) {
    findings.push({
      id: 'pipeline.stockpiling',
      severity: 'high',
      surface: 'pipeline',
      sentence: `${plural(m.addedLast7, 'lead')} added but only ${plural(m.reachedLast7, 'reach-out')} this week — you're collecting, not contacting.`,
    })
  }

  // Channel disparity — only if both have non-trivial sample size.
  const em = m.byMedium.Email
  const li = m.byMedium.LinkedIn
  if (em.reached >= 4 && li.reached >= 4) {
    const emRate = rate(em.won, em.reached)
    const liRate = rate(li.won, li.reached)
    if (liRate >= emRate * 2 && liRate >= 20) {
      findings.push({
        id: 'pipeline.linkedin-better',
        severity: 'high',
        surface: 'pipeline',
        sentence: `LinkedIn converts at ${liRate}%, Email at ${emRate}%. Stop A/B testing what you already know.`,
      })
    } else if (emRate >= liRate * 2 && emRate >= 20) {
      findings.push({
        id: 'pipeline.email-better',
        severity: 'high',
        surface: 'pipeline',
        sentence: `Email converts at ${emRate}%, LinkedIn at ${liRate}%. Email is your real channel.`,
      })
    }
  }

  // Quiet pipeline (lots in flight, no activity this week).
  if (m.total >= 10 && m.addedLast7 === 0 && m.reachedLast7 === 0) {
    findings.push({
      id: 'pipeline.quiet',
      severity: 'high',
      surface: 'pipeline',
      sentence: `${m.total} leads in pipeline, zero activity this week. The pipeline doesn't move itself.`,
    })
  }

  // Response rate context — flag low or high with enough sample.
  if (m.reachedOut >= 10 && m.responseRate < 15) {
    findings.push({
      id: 'pipeline.low-response',
      severity: 'medium',
      surface: 'pipeline',
      sentence: `Response rate is ${m.responseRate}% across ${plural(m.reachedOut, 'reach-out')}. The message isn't landing.`,
    })
  } else if (m.reachedOut >= 10 && m.responseRate >= 40) {
    findings.push({
      id: 'pipeline.strong-response',
      severity: 'medium',
      surface: 'pipeline',
      sentence: `Response rate is ${m.responseRate}% across ${plural(m.reachedOut, 'reach-out')}. Whatever you're sending is working — send more.`,
    })
  }

  // Win-vs-reach context: win rate is fine, reach is the bottleneck.
  if (m.winRate >= 30 && m.reachedOut >= 5 && m.reachedLast7 <= 2) {
    findings.push({
      id: 'pipeline.reach-bottleneck',
      severity: 'medium',
      surface: 'pipeline',
      sentence: `Win rate is ${m.winRate}% — that's solid. The bottleneck isn't conversion, it's how few you've reached this week.`,
    })
  }

  // ── FOLLOW-UPS (Outreach > Follow-ups) ──────────────────────────

  if (m.followupOverdue > 0) {
    // Stale + sourcing busy = priority signal.
    if (m.followupOverdue >= 2 && m.addedLast7 >= 3) {
      findings.push({
        id: 'followups.overdue-while-sourcing',
        severity: 'high',
        surface: 'followups',
        sentence: `${plural(m.followupOverdue, 'follow-up')} overdue while ${plural(m.addedLast7, 'new lead')} landed this week. You're sourcing faster than you're closing.`,
      })
    } else {
      findings.push({
        id: 'followups.overdue',
        severity: 'high',
        surface: 'followups',
        sentence: `${plural(m.followupOverdue, 'follow-up')} overdue today. Clear those before anything else.`,
      })
    }
  } else if (m.followupDueToday > 0) {
    findings.push({
      id: 'followups.due-today',
      severity: 'medium',
      surface: 'followups',
      sentence: `${plural(m.followupDueToday, 'follow-up')} due today.`,
    })
  } else if (m.open >= 5 && m.followupDueThisWeek === 0) {
    // Lots of Opens, none with follow-up dates set — invisible queue.
    findings.push({
      id: 'followups.no-dates-set',
      severity: 'medium',
      surface: 'followups',
      sentence: `${plural(m.open, 'Open lead')} but no follow-up dates set — they'll fall off your radar without one.`,
    })
  }

  // ── ACTIVE CLIENTS ──────────────────────────────────────────────

  if (m.activeClientsTotal > 0) {
    // Repeat candidates uncontacted — warmest possible leads.
    const warm = m.repeatDefinitely + m.repeatLikely
    if (warm > 0) {
      findings.push({
        id: 'active.repeat-warm',
        severity: 'high',
        surface: 'active',
        sentence: `${plural(warm, 'completed client')} marked Definitely- or Likely-repeat. Those are warm leads — don't let them go cold.`,
      })
    }

    // Paused engagements idle.
    if (m.lifecyclePaused > 0) {
      findings.push({
        id: 'active.paused',
        severity: 'medium',
        surface: 'active',
        sentence: `${plural(m.lifecyclePaused, 'engagement', 'engagements')} sitting paused. Reactivate them or mark them churned — the limbo costs you focus.`,
      })
    }

    // Team takes too much of booked.
    if (m.totalBooked > 0) {
      const personalPct = rate(m.personalRevenue, m.totalBooked)
      if (personalPct < 60 && m.totalBooked >= 1000) {
        const splitPct = 100 - personalPct
        findings.push({
          id: 'active.team-heavy',
          severity: 'medium',
          surface: 'active',
          sentence: `Team takes ${splitPct}% of your booked revenue. Either raise prices or rework the share structure.`,
        })
      }
    }

    // Single high-rated client without follow-on context.
    if (m.avgRating != null && m.avgRating >= 4.5 && m.lifecycleCompleted >= 2) {
      findings.push({
        id: 'active.high-rating',
        severity: 'low',
        surface: 'active',
        sentence: `${plural(m.lifecycleCompleted, 'completed engagement')} averaging ${m.avgRating}/5. Ask for testimonials — that's the easiest social proof you'll ever collect.`,
      })
    }
  }

  // ── WORKFLOW SETUP ──────────────────────────────────────────────

  // Pitch line empty + already sending.
  if (!m.workflow.hasPitchLine && m.reachedOut > 0) {
    findings.push({
      id: 'workflow.no-pitch-line',
      severity: 'high',
      surface: 'workflow',
      sentence: `Pitch line is blank. Every AI rewrite is writing for someone who hasn't decided what they sell.`,
    })
  } else if (!m.workflow.hasPitchLine && m.total > 0) {
    findings.push({
      id: 'workflow.no-pitch-line-soft',
      severity: 'medium',
      surface: 'workflow',
      sentence: `Pitch line is blank. Set it in Profile before you start reaching out — the AI rewrites depend on it.`,
    })
  }

  // Gmail not connected, doing real outreach.
  if (!m.workflow.gmailConnected && m.reachedOut >= 5) {
    findings.push({
      id: 'workflow.gmail-disconnected',
      severity: 'high',
      surface: 'workflow',
      sentence: `${plural(m.reachedOut, 'reach-out')} sent and Gmail still isn't connected — every send is a copy-paste tax.`,
    })
  }

  // Wins on default email template — time to customize.
  if (m.successful >= 3 && !m.workflow.customEmailTemplate) {
    findings.push({
      id: 'workflow.no-custom-email',
      severity: 'low',
      surface: 'workflow',
      sentence: `${plural(m.successful, 'win')} on the default email template. Custom is overdue — capture what's already working.`,
    })
  }

  // Sender's physical address missing — CAN-SPAM risk for serious senders.
  if (!m.workflow.hasPhysicalAddress && m.reachedOut >= 10) {
    findings.push({
      id: 'workflow.no-address',
      severity: 'medium',
      surface: 'workflow',
      sentence: `No physical address set on your profile. US CAN-SPAM rules require one in every commercial email — add it before you scale up.`,
    })
  }

  return findings
}

/**
 * Rank findings and pick the top N with surface diversity. Severity
 * outweighs surface — three "high" findings from the same surface
 * still beat one "low" from another surface — but among same-severity
 * findings, we spread across surfaces so the user sees different
 * parts of the app.
 *
 * Returns the formatted sentences only (in display order).
 */
export function pickTopFindings(findings: Finding[], limit = 5): string[] {
  if (findings.length === 0) return []

  const severityWeight: Record<Severity, number> = { high: 3, medium: 2, low: 1 }
  const sorted = [...findings].sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity])

  const picked: Finding[] = []
  const usedSurfaces = new Set<Finding['surface']>()

  // First pass: one per surface, severity-ordered.
  for (const f of sorted) {
    if (picked.length >= limit) break
    if (usedSurfaces.has(f.surface)) continue
    picked.push(f)
    usedSurfaces.add(f.surface)
  }

  // Second pass: fill remaining slots with the next-highest-severity
  // findings even if surface overlaps (only if there's truly more to say).
  for (const f of sorted) {
    if (picked.length >= limit) break
    if (picked.includes(f)) continue
    picked.push(f)
  }

  return picked.map(f => f.sentence)
}

/**
 * Honest absence fallback — used when zero detectors fire (typically
 * for users with very little data or perfectly clean state). One per
 * common "nothing here yet" scenario; the API picks 2-3.
 */
export function absenceObservations(m: DashboardMetrics): string[] {
  const out: string[] = []

  if (m.total === 0 && m.resultsCount === 0) {
    out.push("Nothing searched yet — the Results tab is where the work starts.")
    out.push("Pitch line is blank. Tell the AI what you actually do before asking it to write on your behalf.")
    out.push("Pipeline is empty. The first lead is the only one that feels hard to add.")
    return out
  }

  if (m.total === 0 && m.resultsCount > 0) {
    out.push(`${m.resultsCount} creators showing in Results but none added to outreach yet — pick one and start the pipeline.`)
    if (!m.workflow.hasPitchLine) out.push('Pitch line is blank. Set it in Profile before the first reach-out.')
    return out
  }

  if (m.total > 0 && m.reachedOut === 0) {
    out.push(`${m.total} leads added, none reached out. The hardest send is the first.`)
    if (m.workflow.hasPitchLine) out.push('Profile is set up. The next move is sending — not adding more leads.')
    if (!m.workflow.gmailConnected) out.push('Gmail isn\'t connected. Wire it up so the first send isn\'t a copy-paste.')
    return out
  }

  // Generic — everything looks clean / no patterns triggered.
  out.push(`${m.total} leads in pipeline, ${m.reachedOut} reached out. Nothing's flagged — the bottleneck right now is sourcing volume.`)
  if (m.activeClientsTotal > 0) {
    out.push(`${plural(m.activeClientsTotal, 'active client')}. Run their next milestone or close the loop with the ones marked Completed.`)
  }
  return out
}
