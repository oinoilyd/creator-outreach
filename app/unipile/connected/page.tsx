/**
 * /unipile/connected — landing page after Unipile's hosted OAuth flow.
 *
 * Unipile redirects users here with ?status=success or ?status=fail.
 * The actual account link comes via /api/unipile/webhook, which may
 * race the redirect — so the client view polls /api/unipile/me until
 * the link shows up (or times out at ~21s with a "still pending"
 * fallback).
 *
 * This file is a server component that forces dynamic rendering and
 * wraps the client view in a Suspense boundary, because the client
 * uses useSearchParams() and Next.js complains if it can be statically
 * rendered.
 */

import { Suspense } from 'react'
import ConnectedView from './ConnectedView'

export const dynamic = 'force-dynamic'

export default function UnipileConnectedPage() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <Suspense
        fallback={
          <div className="max-w-md w-full rounded-2xl border border-border bg-card/40 p-8 text-center shadow-sm">
            <div className="text-4xl mb-3" aria-hidden>⏳</div>
            <h1 className="text-lg font-semibold mb-2">Loading…</h1>
          </div>
        }
      >
        <ConnectedView />
      </Suspense>
    </main>
  )
}
