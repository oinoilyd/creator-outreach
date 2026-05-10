import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { EmailTestPanel } from './EmailTestPanel'
import { BenchmarkPanel } from './BenchmarkPanel'
import { LocalDateTime } from '@/components/LocalDateTime'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export interface EmailTestRun {
  id: string
  created_at: string
  query: string
  region: string | null
  strategy: string
  total: number
  with_email: number
  hit_rate: number
  took_ms: number
  notes: string | null
}

export const dynamic = 'force-dynamic'

async function deleteRun(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) redirect('/')
  await supabase.from('email_test_runs').delete().eq('id', id)
  revalidatePath('/admin/email-test')
}

export default async function EmailTestPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) notFound()

  const { data, error } = await supabase
    .from('email_test_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const runs = (data || []) as EmailTestRun[]

  // Aggregate stats per unique strategy combo. Lets you see at-a-glance
  // which configurations are pulling the highest hit rate.
  const byStrategy = new Map<string, { runs: number; total: number; withEmail: number }>()
  for (const r of runs) {
    const acc = byStrategy.get(r.strategy) || { runs: 0, total: 0, withEmail: 0 }
    acc.runs += 1
    acc.total += r.total
    acc.withEmail += r.with_email
    byStrategy.set(r.strategy, acc)
  }
  const strategySummary = [...byStrategy.entries()]
    .map(([strategy, s]) => ({
      strategy,
      runs: s.runs,
      total: s.total,
      withEmail: s.withEmail,
      hitRate: s.total > 0 ? (s.withEmail / s.total) * 100 : 0,
    }))
    .sort((a, b) => b.hitRate - a.hitRate)

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin · Email-test harness</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Run a sandboxed search + enrichment with toggled strategies. Each run records the hit rate so you can compare configurations over time.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground border border-border hover:border-border/80 rounded-lg px-4 py-2 transition-colors">← Users</Link>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground border border-border hover:border-border/80 rounded-lg px-4 py-2 transition-colors">Back to app</Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg p-4 mb-6">
            <div className="text-sm text-red-800 dark:text-red-300 font-medium mb-1">Could not load runs</div>
            <div className="text-xs text-red-700/80 dark:text-red-400/80 mb-2">{error.message}</div>
            <div className="text-xs text-muted-foreground">
              Run <code className="text-foreground">supabase/migrations/0007_email_test_runs.sql</code> in the Supabase SQL editor to create the table.
            </div>
          </div>
        )}

        {/* The interactive run panel — client component */}
        <EmailTestPanel />

        {/* Automated benchmark — fires many runs to compare buckets */}
        <BenchmarkPanel />

        {/* Strategy leaderboard */}
        {strategySummary.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold mb-3">Strategy leaderboard</h2>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Strategy</th>
                    <th className="px-4 py-3 text-right font-medium">Runs</th>
                    <th className="px-4 py-3 text-right font-medium">Creators</th>
                    <th className="px-4 py-3 text-right font-medium">With email</th>
                    <th className="px-4 py-3 text-right font-medium">Hit rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {strategySummary.map((s, i) => (
                    <tr key={s.strategy} className={i === 0 ? 'bg-emerald-50 dark:bg-emerald-500/5' : ''}>
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {i === 0 && <span className="mr-2 text-emerald-700 dark:text-emerald-300">★</span>}
                        {s.strategy || <span className="text-muted-foreground">(none)</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">{s.runs}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">{s.total}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">{s.withEmail}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{s.hitRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Recent runs */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold mb-3">Recent runs</h2>
          {runs.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl py-16 text-center text-muted-foreground text-sm">
              No runs yet — run a search above to start collecting data.
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">When</th>
                    <th className="px-4 py-3 text-left font-medium">Query</th>
                    <th className="px-4 py-3 text-left font-medium">Strategy</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="px-4 py-3 text-right font-medium">w/ Email</th>
                    <th className="px-4 py-3 text-right font-medium">Hit rate</th>
                    <th className="px-4 py-3 text-right font-medium">Took</th>
                    <th className="px-4 py-3 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {runs.map(r => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        <LocalDateTime variant="datetime-short" iso={r.created_at} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{r.query}</div>
                        {r.region && <div className="text-[10px] text-muted-foreground">{r.region}</div>}
                        {r.notes && <div className="text-[10px] text-muted-foreground italic mt-0.5">{r.notes}</div>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground max-w-xs truncate">{r.strategy || '(none)'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.total}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.with_email}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{r.hit_rate.toFixed(1)}%</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground text-xs">{(r.took_ms / 1000).toFixed(1)}s</td>
                      <td className="px-4 py-2.5 text-right">
                        <form action={deleteRun}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="text-xs text-muted-foreground hover:text-red-700 dark:hover:text-red-400 transition-colors" title="Delete this run">
                            ✕
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

