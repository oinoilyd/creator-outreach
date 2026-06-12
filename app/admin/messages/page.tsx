import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import { AdminMessages } from '@/components/admin/AdminMessages'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export const dynamic = 'force-dynamic'

export default async function AdminMessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) notFound()

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Admin · Messages</h1>
            <p className="text-muted-foreground/80 text-sm mt-1">
              Broadcast site-wide updates or message users one-to-one. Replies land in their in-app inbox.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-4 py-2 transition-colors">
              ← Users
            </Link>
            <Link href="/admin/contact" className="text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-4 py-2 transition-colors">
              Inquiries
            </Link>
            <ThemeToggle />
          </div>
        </div>

        <AdminMessages />
      </div>
    </main>
  )
}
