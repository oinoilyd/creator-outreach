import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/LegalLayout'
import { renderJsx } from '@/lib/legal/render-jsx'
import cookiesDoc from '@/lib/legal/content/cookies'

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'How Creator Outreach uses cookies and similar technologies.',
  robots: { index: true, follow: true },
}

export default function CookiesPage() {
  return (
    <LegalLayout title={cookiesDoc.title} lastUpdated={cookiesDoc.lastUpdated}>
      {renderJsx(cookiesDoc)}
    </LegalLayout>
  )
}
