/**
 * Export entitlement logic — single source of truth for "can this user
 * export right now, and what does it cost?"
 *
 * Tiers of access (Dylan 2026-06-08 — removed the free-under-10 tier):
 *   1. unlimited_exports = true       — comp account, always free
 *   2. paid_export_credits > 0        — pre-paid $50 credit, consume one
 *   3. otherwise                      — needs to pay $50 via Stripe Checkout
 *
 * The "1 free per month if under 10 rows" tier was removed because it
 * was an abuse vector for an outreach tool: trial users could sign up,
 * load 9 leads, export to XLSX, cancel before being charged. Removing
 * it means every export is either an unlimited comp account, a pre-paid
 * credit, or a $50 Stripe charge — no free path for new users to grab
 * data and bounce.
 *
 * FREE_TIER_ROW_THRESHOLD is kept in the file but unused by the gate;
 * still exported because the migration and DB columns reference it
 * conceptually + the modal might want to show row counts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** Historical free-tier cutoff. Kept for reference; the gate no longer uses it. */
export const FREE_TIER_ROW_THRESHOLD = 10

/** Stripe price (in cents) for one paid export. */
export const PAID_EXPORT_PRICE_CENTS = 5000 // $50.00 (Dylan 2026-06-08, was $25)

/**
 * What the export endpoint reports back to the client before performing
 * the work. Lets the UI render the right pre-export confirmation modal
 * ("1 free this month" vs "$25 charge" vs "comp account") without a
 * round-trip to compute it.
 */
export interface ExportEntitlement {
  /** Final answer: can this user export RIGHT NOW without paying? */
  canExportFree: boolean
  /** Why they can / can't. */
  reason:
    | 'unlimited_account'
    | 'paid_credit_available'
    | 'requires_payment'
    // Kept in the union so old session/storage values continue to
    // type-check, but the gate never returns this anymore (Dylan
    // 2026-06-08 removed the free-under-10 tier).
    | 'under_threshold_free_monthly'
  /** Current Outreach row count, server-side. UI shouldn't trust client. */
  outreachRowCount: number
  /** Threshold above which payment is required. */
  threshold: number
  /** When the user's monthly free export quota next resets. */
  freeQuotaResetsAt: string | null
  /** # of pre-paid $25 export credits the user holds. */
  paidCredits: number
  /** Stripe Checkout price for a one-off export, in cents. */
  paidExportPriceCents: number
}

interface ProfileRow {
  unlimited_exports: boolean | null
  monthly_export_count: number | null
  export_count_resets_at: string | null
  paid_export_credits: number | null
}

/**
 * Resolve entitlement for a user. Does NOT mutate anything — pure read.
 * Performs the lazy monthly reset if the reset window has elapsed.
 *
 * The {@link sb} client should be the SERVICE-ROLE client. We need to
 * UPDATE user_profile during the lazy reset, and RLS would block the
 * user's own client from touching billing columns.
 */
