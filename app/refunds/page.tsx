import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/LegalLayout'

export const metadata: Metadata = {
  title: 'Refund Policy',
  description: 'How refunds work at Creator Outreach.',
  robots: { index: true, follow: true },
}

export default function RefundsPage() {
  return (
    <LegalLayout title="Refund Policy" lastUpdated="May 11, 2026">
      <p>
        We want you to be happy with Creator Outreach. Here&rsquo;s how refunds work.
      </p>

      <h2>Free trial</h2>
      <p>
        If your plan includes a free trial, you will not be charged until the trial ends. You
        can cancel anytime during the trial from your account settings and you will owe nothing.
      </p>

      <h2>Monthly subscriptions</h2>
      <p>
        Monthly subscriptions are billed in advance and are non-refundable for partial months.
        If you cancel mid-month, your access continues until the end of the current billing
        period, then your subscription stops automatically.
      </p>

      <h2>Annual subscriptions</h2>
      <p>
        Annual subscriptions can be refunded on a pro-rated basis for the unused portion if you
        request within <strong>30 days</strong> of the renewal date. After 30 days, annual
        subscriptions are non-refundable; you keep access until the end of the term.
      </p>

      <h2>First-time charges</h2>
      <p>
        If you were charged unexpectedly (you didn&rsquo;t mean to subscribe, the trial converted
        before you noticed, etc.), email us within <strong>7 days</strong> of the charge and we
        will issue a full refund — no questions asked.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Email <a href="mailto:dmeehanj@gmail.com">dmeehanj@gmail.com</a> from the address
        associated with your account. Include:
      </p>
      <ul>
        <li>Your account email</li>
        <li>The charge date and amount</li>
        <li>The reason (optional, helps us improve)</li>
      </ul>
      <p>
        Approved refunds are processed within 5–10 business days through your original payment
        method.
      </p>

      <h2>Non-refundable situations</h2>
      <ul>
        <li>Accounts terminated for violation of our <a href="/terms">Terms of Service</a>;</li>
        <li>Add-on services or one-time charges (clearly labeled at purchase);</li>
        <li>Annual subscriptions older than 30 days from the most recent renewal;</li>
        <li>Charges incurred before a price change you were notified about.</li>
      </ul>

      <h2>Chargebacks</h2>
      <p>
        Please contact us before filing a chargeback with your bank. We will almost always
        resolve issues directly and much faster than the chargeback process. Filing a
        chargeback without contacting us first may result in account suspension while the
        dispute is investigated.
      </p>

      <h2>Questions?</h2>
      <p>
        Email <a href="mailto:dmeehanj@gmail.com">dmeehanj@gmail.com</a>. We respond within
        1&ndash;2 business days.
      </p>
    </LegalLayout>
  )
}
