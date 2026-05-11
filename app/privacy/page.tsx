import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/LegalLayout'
import { renderJsx } from '@/lib/legal/render-jsx'
import privacyDoc from '@/lib/legal/content/privacy'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Creator Outreach collects, uses, and protects your data.',
  robots: { index: true, follow: true },
}

export default function PrivacyPage() {
  return (
    <LegalLayout title={privacyDoc.title} lastUpdated={privacyDoc.lastUpdated}>
      {renderJsx(privacyDoc)}
    </LegalLayout>
  )
}
