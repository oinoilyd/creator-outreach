import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  listTestEnrichmentRows,
  getTestRowCounts,
  TEST_CHANNEL_PREFIXES,
  type EnrichmentLatest,
} from '@/lib/creator-enrichment'
import { formatSubscribers } from '@/lib/format'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export const dynamic = 'force-dynamic'

/**
 * /admin/test-data — view of synthetic rows in creator_enrichment.
 *
 * Service-role smoke checks + automated tests seed rows under three
 * channel-id prefixes (UC_TEST_, mock_, fake_). /api/admin/bulk-enrich
 * filters them out of normal modes so they never hit the live
 * pipeline (those endpoints 400 on synthetic IDs). This tab surfaces
 * them in isolation — useful for:
 *   - confirming that smoke checks ran recently (counts > 0)
 *   - auditing what test data exists
 *   - spotting if a test row accidentally sneaked into a normal mode
 */
export default async function AdminTestDataPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) notFound()

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const limit = 50
  const offset = (page - 1) * limit

  const [counts, listing] = await Promise.all([
    getTestRowCounts(),
    listTestEnrichmentRows({ limit, offset }),
  ])

  const totalAll = TEST_CHANNEL_PREFIXES.reduce((s, p) => s + (counts[p] ?? 0), 0)
  const totalPages = Math.max(1, Math.ceil(listing.total / limit))

  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Admin · Test data</h1>
            <p className="text-gray-500 text-sm mt-1">
              Synthetic rows in <span className="font-mono">creator_enrichment</span> seeded by
              service-role smoke checks. Excluded from <Link href="/admin/contacts" className="text-orange-400 hover:underline">/admin/contacts</Link>{' '}
              and from every bulk-enrich mode.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/admin/contacts"
              className="text-sm rounded-lg px-4 py-2 transition-colors flex items-center gap-2 border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white"
            >
              📇 Contacts
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

        {/* PER-PREFIX COUNTS */}
        <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-2">
          By prefix
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatBox label="Total test rows" value={totalAll.toLocaleString()} accent={totalAll > 0} />
          {TEST_CHANNEL_PREFIXES.map(p => (
            <StatBox
              key={p}
              label={p}
              value={(counts[p] ?? 0).toLocaleString()}
              tone={(counts[p] ?? 0) === 0 ? 'muted' : undefined}
            />
          ))}
        </div>

        {/* EMPTY STATE */}
        {totalAll === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 px-6 py-12 text-center">
            <div className="text-3xl mb-3" aria-hidden>🧪</div>
            <div className="text-sm font-semibold text-gray-300 mb-1">No test data found</div>
            <div className="text-xs text-gray-500 leading-relaxed max-w-md mx-auto">
              Nothing matching <span className="font-mono">UC_TEST_*</span>,{' '}
              <span className="font-mono">mock_*</span>, or{' '}
              <span className="font-mono">fake_*</span> in the cache yet.
              These appear when service-role smoke checks or automated tests run.
            </div>
          </div>
        ) : (
          <>
            <div className="text-xs text-gray-500 mb-3">
              Showing {listing.rows.length} of {listing.total.toLocaleString()} test rows
              {totalPages > 1 && (
                <>
                  {' '}· page {page} of {totalPages}
                </>
              )}
            </div>

            {/* TABLE */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-900/80 text-gray-400">
                    <tr className="border-b border-gray-800">
                      <Th>Prefix</Th>
                      <Th>Channel ID</Th>
                      <Th>Channel name</Th>
                      <Th>Email</Th>
                      <Th>Subs</Th>
                      <Th>Source</Th>
                      <Th>Fetched</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {listing.rows.map(r => (
                      <Row key={`${r.yt_channel_id}-${r.id}`} r={r} />
                    ))}
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
                      href={`/admin/test-data?page=${page - 1}`}
                      className="px-3 py-1.5 rounded-md text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 transition-colors"
                    >
                      ← Prev
                    </Link>
                  )}
                  {page < totalPages && (
                    <Link
                      href={`/admin/test-data?page=${page + 1}`}
                      className="px-3 py-1.5 rounded-md text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 transition-colors"
                    >
                      Next →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* FOOTNOTE */}
        <div className="mt-8 rounded-xl border border-gray-800/60 bg-gray-900/20 p-4 text-[12px] text-gray-400 leading-relaxed">
          <p>
            <span className="text-gray-200 font-semibold">Why these exist:</span>{' '}
            Service-role write-path checks insert a synthetic row periodically to
            verify the cache is reachable + writable. Automated Playwright tests
            also seed mock rows during runs. Real YouTube channel IDs always
            start with <span className="font-mono">UC</span> and are 24 chars —
            anything matching the test prefixes is guaranteed to be synthetic.
          </p>
        </div>
      </div>
    </main>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left font-semibold text-[10px] uppercase tracking-[0.18em] px-4 py-2.5">
      {children}
    </th>
  )
}

function Row({ r }: { r: EnrichmentLatest }) {
  // Identify which prefix this row belongs to so we can render a
  // distinguishing pill (helps Dylan eyeball "are these all from one
  // smoke check or mixed sources?").
  const prefix =
    TEST_CHANNEL_PREFIXES.find(p => r.yt_channel_id?.startsWith(p)) ?? '?'
  const prefixTone =
    prefix === 'UC_TEST_'
      ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
      : prefix === 'mock_'
      ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
      : 'bg-gray-700/40 text-gray-300 border-gray-600/30'

  return (
    <tr className="border-b border-gray-800/60 hover:bg-gray-900/40 transition-colors">
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${prefixTone}`}
        >
          {prefix}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="text-[11px] text-gray-300 font-mono break-all" title={r.yt_channel_id}>
          {r.yt_channel_id}
        </div>
      </td>
      <td className="px-4 py-3 text-gray-200">
        {r.channel_name || <span className="text-gray-600 italic">unnamed</span>}
        {r.niche && <div className="text-[11px] text-gray-500 mt-0.5">{r.niche}</div>}
      </td>
      <td className="px-4 py-3">
        {r.email ? (
          <span
            className={
              r.email_bounced
                ? 'text-red-400 line-through'
                : 'text-emerald-300 break-all'
            }
          >
            {r.email}
          </span>
        ) : (
          <span className="text-gray-600 italic">none</span>
        )}
      </td>
      <td className="px-4 py-3 tabular-nums text-gray-300 whitespace-nowrap">
        {formatSubscribers(r.subscribers != null ? String(r.subscribers) : '')}
      </td>
      <td className="px-4 py-3 text-gray-400 font-mono text-[11px]">{r.email_source ?? '—'}</td>
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
  tone?: 'muted'
}) {
  const valueClass = tone === 'muted'
    ? 'text-gray-600'
    : accent
    ? 'text-orange-400'
    : 'text-white'
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-1 truncate" title={label}>
        {label}
      </div>
      <div className={`text-xl font-semibold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  )
}