export async function getExportEntitlement(
  sb: SupabaseClient,
  userId: string,
  outreachRowCount: number,
): Promise<ExportEntitlement> {
  // Read the four billing fields. Migration-tolerant: if 0034 hasn't
  // been applied yet, we get an error and fall back to "everything is
  // free" — this matches pre-paywall behaviour and avoids locking users
  // out during the deploy window.
  const { data, error } = await sb
    .from('user_profile')
    .select('unlimited_exports, monthly_export_count, export_count_resets_at, paid_export_credits')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) {
    // Schema not yet migrated OR profile row missing. Fall back to
    // requires_payment — better to ask the user to pay than to
    // accidentally hand out free exports because of an infrastructure
    // miss. (The old "free fallback" matched the now-removed Tier 2
    // and is no longer appropriate.)
    return {
      canExportFree: false,
      reason: 'requires_payment',
      outreachRowCount,
      threshold: FREE_TIER_ROW_THRESHOLD,
      freeQuotaResetsAt: null,
      paidCredits: 0,
      paidExportPriceCents: PAID_EXPORT_PRICE_CENTS,
    }
  }

  const row = data as ProfileRow
  const unlimited = row.unlimited_exports === true
  let monthlyCount = row.monthly_export_count ?? 0
  const resetsAt = row.export_count_resets_at
  const credits = row.paid_export_credits ?? 0

  // Lazy monthly reset.
  if (resetsAt && new Date(resetsAt).getTime() <= Date.now()) {
    const nextReset = nextMonthlyResetIso(new Date())
    const { error: resetErr } = await sb
      .from('user_profile')
      .update({
        monthly_export_count: 0,
        export_count_resets_at: nextReset,
      })
      .eq('user_id', userId)
    if (!resetErr) {
      monthlyCount = 0
    } else {
      // Non-fatal — we'll just see them count as having used their free
      // export this month, which errs SAFE (we charge instead of giving
      // away). Log so we notice persistent failures.
      console.warn('[exports] monthly reset failed', userId, resetErr.message)
    }
  }

  // Tier 1: comp account.
  if (unlimited) {
    return {
      canExportFree: true,
      reason: 'unlimited_account',
      outreachRowCount,
      threshold: FREE_TIER_ROW_THRESHOLD,
      freeQuotaResetsAt: resetsAt,
      paidCredits: credits,
      paidExportPriceCents: PAID_EXPORT_PRICE_CENTS,
    }
  }

  // 2026-06-08: Tier 2 (under_threshold_free_monthly) removed —
  // see top-of-file comment. monthlyCount / resetsAt are kept so the
  // schema columns continue to read OK, but no entitlement path
  // consults them anymore. Safe to leave in place.
  void monthlyCount

  // Tier 3 (now tier 2): pre-paid credit available.
  if (credits > 0) {
    return {
      canExportFree: true,
      reason: 'paid_credit_available',
      outreachRowCount,
      threshold: FREE_TIER_ROW_THRESHOLD,
      freeQuotaResetsAt: resetsAt,
      paidCredits: credits,
      paidExportPriceCents: PAID_EXPORT_PRICE_CENTS,
    }
  }

  // Tier 4: requires payment.
  return {
    canExportFree: false,
    reason: 'requires_payment',
    outreachRowCount,
    threshold: FREE_TIER_ROW_THRESHOLD,
    freeQuotaResetsAt: resetsAt,
    paidCredits: credits,
    paidExportPriceCents: PAID_EXPORT_PRICE_CENTS,
  }
}

/**
 * Atomically consume one unit of entitlement. Called by the export
 * endpoint AFTER getExportEntitlement reported canExportFree=true.
 *
 * For unlimited accounts: no-op.
 * For free-tier monthly: increment monthly_export_count.
 * For paid credit: decrement paid_export_credits.
 *
 * Returns true on success, false if entitlement was somehow revoked
 * between the check and the consume (e.g. another concurrent export
 * ate the credit). Caller should re-check entitlement and abort.
 */
export async function consumeExportEntitlement(
  sb: SupabaseClient,
  userId: string,
  reason: ExportEntitlement['reason'],
): Promise<boolean> {
  if (reason === 'unlimited_account') {
    return true
  }

  // Audit 2026-06-10: the 'under_threshold_free_monthly' consume
  // branch was removed. getExportEntitlement no longer returns that
  // reason (free-under-10 tier killed 2026-06-08), but the live
  // consume code still granted a free export by bumping
  // monthly_export_count if any stale session/value passed it. With
  // the branch gone, an unexpected 'under_threshold_free_monthly'
  // falls through to the fail-closed `return false` at the bottom.

  if (reason === 'paid_credit_available') {
    // Decrement credits. Conditional WHERE on credits > 0 prevents
    // going negative under concurrency.
    const { data: profile, error: readErr } = await sb
      .from('user_profile')
      .select('paid_export_credits')
      .eq('user_id', userId)
      .maybeSingle()
    if (readErr || !profile) {
      console.error('[exports] paid credit read failed', userId, readErr?.message)
      return false
    }
    const current = (profile as { paid_export_credits: number | null }).paid_export_credits ?? 0
    if (current <= 0) return false
    const { data, error } = await sb
      .from('user_profile')
      .update({ paid_export_credits: current - 1 })
      .eq('user_id', userId)
      .eq('paid_export_credits', current)
      .select('user_id')
    if (error) {
      console.error('[exports] paid credit consume failed', userId, error.message)
      return false
    }
    return (data?.length ?? 0) > 0
  }

  // requires_payment — caller should never reach this branch since they
  // checked canExportFree first. Fail closed.
  return false
}

/**
 * Compute the ISO timestamp of the next monthly reset. Always the
 * start of the next calendar month, UTC. We use date_trunc('month',...)
 * + interval in the migration for the same semantics.
 */
export function nextMonthlyResetIso(from: Date): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 0, 0, 0, 0))
  return d.toISOString()
}
