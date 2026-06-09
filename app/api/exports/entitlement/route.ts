/**
 * GET /api/exports/entitlement — what's the current export entitlement
 * state for the signed-in user?
 *
 * Returns the same shape as the 402 body from /api/export-outreach, plus
 * canExportFree=true when the user IS allowed.
 *
 * The pre-export modal polls this on open so it can render the right
 * message ("1 free this month" vs "$25 charge" vs "comp account") without
 * waiting for the user to click the button and discover the cost.
 */
import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/api-auth'
import { getExportEntitlement, PAID_EXPORT_PRICE_CENTS } from '@/lib/billing/exports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createServiceClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function GET() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth

  const sb = getServiceClient()
  if (!sb) {
    // Service role missing → fall back to requires_payment. Was
    // "free" before Dylan 2026-06-08 — but the free tier is gone, and
    // we shouldn't accidentally hand out free exports just because
    // SUPABASE_SERVICE_ROLE_KEY isn't set.
    return NextResponse.json({
      canExportFree: false,
      reason: 'requires_payment',
      outreachRowCount: 0,
      threshold: 10,
      freeQuotaResetsAt: null,
      paidCredits: 0,
      paidExportPriceCents: PAID_EXPORT_PRICE_CENTS,
    })
  }

  const { count: outreachCount, error: countErr } = await sb
    .from('outreach_entries') // Dylan 2026-06-08: was 'outreach' — wrong table, count silently returned 0
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.id)

  if (countErr) {
    console.warn('[exports/entitlement] count failed', countErr.message)
  }

  const ent = await getExportEntitlement(sb, auth.id, outreachCount ?? 0)
  return NextResponse.json(ent)
}
