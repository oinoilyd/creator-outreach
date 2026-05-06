import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

interface UserRow {
  user_id: string
  email: string
  full_name: string | null
  created_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  outreach_count: number
  dismissed_count: number
}

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) notFound()

  const { data, error } = await supabase.rpc('admin_user_summary')
  const rows = (data || []) as UserRow[]

  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Admin · Users</h1>
            <p className="text-gray-500 text-sm mt-1">
              {rows.length} user{rows.length === 1 ? '' : 's'} signed up.
            </p>
          </div>
          <Link href="/" className="text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg px-4 py-2 transition-colors">
            Back to app
          </Link>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-900/40 rounded-lg p-4 mb-6">
            <div className="text-sm text-red-300 font-medium mb-1">Could not load user summary</div>
            <div className="text-xs text-red-400/80 mb-2">{error.message}</div>
            <div className="text-xs text-gray-400">
              Run <code className="text-gray-300">supabase/migrations/0002_admin_summary.sql</code> in the Supabase SQL editor to enable this view.
            </div>
          </div>
        )}

        {!error && rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Signed up</th>
                  <th className="px-4 py-3 text-left font-medium">Last sign in</th>
                  <th className="px-4 py-3 text-left font-medium">Confirmed</th>
                  <th className="px-4 py-3 text-right font-medium">Outreach</th>
                  <th className="px-4 py-3 text-right font-medium">Dismissed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {rows.map(r => (
                  <tr key={r.user_id} className="hover:bg-gray-900/40 transition-colors">
                    <td className="px-4 py-2.5 text-white">{r.email}</td>
                    <td className="px-4 py-2.5 text-gray-300">{r.full_name || <span className="text-gray-600">—</span>}</td>
                    <td className="px-4 py-2.5 text-gray-400">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-2.5 text-gray-400">{r.last_sign_in_at ? fmtDate(r.last_sign_in_at) : <span className="text-gray-600">never</span>}</td>
                    <td className="px-4 py-2.5">
                      {r.email_confirmed_at
                        ? <span className="text-green-400">✓</span>
                        : <span className="text-yellow-500">pending</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-200 font-mono">{r.outreach_count}</td>
                    <td className="px-4 py-2.5 text-right text-gray-200 font-mono">{r.dismissed_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!error && rows.length === 0 && (
          <div className="border border-dashed border-gray-800 rounded-xl py-16 text-center text-gray-500 text-sm">
            No users yet.
          </div>
        )}
      </div>
    </main>
  )
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  const opts: Intl.DateTimeFormatOptions = sameYear
    ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { year: 'numeric', month: 'short', day: 'numeric' }
  return d.toLocaleString(undefined, opts)
}
