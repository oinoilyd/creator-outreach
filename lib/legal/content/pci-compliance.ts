import type { LegalDoc } from '../types'

const doc: LegalDoc = {
  slug: 'pci-compliance',
  title: 'PCI Compliance Procedure',
  lastUpdated: 'May 11, 2026',
  summary: 'Internal procedure for maintaining PCI DSS SAQ A compliance via Stripe.',
  isPublic: false,
  intro:
    'This procedure defines how Creator Outreach maintains Payment Card Industry Data Security Standard (PCI DSS) compliance. We qualify for **Self-Assessment Questionnaire A (SAQ A)** because we fully outsource card processing to Stripe and never see, store, process, or transmit raw cardholder data on our own systems.',
  blocks: [
    { type: 'h2', text: '1. Purpose' },
    {
      type: 'p',
      md: 'To document the controls and recurring tasks that keep Creator Outreach within PCI DSS SAQ A scope, and to define what we do if scope ever expands.',
    },

    { type: 'h2', text: '2. Scope' },
    {
      type: 'p',
      md: 'This procedure applies to every part of Creator Outreach that touches, displays, or routes payment-card data. Today that means only:',
    },
    {
      type: 'ul',
      items: [
        'Stripe Checkout (hosted by Stripe) used for new subscriptions and upgrades.',
        'Stripe Customer Portal (hosted by Stripe) used for card updates and cancellation.',
        'Stripe webhooks that notify us of subscription state changes (no card data in payload).',
      ],
    },
    {
      type: 'p',
      md: 'Any future change that introduces a Stripe Elements iframe, a card-on-file form, or any other surface where card data flows through code we own brings additional PCI scope and triggers Section 7 (Change Management).',
    },

    { type: 'h2', text: '3. Policy Statement' },
    {
      type: 'ul',
      items: [
        '**We never touch raw cardholder data.** PAN, CVV, expiry, and cardholder name flow only between the customer and Stripe.',
        'All card-capture surfaces are Stripe-hosted (Checkout) or Stripe-Elements iframes loaded directly from Stripe origins.',
        'We never log, cache, or persist any field that could be considered cardholder data under PCI DSS.',
        'Our database stores only Stripe identifiers (`cus_*`, `sub_*`, `pi_*`) and the last four digits of the card brand for display — retrieved from Stripe, not captured by us.',
      ],
    },

    { type: 'h2', text: '4. Procedure' },
    { type: 'h3', text: '4.1 Annual SAQ A Attestation' },
    {
      type: 'ul',
      items: [
        'Log in to the Stripe Dashboard each calendar year on or before the anniversary of the previous attestation.',
        'Navigate to **Compliance › PCI Compliance** and complete the SAQ A questionnaire as prompted.',
        'Confirm that no checkbox triggers a higher-scope SAQ (A-EP, D, etc.). If any answer would change the SAQ tier, stop and escalate per Section 7.',
        'Download the signed Attestation of Compliance (AOC) PDF and store it in the evidence folder (Section 6).',
      ],
    },
    { type: 'h3', text: '4.2 Quarterly Self-Review' },
    {
      type: 'ul',
      items: [
        'Confirm Stripe Checkout / Elements is still the only card-capture mechanism.',
        'Search the repository for any new card-related fields, regex, or storage. (`pan`, `cvv`, `card_number`, `cardnumber`, etc.).',
        'Confirm CSP rules still restrict script and frame sources to Stripe origins on payment pages.',
        'Confirm no card-data-bearing log lines exist in Vercel or Supabase logs (sample at least one week of payment activity).',
      ],
    },
    { type: 'h3', text: '4.3 Breach Notification (PCI-relevant)' },
    {
      type: 'ul',
      items: [
        'If any event suggests card data may have been exposed (e.g., a stored XSS on a payment page, a leaked CSP, a Stripe-side incident notification), notify Stripe support **immediately** and freeze deploys to payment paths.',
        'Notify affected cardholders and the relevant card brands within the timelines required by their breach notification rules.',
        "Cooperate fully with Stripe's incident response and any forensic investigation they require.",
      ],
    },

    { type: 'h2', text: '5. Roles & Responsibilities' },
    {
      type: 'ul',
      items: [
        '**CEO / Founder (Dylan Meehan)** — signs and submits the annual SAQ A in the Stripe dashboard. Owns the evidence folder. Final approver of any scope-changing release.',
        '**CEO / Founder** also performs the quarterly self-review until a dedicated security owner is hired.',
        '**Any engineer** — must flag scope changes before merging code that touches payment flows.',
      ],
    },

    { type: 'h2', text: '6. Evidence Retention' },
    {
      type: 'ul',
      items: [
        'Retain every signed SAQ A AOC, quarterly self-review note, and PCI-related communication for a **minimum of 3 years**.',
        'Store evidence in a private, access-controlled folder (e.g., `legal/pci/<year>/`) with no public-internet exposure.',
        'Evidence must be available within 24 hours on request from Stripe, an acquirer, or a card brand.',
      ],
    },

    { type: 'h2', text: '7. Change Management & PCI Scope Re-Review' },
    {
      type: 'p',
      md: 'Any code change that handles, displays, or routes card data triggers a PCI scope re-review **before** it ships to production. The change author must:',
    },
    {
      type: 'ul',
      items: [
        'Open a PR titled with the prefix `[pci-scope]`.',
        'Tag the CEO / Founder as a required reviewer.',
        'Describe the data flow, including where cardholder data enters and exits the system.',
        'Confirm whether the change keeps us in SAQ A scope or pushes us into SAQ A-EP or higher.',
        'If scope expands, halt the merge and update this procedure plus the Stripe SAQ tier **before** rollout.',
      ],
    },

    { type: 'h2', text: '8. Review Cadence' },
    {
      type: 'p',
      md: 'This procedure is reviewed annually alongside the SAQ A attestation. Any material change to the payment stack also triggers an out-of-band review.',
    },
  ],
}

export default doc
export { doc }
