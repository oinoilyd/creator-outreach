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
      sentence: `${m.resultsCount} creators in Results, ${m.addedLast7 === 0 ? 'none' : `only ${m.addedLast7}`} added in the last 7 days. The rest are window-shopping.`,
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

  // Channel disparity (Email vs LinkedIn) — only if both have
  // non-trivial sample size. Skipped if Other dominates everything;
  // that gets its own detector below.
  const em = m.byMedium.Email
  const li = m.byMedium.LinkedIn
  const ot = m.byMedium.Other
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

  // "Other" dominates — most reach-outs (and most wins) are in
  // channels other than Email/LinkedIn. Surface the SPECIFIC top
  // Other channel by name from the topMediumOther breakdown, not
  // the generic "Other" label. Without that breakdown we'd just
  // be saying "you do most things in Other" which means nothing.
  const totalReached = em.reached + li.reached + ot.reached
  if (ot.reached >= 5 && totalReached > 0 && ot.reached / totalReached >= 0.6) {
    const top = m.topMediumOther[0]
    if (top && top.reached >= Math.ceil(ot.reached * 0.5)) {
      // One specific channel accounts for most of the Other bucket —
      // call it out by name with its real conversion rate.
      const topRate = rate(top.won, top.reached)
      if (top.won > 0) {
        findings.push({
          id: 'pipeline.other-channel-named-winning',
          severity: 'high',
          surface: 'pipeline',
          sentence: `${top.name} is doing the heavy lifting — ${top.reached} reach-outs, ${top.won} won (${topRate}%). Email and LinkedIn are sitting out.`,
        })
      } else {
        findings.push({
          id: 'pipeline.other-channel-named-no-wins',
          severity: 'medium',
          surface: 'pipeline',
          sentence: `${top.reached} reach-outs via ${top.name}, none won yet. Try Email or LinkedIn for the next batch and compare.`,
        })
      }
    } else if (m.topMediumOther.length === 0) {
      // Entries are marked Other but the user never typed what Other
      // actually was — surface that gap so they can fill it in for
      // future analytics.
      findings.push({
        id: 'pipeline.other-channel-unnamed',
        severity: 'medium',
        surface: 'pipeline',
        sentence: `Most reach-outs (${ot.reached}) are logged as "Other" with no specific channel named. Fill in the Other field on those rows to see what's actually working.`,
      })
    } else {
      // Multiple named Other channels, no single dominant one — list
      // the top two by reach so the user sees what they're using.
      const names = m.topMediumOther.slice(0, 2).map(t => t.name).join(' and ')
      findings.push({
        id: 'pipeline.other-channels-mixed',
        severity: 'medium',
        surface: 'pipeline',
        sentence: `Most reach-outs are split between ${names} — neither Email nor LinkedIn is getting your attention. That's a choice worth examining.`,
      })
    }
  }

  // Quiet pipeline (lots in flight, no activity this week).
  if (m.total >= 10 && m.addedLast7 === 0 && m.reachedLast7 === 0) {
    findings.push({
      id: 'pipeline.quiet',
      severity: 'high',
      surface: 'pipeline',
      sentence: `${m.total} leads in pipeline, none touched in the last 7 days. You stalled.`,
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
        sentence: `${plural(m.lifecyclePaused, 'engagement', 'engagements')} sitting Paused. Reactivate or mark Churned — limbo is the worst category.`,
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
