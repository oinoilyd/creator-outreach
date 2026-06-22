import type { LegalDoc } from '../types'

const doc: LegalDoc = {
  slug: 'refunds',
  title: 'Refund Policy',
  lastUpdated: 'May 11, 2026',
  summary: 'Trial, monthly, annual, and chargeback refund rules for Creator Outreach.',
  isPublic: true,
  docType: 'Policy',
  docNumber: 'POL-003',
  version: '1.0',
  effectiveDate: 'May 11, 2026',
  owner: 'Founder / CEO',
  status: 'Active',
  intro: 'We want you to be happy with Creator Outreach. Here’s how refunds work.',
  blocks: [
    { type: 'h2', text: 'Free trial' },
    {
      type: 'p',
      md: 'If your plan includes a free trial, you will not be charged until the trial ends. You can cancel anytime during the trial from your account settings and you will owe nothing.',
    },

    { type: 'h2', text: 'Monthly subscriptions' },
    {
      type: 'p',
      md: 'Monthly subscriptions are billed in advance and are non-refundable for partial months. If you cancel mid-month, your access continues until the end of the current billing period, then your subscription stops automatically.',
    },

    { type: 'h2', text: 'Annual subscriptions' },
    {
      type: 'p',
      md: 'Annual subscriptions can be refunded on a pro-rated basis for the unused portion if you request within **30 days** of the renewal date. After 30 days, annual subscriptions are non-refundable; you keep access until the end of the term.',
    },

    { type: 'h2', text: 'First-time charges' },
    {
      type: 'p',
      md: "If you were charged unexpectedly (you didn't mean to subscribe, the trial converted before you noticed, etc.), email us within **7 days** of the charge and we will issue a full refund — no questions asked.",
    },

    { type: 'h2', text: 'How to request a refund' },
    {
      type: 'p',
      md: 'Email [support@creatoroutreach.net](mailto:support@creatoroutreach.net) from the address associated with your account. Include:',
    },
    {
      type: 'ul',
      items: [
        'Your account email',
        'The charge date and amount',
        'The reason (optional, helps us improve)',
      ],
    },
    {
      type: 'p',
      md: 'Approved refunds are processed within 5–10 business days through your original payment method.',
    },

    { type: 'h2', text: 'Non-refundable situations' },
    {
      type: 'ul',
      items: [
        'Accounts terminated for violation of our [Terms of Service](/terms);',
        'Add-on services or one-time charges (clearly labeled at purchase);',
        'Annual subscriptions older than 30 days from the most recent renewal;',
        'Charges incurred before a price change you were notified about.',
      ],
    },

    { type: 'h2', text: 'Chargebacks' },
    {
      type: 'p',
      md: 'Please contact us before filing a chargeback with your bank. We will almost always resolve issues directly and much faster than the chargeback process. Filing a chargeback without contacting us first may result in account suspension while the dispute is investigated.',
    },

    { type: 'h2', text: 'Questions?' },
    {
      type: 'p',
      md: 'Email [support@creatoroutreach.net](mailto:support@creatoroutreach.net). We respond within 1–2 business days.',
    },
  ],
}

export default doc
export { doc }
