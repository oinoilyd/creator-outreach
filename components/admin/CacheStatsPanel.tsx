/**
 * CacheStatsPanel — admin-only widget showing the creator_enrichment
 * cache size + freshness metrics.
 *
 * Why (Dylan 2026-06-08): the cache is the SaaS moat. At 10K cached
 * creators the network effect starts kicking in — every search that
 * hits a cached creator skips the expensive enrichment pipeline
 * (~2-10s + API costs). This panel surfaces that moat as a visible
 * stat so its growth is trackable week-over-week.
 *
 * Dylan 2026-06-08 v2: refactored from async server component to
 * a pure dumb component that takes stats as props. The original
 * version called getEnrichmentStats() which uses the service-role
 * client (null in prod because SUPABASE_SERVICE_ROLE_KEY isn't in
 * Vercel env), making the panel return zeros and producing a
 * flash-then-disappear glitch on the admin page. The page now
 * fetches via the authenticated server client (creator_enrichment
 * grants SELECT to authenticated per migration 0011).
 */

export interface CacheStats {
  total: number
  withEmail: number
  bouncedCount: number
  fetchedLast7d: number
  fetchedLast24h: number
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('en-US')
}

export function CacheStatsPanel({ stats }: { stats: CacheStats }) {
  const { total, withEmail, bouncedCount, fetchedLast7d, fetchedLast24h } = stats

  const emailPct = total > 0 ? Math.round((withEmail / total) * 100) : 0

  // Tier descriptors for the cache-size narrative. Mirrors the
  // explanation Dylan got in chat — visible signal of where in the
  // moat-growth curve the app is sitting today.
  const tier = (() => {
    if (total >= 1_000_000) return { label: 'Data asset', tone: 'text-emerald-700 dark:text-emerald-300' }
    if (total >= 100_000)   return { label: 'Strong moat', tone: 'text-emerald-700 dark:text-emerald-300' }
    if (total >= 50_000)    return { label: 'Network effect kicking in', tone: 'text-blue-700 dark:text-blue-300' }
    if (total >= 10_000)    return { label: 'Compounding', tone: 'text-blue-700 dark:text-blue-300' }
    if (total >= 1_000)     return { label: 'Building', tone: 'text-amber-700 dark:text-amber-300' }
    return { label: 'Seeding', tone: 'text-muted-foreground' }
  })()

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-6">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-baseline gap-2">
          <h3 className="text-base font-semibold text-foreground">Enrichment Cache</h3>
          <span className={`text-[11px] font-medium ${tier.tone}`}>· {tier.label}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Updates on page reload
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total — the moat metric */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground mb-1">
            Total cached
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums">
            {formatNum(total)}
          </div>
          <div className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">
            Creators pre-enriched — instant on re-search
          </div>
        </div>

        {/* Email coverage — quality metric */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground mb-1">
            Email coverage
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums">
            {emailPct}%
          </div>
          <div className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">
            {formatNum(withEmail)} of {formatNum(total)} have emails
          </div>
        </div>

        {/* Fresh fetches last 7d — cache miss volume */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground mb-1">
            Fresh fetches · 7d
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums">
            {formatNum(fetchedLast7d)}
          </div>
          <div className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">
            New + refreshed rows in the past week
          </div>
        </div>

        {/* Fresh fetches last 24h — recent activity */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground mb-1">
            Fresh fetches · 24h
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums">
            {formatNum(fetchedLast24h)}
          </div>
          <div className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">
            {bouncedCount > 0 && (
              <>{formatNum(bouncedCount)} emails marked bounced</>
            )}
            {bouncedCount === 0 && 'No bounces flagged'}
          </div>
        </div>
      </div>

      {/* Narrative beat — tells the operator what to do with this */}
      <p className="text-[11px] text-muted-foreground/85 mt-3 leading-snug">
        Every cached creator that re-appears in a search skips a 2-10s enrichment + API cost. As this number grows,
        searches feel faster and per-search costs drop — for you AND every future customer.
        {total >= 100_000 && ' At your current size this is real data-asset territory.'}
        {total < 10_000 && ' Hit 10k for the compounding kick-in.'}
      </p>
    </div>
  )
}
