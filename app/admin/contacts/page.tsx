import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getEnrichmentStats,
  listEnrichmentLatest,
  checkEnrichmentHealth,
  type EnrichmentLatest,
} from '@/lib/creator-enrichment'
import { cacheReadCounterRange } from '@/lib/cache'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export const dynamic = 'force-dynamic'

/**
 * /admin/contacts — durable enrichment cache browser.
 *
 * Shows the latest snapshot per channel from creator_enrichment_latest.
 * Search box filters by email / channel name / handles.
 *
 * Phase 1 of the durable cache (2026-05-08): every successful
 * /api/enrich call appends a snapshot. This page is the operator's
 * window into what's accumulating.
 */
export default async function AdminContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; src?: string; page?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) notFound()

  const params = await searchParams
  const q = (params.q ?? '').trim()
  const src = (params.src ?? '').trim()
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const limit = 50
  const offset = (page - 1) * limit

  const [health, stats, listing, l1Hits24h, l2Hits24h, missCold24h, missStale24h] = await Promise.all([
    checkEnrichmentHealth(),
    getEnrichmentStats(),
    listEnrichmentLatest({ search: q || undefined, source: src || undefined, limit, offset }),
    cacheReadCounterRange('enrich:hit:l1', 1),
    cacheReadCounterRange('enrich:hit:l2', 1),
    cacheReadCounterRange('enrich:miss:l2-cold', 1),
    cacheReadCounterRange('enrich:miss:l2-stale', 1),
  ])

  // Hit rate %: (l1 + l2) / (l1 + l2 + cold + stale)
  const cacheHits24h = l1Hits24h + l2Hits24h
  const cacheTotal24h = cacheHits24h + missCold24h + missStale24h
  const hitRatePct = cacheTotal24h > 0 ? Math.round((cacheHits24h / cacheTotal24h) * 100) : null
  const liveFetchesSaved = l2Hits24h // L2 hits = saved live pipeline runs

  const totalPages = Math.max(1, Math.ceil(listing.total / limit))

  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Admin · Contacts cache</h1>
            <p className="text-gray-500 text-sm mt-1">
              Durable email + social enrichment, append-only per channel.
              Phase 1 (build the corpus) shipped 2026-05-08.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/admin/contacts/seed"
              className="text-sm rounded-lg px-4 py-2 transition-colors flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold"
            >
              ⚡ Bulk seed
            </Link>
            <Link
              href="/admin"
              className="text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg px-4 py-2 transition-colors"
            >
              ← Admin home
            </Link>
            <Link
              href="/"
              className="text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg px-4 py-2 transition-colors"
            >
              Back to app
            </Link>
          </div>
        </div>

        {/* HEALTH BANNER — surfaces the most common failure modes
            (migration not run, service-role missing) loudly so they
            don't cause silent zero-rows behavior. */}
        {!health.ok && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 mb-6 flex items-start gap-3">
            <span className="mt-0.5 text-xl" aria-hidden>⚠️</span>
            <div className="flex-1">
              <div className="text-sm font-bold text-red-300 mb-1">
                Cache is broken — writes are failing silently
              </div>
              <div className="text-sm text-red-200/90 leading-relaxed mb-2">{health.error}</div>
              {!health.tableExists && health.serviceRoleConfigured && (
                <div className="text-xs text-red-200/70 mt-2">
                  Fix:&nbsp;
                  <span className="font-mono text-red-100">
                    Supabase dashboard → SQL editor → paste contents of{' '}
                    <code className="px-1 py-0.5 rounded bg-red-500/20">supabase/migrations/0011_creator_enrichment.sql</code>{' '}
                    → run.
                  </span>
                </div>
              )}
              {!health.serviceRoleConfigured && (
                <div className="text-xs text-red-200/70 mt-2">
                  Fix:&nbsp;
                  <span className="font-mono text-red-100">
                    Vercel project → settings → environment variables → add{' '}
                    <code className="px-1 py-0.5 rounded bg-red-500/20">SUPABASE_SERVICE_ROLE_KEY</code>{' '}
                    → redeploy.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        {health.ok && health.rowCount === 0 && (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 mb-6 flex items-start gap-3">
            <span className="mt-0.5 text-xl" aria-hidden>ℹ️</span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-yellow-200 mb-1">
                Cache is healthy but empty
              </div>
              <div className="text-xs text-yellow-200/75 leading-relaxed">
                Table exists, service role configured, just no rows yet. Run a bulk-seed batch or
                do a few searches in the app to start populating.
              </div>
            </div>
          </div>
        )}

        {/* CORPUS STATS */}
        <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-2">Corpus</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatBox label="Total channels" value={stats.total.toLocaleString()} />
          <StatBox label="With email" value={stats.withEmail.toLocaleString()} accent />
          <StatBox label="Bounced" value={stats.bouncedCount.toLocaleString()} tone="warn" />
          <StatBox label="Snapshots · 7d" value={stats.fetchedLast7d.toLocaleString()} />
          <StatBox label="Snapshots · 24h" value={stats.fetchedLast24h.toLocaleString()} />
        </div>

        {/* CACHE-HIT METRICS — Phase 2 read path performance.
            L1 = Redis hit (sub-10ms), L2 = Postgres hit (sub-50ms;
            saves a 5-12s live pipeline run). */}
        <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-2">
          Cache hit rate · last 24h
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <StatBox
            label="Hit rate"
            value={hitRatePct == null ? '—' : `${hitRatePct}%`}
            accent={hitRatePct != null && hitRatePct >= 50}
          />
          <StatBox label="L1 (Redis)" value={l1Hits24h.toLocaleString()} />
          <StatBox label="L2 (Postgres)" value={l2Hits24h.toLocaleString()} accent={l2Hits24h > 0} />
          <StatBox label="Live fetches saved" value={liveFetchesSaved.toLocaleString()} />
          <StatBox
            label="Misses (cold + stale)"
            value={(missCold24h + missStale24h).toLocaleString()}
          />
        </div>

        {/* SEARCH + FILTER */}
        <form method="get" className="flex flex-wrap items-center gap-2 mb-5">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search email, name, handle…"
            className="flex-1 min-w-[260px] px-3 py-2 rounded-md bg-gray-900 border border-gray-800 text-sm placeholder:text-gray-600 focus:outline-none focus:border-gray-600"
          />
          <select
            name="src"
            defaultValue={src}
            className="px-3 py-2 rounded-md bg-gray-900 border border-gray-800 text-sm focus:outline-none focus:border-gray-600"
          >
            <option value="">Any source</option>
            <option value="youtube_about">youtube_about</option>
            <option value="ddg">ddg</option>
            <option value="web_scrape">web_scrape</option>
            <option value="biolink">biolink</option>
            <option value="bio_pages">bio_pages</option>
            <option value="wayback">wayback</option>
            <option value="domain_guess">domain_guess</option>
            <option value="manual">manual</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 rounded-md text-sm font-semibold bg-orange-600 hover:bg-orange-500 transition-colors"
          >
            Search
          </button>
          {(q || src) && (
            <Link
              href="/admin/contacts"
              className="px-3 py-2 rounded-md text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 transition-colors"
            >
              Reset
            </Link>
          )}
        </form>

        <div className="text-xs text-gray-500 mb-3">
          Showing {listing.rows.length} of {listing.total.toLocaleString()} channels
          {q && (
            <>
              {' '}· filter: <span className="font-mono">&quot;{q}&quot;</span>
            </>
          )}
          {src && (
            <>
              {' '}· source: <span className="font-mono">{src}</span>
            </>
          )}
        </div>

        {/* TABLE */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/80 text-gray-400">
                <tr className="border-b border-gray-800">
                  <Th>Channel</Th>
                  <Th>Email</Th>
                  <Th>Source</Th>
                  <Th>Subs</Th>
                  <Th>Avg views</Th>
                  <Th>Socials</Th>
                  <Th>Fetched</Th>
                </tr>
              </thead>
              <tbody>
                {listing.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      {q || src
                        ? 'No matches. Try clearing filters.'
                        : 'No contacts cached yet — run a few searches in the app and snapshots will appear here.'}
                    </td>
                  </tr>
                ) : (
                  listing.rows.map(r => <Row key={`${r.yt_channel_id}-${r.id}`} r={r} />)
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="mt-5 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link
                  href={buildHref({ q, src, page: page - 1 })}
                  className="px-3 py-1.5 rounded-md text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 transition-colors"
                >
                  ← Prev
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildHref({ q, src, page: page + 1 })}
                  className="px-3 py-1.5 rounded-md text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 transition-colors"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function buildHref({ q, src, page }: { q: string; src: string; page: number }) {
  const sp = new URLSearchParams()
  if (q) sp.set('q', q)
  if (src) sp.set('src', src)
  if (page > 1) sp.set('page', String(page))
  const qs = sp.toString()
  return `/admin/contacts${qs ? `?${qs}` : ''}`
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left font-semibold text-[10px] uppercase tracking-[0.18em] px-4 py-2.5">
      {children}
    </th>
  )
}

function Row({ r }: { r: EnrichmentLatest }) {
  const handles: { label: string; href: string | null }[] = [
    { label: 'IG', href: r.instagram_handle ? `https://instagram.com/${r.instagram_handle.replace('@', '')}` : null },
    { label: 'X', href: r.twitter_handle ? `https://x.com/${r.twitter_handle.replace('@', '')}` : null },
    { label: 'in', href: r.linkedin_url || null },
    { label: '🌐', href: r.website || null },
  ]
  return (
    <tr className="border-b border-gray-800/60 hover:bg-gray-900/40 transition-colors">
      <td className="px-4 py-3">
        <div className="font-semibold text-white">{r.channel_name || <span className="text-gray-600">—</span>}</div>
        <div className="text-[11px] text-gray-500 font-mono mt-0.5">{r.yt_channel_id}</div>
        {r.niche && <div className="text-[11px] text-gray-600 mt-0.5">{r.niche}</div>}
      </td>
      <td className="px-4 py-3">
        {r.email ? (
          <span className={r.email_bounced ? 'text-red-400 line-through' : 'text-emerald-300'}>
            {r.email}
          </span>
        ) : (
          <span className="text-gray-600 italic">none</span>
        )}
      </td>
      <td className="px-4 py-3 text-gray-400 font-mono text-[11px]">{r.email_source ?? '—'}</td>
      <td className="px-4 py-3 tabular-nums text-gray-300">{r.subscribers != null ? Number(r.subscribers).toLocaleString() : '—'}</td>
      <td className="px-4 py-3 tabular-nums text-gray-300">{r.avg_views != null ? Number(r.avg_views).toLocaleString() : '—'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {handles.map(h =>
            h.href ? (
              <a
                key={h.label}
                href={h.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold border border-gray-800 hover:border-gray-600 text-gray-400 hover:text-white"
              >
                {h.label}
              </a>
            ) : null,
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-[11px] text-gray-400 whitespace-nowrap">
        {formatRelative(r.fetched_at)}
      </td>
    </tr>
  )
}

function formatRelative(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  const diff = Date.now() - t
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function StatBox({
  label,
  value,
  accent,
  tone,
}: {
  label: string
  value: string
  accent?: boolean
  tone?: 'warn'
}) {
  const valueClass = tone === 'warn'
    ? 'text-yellow-300'
    : accent
    ? 'text-orange-400'
    : 'text-white'
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-1">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  )
}
