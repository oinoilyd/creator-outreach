import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

interface ContactRow {
  id: string
  created_at: string
  name: string
  email: string
  message: string
  user_agent: string | null
  resolved: boolean
}

export const dynamic = 'force-dynamic'

async function toggleResolved(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const next = formData.get('next') === 'true'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) redirect('/')
  await supabase.from('contact_messages').update({ resolved: next }).eq('id', id)
  revalidatePath('/admin/contact')
  revalidatePath('/admin')
}

export default async function AdminContactPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) notFound()

  const { data, error } = await supabase
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false })

  const rows = (data || []) as ContactRow[]
  const unresolved = rows.filter(r => !r.resolved).length

  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Admin · Contact inbox</h1>
            <p className="text-gray-500 text-sm mt-1">
              {rows.length} total message{rows.length === 1 ? '' : 's'}
              {unresolved > 0 && <span className="ml-2 text-yellow-400">· {unresolved} unresolved</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg px-4 py-2 transition-colors">
              ← Users
            </Link>
            <Link href="/" className="text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg px-4 py-2 transition-colors">
              Back to app
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-900/40 rounded-lg p-4 mb-6">
            <div className="text-sm text-red-300 font-medium mb-1">Could not load messages</div>
            <div className="text-xs text-red-400/80 mb-2">{error.message}</div>
            <div className="text-xs text-gray-400">
              Run <code className="text-gray-300">supabase/migrations/0006_contact_messages.sql</code> in the Supabase SQL editor to create the table.
            </div>
          </div>
        )}

        {!error && rows.length === 0 && (
          <div className="border border-dashed border-gray-800 rounded-xl py-16 text-center text-gray-500 text-sm">
            No messages yet.
          </div>
        )}

        {!error && rows.length > 0 && (
          <div className="space-y-3">
            {rows.map(r => (
              <article
                key={r.id}
                className={`rounded-xl border p-5 transition-colors ${
                  r.resolved
                    ? 'border-gray-800 bg-gray-900/30 opacity-60'
                    : 'border-gray-800 bg-gray-900/60 hover:bg-gray-900/80'
                }`}
              >
                <header className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-semibold text-white">{r.name}</span>
                      <a
                        href={`mailto:${r.email}?subject=${encodeURIComponent(`Re: your message on Creator Outreach`)}`}
                        className="text-sm text-blue-400 hover:underline break-all"
                      >
                        {r.email}
                      </a>
                      {r.resolved && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-500/30 text-emerald-300 bg-emerald-500/10">
                          resolved
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {fmtDate(r.created_at)}
                    </div>
                  </div>
                  <form action={toggleResolved}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="next" value={(!r.resolved).toString()} />
                    <button
                      type="submit"
                      className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                        r.resolved
                          ? 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                          : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
                      }`}
                    >
                      {r.resolved ? 'Reopen' : 'Mark resolved'}
                    </button>
                  </form>
                </header>
                <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed bg-black/30 border border-gray-800 rounded-lg p-3">
                  {r.message}
                </div>
                {r.user_agent && (
                  <div className="text-[10px] text-gray-600 mt-2 truncate" title={r.user_agent}>
                    {r.user_agent}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}
