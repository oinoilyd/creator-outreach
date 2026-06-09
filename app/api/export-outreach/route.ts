/**
 * POST /api/export-outreach — generates an Outreach export.
 *
 * Accepts { entries, format } where format is 'xlsx' (default) or 'csv'.
 * CSV used to be generated client-side; routing it through the server
 * (Dylan 2026-05-24) was necessary to apply the export paywall — a
 * client-side CSV writer could trivially bypass any gate.
 *
 * GATED by the export paywall:
 *   • Free if user has unlimited_exports=true (comp account)
 *   • Free if outreach row count < 10 AND no free export used this month
 *   • Free if user has a pre-paid $25 credit (consumed)
 *   • Otherwise → 402 Payment Required with a {needsPayment: true} body
 *     so the client can launch Stripe Checkout
 *
 * The entitlement check uses the SERVER-side outreach count, not the
 * client's payload length. A user could trim entries client-side to slip
 * under the threshold and we'd still see the real count. The exported
 * file is still generated from the client payload so the user controls
 * which rows / columns end up in the export — they just can't fake the
 * row-count gate.
 */
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireUser, rateLimit } from '@/lib/api-auth'
import {
  getExportEntitlement,
  consumeExportEntitlement,
  PAID_EXPORT_PRICE_CENTS,
  type ExportEntitlement,
} from '@/lib/billing/exports'

export const runtime = 'nodejs'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createServiceClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth

  // Cap exports/hr to prevent DOS via XLSX generation loop.
  // (Paywall stops abuse via cost; rate-limit stops abuse via compute.)
  const limited = rateLimit(auth.id, 'export-outreach', 20)
  if (limited) return limited

  const body = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: any[] = Array.isArray(body.entries) ? body.entries.slice(0, 1000) : []
  const format: 'xlsx' | 'csv' = body.format === 'csv' ? 'csv' : 'xlsx'

  // Server-side entitlement check.
  const sb = getServiceClient()
  let entitlementReason: ExportEntitlement['reason'] | null = null

  if (sb) {
    const { count: outreachCount, error: countErr } = await sb
      .from('outreach_entries') // Dylan 2026-06-08: was 'outreach' — wrong table, count always failed, gate silently fell through to "free"
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.id)
    if (countErr) {
      // Count failed — fall back to permissive (no charge). Safer to
      // miss a charge than to lock a paying user out.
      console.warn('[export-outreach] count failed, falling back to permissive', countErr.message)
    } else {
      const ent = await getExportEntitlement(sb, auth.id, outreachCount ?? 0)
      if (!ent.canExportFree) {
        return NextResponse.json(
          {
            needsPayment: true,
            reason: ent.reason,
            outreachRowCount: ent.outreachRowCount,
            threshold: ent.threshold,
            paidExportPriceCents: ent.paidExportPriceCents,
            freeQuotaResetsAt: ent.freeQuotaResetsAt,
          },
          { status: 402 },
        )
      }
      entitlementReason = ent.reason
    }
  } else {
    console.error('[export-outreach] service role not configured; bypassing paywall')
  }

  // Consume the entitlement BEFORE generating the file. If consumption
  // fails (concurrent request ate the credit), bail with 402.
  if (sb && entitlementReason) {
    const ok = await consumeExportEntitlement(sb, auth.id, entitlementReason)
    if (!ok) {
      return NextResponse.json(
        {
          needsPayment: true,
          reason: 'requires_payment',
          paidExportPriceCents: PAID_EXPORT_PRICE_CENTS,
        },
        { status: 402 },
      )
    }
  }

  // ---- Generate the file in the requested format ----
  if (format === 'csv') {
    const headers = [
      'Channel Name', 'YouTube URL', 'Email', 'Description', 'Product',
      'Reached Out', 'Medium', 'Subject Line', 'Status',
    ]
    const rows = entries.map(e => [
      e.channelName, e.channelUrl, e.email, e.description, e.product,
      e.reachedOut ? 'Yes' : 'No',
      e.medium === 'Other' ? (e.mediumOther || 'Other') : (e.medium || ''),
      e.headerUsed,
      e.status || '',
    ])
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="outreach.csv"',
      },
    })
  }

  // Default: XLSX.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = entries.map((e: any) => ({
    'Channel Name': e.channelName,
    'YouTube URL': e.channelUrl,
    'Email': e.email || '',
    'Description': e.description || '',
    'Product': e.product || '',
    'Reached Out': e.reachedOut ? 'Yes' : 'No',
    'Medium': e.medium === 'Other' ? (e.mediumOther || 'Other') : (e.medium || ''),
    'Subject Line': e.headerUsed || '',
    'Status': e.status || '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Outreach')

  ws['!cols'] = [
    { wch: 28 }, { wch: 40 }, { wch: 32 }, { wch: 50 },
    { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 40 },
    { wch: 16 },
  ]

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="outreach.xlsx"',
    },
  })
}
