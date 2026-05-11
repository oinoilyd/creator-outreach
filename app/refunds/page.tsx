import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/LegalLayout'
import { renderJsx } from '@/lib/legal/render-jsx'
import refundsDoc from '@/lib/legal/content/refunds'

export const metadata: Metadata = {
  title: 'Refund Policy',
  description: 'How refunds work at Creator Outreach.',
  robots: { index: true, follow: true },
}

export default function RefundsPage() {
  return (
    <LegalLayout title={refundsDoc.title} lastUpdated={refundsDoc.lastUpdated}>
      {renderJsx(refundsDoc)}
    </LegalLayout>
  )
}
