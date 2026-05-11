import type { LegalDoc } from '../types'

const doc: LegalDoc = {
  slug: 'customer-support',
  title: 'Customer Support Policy & SLA',
  lastUpdated: 'May 11, 2026',
  summary: 'How to reach Creator Outreach support and the response times you can expect.',
  isPublic: true,
  intro:
    'We want every Creator Outreach customer to know exactly how to reach us and what to expect when they do. This policy sets out our contact channels, response-time commitments, and the small set of rules that keep support fair for everyone.',
  blocks: [
    { type: 'h2', text: '1. How to Contact Us' },
    {
      type: 'p',
      md: 'Email is our primary support channel.',
    },
    {
      type: 'ul',
      items: [
        '**Primary support inbox:** [support@creatoroutreach.net](mailto:support@creatoroutreach.net) (placeholder — until the dedicated inbox is live, please use the personal address below).',
        '**Active address today:** [dmeehanj@gmail.com](mailto:dmeehanj@gmail.com).',
        'Please write from the email address associated with your Creator Outreach account so we can find you quickly.',
      ],
    },

    { type: 'h2', text: '2. Response Time Commitments' },
    {
      type: 'p',
      md: 'We aim to respond within the windows below. "Business day" means Monday–Friday, excluding US federal holidays (see Section 7).',
    },
    {
      type: 'ul',
      items: [
        '**Standard inquiries** (questions, feature requests, general help) — within **2 business days**.',
        '**Account or billing issues** (payment problems, refund requests, plan changes, login trouble) — within **1 business day**.',
        '**Service-down or data-loss reports** — within **4 hours during business hours**. If you tell us the Service is unavailable for you, we will triage **24/7** as soon as we see the message.',
      ],
    },
    {
      type: 'p',
      md: 'These are targets, not contractual guarantees. We will tell you honestly if a request needs longer.',
    },

    { type: 'h2', text: '3. Business Hours' },
    {
      type: 'p',
      md: 'Standard support hours are **Monday–Friday, 9:00 AM – 6:00 PM Pacific Time**. Outside those hours we still monitor for outage reports and respond as quickly as we reasonably can.',
    },

    { type: 'h2', text: '4. Escalation Path' },
    {
      type: 'p',
      md: 'If you have not heard back within the windows in Section 2, please email us again with **"ESCALATION"** in the subject line. That moves your ticket to the top of the queue and triggers a same-day acknowledgement.',
    },

    { type: 'h2', text: '5. What to Include in a Support Request' },
    {
      type: 'p',
      md: 'You will get a faster, better answer if you include:',
    },
    {
      type: 'ul',
      items: [
        'The email address on your Creator Outreach account.',
        'Your current plan (Free, Pro, etc.).',
        'Browser and operating system (e.g., Chrome 142 on macOS 15).',
        'A screenshot or short screen recording if the issue is visual.',
        'Steps to reproduce — what you clicked, what you expected, what happened instead.',
        'Any error message shown on screen, or the request ID from the bottom of an error page if present.',
      ],
    },

    { type: 'h2', text: '6. Self-Serve Resources' },
    {
      type: 'p',
      md: 'Before opening a ticket, you may find your answer faster in one of these:',
    },
    {
      type: 'ul',
      items: [
        '**Public roadmap** — [/roadmap](/roadmap) shows what we are building and what is shipping next.',
        '**Changelog** — published as new features ship (link will be added here when live).',
        'Your account settings page — plan, billing history, connected accounts, and cancellation can all be self-served.',
      ],
    },

    { type: 'h2', text: '7. Holidays' },
    {
      type: 'p',
      md: 'We observe US federal holidays. Responses on those days, and on the business day immediately following, may be delayed by 1–2 business days relative to the targets in Section 2.',
    },

    { type: 'h2', text: '8. Fair-Use Note' },
    {
      type: 'p',
      md: 'Support is delivered by real people who care about doing right by our customers. To keep that workable, we reserve the right to deprioritize, decline to respond to, or in extreme cases terminate support for tickets that involve:',
    },
    {
      type: 'ul',
      items: [
        'Harassment, threats, or abusive language toward Creator Outreach staff.',
        'Repeated bad-faith disputes, such as filing chargebacks for legitimately rendered services.',
        'Attempts to use support channels to extract proprietary information or technical assistance unrelated to your account.',
      ],
    },
    {
      type: 'p',
      md: 'This is a backstop, not the default. Honest disagreements, frustrated tones, and detailed criticism are all welcome — they make the product better.',
    },

    { type: 'h2', text: '9. Changes to This Policy' },
    {
      type: 'p',
      md: 'We may update this Support Policy as the team grows and as we adopt dedicated support tooling. Material changes will be announced in-app or by email.',
    },

    { type: 'h2', text: '10. Contact' },
    {
      type: 'p',
      md: 'Still stuck? Email [dmeehanj@gmail.com](mailto:dmeehanj@gmail.com) and we will take it from there.',
    },
  ],
}

export default doc
export { doc }
