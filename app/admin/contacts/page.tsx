import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AuditMenu } from '@/components/admin/AuditMenu'
import {
  getEnrichmentStats,
  listEnrichmentLatest,
  checkEnrichmentHealth,
  SORTABLE_COLUMNS,
  type EnrichmentLatest,
  type SortColumn,
} from '@/lib/creator-enrichment'
import { cacheReadCounterRange } from '@/lib/cache'
import { formatSubscribers } from '@/lib/format'

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
  searchParams: Promise<{ q?: string; src?: string; page?: string; sort?: string; dir?: string }>
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

  // Sort params — validated against the SORTABLE_COLUMNS whitelist
  // so a malformed URL doesn't break the page or open an injection
  // hole. Default sort is fetched_at desc (most-recently-cached first).
  const sortRaw = (params.sort ?? '').trim()
  const sort: SortColumn = (SORTABLE_COLUMNS as readonly string[]).includes(sortRaw)
    ? (sortRaw as SortColumn)
    : 'fetched_at'
  const dir: 'asc' | 'desc' = params.dir === 'asc' ? 'asc' : 'desc'

  const [health, stats, listing, l1Hits24h, l2Hits24h, missCold24h, missStale24h] = await Promise.all([
    checkEnrichmentHealth(),
    getEnrichmentStats(),
    listEnrichmentLatest({ search: q || undefined, source: src || undefined, sort, dir, limit, offset }),
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

  // Email present rate — what % of the corpus has a usable email.
  // Bounced rows are excluded from the numerator since they're known
  // bad. This is the headline KPI for "how well is enrichment
  // actually converting raw channels into actionable contacts?"
  const usableEmail = Math.max(0, stats.withEmail - stats.bouncedCount)
  const emailPresentPct = stats.total > 0
    ? Math.round((usableEmail / stats.total) * 100)
    : null

  const totalPages = Math.max(1, Math.ceil(listing.total / limit))

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Admin · Contacts cache</h1>
            <p className="text-muted-foreground/80 text-sm mt-1">
              Durable email + social enrichment, append-only per channel.
              Phase 1 (build the corpus) shipped 2026-05-08.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/admin/contacts/seed"
              className="text-sm rounded-lg px-4 py-2 transition-colors flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-foreground font-semibold"
            >
              ⚡ Bulk seed
            </Link>
            <Link
              href="/admin/contacts/enrich"
              className="text-sm rounded-lg px-4 py-2 transition-colors flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-foreground font-semibold"
            >
              ⚙️ Enrich
            </Link>
            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:text-foreground border border-border hover:border-border rounded-lg px-4 py-2 transition-colors"
            >
              ← Admin home
            </Link>
            <AuditMenu />
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground border border-border hover:border-border rounded-lg px-4 py-2 transition-colors"
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
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-bold mb-2">Corpus</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <StatBox label="Total channels" value={stats.total.toLocaleString()} />
          <StatBox label="With email" value={stats.withEmail.toLocaleString()} accent />
          <StatBox
            label="Email present"
            value={emailPresentPct == null ? '—' : `${emailPresentPct}%`}
            sublabel={
              stats.total > 0
                ? `${usableEmail.toLocaleString()} of ${stats.total.toLocaleString()} usable`
                : 'no data yet'
            }
            accent={emailPresentPct != null && emailPresentPct >= 50}
            tone={emailPresentPct != null && emailPresentPct < 25 ? 'warn' : undefined}
          />
          <StatBox label="Bounced" value={stats.bouncedCount.toLocaleString()} tone="warn" />
          <StatBox label="Snapshots · 7d" value={stats.fetchedLast7d.toLocaleString()} />
          <StatBox label="Snapshots · 24h" value={stats.fetchedLast24h.toLocaleString()} />
        </div>

        {/* CACHE-HIT METRICS — Phase 2 read path performance.
            L1 = Redis hit (sub-10ms), L2 = Postgres hit (sub-50ms;
            saves a 5-12s live pipeline run). */}
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-bold mb-2">
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
            className="flex-1 min-w-[260px] px-3 py-2 rounded-md bg-card border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-border"
          />
          <select
            name="src"
            defaultValue={src}
            className="px-3 py-2 rounded-md bg-card border border-border text-sm focus:outline-none focus:border-border"
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
              className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground border border-border hover:border-border transition-colors"
            >
              Reset
            </Link>
          )}
        </form>

        <div className="text-xs text-muted-foreground/80 mb-3">
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
        <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-card/80 text-muted-foreground">
                <tr className="border-b border-border">
                  {/* YT + Socials aren't sortable (they're action
                      columns). Everything else has a clickable
                      header that toggles asc/desc and routes via
                      URL params (so refresh/share preserves state). */}
                  <Th>YT</Th>
                  <SortableTh col="channel_name" sort={sort} dir={dir} q={q} src={src}>
                    Channel
                  </SortableTh>
                  <SortableTh col="email" sort={sort} dir={dir} q={q} src={src}>
                    Email
                  </SortableTh>
                  <SortableTh col="subscribers" sort={sort} dir={dir} q={q} src={src}>
                    Subs
                  </SortableTh>
                  <SortableTh col="avg_views" sort={sort} dir={dir} q={q} src={src}>
                    Avg views
                  </SortableTh>
                  <Th>Socials</Th>
                  <SortableTh col="email_source" sort={sort} dir={dir} q={q} src={src}>
                    Source
                  </SortableTh>
                  <SortableTh col="fetched_at" sort={sort} dir={dir} q={q} src={src}>
                    Fetched
                  </SortableTh>
                </tr>
              </thead>
              <tbody>
                {listing.rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground/80">
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
            <span className="text-xs text-muted-foreground/80">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link
                  href={buildHref({ q, src, page: page - 1, sort, dir })}
                  className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground border border-border hover:border-border transition-colors"
                >
                  ← Prev
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildHref({ q, src, page: page + 1, sort, dir })}
                  className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground border border-border hover:border-border transition-colors"
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

