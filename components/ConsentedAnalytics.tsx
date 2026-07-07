'use client'

/**
 * ConsentedAnalytics — loads Vercel Web Analytics unless the visitor has
 * explicitly rejected non-essential cookies via the CookieConsent banner.
 *
 * Vercel Web Analytics is cookieless and collects no personal data, so an
 * opt-out model (load unless rejected) is appropriate and legally
 * defensible — but this makes the banner's "Reject non-essential" button
 * actually do something, which the bare <Analytics/> mount did not.
 * (Security/compliance audit 2026-07-07.)
 *
 * Reacts live to the choice: the banner dispatches `cookie-consent-changed`
 * on click, and we also listen for cross-tab `storage` events — so a reject
 * unmounts analytics immediately, no reload needed.
 */
import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/next'

const STORAGE_KEY = 'cookie-consent'

export function ConsentedAnalytics() {
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const read = () => {
      try {
        setAllowed(window.localStorage.getItem(STORAGE_KEY) !== 'rejected')
      } catch {
        setAllowed(true)
      }
    }
    read()
    window.addEventListener('storage', read)
    window.addEventListener('cookie-consent-changed', read)
    return () => {
      window.removeEventListener('storage', read)
      window.removeEventListener('cookie-consent-changed', read)
    }
  }, [])

  return allowed ? <Analytics /> : null
}
