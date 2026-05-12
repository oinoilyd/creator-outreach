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
  title: 'Subprocessors',
  description:
    'The third-party services Creator Outreach engages to operate the product, including purpose, data location, and DPA status.',
  robots: { index: true, follow: true },
}

const LAST_UPDATED = 'May 11, 2026'

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
    <LegalLayout title="Subprocessors" lastUpdated={LAST_UPDATED}>
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
        <a href="mailto:dmeehanj@gmail.com" className="text-blue-600 dark:text-blue-400 underline underline-offset-2">
          dmeehanj@gmail.com
        </a>{' '}
        if you need a current DPA, a copy of a specific subprocessor&apos;s
        certifications, or have any other questions about how we share
        data with the services listed above.
      </p>
    </LegalLayout>
  )
}
