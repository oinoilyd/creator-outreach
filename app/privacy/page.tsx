import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/LegalLayout'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Creator Outreach collects, uses, and protects your data.',
  robots: { index: true, follow: true },
}

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="May 11, 2026">
      <p>
        This Privacy Policy describes how <strong>[LLC LEGAL NAME]</strong> (&ldquo;Creator
        Outreach,&rdquo; &ldquo;we,&rdquo; or &ldquo;us&rdquo;) collects, uses, and shares
        information when you use our website and Service at creatoroutreach.net.
      </p>
      <p>
        We follow GDPR (European Union) and CCPA (California) principles regardless of where
        you live: we collect only what we need, we tell you what we do with it, and we let you
        delete it.
      </p>

      <h2>1. Information We Collect</h2>

      <h3>You give us</h3>
      <ul>
        <li><strong>Account info</strong> — email address, password (hashed), and any profile fields you fill in (full name, LinkedIn URL, pitch line, etc.).</li>
        <li><strong>Outreach data</strong> — search history, criteria you write, creators you save, email drafts, sent emails, follow-up dates, notes, and outcomes.</li>
        <li><strong>Connected account credentials</strong> — when you connect Gmail, Outlook, LinkedIn, or other accounts via Unipile, we store the OAuth tokens needed to send and read messages on your behalf. We do not see your password.</li>
        <li><strong>Payment info</strong> — handled entirely by Stripe. We never see or store your credit card number; we only receive a token representing the card.</li>
      </ul>

      <h3>Collected automatically</h3>
      <ul>
        <li><strong>Usage data</strong> — pages visited, features used, errors encountered, approximate timing.</li>
        <li><strong>Device data</strong> — IP address, browser type, operating system.</li>
        <li><strong>Cookies and similar technologies</strong> — see our <a href="/cookies">Cookie Policy</a>.</li>
      </ul>

      <h3>From third parties</h3>
      <ul>
        <li><strong>Public creator data</strong> — profile information, public metrics, and emails listed publicly on YouTube, Instagram, TikTok, X, and LinkedIn. We retrieve this through public APIs and search engines.</li>
        <li><strong>Email engagement</strong> — when you send outreach through a connected account, our partner Unipile reports whether the recipient opened or replied.</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To operate, maintain, and improve the Service;</li>
        <li>To process payments and manage subscriptions;</li>
        <li>To send messages on your behalf using your connected accounts (only when you instruct us to);</li>
        <li>To respond to support requests;</li>
        <li>To send transactional emails (receipts, password resets, security alerts);</li>
        <li>To detect and prevent fraud, abuse, and violations of our Terms;</li>
        <li>To analyze aggregate usage to improve features (never tied to individual users in published reports);</li>
        <li>To comply with legal obligations.</li>
      </ul>
      <p>
        <strong>We do not sell your personal information.</strong> We do not use your outreach
        data to train AI models. We do not share your data with advertisers.
      </p>

      <h2>3. How We Share Your Information</h2>
      <p>
        We share information only with the following categories of recipients, and only as
        needed to operate the Service:
      </p>
      <ul>
        <li><strong>Supabase</strong> — hosts our database and handles authentication. Data stored in the US.</li>
        <li><strong>Vercel</strong> — hosts our application. Data processed in the US.</li>
        <li><strong>Anthropic</strong> — provides the AI models that score creators and classify replies. Only the relevant text (search queries, reply content) is sent; we never send your email/password or payment info to AI providers.</li>
        <li><strong>Unipile</strong> — provides the unified email and messaging API. They handle OAuth tokens and message delivery.</li>
        <li><strong>Stripe</strong> — processes payments. They receive your name, email, and payment details directly through their hosted checkout.</li>
        <li><strong>Service providers</strong> — analytics, error monitoring, customer support tools.</li>
        <li><strong>Legal authorities</strong> — when required by valid legal process (subpoena, court order). We push back on overbroad requests.</li>
        <li><strong>Business transfers</strong> — in the event of a merger, acquisition, or sale of assets, your data may transfer to the new owner. We will notify you in advance and your rights under this Policy will continue.</li>
      </ul>

      <h2>4. Data Retention</h2>
      <p>We retain your data for the following periods:</p>
      <ul>
        <li><strong>Active accounts</strong> — for as long as your account is open.</li>
        <li><strong>After cancellation</strong> — 90 days, then permanently deleted (except where we are legally required to keep records, such as for tax purposes).</li>
        <li><strong>Outreach logs</strong> — kept for the lifetime of your account plus 90 days.</li>
        <li><strong>Backup copies</strong> — may persist in encrypted backups for up to an additional 30 days after deletion.</li>
      </ul>

      <h2>5. Your Rights</h2>
      <p>Depending on where you live, you have some or all of the following rights:</p>
      <ul>
        <li><strong>Access</strong> — request a copy of the data we hold about you.</li>
        <li><strong>Correction</strong> — fix inaccurate or incomplete data.</li>
        <li><strong>Deletion</strong> — request that we delete your data (also known as the right to be forgotten).</li>
        <li><strong>Portability</strong> — receive your data in a structured, machine-readable format.</li>
        <li><strong>Restriction</strong> — limit how we use your data.</li>
        <li><strong>Objection</strong> — object to processing for direct marketing or legitimate interests.</li>
        <li><strong>Withdraw consent</strong> — withdraw any consent you previously gave (where processing was based on consent).</li>
        <li><strong>Complain</strong> — file a complaint with your local data protection authority.</li>
      </ul>
      <p>
        To exercise any of these rights, email{' '}
        <a href="mailto:dmeehanj@gmail.com">dmeehanj@gmail.com</a>. We will respond within 30
        days. Many of these are also self-serve via your account settings.
      </p>

      <h2>6. California Residents (CCPA/CPRA)</h2>
      <p>
        California residents have additional rights including the right to know what personal
        information we collect, the right to delete it, the right to correct it, the right to
        opt out of any &ldquo;sale&rdquo; or &ldquo;sharing&rdquo; (we do not sell or share for
        cross-context behavioral advertising), and the right to non-discrimination for
        exercising these rights. To exercise your California rights, email us at the address
        above with &ldquo;California Privacy Request&rdquo; in the subject line.
      </p>

      <h2>7. International Data Transfers</h2>
      <p>
        Our infrastructure is primarily based in the United States. If you access the Service
        from outside the US, your data will be transferred to and processed in the US. We rely
        on Standard Contractual Clauses approved by the European Commission for transfers from
        the EU/UK to the US.
      </p>

      <h2>8. Security</h2>
      <p>
        We use industry-standard measures to protect your data: encryption in transit (TLS),
        encryption at rest, access controls, two-factor authentication on administrative
        systems, and regular security reviews. No system is perfectly secure; if a breach
        affecting your data occurs, we will notify you and the relevant authorities as required
        by law (within 72 hours under GDPR).
      </p>

      <h2>9. Children&rsquo;s Privacy</h2>
      <p>
        The Service is not intended for anyone under 18. We do not knowingly collect personal
        information from children. If we learn we have collected data from a minor, we will
        delete it promptly.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will post the new version at
        this URL and update the &ldquo;Last updated&rdquo; date above. For material changes, we
        will notify you by email or in-app notice at least 14 days before the change takes
        effect.
      </p>

      <h2>11. Contact Us</h2>
      <p>
        Privacy questions or data requests? Email{' '}
        <a href="mailto:dmeehanj@gmail.com">dmeehanj@gmail.com</a>.
      </p>
      <p>
        Postal address: <strong>[LLC LEGAL NAME], [LLC ADDRESS]</strong>.
      </p>
    </LegalLayout>
  )
}
