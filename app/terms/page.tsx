import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/LegalLayout'
import { renderJsx } from '@/lib/legal/render-jsx'
import termsDoc from '@/lib/legal/content/terms'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms governing your use of Creator Outreach.',
  robots: { index: true, follow: true },
}

export default function TermsPage() {
  return (
    <LegalLayout title={termsDoc.title} lastUpdated={termsDoc.lastUpdated}>
      {renderJsx(termsDoc)}
    </LegalLayout>
  )
}
