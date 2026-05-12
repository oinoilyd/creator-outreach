import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { LEGAL_DOCS } from '@/lib/legal/content'
import { renderComprehensiveDocx } from '@/lib/legal/render-comprehensive-docx'
import { renderComprehensivePdf } from '@/lib/legal/render-comprehensive-pdf'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/legal/comprehensive/[format]
 *
 * Admin-only download endpoint for the combined P&P manual —
 * every doc in `LEGAL_DOCS` rendered into one Word/PDF with a
 * cover page + table of contents + page-break-separated sections.
 *
 * Mirrors the per-doc route at /api/admin/legal/[slug]/[format]
 * (404 for non-admins, same Cache-Control: no-store).
 *
 * Auto-updates: built fresh from the registry per request, so any
 * new P&P added to /lib/legal/content/index.ts lands in the next
 * download without a code change here.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ format: string }> },
): Promise<Response> {
  const { format } = await ctx.params

  // Auth gate — 404 for non-admins to avoid leaking route existence.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return new NextResponse('Not found', { status: 404 })
  }

  if (format !== 'docx' && format !== 'pdf') {
    return new NextResponse('Not found', { status: 404 })
  }

  // Filename stamped with today's date so old downloads don't
  // overwrite new ones if the user has multiple in their Downloads
  // folder over time.
  const today = new Date().toISOString().slice(0, 10)
  const filename = `creator-outreach-pnp-manual-${today}`

  if (format === 'docx') {
    const buffer = await renderComprehensiveDocx(LEGAL_DOCS)
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}.docx"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  // format === 'pdf'
  const buffer = await renderComprehensivePdf(LEGAL_DOCS)
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
