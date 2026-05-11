import type { LegalDoc } from '../types'

const doc: LegalDoc = {
  slug: 'terms',
  title: 'Terms of Service',
  lastUpdated: 'May 11, 2026',
  summary: 'Terms governing access to and use of the Creator Outreach service.',
  isPublic: true,
  intro:
    'Welcome to Creator Outreach. These Terms of Service (the "Terms") govern your access to and use of the Creator Outreach website, applications, APIs, and related services (collectively, the "Service"), operated by **[LLC LEGAL NAME]** ("Creator Outreach," "we," "us," or "our"). By creating an account or using the Service, you agree to these Terms and to our [Privacy Policy](/privacy). If you do not agree, do not use the Service.',
  blocks: [
    { type: 'h2', text: '1. Eligibility & Account' },
    {
      type: 'p',
      md: 'You must be at least 18 years old and able to form a binding contract to use the Service. You are responsible for safeguarding your account credentials and for all activity that occurs under your account. Notify us immediately at [dmeehanj@gmail.com](mailto:dmeehanj@gmail.com) if you suspect unauthorized access.',
    },

    { type: 'h2', text: '2. The Service' },
    {
      type: 'p',
      md: 'Creator Outreach helps users discover content creators across YouTube, Instagram, TikTok, X (Twitter), and LinkedIn, score them against criteria you define, and send outreach through your own connected email or messaging accounts. We may add, modify, or remove features at any time.',
    },

    { type: 'h2', text: '3. Subscription, Billing & Refunds' },
    {
      type: 'p',
      md: 'Paid plans are billed in advance on a recurring basis (monthly or annually as selected). By subscribing, you authorize us and our payment processor (Stripe) to charge your payment method on each renewal until you cancel.',
    },
    {
      type: 'ul',
      items: [
        "Prices are listed on our pricing page and may change with at least 30 days' notice.",
        'You can cancel anytime from your account settings; cancellation takes effect at the end of the current billing period.',
        'Refunds are governed by our [Refund Policy](/refunds).',
        'Failure to pay may result in suspension or termination of your account.',
      ],
    },

    { type: 'h2', text: '4. Your Content & Data' },
    {
      type: 'p',
      md: 'You retain ownership of any data you upload, generate, or store in the Service (including outreach lists, email drafts, and notes). You grant us a limited license to process this data solely to operate, maintain, and improve the Service. We do not sell your data. See our [Privacy Policy](/privacy) for details.',
    },

    { type: 'h2', text: '5. Connected Accounts (Gmail, Outlook, LinkedIn, etc.)' },
    {
      type: 'p',
      md: 'When you connect a third-party account through our partner Unipile or any other integration, you authorize us to send messages, read replies, and track engagement on your behalf in accordance with your instructions. You remain responsible for compliance with the terms of those third-party services and any applicable anti-spam laws (CAN-SPAM, CASL, GDPR, etc.).',
    },

    { type: 'h2', text: '6. Acceptable Use' },
    { type: 'p', md: 'You agree not to use the Service to:' },
    {
      type: 'ul',
      items: [
        'Send unsolicited bulk email or messages that violate anti-spam laws;',
        'Harass, threaten, or impersonate any person or entity;',
        'Scrape, reverse-engineer, or copy substantial portions of the Service;',
        'Circumvent rate limits, security controls, or paywalls;',
        'Upload malware, infringing content, or anything illegal;',
        'Use the Service to compete directly with Creator Outreach by reselling access.',
      ],
    },
    {
      type: 'p',
      md: 'We may suspend or terminate accounts that violate these rules, with or without notice.',
    },

    { type: 'h2', text: '7. Intellectual Property' },
    {
      type: 'p',
      md: 'The Service, including all software, design, copy, and branding, is owned by Creator Outreach and protected by intellectual property laws. We grant you a non-exclusive, non-transferable, revocable license to use the Service for its intended purpose during your subscription. You may not redistribute, sublicense, or build a competing product on top of it.',
    },

    { type: 'h2', text: '8. Third-Party Services' },
    {
      type: 'p',
      md: "The Service integrates with third parties including Supabase (database & auth), Anthropic (AI), Unipile (email & messaging), Stripe (payments), Vercel (hosting), and the public APIs of the creator platforms we search. We are not responsible for those third parties' performance, terms, or availability. Your use of those services is governed by their respective terms.",
    },

    { type: 'h2', text: '9. Disclaimers' },
    {
      type: 'p',
      md: 'The Service is provided **"as is"** and **"as available."** We disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or that data will never be lost. You use the Service at your own risk.',
    },

    { type: 'h2', text: '10. Limitation of Liability' },
    {
      type: 'p',
      md: "To the maximum extent permitted by law, Creator Outreach's total liability arising out of or relating to these Terms or the Service shall not exceed the greater of (a) the amount you paid us in the 12 months preceding the claim, or (b) USD $100. We are not liable for indirect, incidental, special, consequential, or punitive damages, including lost profits, lost data, or business interruption.",
    },

    { type: 'h2', text: '11. Indemnification' },
    {
      type: 'p',
      md: 'You agree to indemnify and hold harmless Creator Outreach and its officers, employees, and affiliates from any claims, damages, or expenses arising from (a) your use of the Service, (b) your violation of these Terms, or (c) your violation of any third-party rights, including anti-spam laws.',
    },

    { type: 'h2', text: '12. Termination' },
    {
      type: 'p',
      md: 'You may stop using the Service at any time. We may suspend or terminate your account for breach of these Terms, suspected fraud, or extended inactivity. On termination, your access ceases and we may delete your data after a reasonable retention period (see [Privacy Policy](/privacy)).',
    },

    { type: 'h2', text: '13. Changes to These Terms' },
    {
      type: 'p',
      md: 'We may update these Terms from time to time. Material changes will be announced via email or in-app notice at least 14 days before they take effect. Your continued use of the Service after the effective date constitutes acceptance of the updated Terms.',
    },

    { type: 'h2', text: '14. Governing Law & Disputes' },
    {
      type: 'p',
      md: 'These Terms are governed by the laws of the State of **[STATE OF INCORPORATION]**, United States, without regard to its conflict of law principles. Any disputes will be resolved in the state or federal courts located in **[COUNTY, STATE]**, and you consent to the jurisdiction of those courts.',
    },

    { type: 'h2', text: '15. Contact' },
    {
      type: 'p',
      md: 'Questions, concerns, or notices? Email [dmeehanj@gmail.com](mailto:dmeehanj@gmail.com).',
    },
  ],
}

export default doc
export { doc }
