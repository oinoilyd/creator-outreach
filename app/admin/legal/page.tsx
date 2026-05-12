import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LEGAL_DOCS } from '@/lib/legal/content'
import type { LegalDoc } from '@/lib/legal/types'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

/**
 * Signed external agreements — DPAs and MSAs with sub-processors.
 *
 * Two flavors:
 *   1. Counter-signed PDFs — the vendor sent a signature page back.
 *      We store the artifact in /public/legal/ and link it via
 *      `filename`. Strongest audit evidence.
 *   2. Accepted-at-signup public templates — the vendor publishes
 *      a DPA URL that's auto-accepted on account creation
 *      (Anthropic, Supabase, Stripe, Vercel all work this way).
 *      We link the live URL via `externalUrl` plus record the
 *      acceptance date. For audit-grade evidence, snapshot the
 *      page to PDF and re-add as a `filename` entry.
 *
 * To add a new one:
 *   - Counter-signed: drop the PDF in /public/legal/, add a
 *     `filename` entry.
 *   - Live-link: add an `externalUrl` entry (no file copy needed).
 */
type SignedAgreement = {
  title: string
  vendor: string
  /** YYYY-MM-DD. For signed PDFs, the counter-sign date. For live
   *  links, the date we accepted by creating the account. */
  signedOn: string
  /** Who signed (counter-signed) or accepted (live-link). */
  signedBy: string
  summary: string
} & (
  | { filename: string; externalUrl?: never }
  | { externalUrl: string; filename?: never }
)

const SIGNED_AGREEMENTS: SignedAgreement[] = [
  {
    title: 'Data Processing Agreement — Unipile',
    vendor: 'Unipile SAS',
    signedOn: '2025-07-09',
    signedBy: 'Julien Crépieux (CEO)',
    summary:
      'GDPR Article 28 DPA covering Unipile processing of LinkedIn/email account data on our behalf. Lists sub-processors (Scaleway, Crisp, Stripe, Bright Data, Webshare, Oxylabs), security obligations, breach notification, and EU transfer mechanism.',
    filename: 'DPA-Unipile-signed.pdf',
  },
  {
    title: 'Data Processing Addendum — Anthropic',
    vendor: 'Anthropic, PBC',
    signedOn: '2026-04-28',
    signedBy: 'Dylan Meehan (auto-accepted at API signup)',
    summary:
      'GDPR Article 28 DPA covering Anthropic processing of prompt/response data sent to the Claude API (used for AI keyword expansion + outreach drafting). Auto-accepted upon API account creation. PDF snapshot filed 2026-05-12; confirmation email from Anthropic support archived separately. Upstream URL: anthropic.com/legal/data-processing-addendum.',
    filename: 'DPA-Anthropic.pdf',
  },
]

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

        {/* Combined / comprehensive download — every doc in the
            table above, concatenated into one Word/PDF with a
            cover page + auto-generated TOC + page-break-separated
            sections. Rebuilt fresh per request from the LEGAL_DOCS
            registry, so any new P&P automatically appears in the
            next download with zero manual update. */}
        <div className="mt-4 rounded-lg border border-purple-500/30 bg-purple-500/5 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">
              Comprehensive P&amp;P Manual
            </div>
            <div className="text-xs text-muted-foreground/80 mt-0.5">
              All {docs.length} document{docs.length === 1 ? '' : 's'} above in one
              file — cover page, table of contents, page-break-separated sections.
              Auto-updates whenever a new P&amp;P is added.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/admin/legal/comprehensive/docx"
              download
              className="text-xs rounded-md px-3 py-1.5 inline-block border border-purple-500/40 text-foreground bg-card hover:bg-purple-500/10 transition-colors font-medium"
            >
              Download Word
            </a>
            <a
              href="/api/admin/legal/comprehensive/pdf"
              download
              className="text-xs rounded-md px-3 py-1.5 inline-block border border-purple-500/40 text-foreground bg-card hover:bg-purple-500/10 transition-colors font-medium"
            >
              Download PDF
            </a>
          </div>
        </div>

        {/* Signed external agreements — counter-signed vendor DPAs/MSAs.
            Separated from the table above because these are signed
            artifacts (can't regenerate Word from them) and serve a
            different compliance purpose (proof we have a DPA with
            each sub-processor we send personal data to). */}
        <div className="mt-10">
          <h2 className="text-lg font-semibold">Signed external agreements</h2>
          <p className="text-muted-foreground/80 text-sm mt-1">
            Counter-signed vendor DPAs and MSAs. Proof of GDPR Article
            28 compliance for each sub-processor we send personal data
            to.
          </p>
          <p className="text-muted-foreground/70 text-xs mt-1 tabular-nums">
            Total: {SIGNED_AGREEMENTS.length} signed agreement
            {SIGNED_AGREEMENTS.length === 1 ? '' : 's'}
          </p>

          <div className="overflow-x-auto rounded-lg border border-border mt-3">
            <table className="min-w-full text-sm">
              <thead className="bg-card text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Agreement</th>
                  <th className="px-4 py-3 text-left font-medium">Vendor</th>
                  <th className="px-4 py-3 text-left font-medium">Signed</th>
                  <th className="px-4 py-3 text-left font-medium">Summary</th>
                  <th className="px-4 py-3 text-right font-medium">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {SIGNED_AGREEMENTS.map((a) => (
                  <SignedAgreementRow key={a.filename} agreement={a} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}

function SignedAgreementRow({
  agreement,
}: {
  agreement: SignedAgreement
}) {
  // Two render modes:
  //   - filename → local PDF in /public/legal/, served as a download
  //   - externalUrl → live vendor URL, opens in new tab
  const isLocal = 'filename' in agreement && agreement.filename
  const subtitle = isLocal ? agreement.filename : agreement.externalUrl
  return (
    <tr className="hover:bg-card/40 transition-colors">
      <td className="px-4 py-3 align-top">
        <div className="font-medium text-foreground">{agreement.title}</div>
        <div className="text-xs text-muted-foreground/70 font-mono mt-0.5 break-all">
          {subtitle}
        </div>
      </td>
      <td className="px-4 py-3 align-top text-muted-foreground whitespace-nowrap">
        {agreement.vendor}
      </td>
      <td className="px-4 py-3 align-top text-muted-foreground whitespace-nowrap">
        <div className="tabular-nums">{agreement.signedOn}</div>
        <div className="text-xs text-muted-foreground/70 mt-0.5">
          {isLocal ? 'by ' : ''}
          {agreement.signedBy}
        </div>
      </td>
      <td className="px-4 py-3 align-top text-muted-foreground/90 max-w-md">
        {agreement.summary}
      </td>
      <td className="px-4 py-3 align-top text-right whitespace-nowrap">
        {isLocal ? (
          <a
            href={`/legal/${agreement.filename}`}
            download
            className="text-xs rounded-md px-2.5 py-1.5 inline-block border border-border text-foreground hover:bg-card/60 transition-colors"
          >
            PDF
          </a>
        ) : (
          <a
            href={agreement.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs rounded-md px-2.5 py-1.5 inline-block border border-border text-foreground hover:bg-card/60 transition-colors"
          >
            View ↗
          </a>
        )}
      </td>
    </tr>
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
