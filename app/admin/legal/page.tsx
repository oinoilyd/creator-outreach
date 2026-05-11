import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LEGAL_DOCS } from '@/lib/legal/content'
import type { LegalDoc } from '@/lib/legal/types'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export const dynamic = 'force-dynamic'

/**
 * Admin index for legal/PnP documents.
 *
 * Lists every LegalDoc registered in lib/legal/content with a
 * link to the public page (if any) and Word/PDF download links
 * that hit /api/admin/legal/[slug]/[format].
 */
export default async function AdminLegalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) notFound()

  const docs = LEGAL_DOCS
  const publicCount = docs.filter((d) => d.isPublic).length
  const internalCount = docs.length - publicCount

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
            >
              ← Back to admin
            </Link>
            <h1 className="text-2xl font-bold">Policies &amp; Procedures</h1>
            <p className="text-muted-foreground/80 text-sm mt-1">
              Customer-facing and internal compliance documents.
            </p>
            <p className="text-muted-foreground/70 text-xs mt-1 tabular-nums">
              Total: {docs.length} document{docs.length === 1 ? '' : 's'} ·{' '}
              {publicCount} public · {internalCount} internal
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:text-foreground border border-border hover:border-border rounded-lg px-4 py-2 transition-colors"
            >
              Back to admin
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-card text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Document</th>
                <th className="px-4 py-3 text-left font-medium">Public?</th>
                <th className="px-4 py-3 text-left font-medium">Last updated</th>
                <th className="px-4 py-3 text-left font-medium">Summary</th>
                <th className="px-4 py-3 text-right font-medium">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {docs.map((doc) => (
                <DocRow key={doc.slug} doc={doc} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}

function DocRow({ doc }: { doc: LegalDoc }) {
  const publicHref = `/${doc.slug}`
  return (
    <tr className="hover:bg-card/40 transition-colors">
      <td className="px-4 py-3 align-top">
        <div className="font-medium text-foreground">{doc.title}</div>
        <div className="text-xs text-muted-foreground/70 font-mono mt-0.5">
          {doc.slug}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        {doc.isPublic ? (
          <Link
            href={publicHref}
            className="text-green-700 dark:text-green-400 text-xs inline-flex items-center gap-1.5 hover:underline"
          >
            <span aria-hidden>✅</span>
            <span>live at {publicHref}</span>
          </Link>
        ) : (
          <span className="text-muted-foreground text-xs inline-flex items-center gap-1.5">
            <span aria-hidden>🔒</span>
            <span>internal</span>
          </span>
        )}
      </td>
      <td className="px-4 py-3 align-top text-muted-foreground whitespace-nowrap">
        {doc.lastUpdated}
      </td>
      <td className="px-4 py-3 align-top text-muted-foreground/90 max-w-md">
        {doc.summary}
      </td>
      <td className="px-4 py-3 align-top text-right whitespace-nowrap">
        <a
          href={`/api/admin/legal/${doc.slug}/docx`}
          download
          className="text-xs rounded-md px-2.5 py-1.5 inline-block border border-border text-foreground hover:bg-card/60 transition-colors mr-2"
        >
          Word
        </a>
        <a
          href={`/api/admin/legal/${doc.slug}/pdf`}
          download
          className="text-xs rounded-md px-2.5 py-1.5 inline-block border border-border text-foreground hover:bg-card/60 transition-colors"
        >
          PDF
        </a>
      </td>
    </tr>
  )
}
