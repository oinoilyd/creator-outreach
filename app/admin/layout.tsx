import type { Metadata } from 'next'

/**
 * Admin segment layout — attaches `noindex` to every /admin/* page so
 * Googlebot doesn't index operational tooling. Admin auth gate runs
 * per-page (not in the layout) because the existing pattern is to
 * call notFound() from the server page when the user isn't admin —
 * keep that pattern.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
