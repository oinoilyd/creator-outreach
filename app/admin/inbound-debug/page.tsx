import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { cacheGet } from '@/lib/cache'
import { AuditMenu } from '@/components/admin/AuditMenu'
import { LocalDateTime } from '@/components/LocalDateTime'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export const dynamic = 'force-dynamic'

const RECENT_INBOUND_KEY = 'inbound-email:recent:v1'

type RecentInboundEntry = {
  receivedAt: string
  from: string
  to: string
  subject: string
  textSnippet: string
  trackingId: string | null
  matched: boolean
  matchedEntryId: string | null
}

/**
 * /admin/inbound-debug — last 50 emails received at the SendGrid
 * Inbound Parse webhook (/api/inbound-email).
 *
 * Two reasons this page exists:
 *   1. During Gmail forwarding setup, Gmail sends a verification code
 *      to inbound@inbound.creatoroutreach.net. The code lands here
 *      (because we own that subdomain in SendGrid) and the user
 *      copies it back into Gmail.
 *   2. Debugging the inbound chain — when an outreach reply doesn't
 *      auto-flip status, this page shows whether the email arrived
 *      at all + whether the [CO-#] tracking tag was extracted.
 */
export default async function InboundDebugPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) notFound()

  const recent = (await cacheGet<RecentInboundEntry[]>(RECENT_INBOUND_KEY)) || []

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Admin · Inbound email debug</h1>
            <p className="text-muted-foreground/80 text-sm mt-1">
              Last {recent.length} of up to 50 emails received at{' '}
              <span className="font-mono">inbound.creatoroutreach.net</span>{' '}
              via SendGrid Inbound Parse → <span className="font-mono">/api/inbound-email</span>.
              Used during Gmail forwarding setup (verification codes land here)
              and for debugging missed reply detections.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/admin/contacts"
              className="text-sm rounded-lg px-4 py-2 transition-colors flex items-center gap-2 border border-border text-muted-foreground hover:border-border hover:text-foreground"
            >
              📇 Contacts
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

        {/* EMPTY STATE */}
        {recent.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/40 px-6 py-12 text-center">
            <div className="text-3xl mb-3" aria-hidden>📬</div>
            <div className="text-sm font-semibold text-foreground/90 mb-1">No inbound emails yet</div>
            <div className="text-xs text-muted-foreground/80 leading-relaxed max-w-md mx-auto">
              SendGrid Inbound Parse hasn&apos;t POSTed anything to this webhook yet.
              That&apos;s normal until you set up Gmail forwarding (which sends a
              verification email here) or someone replies to an outreach you sent
              with the <span className="font-mono">[CO-#]</span> subject tag.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {recent.map((e, i) => (
              <article
                key={`${e.receivedAt}-${i}`}
                className={`rounded-xl border p-4 transition-colors ${
                  e.matched
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : e.trackingId
                    ? 'border-yellow-500/30 bg-yellow-500/5'
                    : 'border-border bg-card/40'
                }`}
              >
                {/* Status pill */}
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {e.matched ? (
                      <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-emerald-400">
                        ✓ Matched entry {e.matchedEntryId?.slice(0, 12)}…
                      </span>
                    ) : e.trackingId ? (
                      <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-yellow-400">
                        ⚠ Tag found but no matching entry (trackingId={e.trackingId})
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
                        No tracking tag — probably Gmail verification or unrelated
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground/80 tabular-nums">
                    <LocalDateTime variant="relative" iso={e.receivedAt} />
                  </span>
                </div>

                {/* Headers */}
                <div className="grid grid-cols-1 md:grid-cols-[80px_1fr] gap-x-3 gap-y-1 text-xs mb-3">
                  <span className="text-muted-foreground/80 font-mono">From:</span>
                  <span className="text-foreground break-all">{e.from || <em className="text-muted-foreground/60">(none)</em>}</span>
                  <span className="text-muted-foreground/80 font-mono">To:</span>
                  <span className="text-foreground/90 break-all">{e.to || <em className="text-muted-foreground/60">(none)</em>}</span>
                  <span className="text-muted-foreground/80 font-mono">Subject:</span>
                  <span className="text-foreground break-all font-medium">{e.subject || <em className="text-muted-foreground/60">(none)</em>}</span>
                </div>

                {/* Body snippet */}
                {e.textSnippet && (
                  <details className="text-[12px]">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground text-[10px] uppercase tracking-[0.16em] font-bold">
                      Body snippet ({e.textSnippet.length} chars)
                    </summary>
                    <pre className="mt-2 p-3 rounded bg-background/60 border border-border text-foreground/90 whitespace-pre-wrap break-words font-mono leading-relaxed max-h-72 overflow-y-auto">
                      {e.textSnippet}
                    </pre>
                  </details>
                )}
              </article>
            ))}
          </div>
        )}

        {/* FOOTNOTE */}
        <div className="mt-8 rounded-xl border border-border/60 bg-card/20 p-4 text-[12px] text-muted-foreground leading-relaxed">
          <p>
            <span className="text-foreground font-semibold">Color legend:</span>{' '}
            Green border = email had a tracking tag and matched an outreach
            entry (status auto-updated).{' '}
            Yellow border = had a tag but no entry matched (legacy entry
            without trackingId, or the entry was deleted).{' '}
            Gray border = no tracking tag — usually Gmail verification codes,
            autoresponders, or replies to legacy entries.
          </p>
          <p className="mt-2">
            Storage: rolling list in Redis, last 50 entries, 7-day TTL.
            Refresh this page to see new entries (they don&apos;t stream).
          </p>
        </div>
      </div>
    </main>
  )
}

