import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/LegalLayout'

/**
 * /subprocessors — public list of every third-party service that processes
 * Creator Outreach customer data. Enterprise buyers ask for this; it's a
 * standard compliance artifact alongside Privacy + Security.
 *
 * Not driven by the structured LegalDoc system because that vocabulary
 * (h2/h3/p/ul) doesn't have table support. Tables read materially better
 * for this content, so we render a small JSX page directly inside the
 * shared LegalLayout shell.
 *
 * Keep this page truthful: only list third parties actually integrated
 * with the product. Verified against package.json + lib/ usage on
 * 2026-05-11 — Supabase, Vercel, Anthropic, Unipile, Stripe, Resend,
 * and Upstash/QStash are all in active use.
 */

export const metadata: Metadata = {
  title: 'Subprocessors & DPAs',
  description:
    'The third-party services Creator Outreach engages to operate the product, including purpose, data location, DPA status, and downloadable counter-signed Data Processing Agreements.',
  robots: { index: true, follow: true },
}

const LAST_UPDATED = 'May 19, 2026'

/**
 * Counter-signed DPAs available for public download. Same files
 * mirrored under public/legal/ and surfaced (with summaries) on
 * /admin/legal for internal review.
 *
 * Only the five sub-processors that touch personal data are listed
 * here — Resend (admin-form-notification only) + Upstash (ephemeral
 * cache) handle DPAs case-by-case on request rather than as a public
 * library entry. Email support@creatoroutreach.net to get those.
 */
const PUBLIC_DPAS: { vendor: string; title: string; signedOn: string; filename: string }[] = [
  {
    vendor: 'Unipile',
    title: 'Data Processing Agreement',
    signedOn: '2025-07-09',
    filename: 'DPA-Unipile-signed.pdf',
  },
  {
    vendor: 'Anthropic',
    title: 'Data Processing Addendum',
    signedOn: '2026-04-28',
    filename: 'DPA-Anthropic.pdf',
  },
  {
    vendor: 'Stripe',
    title: 'Data Processing Agreement',
    signedOn: '2026-05-12',
    filename: 'DPA-Stripe.pdf',
  },
  {
    vendor: 'Vercel',
    title: 'Data Processing Addendum',
    signedOn: '2026-05-12',
    filename: 'DPA-Vercel.pdf',
  },
  {
    vendor: 'Supabase',
    title: 'Data Processing Agreement',
    signedOn: '2026-05-18',
    filename: 'DPA-Supabase-signed.pdf',
  },
]

interface SubprocessorRow {
  name: string
  purpose: string
  location: string
  dpa: string
}

const SUBPROCESSORS: SubprocessorRow[] = [
  {
    name: 'Supabase',
    purpose: 'Database, authentication, file storage',
    location: 'United States (us-east)',
    dpa: 'Yes — request via privacy@supabase.io',
  },
  {
    name: 'Vercel',
    purpose: 'Application hosting + CDN, edge runtime',
    location: 'Global (primary US)',
    dpa: 'Yes — auto-accepted on paid plan',
  },
  {
    name: 'Anthropic',
    purpose: 'AI scoring, reply classification, email-draft assistance',
    location: 'United States',
    dpa: 'Yes — request via support',
  },
  {
    name: 'Unipile',
    purpose: 'Email + LinkedIn messaging API for outreach delivery',
    location: 'France (EU)',
    dpa: 'Yes — request via support',
  },
  {
    name: 'Stripe',
    purpose: 'Payment processing + subscription billing',
    location: 'United States + EU',
    dpa: 'Yes — auto-accepted on activation',
  },
  {
    name: 'Resend',
    purpose: 'Transactional email delivery (contact-form notifications, system mail)',
    location: 'United States',
    dpa: 'Yes — available on request',
  },
  {
    name: 'Upstash (Redis + QStash)',
    purpose: 'Background job queue + ephemeral cache layer',
    location: 'United States',
    dpa: 'Yes — available on request',
  },
]

