import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SeedClient } from './SeedClient'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export const dynamic = 'force-dynamic'

/**
 * /admin/contacts/seed — bulk-seed the contacts cache.
 *
 * Server-side gate (admin-only), then renders the client form.
 * The client component handles the textarea + run button + live
 * progress and POSTs to /api/admin/bulk-seed.
 */
export default async function BulkSeedPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) notFound()

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Admin · Bulk seed</h1>
            <p className="text-muted-foreground/80 text-sm mt-1">
              Paste search queries (one per line). Each runs through
              /api/search server-side and snapshots every channel into
              creator_enrichment. Toggle &quot;also enrich&quot; to chase
              emails for every result (slower).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/contacts"
              className="text-sm text-muted-foreground hover:text-foreground border border-border hover:border-border rounded-lg px-4 py-2 transition-colors"
            >
              ← Contacts
            </Link>
          </div>
        </div>

        <SeedClient />
      </div>
    </main>
  )
}
