import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/LegalLayout'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms governing your use of Creator Outreach.',
  robots: { index: true, follow: true },
}

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="May 11, 2026">
      <p>
        Welcome to Creator Outreach. These Terms of Service (the &ldquo;Terms&rdquo;) govern your access
        to and use of the Creator Outreach website, applications, APIs, and related services
        (collectively, the &ldquo;Service&rdquo;), operated by{' '}
        <strong>[LLC LEGAL NAME]</strong> (&ldquo;Creator Outreach,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us,&rdquo; or &ldquo;our&rdquo;). By creating an account or using the Service, you
        agree to these Terms and to our{' '}
        <a href="/privacy">Privacy Policy</a>. If you do not agree, do not use the Service.
      </p>

      <h2>1. Eligibility &amp; Account</h2>
      <p>
        You must be at least 18 years old and able to form a binding contract to use the Service.
        You are responsible for safeguarding your account credentials and for all activity that
        occurs under your account. Notify us immediately at{' '}
        <a href="mailto:dmeehanj@gmail.com">dmeehanj@gmail.com</a> if you suspect unauthorized
        access.
      </p>

      <h2>2. The Service</h2>
      <p>
        Creator Outreach helps users discover content creators across YouTube, Instagram, TikTok,
        X (Twitter), and LinkedIn, score them against criteria you define, and send outreach
        through your own connected email or messaging accounts. We may add, modify, or remove
        features at any time.
      </p>

      <h2>3. Subscription, Billing &amp; Refunds</h2>
      <p>
        Paid plans are billed in advance on a recurring basis (monthly or annually as selected).
        By subscribing, you authorize us and our payment processor (Stripe) to charge your
        payment method on each renewal until you cancel.
      </p>
      <ul>
        <li>Prices are listed on our pricing page and may change with at least 30 days&rsquo; notice.</li>
        <li>You can cancel anytime from your account settings; cancellation takes effect at the end of the current billing period.</li>
        <li>Refunds are governed by our <a href="/refunds">Refund Policy</a>.</li>
        <li>Failure to pay may result in suspension or termination of your account.</li>
      </ul>

      <h2>4. Your Content &amp; Data</h2>
      <p>
        You retain ownership of any data you upload, generate, or store in the Service (including
        outreach lists, email drafts, and notes). You grant us a limited license to process this
        data solely to operate, maintain, and improve the Service. We do not sell your data.
        See our <a href="/privacy">Privacy Policy</a> for details.
      </p>

      <h2>5. Connected Accounts (Gmail, Outlook, LinkedIn, etc.)</h2>
      <p>
        When you connect a third-party account through our partner Unipile or any other
        integration, you authorize us to send messages, read replies, and track engagement on
        your behalf in accordance with your instructions. You remain responsible for compliance
        with the terms of those third-party services and any applicable anti-spam laws
        (CAN-SPAM, CASL, GDPR, etc.).
      </p>

      <h2>6. Acceptable Use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>Send unsolicited bulk email or messages that violate anti-spam laws;</li>
        <li>Harass, threaten, or impersonate any person or entity;</li>
        <li>Scrape, reverse-engineer, or copy substantial portions of the Service;</li>
        <li>Circumvent rate limits, security controls, or paywalls;</li>
        <li>Upload malware, infringing content, or anything illegal;</li>
        <li>Use the Service to compete directly with Creator Outreach by reselling access.</li>
      </ul>
      <p>
        We may suspend or terminate accounts that violate these rules, with or without notice.
      </p>

      <h2>7. Intellectual Property</h2>
      <p>
        The Service, including all software, design, copy, and branding, is owned by Creator
        Outreach and protected by intellectual property laws. We grant you a non-exclusive,
        non-transferable, revocable license to use the Service for its intended purpose during
        your subscription. You may not redistribute, sublicense, or build a competing product
        on top of it.
      </p>

      <h2>8. Third-Party Services</h2>
      <p>
        The Service integrates with third parties including Supabase (database &amp; auth),
        Anthropic (AI), Unipile (email &amp; messaging), Stripe (payments), Vercel (hosting),
        and the public APIs of the creator platforms we search. We are not responsible for those
        third parties&rsquo; performance, terms, or availability. Your use of those services is
        governed by their respective terms.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        The Service is provided <strong>&ldquo;as is&rdquo;</strong> and <strong>&ldquo;as available.&rdquo;</strong> We disclaim all warranties,
        express or implied, including merchantability, fitness for a particular purpose, and
        non-infringement. We do not warrant that the Service will be uninterrupted, error-free,
        or that data will never be lost. You use the Service at your own risk.
      </p>

      <h2>10. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, Creator Outreach&rsquo;s total liability arising
        out of or relating to these Terms or the Service shall not exceed the greater of (a) the
        amount you paid us in the 12 months preceding the claim, or (b) USD $100. We are not
        liable for indirect, incidental, special, consequential, or punitive damages, including
        lost profits, lost data, or business interruption.
      </p>

      <h2>11. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless Creator Outreach and its officers, employees,
        and affiliates from any claims, damages, or expenses arising from (a) your use of the
        Service, (b) your violation of these Terms, or (c) your violation of any third-party
        rights, including anti-spam laws.
      </p>

      <h2>12. Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or terminate your account
        for breach of these Terms, suspected fraud, or extended inactivity. On termination,
        your access ceases and we may delete your data after a reasonable retention period
        (see <a href="/privacy">Privacy Policy</a>).
      </p>

      <h2>13. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be announced via
        email or in-app notice at least 14 days before they take effect. Your continued use of
        the Service after the effective date constitutes acceptance of the updated Terms.
      </p>

      <h2>14. Governing Law &amp; Disputes</h2>
      <p>
        These Terms are governed by the laws of the State of <strong>[STATE OF INCORPORATION]</strong>,
        United States, without regard to its conflict of law principles. Any disputes will be
        resolved in the state or federal courts located in <strong>[COUNTY, STATE]</strong>, and you
        consent to the jurisdiction of those courts.
      </p>

      <h2>15. Contact</h2>
      <p>
        Questions, concerns, or notices? Email{' '}
        <a href="mailto:dmeehanj@gmail.com">dmeehanj@gmail.com</a>.
      </p>
    </LegalLayout>
  )
}