function buildHref({
  q,
  src,
  page,
  sort,
  dir,
}: {
  q: string
  src: string
  page: number
  sort?: SortColumn
  dir?: 'asc' | 'desc'
}) {
  const sp = new URLSearchParams()
  if (q) sp.set('q', q)
  if (src) sp.set('src', src)
  if (page > 1) sp.set('page', String(page))
  // Only emit sort params when they differ from the default
  // (fetched_at desc) so the URL stays clean for the common case.
  if (sort && sort !== 'fetched_at') sp.set('sort', sort)
  if (dir && dir === 'asc') sp.set('dir', dir)
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

/**
 * Clickable header. Click once → sort asc by this column. Click
 * again on the same column → flip to desc. Click a different
 * column → start at desc (most useful default for time/numeric
 * columns; alphabetic asc just isn't usually what you want first).
 *
 * The chevron makes the active sort + direction immediately
 * visible — same affordance every spreadsheet has.
 */
function SortableTh({
  col,
  sort,
  dir,
  q,
  src,
  children,
}: {
  col: SortColumn
  sort: SortColumn
  dir: 'asc' | 'desc'
  q: string
  src: string
  children: React.ReactNode
}) {
  const isActive = sort === col
  const nextDir: 'asc' | 'desc' = isActive ? (dir === 'asc' ? 'desc' : 'asc') : 'desc'
  const href = buildHref({ q, src, page: 1, sort: col, dir: nextDir })
  return (
    <th className="text-left font-semibold text-[10px] uppercase tracking-[0.18em] px-4 py-2.5">
      <Link
        href={href}
        className={`inline-flex items-center gap-1 transition-colors ${
          isActive ? 'text-orange-400 hover:text-orange-300' : 'text-muted-foreground hover:text-foreground'
        }`}
        title={`Sort by ${col} ${nextDir === 'asc' ? 'ascending' : 'descending'}`}
      >
        {children}
        <span aria-hidden className="inline-flex flex-col leading-none -my-1">
          <span className={`text-[8px] ${isActive && dir === 'asc' ? 'text-orange-400' : 'text-muted-foreground/40'}`}>▲</span>
          <span className={`text-[8px] -mt-1 ${isActive && dir === 'desc' ? 'text-orange-400' : 'text-muted-foreground/40'}`}>▼</span>
        </span>
      </Link>
    </th>
  )
}

function Row({ r }: { r: EnrichmentLatest }) {
  // Mirrors the in-app Outreach board's social-pill set + visual
  // hierarchy. Channel name + YT logo column are linked the same
  // way the outreach view links them.
  const channelUrl = `https://www.youtube.com/channel/${r.yt_channel_id}`
  const handles: { label: string; href: string | null }[] = [
    { label: 'IG', href: r.instagram_handle ? `https://instagram.com/${r.instagram_handle.replace('@', '')}` : null },
    { label: 'X', href: r.twitter_handle ? `https://x.com/${r.twitter_handle.replace('@', '')}` : null },
    { label: 'in', href: r.linkedin_url || null },
    { label: '🌐', href: r.website || null },
  ]
  return (
    <tr className="border-b border-border/60 hover:bg-card/40 transition-colors">
      {/* YT logo column — same affordance as the outreach board's
          channelUrl column. Single click to open the YouTube channel
          in a new tab. */}
      <td className="px-3 py-3">
        <a
          href={channelUrl}
          target="_blank"
          rel="noreferrer"
          title="Open YouTube channel"
          className="inline-flex items-center justify-center w-7 h-7 rounded text-red-500/80 hover:text-red-500 hover:bg-red-500/10 transition-colors"
          aria-label="Open YouTube channel"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 3.993L9 16z" />
          </svg>
        </a>
      </td>

      {/* Channel name — hyperlinked to YouTube, blue underline-on-
          hover same as the outreach board\\'s channelName cell. */}
      <td className="px-4 py-3">
        <a
          href={channelUrl}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-blue-400 hover:text-blue-300 hover:underline"
        >
          {r.channel_name || <span className="text-muted-foreground/60 italic font-normal no-underline">unnamed</span>}
        </a>
        <div className="text-[10px] text-muted-foreground/60 font-mono mt-0.5 truncate max-w-[220px]" title={r.yt_channel_id}>
          {r.yt_channel_id}
        </div>
        {r.niche && <div className="text-[11px] text-muted-foreground/80 mt-0.5">{r.niche}</div>}
      </td>

      {/* Email — same green/strikethrough treatment as the outreach
          board email cell. mailto link opens the user\\'s mail
          client when clicked, exactly like the in-app behavior. */}
      <td className="px-4 py-3">
        {r.email ? (
          <a
            href={`mailto:${r.email}`}
            className={
              r.email_bounced
                ? 'text-red-400 line-through hover:no-underline'
                : 'text-emerald-300 hover:underline break-all'
            }
            title={r.email_bounced ? 'Marked bounced — needs re-fetch' : 'Open in mail client'}
          >
            {r.email}
          </a>
        ) : (
          <span className="text-muted-foreground/60 italic">none</span>
        )}
      </td>

      {/* Subscribers — formatted with K/M same as the outreach view. */}
      <td className="px-4 py-3 tabular-nums text-foreground/90 whitespace-nowrap">
        {formatSubscribers(r.subscribers != null ? String(r.subscribers) : '')}
      </td>

      {/* Avg views — formatted same way. */}
      <td className="px-4 py-3 tabular-nums text-foreground/90 whitespace-nowrap">
        {formatSubscribers(r.avg_views != null ? String(r.avg_views) : '')}
      </td>

      {/* Socials — same compact pills as the outreach board. */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {handles.map(h =>
            h.href ? (
              <a
                key={h.label}
                href={h.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold border border-border hover:border-border text-muted-foreground hover:text-foreground"
              >
                {h.label}
              </a>
            ) : null,
          )}
        </div>
      </td>

      {/* Source — admin-specific column, mono-styled */}
      <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">{r.email_source ?? '—'}</td>

      {/* Fetched — admin-specific column */}
      <td className="px-4 py-3 text-[11px] text-muted-foreground whitespace-nowrap">
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
  sublabel,
  accent,
  tone,
}: {
  label: string
  value: string
  /** Optional small caption below the value (e.g. "12,432 of 30,108 usable"). */
  sublabel?: string
  accent?: boolean
  tone?: 'warn'
}) {
  const valueClass = tone === 'warn'
    ? 'text-yellow-300'
    : accent
    ? 'text-orange-400'
    : 'text-foreground'
  return (
    <div className="rounded-lg border border-border bg-card/40 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-bold mb-1">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${valueClass}`}>{value}</div>
      {sublabel && (
        <div className="text-[10px] text-muted-foreground/80 mt-0.5 truncate" title={sublabel}>
          {sublabel}
        </div>
      )}
    </div>
  )
}
