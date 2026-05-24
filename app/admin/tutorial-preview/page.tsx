import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { TutorialPreviewClient } from './TutorialPreviewClient'

/**
 * /admin/tutorial-preview — admin-only tool for inspecting each
 * tutorial tier's step list.
 *
 * Why it exists (Dylan 2026-05-24): as new features ship, the
 * tutorial catalog grows. The preview lets you scrub through each
 * tier without re-triggering the first-run flow, see which steps
 * belong to which tier, spot missing data-tour-id anchors in the
 * live DOM, and validate copy before shipping.
 *
 * No state, no persistence — pure read-only inspection over the
 * canonical catalog at lib/tutorial-catalog.ts.
 */

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export const dynamic = 'force-dynamic'

export default async function TutorialPreviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) notFound()

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Tutorial Preview</h1>
            <p className="text-muted-foreground/80 text-sm mt-1">
              Scrub the three tutorial tiers. Inspect copy, check for missing anchors, validate new feature coverage.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm text-muted-foreground hover:text-foreground border border-border hover:border-border rounded-lg px-4 py-2 transition-colors"
          >
            ← Admin
          </Link>
        </div>

        <TutorialPreviewClient />
      </div>
    </main>
  )
}
