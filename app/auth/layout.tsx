import type { Metadata } from 'next'

/**
 * Auth segment layout — exists solely to attach `noindex` metadata to
 * every page under /auth (signin, signup, check-email, forgot-password,
 * reset-password). Without this, Googlebot follows redirects into the
 * sign-in page and may surface it as the canonical product URL,
 * burying the real landing page in search results.
 *
 * Pass-through layout: all visual structure stays on the individual
 * pages.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
