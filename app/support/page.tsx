import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/LegalLayout'
import { renderJsx } from '@/lib/legal/render-jsx'
import customerSupportDoc from '@/lib/legal/content/customer-support'

export const metadata: Metadata = {
  title: 'Customer Support',
  description:
    'How to reach Creator Outreach support and the response times you can expect.',
  robots: { index: true, follow: true },
}

export default function SupportPage() {
  return (
    <LegalLayout title={customerSupportDoc.title} lastUpdated={customerSupportDoc.lastUpdated}>
      {renderJsx(customerSupportDoc)}
    </LegalLayout>
  )
}
