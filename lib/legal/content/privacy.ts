import type { LegalDoc } from '../types'

const doc: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy Policy',
  lastUpdated: 'May 11, 2026',
  summary: 'How Creator Outreach collects, uses, shares, and protects your personal data.',
  isPublic: true,
  docType: 'Policy',
  docNumber: 'POL-002',
  version: '1.0',
  effectiveDate: 'May 11, 2026',
  owner: 'Founder / CEO',
  status: 'Active',
  intro:
    'This Privacy Policy describes how **Gaynor Media LLC** ("Creator Outreach," "we," or "us") collects, uses, and shares information when you use our website and Service at creatoroutreach.net.\n\nWe follow GDPR (European Union) and CCPA (California) principles regardless of where you live: we collect only what we need, we tell you what we do with it, and we let you delete it.',
  blocks: [
    { type: 'h2', text: '1. Information We Collect' },

    { type: 'h3', text: 'You give us' },
    {
      type: 'ul',
      items: [
        '**Account info** — email address, password (hashed), and any profile fields you fill in (full name, LinkedIn URL, pitch line, etc.).',
        '**Outreach data** — search history, criteria you write, creators you save, email drafts, sent emails, follow-up dates, notes, and outcomes.',
        '**Connected account credentials** — when you connect Gmail, Outlook, LinkedIn, or other accounts via Unipile, we store the OAuth tokens needed to send and read messages on your behalf. We do not see your password.',
        '**Payment info** — handled entirely by Stripe. We never see or store your credit card number; we only receive a token representing the card.',
      ],
    },

    { type: 'h3', text: 'Collected automatically' },
    {
      type: 'ul',
      items: [
        '**Usage data** — pages visited, features used, errors encountered, approximate timing.',
        '**Device data** — IP address, browser type, operating system.',
        '**Cookies and similar technologies** — see our [Cookie Policy](/cookies).',
      ],
    },

    { type: 'h3', text: 'From third parties' },
    {
      type: 'ul',
      items: [
        '**Public creator data** — profile information, public metrics, and emails listed publicly on YouTube, Instagram, TikTok, X, and LinkedIn. We retrieve this through public APIs and search engines.',
        '**Email engagement** — when you send outreach through a connected account, our partner Unipile reports whether the recipient opened or replied.',
      ],
    },

    { type: 'h2', text: '2. How We Use Your Information' },
    {
      type: 'ul',
      items: [
        'To operate, maintain, and improve the Service;',
        'To process payments and manage subscriptions;',
        'To send messages on your behalf using your connected accounts (only when you instruct us to);',
        'To respond to support requests;',
        'To send transactional emails (receipts, password resets, security alerts);',
        'To detect and prevent fraud, abuse, and violations of our Terms;',
        'To analyze aggregate usage to improve features (never tied to individual users in published reports);',
        'To comply with legal obligations.',
      ],
    },
    {
      type: 'p',
      md: '**We do not sell your personal information.** We do not use your outreach data to train AI models. We do not share your data with advertisers.',
    },

    { type: 'h2', text: '3. How We Share Your Information' },
    {
      type: 'p',
      md: 'We share information only with the following categories of recipients, and only as needed to operate the Service:',
    },
    {
      type: 'ul',
      items: [
        '**Supabase** — hosts our database and handles authentication. Data stored in the US.',
        '**Vercel** — hosts our application. Data processed in the US.',
        '**Anthropic** — provides the AI models that score creators and classify replies. Only the relevant text (search queries, reply content) is sent; we never send your email/password or payment info to AI providers.',
        '**Unipile** — provides the unified email and messaging API. They handle OAuth tokens and message delivery.',
        '**Stripe** — processes payments. They receive your name, email, and payment details directly through their hosted checkout.',
        '**Service providers** — analytics, error monitoring, customer support tools.',
        '**Legal authorities** — when required by valid legal process (subpoena, court order). We push back on overbroad requests.',
        '**Business transfers** — in the event of a merger, acquisition, or sale of assets, your data may transfer to the new owner. We will notify you in advance and your rights under this Policy will continue.',
      ],
    },

    { type: 'h2', text: '4. Data Retention' },
    { type: 'p', md: 'We retain your data for the following periods:' },
    {
      type: 'ul',
      items: [
        '**Active accounts** — for as long as your account is open.',
        '**After cancellation** — 90 days, then permanently deleted (except where we are legally required to keep records, such as for tax purposes).',
        '**Outreach logs** — kept for the lifetime of your account plus 90 days.',
        '**Backup copies** — may persist in encrypted backups for up to an additional 30 days after deletion.',
      ],
    },

    { type: 'h2', text: '5. Your Rights' },
    {
      type: 'p',
      md: 'Depending on where you live, you have some or all of the following rights:',
    },
    {
      type: 'ul',
      items: [
        '**Access** — request a copy of the data we hold about you.',
        '**Correction** — fix inaccurate or incomplete data.',
        '**Deletion** — request that we delete your data (also known as the right to be forgotten).',
        '**Portability** — receive your data in a structured, machine-readable format.',
        '**Restriction** — limit how we use your data.',
        '**Objection** — object to processing for direct marketing or legitimate interests.',
        '**Withdraw consent** — withdraw any consent you previously gave (where processing was based on consent).',
        '**Complain** — file a complaint with your local data protection authority.',
      ],
    },
    {
      type: 'p',
      md: 'To exercise any of these rights, email [dmeehanj@gmail.com](mailto:dmeehanj@gmail.com). We will respond within 30 days. Many of these are also self-serve via your account settings.',
    },

    { type: 'h2', text: '6. Your US State Privacy Rights' },
    {
      type: 'p',
      md: 'If you are a resident of a US state with an applicable comprehensive privacy law, you have additional rights described in this section. These laws include the **California Consumer Privacy Act / California Privacy Rights Act (CCPA/CPRA)**, **Virginia Consumer Data Protection Act (VCDPA)**, **Colorado Privacy Act (CPA)**, **Connecticut Data Privacy Act (CTDPA)**, **Utah Consumer Privacy Act (UCPA)**, **Texas Data Privacy and Security Act (TDPSA)**, **Oregon Consumer Privacy Act (OCPA)**, **Iowa Consumer Data Protection Act (IPDPA)**, **Tennessee Information Protection Act (TIPA)**, **Delaware Personal Data Privacy Act (DPDPA)**, and **New Hampshire Privacy Act (NHPDPA)**.',
    },
    {
      type: 'p',
      md: 'Subject to verification and the specifics of your state\'s law, you may have the following rights:',
    },
    {
      type: 'ul',
      items: [
        '**Right to know / access** — confirm whether we process your personal information and request a copy of what we collect.',
        '**Right to delete** — request that we delete personal information we have collected from you.',
        '**Right to correct** — request that we correct inaccurate personal information we hold about you.',
        '**Right to data portability** — receive a copy of your personal information in a portable, machine-readable format.',
        '**Right to opt out of "sale" or "sharing"** — we do not sell your personal information and we do not "share" it for cross-context behavioral advertising as those terms are defined under state law.',
        '**Right to opt out of targeted advertising** — we do not engage in targeted advertising based on your personal information.',
        '**Right to limit the use of sensitive personal information** — we do not use sensitive personal information for purposes beyond what is reasonably necessary to provide the Service.',
        '**Right to opt out of profiling** — we do not use automated decision-making or profiling that produces legal or similarly significant effects about you.',
        '**Right to appeal** — if we deny your privacy rights request, you may appeal that decision by replying to our denial email, and we will respond within the timeframe required by your state\'s law (typically 45 to 60 days).',
        '**Right to non-discrimination** — we will not deny service, charge different prices, or provide a different level of quality because you exercised your privacy rights.',
      ],
    },
    {
      type: 'p',
      md: '**Universal opt-out signals (Global Privacy Control).** Where required by state law (currently California, Colorado, Connecticut, Texas, Oregon, and others as they take effect), we honor browser-based universal opt-out signals such as the **Global Privacy Control (GPC)** as a valid request to opt out of "sale," "sharing," and targeted advertising. Because we do not engage in those activities, the GPC signal does not change our processing, but we recognize and respect the signal.',
    },
    {
      type: 'p',
      md: 'To exercise any of these rights, email [dmeehanj@gmail.com](mailto:dmeehanj@gmail.com) with "US State Privacy Request" and your state of residence in the subject line. We will respond within 30 days (or the timeframe your state\'s law requires, whichever is shorter). We may need to verify your identity before fulfilling the request.',
    },
    {
      type: 'p',
      md: 'You may also designate an authorized agent to make a request on your behalf. We will require written proof of the designation and may require you to verify your identity directly with us before honoring an agent request.',
    },

    { type: 'h3', text: 'Illinois residents' },
    {
      type: 'p',
      md: 'While Illinois has not enacted a comprehensive consumer privacy law, our Privacy Policy practices apply to all U.S. users. Under the **Illinois Personal Information Protection Act (PIPA, 815 ILCS 530)**, we commit to notify affected Illinois residents — and the **Illinois Attorney General** (if 500 or more Illinois residents are affected by a single incident) — without unreasonable delay following a confirmed breach of unencrypted Personal Information. Notification will occur within 45 days of breach discovery, or sooner if directed by the Illinois Attorney General\'s office. To contact us about an Illinois privacy concern, email [dmeehanj@gmail.com](mailto:dmeehanj@gmail.com) or [security@creatoroutreach.net](mailto:security@creatoroutreach.net) and reference "Illinois privacy" in the subject line.',
    },

    { type: 'h2', text: '7. International Data Transfers' },
    {
      type: 'p',
      md: 'Our infrastructure is primarily based in the United States. If you access the Service from outside the US, your data will be transferred to and processed in the US. We rely on Standard Contractual Clauses approved by the European Commission for transfers from the EU/UK to the US.',
    },

    { type: 'h2', text: '8. Security' },
    {
      type: 'p',
      md: 'We use industry-standard measures to protect your data: encryption in transit (TLS), encryption at rest, access controls, two-factor authentication on administrative systems, and regular security reviews. No system is perfectly secure; if a breach affecting your data occurs, we will notify you and the relevant authorities as required by law (within 72 hours under GDPR).',
    },

    { type: 'h2', text: "9. Children's Privacy" },
    {
      type: 'p',
      md: 'The Service is not intended for anyone under 18. We do not knowingly collect personal information from children. If we learn we have collected data from a minor, we will delete it promptly.',
    },

    { type: 'h2', text: '10. Changes to This Policy' },
    {
      type: 'p',
      md: 'We may update this Privacy Policy from time to time. We will post the new version at this URL and update the "Last updated" date above. For material changes, we will notify you by email or in-app notice at least 14 days before the change takes effect.',
    },

    { type: 'h2', text: '11. Contact Us' },
    {
      type: 'p',
      md: 'Privacy questions or data requests? Email [dmeehanj@gmail.com](mailto:dmeehanj@gmail.com).',
    },
    {
      type: 'p',
      md: 'Postal address: **Gaynor Media LLC, [LLC ADDRESS]**.',
    },
  ],
}

export default doc
export { doc }
