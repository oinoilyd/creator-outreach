/**
 * Export entitlement logic — single source of truth for "can this user
 * export right now, and what does it cost?"
 *
 * Three tiers of access:
 *   1. unlimited_exports = true       — comp account, always free, never counts
 *   2. < FREE_TIER_ROW_THRESHOLD rows
 *      AND monthly_export_count = 0   — 1 free per calendar month
 *   3. paid_export_credits > 0        — pre-paid $25 credit, consume one
 *   4. otherwise                      — needs to pay $25 via Stripe Checkout
 *
 * The threshold gate uses the user's CURRENT outreach row count, not a
 * historical max. A user who shrinks back below 10 (delete some entries)
 * gets their free-tier quota back next month. This is intentional — we
 * want to encourage hygiene + reward low-volume users.
 *
 * Why a lazy reset (not a cron)? No infra dependency, no race condition
 * with month-rollover at midnight. Every read checks if we crossed
 * export_count_resets_at and writes-back the new (0, +1 month) state.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** Rows in the user's Outreach tab above this require payment. */
export const FREE_TIER_ROW_THRESHOLD = 10

/** Stripe price (in cents) for one paid export. */
export const PAID_EXPORT_PRICE_CENTS = 2500 // $25.00

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
    | 'under_threshold_free_monthly'
    | 'paid_credit_available'
    | 'requires_payment'
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
    // Schema not yet migrated OR profile row missing. Either way, the
    // SAFE default is "free export, no charge" — we never want to
    // accidentally charge someone because of an infrastructure miss.
    return {
      canExportFree: true,
      reason: 'under_threshold_free_monthly',
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

  // Tier 2: under threshold + free quota available this month.
  if (outreachRowCount < FREE_TIER_ROW_THRESHOLD && monthlyCount < 1) {
    return {
      canExportFree: true,
      reason: 'under_threshold_free_monthly',
      outreachRowCount,
      threshold: FREE_TIER_ROW_THRESHOLD,
      freeQuotaResetsAt: resetsAt,
      paidCredits: credits,
      paidExportPriceCents: PAID_EXPORT_PRICE_CENTS,
    }
  }

  // Tier 3: pre-paid credit available.
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

  if (reason === 'under_threshold_free_monthly') {
    // Bump monthly count. Conditional WHERE so we don't accidentally
    // grant a free export to someone who already used theirs this month
    // (concurrent request edge case).
    const { data, error } = await sb
      .from('user_profile')
      .update({ monthly_export_count: 1 })
      .eq('user_id', userId)
      .eq('monthly_export_count', 0)
      .select('user_id')
    if (error) {
      console.error('[exports] free quota consume failed', userId, error.message)
      return false
    }
    return (data?.length ?? 0) > 0
  }

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