export default function SubprocessorsPage() {
  return (
    <LegalLayout title="Subprocessors & DPAs" lastUpdated={LAST_UPDATED}>
      <p>
        Creator Outreach engages the following third-party services to
        operate the Service. Each is contractually bound to handle your
        data per our{' '}
        <a href="/privacy" className="text-blue-600 dark:text-blue-400 underline underline-offset-2">
          Privacy Policy
        </a>{' '}
        and Data Processing Agreement. We share only the data required for
        each subprocessor to perform its function and we do not authorize
        them to use your data for their own purposes.
      </p>

      {/* Quick-link banner — surfaces the DPA library at the top so
          procurement teams + customers searching for a signed agreement
          don't have to scroll past the table to find it. Anchors to the
          #dpa-library section below. */}
      <div className="not-prose my-4 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[13.5px] text-foreground/85 m-0">
          <span className="font-semibold text-foreground">Looking for a signed DPA?</span>{' '}
          We have counter-signed Data Processing Agreements on file for every
          subprocessor that touches personal data.
        </p>
        <a
          href="#dpa-library"
          className="shrink-0 inline-flex items-center gap-1 text-[13px] font-semibold text-blue-600 dark:text-blue-400 hover:underline underline-offset-2"
        >
          Jump to DPA library <span aria-hidden>↓</span>
        </a>
      </div>

      {/* Subprocessor table — uses the same `text-foreground/85` body
          tint as the surrounding LegalLayout typography so it blends
          with the rest of the document. Horizontal scroll on narrow
          viewports rather than collapsing to cards: enterprise readers
          want to see all four columns at once. */}
      <div className="not-prose overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-[14px] text-left">
          <thead className="bg-muted/40 text-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                Subprocessor
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Purpose
              </th>
              <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                Data Location
              </th>
              <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                DPA Signed
              </th>
            </tr>
          </thead>
          <tbody>
            {SUBPROCESSORS.map((row, i) => (
              <tr
                key={row.name}
                className={i % 2 === 1 ? 'bg-muted/20' : undefined}
              >
                <td className="px-4 py-3 align-top font-medium text-foreground whitespace-nowrap">
                  {row.name}
                </td>
                <td className="px-4 py-3 align-top text-foreground/85">
                  {row.purpose}
                </td>
                <td className="px-4 py-3 align-top text-foreground/85 whitespace-nowrap">
                  {row.location}
                </td>
                <td className="px-4 py-3 align-top text-foreground/85">
                  {row.dpa}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DPA Library — open by default (2026-05-19) so procurement teams
          + customers see the signed PDFs without an extra click. The
          collapse affordance is preserved in case the table grows.
          Mirrors the SIGNED_AGREEMENTS list on /admin/legal but
          surfaces only sub-processor DPAs (no internal P&Ps, no
          partner agreements) — uses HTML <details> for zero-JS toggle. */}
      <h2 id="dpa-library">DPA library &mdash; signed Data Processing Agreements</h2>
      <p className="text-foreground/80">
        Each subprocessor above that handles personal data has a counter-signed
        Data Processing Agreement on file. Download the current PDF below.
        Resend and Upstash DPAs are available on request &mdash; email{' '}
        <a href="mailto:support@creatoroutreach.net" className="text-blue-600 dark:text-blue-400 underline underline-offset-2">
          support@creatoroutreach.net
        </a>.
      </p>
      <details open className="not-prose rounded-lg border border-border/60 bg-card/40 overflow-hidden">
        <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-foreground hover:bg-muted/40 transition-colors flex items-center justify-between gap-3">
          <span>Signed DPAs &mdash; {PUBLIC_DPAS.length} on file</span>
          <span aria-hidden className="text-xs text-muted-foreground transition-transform">▾</span>
        </summary>
        <div className="border-t border-border/60 overflow-x-auto">
          <table className="w-full text-[14px] text-left">
            <thead className="bg-muted/40 text-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                  Vendor
                </th>
                <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                  Document
                </th>
                <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                  Signed
                </th>
                <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap text-right">
                  Download
                </th>
              </tr>
            </thead>
            <tbody>
              {PUBLIC_DPAS.map((d, i) => (
                <tr key={d.filename} className={i % 2 === 1 ? 'bg-muted/20' : undefined}>
                  <td className="px-4 py-3 align-top font-medium text-foreground whitespace-nowrap">
                    {d.vendor}
                  </td>
                  <td className="px-4 py-3 align-top text-foreground/85">
                    {d.title}
                  </td>
                  <td className="px-4 py-3 align-top text-foreground/85 whitespace-nowrap">
                    {d.signedOn}
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-right">
                    <a
                      href={`/legal/${d.filename}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[13px] font-semibold text-blue-600 dark:text-blue-400 hover:underline underline-offset-2"
                    >
                      PDF
                      <span aria-hidden>↗</span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <h2>Notifications about subprocessor changes</h2>
      <p>
        We notify customers at least 30 days before adding new
        subprocessors that handle personal data. You can subscribe to
        this page&apos;s RSS feed (coming soon) or check back periodically
        for changes. If you object to a new subprocessor for legitimate
        compliance reasons, you may terminate your subscription before
        the change takes effect and receive a pro-rated refund of any
        prepaid fees.
      </p>

      <h2>Questions</h2>
      <p>
        Email{' '}
        <a href="mailto:support@creatoroutreach.net" className="text-blue-600 dark:text-blue-400 underline underline-offset-2">
          support@creatoroutreach.net
        </a>{' '}
        if you need a current DPA, a copy of a specific subprocessor&apos;s
        certifications, or have any other questions about how we share
        data with the services listed above.
      </p>
    </LegalLayout>
  )
}
