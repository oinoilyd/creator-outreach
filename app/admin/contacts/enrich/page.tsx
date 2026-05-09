import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EnrichClient } from './EnrichClient'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export const dynamic = 'force-dynamic'

/**
 * /admin/contacts/enrich — re-run the enrichment pipeline against
 * channels already in the cache. Server-renders the auth-gated
 * shell, then drops into EnrichClient for the interactive flow.
 */
export default async function EnrichPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) notFound()

  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Admin · Bulk enrich</h1>
            <p className="text-gray-500 text-sm mt-1">
              Re-run the email-finding pipeline against channels already in the
              cache. Use this to fill in missing emails on rows that came in
              search-only, or to force-refresh stale / bounced ones.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/contacts"
              className="text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg px-4 py-2 transition-colors"
            >
              ← Contacts
            </Link>
          </div>
        </div>

        <EnrichClient />
      </div>
    </main>
  )
}
