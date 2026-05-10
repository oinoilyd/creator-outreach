import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { FilterPreview } from './FilterPreview'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export const dynamic = 'force-dynamic'

/**
 * Filter-bar design preview. Admin-only review tool — render the
 * three candidate visual directions plus the current layout in one
 * tabbed page so Dylan can compare apples-to-apples before committing.
 *
 * Not wired to real search state; each variant uses the same shared
 * snapshot of selections (matches the screenshot Dylan provided) so
 * the only thing varying between tabs is presentation.
 */
export default async function DesignPreviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) notFound()

  return <FilterPreview />
}
