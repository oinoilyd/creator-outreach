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
    <main className="h-[calc(100vh-2.75rem)] flex flex-col bg-background text-foreground overflow-hidden">
      <header className="shrink-0 h-14 px-4 sm:px-5 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-sm shadow-blue-500/30 text-[13px]" aria-hidden>✉</span>
          <h1 className="text-[15px] font-bold tracking-tight">Messages</h1>
          <span className="hidden md:inline text-[12px] text-muted-foreground/70">Broadcasts &amp; member conversations</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Link href="/admin" className="text-[12.5px] text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors">← Admin</Link>
          <Link href="/admin/contact" className="text-[12.5px] text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors">Inquiries</Link>
          <ThemeToggle />
        </div>
      </header>
      <div className="flex-1 min-h-0">
        <AdminMessages />
      </div>
    </main>
  )
}
