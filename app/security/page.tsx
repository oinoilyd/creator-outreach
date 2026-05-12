import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/LegalLayout'

/**
 * /security — security overview for enterprise buyers + auditors.
 *
 * Same shell pattern as /subprocessors: plain JSX inside LegalLayout
 * rather than the structured LegalDoc system. Sections map to what a
 * security questionnaire actually asks (infra, encryption, access,
 * payments, vuln disclosure, data handling, incident response,
 * compliance) so this page can stand in as a first-pass security
 * artifact while we work toward SOC 2.
 *
 * Keep the language conservative and accurate — every claim here is
 * something we can defend in a procurement review. Update this page
 * (not the marketing site) when a control changes.
 */

export const metadata: Metadata = {
  title: 'Security',
  description:
    'How Creator Outreach protects customer data — infrastructure, encryption, access controls, payment security, and incident response.',
  robots: { index: true, follow: true },
}

const LAST_UPDATED = 'May 11, 2026'

export default function SecurityPage() {
  return (
    <LegalLayout title="Security" lastUpdated={LAST_UPDATED}>
      <p>
        Creator Outreach handles customer outreach data, connected-account
        credentials, and payment information. This page describes the
        controls we have in place to keep that data safe. If you need
        more detail — a security questionnaire, a copy of a
        subprocessor&apos;s SOC 2 report, or our DPA — email{' '}
        <a href="mailto:dmeehanj@gmail.com" className="text-blue-600 dark:text-blue-400 underline underline-offset-2">
          dmeehanj@gmail.com
        </a>
        .
      </p>

      <h2>Infrastructure</h2>
      <ul>
        <li>
          Hosted on <strong>Vercel</strong> (SOC 2 Type II, ISO 27001) for
          the application layer and <strong>Supabase</strong> (SOC 2 Type
          II) for the database, authentication, and file storage.
        </li>
        <li>US-region primary data center (us-east) for both providers.</li>
        <li>
          Application code is deployed exclusively via Vercel, which
          maintains audit logs of every deploy, environment-variable
          change, and team-membership change.
        </li>
        <li>
          Background work runs on <strong>Upstash QStash</strong>, an
          HTTPS-only queue that POSTs verified payloads to our serverless
          worker routes — no long-lived job processes to compromise.
        </li>
      </ul>

      <h2>Encryption</h2>
      <ul>
        <li>
          <strong>In transit:</strong> TLS 1.2+ everywhere. HTTPS is
          enforced via HSTS; we do not accept plaintext HTTP requests.
        </li>
        <li>
          <strong>At rest:</strong> AES-256 encryption on all Supabase
          Postgres volumes, file storage, and backups (Supabase default).
        </li>
        <li>
          <strong>Secrets:</strong> stored as Vercel environment variables,
          encrypted at rest, never committed to source control. Access to
          decrypt them is limited to authorized deploys.
        </li>
        <li>
          <strong>OAuth tokens</strong> for connected Gmail / Outlook /
          LinkedIn accounts are stored encrypted alongside the rest of
          your row-level data; we never see or store the underlying
          provider passwords.
        </li>
      </ul>

      <h2>Access controls</h2>
      <ul>
        <li>
          Single administrative account (<code>dmeehanj@gmail.com</code>)
          with elevated permissions; all other users see only their own
          data.
        </li>
        <li>
          <strong>Two-factor authentication required</strong> on every
          administrative system we use (Vercel, Supabase, Stripe,
          Anthropic, Resend, Upstash, GitHub).
        </li>
        <li>
          Role-based access in Supabase via{' '}
          <strong>Row-Level Security (RLS)</strong> policies on every
          user-data table. RLS is the default deny posture; rows are
          only readable by the user that owns them.
        </li>
        <li>
          <strong>Service-role keys</strong> for server-side operations
          are scoped to specific routes and never shipped to the client.
          Client requests authenticate as the signed-in user only.
        </li>
        <li>
          Audit log of every administrative action (Stripe webhook events,
          Supabase auth events, Vercel deploys) retained for at least
          90 days.
        </li>
      </ul>

      <h2>Payment security</h2>
      <ul>
        <li>
          Payments are processed by <strong>Stripe</strong> via Stripe
          Elements / Checkout. <strong>We never store, transmit, or
          process raw card data</strong> — the card number goes directly
          from the user&apos;s browser to Stripe over TLS, and we receive
          only a token referring to the saved payment method.
        </li>
        <li>
          PCI DSS <strong>SAQ A</strong> self-attested annually. Because
          Stripe Elements isolates the cardholder fields in a Stripe-served
          iframe, our PCI scope is the smallest available.
        </li>
        <li>
          Webhook signatures from Stripe are verified on every request
          (see our{' '}
          <a href="/admin/legal/webhook-security" className="text-blue-600 dark:text-blue-400 underline underline-offset-2">
            Webhook Security
          </a>{' '}
          policy if you have admin access).
        </li>
      </ul>

      <h2>Vulnerability disclosure</h2>
      <ul>
        <li>
          Email <code>security@creatoroutreach.net</code> with anything
          you find. We acknowledge reports within <strong>1 business
          day</strong> and will keep you updated until the issue is
          remediated.
        </li>
        <li>
          We prefer <strong>coordinated disclosure</strong>: please give
          us a reasonable window to fix the issue before publishing
          details. We do not run a paid bug bounty yet, but we will
          credit researchers (with permission) in our security
          changelog.
        </li>
        <li>
          Good-faith security research is welcome. Do not access or
          modify data that isn&apos;t yours, do not run automated scans
          that degrade service availability, and do not exfiltrate any
          customer data you happen to encounter while testing.
        </li>
      </ul>

      <h2>Data handling</h2>
      <ul>
        <li>
          See our{' '}
          <a href="/privacy" className="text-blue-600 dark:text-blue-400 underline underline-offset-2">
            Privacy Policy
          </a>{' '}
          for the full list of data we collect and how we use it.
        </li>
        <li>
          See our{' '}
          <a href="/subprocessors" className="text-blue-600 dark:text-blue-400 underline underline-offset-2">
            Subprocessors
          </a>{' '}
          page for every third party that handles customer data on our
          behalf.
        </li>
        <li>
          <strong>Retention:</strong> account data is retained for the
          life of your account plus <strong>90 days</strong> after
          deletion, then permanently removed (with a small carve-out for
          encrypted backup copies, which roll off within an additional
          30 days).
        </li>
        <li>
          <strong>Data portability:</strong> you can export your
          outreach data as CSV / Excel at any time from inside the app.
        </li>
      </ul>

      <h2>Incident response</h2>
      <ul>
        <li>
          <strong>Notification timeline:</strong> in the event of a
          confirmed personal-data breach, we notify affected users and
          the relevant supervisory authority within <strong>72 hours</strong>{' '}
          of becoming aware, consistent with GDPR Article 33 and the
          breach-notification requirements of US state privacy laws.
        </li>
        <li>
          Notification is sent by email to affected users and posted on
          this page (and at <code>/security/incidents</code> if we ever
          need a separate incident log).
        </li>
        <li>
          We retain incident response evidence (logs, timeline,
          remediation steps) for a minimum of <strong>2 years</strong>{' '}
          for audit purposes.
        </li>
      </ul>

      <h2>Compliance</h2>
      <ul>
        <li>
          <strong>SOC 2 Type I</strong> in progress — target completion
          within 6 months. We will publish the report (under NDA) when
          available.
        </li>
        <li>
          <strong>CAN-SPAM compliant</strong> outbound email
          infrastructure: every email sent through Creator Outreach
          carries a physical postal address and a working unsubscribe
          link, and contacts who unsubscribe are added to a permanent
          suppression list consulted before any future send.
        </li>
        <li>
          <strong>GDPR + UK GDPR</strong> for European data subjects,
          including support for data-subject access, rectification,
          erasure, restriction, portability, and objection requests.
          We use Standard Contractual Clauses for EU/UK → US data
          transfers.
        </li>
        <li>
          <strong>CCPA/CPRA</strong> and 10 other US state comprehensive
          privacy laws (Virginia, Colorado, Connecticut, Utah, Texas,
          Oregon, Iowa, Tennessee, Delaware, New Hampshire). See the{' '}
          <a href="/privacy" className="text-blue-600 dark:text-blue-400 underline underline-offset-2">
            US State Privacy Rights
          </a>{' '}
          section of the Privacy Policy for details.
        </li>
        <li>
          We honor browser-based <strong>Global Privacy Control (GPC)</strong>{' '}
          opt-out signals where applicable.
        </li>
      </ul>

      <h2>Changes to this page</h2>
      <p>
        We will update this page when controls materially change. Date
        at the top of the page reflects the most recent revision. For
        meaningful changes, customers on enterprise plans are notified
        by email.
      </p>
    </LegalLayout>
  )
}
