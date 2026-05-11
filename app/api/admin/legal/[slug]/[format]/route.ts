import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDocBySlug } from '@/lib/legal/content'
import { renderDocx } from '@/lib/legal/render-docx'
import { renderPdf } from '@/lib/legal/render-pdf'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/legal/[slug]/[format]
 *
 * Admin-only download endpoint for legal/PnP documents. Returns
 * 404 (not 401/403) for non-admins to avoid leaking the route's
 * existence — same convention as the rest of /admin.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; format: string }> },
): Promise<Response> {
  const { slug, format } = await ctx.params

  // Auth gate — match the /admin pages: not-admin = 404.
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

  const doc = getDocBySlug(slug)
  if (!doc) {
    return new NextResponse('Not found', { status: 404 })
  }

  const filenameSafe = doc.slug.replace(/[^a-z0-9-]/gi, '_')

  if (format === 'docx') {
    const buffer = await renderDocx(doc)
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filenameSafe}.docx"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  // format === 'pdf'
  const buffer = await renderPdf(doc)
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filenameSafe}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
