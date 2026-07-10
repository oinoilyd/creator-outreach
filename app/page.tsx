'use client'

import Link from 'next/link'
import React, { useState, useMemo, useEffect, useCallback, useLayoutEffect, useRef, useContext } from 'react'
// Per taste-skill: NEVER use emojis. All formerly-emoji UI elements
// (★ Favorites, ⏰ Follow-ups, 📊 Analytics, 🔥 High priority, ✨ Lead
// Criteria, ✉ has-email indicator, 👋 in DM template) are now SVG
// icons from lucide-react.
import { BarChart3 } from 'lucide-react'
import type {
  Creator, SortCol, SortKey, ColId, ActiveTab, ScoreWeights,
  GuidanceEntry,
  OutreachEntry, OutreachColConfig,
  ColConfig, PlatformId, UserProfile,
} from '@/lib/types'
import { computeMetric, metricTypeLabel, SUGGESTED_METRICS } from '@/lib/metrics'
import type { BackdropTheme } from '@/lib/backdrop-themes'
import { toast } from 'sonner'
import { celebrateSuccess } from '@/lib/celebrate'
import { SuccessToast } from '@/components/SuccessToast'
import { ExportGateModal, PENDING_EXPORT_LS_KEY, type ExportRequest } from '@/components/ExportGateModal'
import { CreatorTable } from '@/components/creators/CreatorTable'
import { GuidanceContext } from '@/components/creators/FitScoreCell'
import { AnimatedTabs, tabId, tabPanelId } from '@/components/AnimatedTabs'
import { OutreachSubTabs } from '@/components/outreach/OutreachSubTabs'
import { AnalyticsCustomizeShell } from '@/components/outreach/AnalyticsCustomizeShell'
import { OutreachAnalytics } from '@/components/outreach/OutreachAnalytics'
import { OutreachTab } from '@/components/outreach/OutreachTab'
import { PendingResponsePrompt } from '@/components/outreach/PendingResponsePrompt'
import { OutreachFollowUps } from '@/components/follow-ups/OutreachFollowUps'
import { ActiveClients } from '@/components/active-clients/ActiveClients'
import { RevertSuccessfulConfirmModal, type PendingRevert } from '@/components/active-clients/RevertSuccessfulConfirmModal'
import { DeleteSuccessfulConfirmModal } from '@/components/active-clients/DeleteSuccessfulConfirmModal'
import { KeyboardShortcutsModal } from '@/components/KeyboardShortcutsModal'
import { useKeyboardShortcuts, type ShortcutBinding } from '@/lib/hooks/useKeyboardShortcuts'
import { consumeSse } from '@/lib/sse-client'
import { motion } from 'motion/react'
import {
  ALL_OCCUPATIONS, VIEW_PRESETS, NICHE_BUCKETS,
  pickRandom, parseRelativeDays, parseSubscriberCount,
} from '@/lib/format'
import {
  DEFAULT_WEIGHTS,
  computeFitScore,
  sortCreators,
} from '@/lib/scoring'
import {
  ALL_OUTREACH_COLS, DEFAULT_OUTREACH_COLS, DEFAULT_COLS,
  YOUTUBE_ONLY_COL_IDS, COL_SORT, PLATFORM_AUTOSHOW_COLS,
  PLATFORM_OUTREACH_DEFAULTS, OUTREACH_PLATFORM_AUTOSHOW,
} from '@/lib/columns'
import { corpusMentionsProduct } from '@/lib/guidance'
import { PLATFORM_CONFIGS, PLATFORM_LOCK_ID } from '@/lib/platform'
import { REGIONS } from '@/lib/regions'
import { classifySearchInput } from '@/lib/search-classify'
import {
  PlusCircleIcon, DismissIcon, Spinner, SortIndicator,
} from '@/components/ui'
import { DismissedTab } from '@/components/DismissedTab'
import { PlatformDropdown } from '@/components/PlatformDropdown'
import { HamburgerMenu } from '@/components/HamburgerMenu'
import { UpgradeButton, computeUpgradeLabel } from '@/components/billing/UpgradeButton'
import { DashboardInsightPill } from '@/components/billing/DashboardInsightPill'
import { TipsAndTricksPill } from '@/components/billing/TipsAndTricksPill'
import { InboxBell } from '@/components/inbox/InboxBell'
import { TourProvider } from '@/components/tour/TourContext'
import { Tour } from '@/components/tour/Tour'
import { FirstRunPickerHost } from '@/components/tour/TutorialPicker'
// Lazy-loaded modal mounts (2026-05-09). Each of these only renders
// after a user click — there's no reason for them to ride along on
// the initial JS bundle. Switching to next/dynamic with the named-
// export `.then(m => m.X)` pattern keeps the prop types intact while
// dropping ~30-60 KB gzipped from the first paint chunk.
//
// `ssr: false` because these are interactive client surfaces that
// only render on user action — SSR would just be wasted work.
import dynamic from 'next/dynamic'
const ScoreSettingsModal = dynamic(
  () => import('@/components/ScoreSettingsModal').then(m => m.ScoreSettingsModal),
  { ssr: false },
)
const OnboardingModal = dynamic(
  () => import('@/components/OnboardingModal').then(m => m.OnboardingModal),
  { ssr: false },
)
const ProfileModal = dynamic(
  () => import('@/components/ProfileModal').then(m => m.ProfileModal),
  { ssr: false },
)
const TemplatesModal = dynamic(
  () => import('@/components/TemplatesModal').then(m => m.TemplatesModal),
  { ssr: false },
)
const IntegrationsModal = dynamic(
  () => import('@/components/IntegrationsModal').then(m => m.IntegrationsModal),
  { ssr: false },
)
const SendPreviewModal = dynamic(
  () => import('@/components/SendPreviewModal').then(m => m.SendPreviewModal),
  { ssr: false },
)
const ThreadModal = dynamic(
  () => import('@/components/ThreadModal').then(m => m.ThreadModal),
  { ssr: false },
)
const PlatformBackdrop = dynamic(
  () => import('@/components/PlatformBackdrop').then(m => m.PlatformBackdrop),
  { ssr: false },
)
const PlatformShade = dynamic(
  () => import('@/components/PlatformShade').then(m => m.PlatformShade),
  { ssr: false },
)
const MigrationPromptModal = dynamic(
  () => import('@/components/MigrationPromptModal').then(m => m.MigrationPromptModal),
  { ssr: false },
)
const ImportOutreachModal = dynamic(
  () => import('@/components/ImportOutreachModal').then(m => m.ImportOutreachModal),
  { ssr: false },
)
const ImportDismissedModal = dynamic(
  () => import('@/components/ImportDismissedModal').then(m => m.ImportDismissedModal),
  { ssr: false },
)
const CustomMetricModal = dynamic(
  () => import('@/components/CustomMetricModal').then(m => m.CustomMetricModal),
  { ssr: false },
)
const ManualAddOutreachModal = dynamic(
  () => import('@/components/ManualAddOutreachModal').then(m => m.ManualAddOutreachModal),
  { ssr: false },
)
const LeadDetailModal = dynamic(
  () => import('@/components/LeadDetailModal').then(m => m.LeadDetailModal),
  { ssr: false },
)
import {
  getOutreach, saveOutreach as persistOutreach,
  upsertOutreachRows, deleteOutreachRows,
  getDismissed, saveDismissed as persistDismissed, saveDismissedRow,
  upsertDismissedRows, deleteDismissedRows,
  saveColConfig,
  getOutreachColConfig, saveOutreachColConfig,
  getCustomMetrics, saveCustomMetrics,
  savePlatformWeights, savePlatformNarrative,
  savePlatformGuidance, clearPlatformGuidance,
  loadPlatformState,
  hasMigrationBackup,
  retryMigrationFromBackup,
  getPendingMigrationCounts,
  getMigrationSkipped,
  setMigrationSkipped,
  runManualMigration,
} from '@/lib/storage'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import {
  parseLocalDate,
  todayIso,
  formatDueDate,
} from '@/lib/dates'
import {
  filterOutreachByKeyword,
  nextFollowUpIso,
  followUpStageLabel,
} from '@/lib/outreach'

/**
 * Turn a raw search/SSE error into a clean, human message for a toast —
 * instead of dumping e.g. `SSE request failed (429): {"error":"Rate limit
 * exceeded. Try again in 12 min."}` as faint gray status text. (Audit P0.)
 */
function friendlySearchError(raw: string): string {
  const r = (raw || '').toString()
  // Known categories first — clearest guidance, and they take precedence
  // over any server-provided string.
  if (/\b429\b|rate limit/i.test(r)) return "You've hit the search limit for now — give it a few minutes and try again."
  if (/\b401\b|unauthor/i.test(r)) return 'Your session expired — refresh the page and sign in again.'
  if (/network|failed to fetch|timeout|ENOTFOUND|ECONN/i.test(r)) return 'Network hiccup — check your connection and try the search again.'
  // Surface a server-provided message ONLY if it reads like safe, human
  // copy — short and free of internal/DB/stack detail — so a raw SQL or
  // stack-trace error body can never land in a user-facing toast.
  const jsonMatch = r.match(/"error"\s*:\s*"([^"]+)"/)
  if (jsonMatch) {
    const msg = jsonMatch[1]
    const looksInternal =
      /SQLSTATE|relation |syntax error|permission denied|\b42P\d{2}\b|TypeError|ReferenceError|undefined is not|cannot read|\bat \w+[.(]|stack/i.test(msg)
    if (msg.length <= 120 && !looksInternal) return msg
  }
  return 'Search failed — please try again in a moment.'
}

export default function Home() {
  const [keyword, setKeyword] = useState('')
  // Per-region cap. Bumped 100 → 175 (2026-05-12) to pair with the AI
  // keyword expansion: with 3 sibling-keyword variants in play, the
  // raw channel pool per region grows roughly 1.5–2× before dedupe, so
  // we let the server keep more of them per region. Final shown count
  // after merging regions + dedupe stays user-readable.
  // Raised 175 → 300 (Dylan 2026-05-26 "wayyy more"). Broad searches
  // now fan out across ~55 sub-niche queries server-side + the relevance
  // floor keeps the bigger pull on-topic. Search runs on youtubei.js
  // (free), so no Google quota ceiling on the larger set.
  const maxResults = 300
  // Load More page cursor — each click fetches one page deeper per
  // query (pages=2, then 3, …) so it pulls GENUINELY NEW results
  // instead of re-rolling page 1. Reset to 1 on every fresh search.
  const loadMorePagesRef = useRef(1)
  // "Filtered ⇄ All" toggle (Dylan 2026-05-26). When true, the Results
  // list bypasses the SOFT filters (avg views / subs / freshness /
  // has-email) and shows everything — a one-click escape hatch from
  // the counter, no need to dig into the filter panel to reset. The
  // structural exclusions (dismissed / already-in-Outreach / active
  // platform) always stay applied. Default off (filters active).
  const [bypassFilters, setBypassFilters] = useState(false)
  const [minViews, setMinViews] = useState(0)
  const [maxViews, setMaxViews] = useState(200000)
  const [minSubs, setMinSubs] = useState(0)
  const [maxSubs, setMaxSubs] = useState(0) // 0 = no upper limit
  // Default to 6 months — most current/active creators only. User
  // can widen via the Last Posted preset row in the filter panel.
  // Default "Last posted" window. 360 days (Dylan 2026-05-26) — the old
  // 180-day default was silently hiding ~half of each search's results
  // (channels that hadn't posted in 6 months). 360 keeps genuinely
  // dormant channels out while surfacing the quarterly/seasonal posters
  // that 180 was cutting. Still adjustable via the "Last posted" presets.
  const [maxAgeDays, setMaxAgeDays] = useState<number>(360)
  // Niche filter for suggestions: null = all niches mixed.
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null)
  const [showNiches, setShowNiches] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(false)
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0 })
  const [elapsed, setElapsed] = useState(0)
  const [status, setStatus] = useState('')
  // Multi-column sort. Index 0 = highest priority (primary). Each
  // header click promotes that column to primary. Clicking the
  // already-primary column toggles direction. Clicking a column that
  // is already in the chain (but not primary) promotes it to primary.
  // To remove a column from the chain, click it past its second
  // direction (asc → desc → off). Default: fit score desc.
  const [sorts, setSorts] = useState<SortKey[]>([{ col: 'fitScore', dir: 'desc' }])

  /**
   * activeTab + outreachSubTab — persisted in the URL (`?tab=outreach&sub=followups`)
   * so refreshing the page keeps you on the same view. URL is source of
   * truth, lazily seeded on first read. We also sync back on every change
   * (replaceState — no extra history entry per click).
   *
   * Why URL over localStorage:
   *   • Shareable — a link to ?tab=outreach&sub=analytics takes someone
   *     directly to that view
   *   • Survives incognito + cross-device when you copy-paste
   *   • Plays nice with the browser's back/forward buttons
   */
  function readTabFromUrl(): { tab: ActiveTab; sub: 'all' | 'analytics' | 'followups' | 'active' } {
    if (typeof window === 'undefined') return { tab: 'results', sub: 'all' }
    const params = new URLSearchParams(window.location.search)
    const t = params.get('tab')
    const s = params.get('sub')
    const tab: ActiveTab =
      t === 'outreach' || t === 'dismissed' || t === 'results' ? t : 'results'
    // Legacy ?sub=favorites URLs land on 'all' (the Favorites sub-tab
    // was removed in v3; favorites now pin via toolbar toggle inside
    // OutreachTab). Bookmarks shouldn't 404 — they just route to the
    // tab the user's looking for.
    const sub: 'all' | 'analytics' | 'followups' | 'active' =
      s === 'analytics' || s === 'followups' || s === 'active' || s === 'all' ? s : 'all'
    return { tab, sub }
  }
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => readTabFromUrl().tab)
  const [outreachSubTab, setOutreachSubTab] = useState<'all' | 'analytics' | 'followups' | 'active'>(
    () => readTabFromUrl().sub,
  )
  // When LeadDetailModal dispatches `goto-active-client`, this id is
  // set and passed through to ActiveClients so the engagement detail
  // modal auto-opens. Reset to null after consumption so it doesn't
  // re-open on every render.
  const [activeClientPreselect, setActiveClientPreselect] = useState<string | null>(null)

  // 2026-05-23 per Dylan: when an outreach row flips to Successful,
  // a subtle bottom-right toast appears offering a one-click jump to
  // the new Active Client engagement card. Pairs with the confetti
  // celebration — the visual fanfare says "you won," the toast says
  // "and here's where to manage them next." Set by
  // updateOutreachEntry on Successful transition; cleared by the
  // toast component once it auto-dismisses or the user clicks
  // through.
  const [successToast, setSuccessToast] = useState<{ entryId: string; channelName: string } | null>(null)

  // Team context (Dylan 2026-05-24). Fetched once after auth so the
  // hamburger can show the right CTA (Upgrade vs Manage Team) and
  // future org-aware code paths can branch off this. Null while
  // loading; the hamburger hides its team entry until populated to
  // avoid flicker.
  const [teamContext, setTeamContext] = useState<{
    mode: 'individual' | 'team'
    organization: { id: string; name: string } | null
    role: 'owner' | 'admin' | 'member' | null
  } | null>(null)

  // Team members (populated when teamContext.mode === 'team'). Used
  // by OutreachTab + active clients for the filter pills + reassign
  // popovers. Empty array for individual users (no team UI rendered).
  const [teamMembers, setTeamMembers] = useState<import('@/lib/team-client').TeamMember[]>([])

  // Ref to a function that refetches outreach. Set inside the main
  // load effect so it closes over the live setOutreach. Called by
  // reloadOutreach() below + the team reassign callback.
  const reloadOutreachRef = useRef<(() => Promise<void>) | null>(null)
  const reloadOutreach = useCallback(async () => {
    if (reloadOutreachRef.current) await reloadOutreachRef.current()
  }, [])

  // Listen for the "Add to Active Clients" CTA in LeadDetailModal —
  // routes the user to the Outreach → Active Clients sub-tab and
  // pre-opens the engagement detail modal for the dispatched entry id.
  useEffect(() => {
    function handler(ev: Event) {
      const detail = (ev as CustomEvent<{ entryId?: string }>).detail
      if (!detail?.entryId) return
      setActiveTab('outreach')
      setOutreachSubTab('active')
      setActiveClientPreselect(detail.entryId)
    }
    window.addEventListener('goto-active-client', handler as EventListener)
    return () => window.removeEventListener('goto-active-client', handler as EventListener)
  }, [])

  // Stripe Checkout return — resume export after a $25 payment.
  // Dylan 2026-05-24. URL shape on success:
  //   /?export_fulfilled=1&session_id=cs_…
  // Flow:
  //   1. Fulfill the credit on the server (POST /api/exports/fulfill).
  //   2. Read the saved request from localStorage (entries + format).
  //   3. Re-open the gate modal with that request — it'll show the
  //      "Paid credit available" tier and complete the export.
  //   4. Clean up URL params + localStorage so refresh doesn't re-fire.
  // If anything fails the user keeps their credit; they can re-trigger
  // export from the Outreach tab and it'll consume the credit on next
  // attempt.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const fulfilled = params.get('export_fulfilled') === '1'
    const sessionId = params.get('session_id')
    if (!fulfilled || !sessionId) return

    // Strip the query params immediately so refresh / share-link
    // doesn't replay the flow.
    const cleanUrl = window.location.pathname + window.location.hash
    window.history.replaceState({}, '', cleanUrl)

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/exports/fulfill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        })
        if (cancelled) return
        if (!res.ok) {
          toast.error('Could not finalize your export payment. Try exporting again — your credit may already be available.')
          return
        }
        // Read the saved request. localStorage survives the redirect;
        // we clear it after reading.
        let pending: ExportRequest | null = null
        try {
          const raw = localStorage.getItem(PENDING_EXPORT_LS_KEY)
          if (raw) pending = JSON.parse(raw) as ExportRequest
        } catch {
          // ignore malformed payload — user can re-trigger export
        }
        try { localStorage.removeItem(PENDING_EXPORT_LS_KEY) } catch {}

        toast.success('Payment confirmed — your export is ready.')

        if (pending && Array.isArray(pending.entries)) {
          // Re-open the gate modal with the saved request. It'll see
          // the new paid_export_credit and complete the export on the
          // user's confirm.
          setExportGateRequest(pending)
          setExportGateOpen(true)
        }
      } catch (err) {
        if (cancelled) return
        console.error('[exports/fulfill] redirect handler failed', err)
        toast.error('Export payment was processed but completion failed. Try exporting again.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // Stripe SUBSCRIPTION Checkout return — confirm the outcome to the user.
  // success_url=/?stripe=success, cancel_url=/pricing?stripe=canceled.
  // (The export-credit flow has its own ?export_fulfilled handler above;
  // the subscription return previously landed silently. Audit P0.)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const stripe = params.get('stripe')
    if (stripe !== 'success' && stripe !== 'canceled') return
    // Strip the param so a refresh / shared link doesn't replay the toast.
    window.history.replaceState({}, '', window.location.pathname + window.location.hash)
    if (stripe === 'success') {
      toast.success("You're all set — welcome to Creator Outreach Pro! 🎉", {
        description: 'Your subscription is active. It can take a few seconds to reflect — refresh if the paywall lingers.',
        duration: 8000,
      })
    } else {
      toast('Checkout canceled — no charge was made.', {
        description: 'You can upgrade any time from the menu.',
      })
    }
  }, [])

  // "From outreach log" picker in Active Clients dispatches this
  // when the user clicks a row to promote. We bump the entry's
  // status to Successful (which makes it appear in the Active
  // Clients filtered view) and then preselect it so the
  // engagement card auto-opens — same end state as the
  // LeadDetailModal "Add to Active Clients" CTA.
  //
  // updateOutreachEntry closes over the live outreach array, so
  // we keep it in a ref to avoid stale closures inside the listener.
  const updateOutreachEntryRef = useRef(updateOutreachEntry)
  useEffect(() => { updateOutreachEntryRef.current = updateOutreachEntry })
  useEffect(() => {
    function handler(ev: Event) {
      const detail = (ev as CustomEvent<{ entryId?: string }>).detail
      if (!detail?.entryId) return
      updateOutreachEntryRef.current(detail.entryId, 'status', 'Successful')
      // Sub-tab stays 'active' since the user is already on it; just
      // preselect so the engagement card auto-opens once the entry
      // appears in the Successful-filtered list.
      setActiveClientPreselect(detail.entryId)
    }
    window.addEventListener('promote-outreach-to-active', handler as EventListener)
    return () => window.removeEventListener('promote-outreach-to-active', handler as EventListener)
  }, [])

  // 2026-05-23 per Dylan: wrap-up modal dispatches this when the
  // engagement closes with referrals captured. Each referral becomes
  // a fresh OutreachEntry in the user's pipeline so warm intros
  // don't get lost in a notes paragraph they never re-read.
  //
  // Single batched event (not one-per-referral) so multiple
  // referrals all land in a single upsertOutreachRows() call — firing
  // N events would race against React batching and only the last
  // would persist.
  //
  // Contact field is freetext; we best-effort parse it:
  //   • email-like ("foo@bar.com")     → entry.email
  //   • URL-like ("https://...")       → entry.channelUrl
  //   • anything else                  → stashed in entry.notes
  useEffect(() => {
    function handler(ev: Event) {
      const detail = (ev as CustomEvent<{
        referrals?: Array<{ name: string; contact: string }>
        sourceChannelName?: string | null
      }>).detail
      if (!detail?.referrals?.length) return

      const sourceLabel = detail.sourceChannelName
        ? `Referral from ${detail.sourceChannelName}`
        : 'Referral'

      const newEntries: OutreachEntry[] = detail.referrals
        .filter(r => r.name.trim() !== '')
        .map((r, i) => {
          const trimmedName = r.name.trim()
          const trimmedContact = r.contact.trim()
          const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedContact)
          const isUrl = /^https?:\/\//i.test(trimmedContact)

          // Synthesize a unique channelId — referrals don't have a
          // real YouTube/IG channel ID yet. Prefix `referral-` so a
          // future search-then-add for the real channel won't
          // collide.
          const channelId = `referral-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`

          // Notes block: source + any non-email/non-URL contact text
          // (e.g. "@handle on twitter" or "met at conference").
          const contactNote = !isEmail && !isUrl && trimmedContact ? trimmedContact : ''
          const notes = [sourceLabel, contactNote].filter(Boolean).join('\n')

          return {
            id: `${channelId}-${Date.now()}`,
            channelId,
            channelName: trimmedName,
            channelUrl: isUrl ? trimmedContact : '',
            description: '',
            email: isEmail ? trimmedContact : '',
            product: '',
            favorite: false,
            reachedOut: false,
            medium: '',
            mediumOther: '',
            headerUsed: '',
            status: 'Not Outreached',
            addedAt: Date.now(),
            trackingId: Math.random().toString(36).slice(2, 10),
            notes,
            followUpDate: '',
            dateReachedOut: '',
            touchpoints: '',
            responseDate: '',
            subscribers: '',
            avgViews: 0,
            fitScore: 0,
            linkedin: '',
            instagram: '',
            twitter: '',
            tiktok: '',
            website: '',
            contentNiche: '',
            phone: '',
            dealValue: '',
            contractSent: false,
            meetingScheduled: '',
          } satisfies OutreachEntry
        })

      if (newEntries.length === 0) return

      // Functional update so this listener doesn't close over a
      // stale `outreach` value (the listener registers once at mount).
      setOutreach(prev => {
        const next = [...newEntries, ...prev]
        setOutreachIds(new Set(next.map(e => e.channelId)))
        // Delta write — only the referral rows themselves hit the DB
        // (2026-07-09 perf; previously re-uploaded the whole board).
        void upsertOutreachRows(newEntries)
        return next
      })
      // Pin the new entries to the top of the Outreach tab so the
      // user can see them when they switch over.
      setRecentlyAddedIds(prev => {
        const updated = new Set(prev)
        for (const e of newEntries) updated.add(e.id)
        return updated
      })
    }
    window.addEventListener('add-outreach-from-referrals', handler as EventListener)
    return () => window.removeEventListener('add-outreach-from-referrals', handler as EventListener)
  }, [])

  // Tour-driven navigation. The product tour fires this event to
  // ferry the user between tabs/sub-tabs as it walks through the
  // app. Same pattern as the other CustomEvent navigators above.
  useEffect(() => {
    function handler(ev: Event) {
      const detail = (ev as CustomEvent<{ tab?: ActiveTab; sub?: 'all' | 'analytics' | 'followups' | 'active' }>).detail
      if (detail?.tab) setActiveTab(detail.tab)
      if (detail?.sub) setOutreachSubTab(detail.sub)
    }
    window.addEventListener('tour-navigate', handler as EventListener)
    return () => window.removeEventListener('tour-navigate', handler as EventListener)
  }, [])

  // Tour-driven interactions (Dylan 2026-05-24 granular tour). The
  // granular tour fires these events to actually OPEN modals/panels
  // so the spotlight has real UI to anchor on. Each kind maps to a
  // state setter — modals open immediately, no side effects beyond
  // visibility. Hamburger events are forwarded; HamburgerMenu has
  // its own listener for those.
  useEffect(() => {
    function handler(ev: Event) {
      const detail = (ev as CustomEvent<{ kind?: string }>).detail
      switch (detail?.kind) {
        case 'open-filter-panel':       setShowFilter(true); break
        case 'close-filter-panel':      setShowFilter(false); break
        case 'open-lead-criteria':      setShowScoreSettings(true); break
        case 'close-lead-criteria':     setShowScoreSettings(false); break
        case 'open-templates':          setShowTemplates(true); break
        case 'close-templates':         setShowTemplates(false); break
        case 'open-customize-columns':  setShowCustomize(true); break
        case 'close-customize-columns': setShowCustomize(false); break
        // Hamburger events bubble through unhandled here — HamburgerMenu
        // owns its own state and listens directly.
      }
    }
    window.addEventListener('tour-interact', handler as EventListener)
    return () => window.removeEventListener('tour-interact', handler as EventListener)
  }, [])

  // Sync state → URL on every change. replaceState (not pushState) so the
  // user's back button still goes back to where they came from on this site
  // rather than walking through every tab click.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    // Don't pollute the URL when on the default tab — only set the param
    // when the user has navigated to something other than the default.
    if (activeTab === 'results') params.delete('tab')
    else params.set('tab', activeTab)
    if (activeTab === 'outreach' && outreachSubTab !== 'all') {
      params.set('sub', outreachSubTab)
    } else {
      params.delete('sub')
    }
    const qs = params.toString()
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    if (window.location.pathname + window.location.search !== next) {
      window.history.replaceState(null, '', next)
    }
  }, [activeTab, outreachSubTab])
  const [customMetrics, setCustomMetrics] = useState<import('@/lib/types').CustomMetric[]>([])
  const [editingMetric, setEditingMetric] = useState<import('@/lib/types').CustomMetric | null>(null)
  const [showAddMetric, setShowAddMetric] = useState(false)
  const [showManualAdd, setShowManualAdd] = useState(false)
  const [viewingLeadId, setViewingLeadId] = useState<string | null>(null)
  const [showAnalyticsCustomize, setShowAnalyticsCustomize] = useState(false)
  const [draftMetrics, setDraftMetrics] = useState<import('@/lib/types').CustomMetric[]>([])
  const [outreach, setOutreach] = useState<OutreachEntry[]>([])
  const [outreachIds, setOutreachIds] = useState<Set<string>>(new Set())
  // Recently-added pin lives at the parent level so it survives the
  // OutreachTab unmount/remount that happens when the user toggles
  // between Results and Outreach tabs. Cleared on column-header sort
  // by OutreachTab via the onClearRecentlyAdded callback.
  const [recentlyAddedIds, setRecentlyAddedIds] = useState<Set<string>>(new Set())
  // Subset of recentlyAddedIds that the user has already touched (any
  // click on the row). The purple highlight is only painted while a
  // row is in recentlyAddedIds AND NOT in this set — once you've
  // interacted with the new row, the highlight fades but the row
  // stays pinned at top until the next sort change.
  const [interactedNewIds, setInteractedNewIds] = useState<Set<string>>(new Set())
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  // Search mode pills (URL / Username / Occupation) on Results tab.
  // Auto-selected by classifySearchInput as the user types; user
  // clicks override and stick until keyword is cleared. Drives whether
  // the next search hits /api/lookup-channel (URL/Username) or
  // /api/search (Occupation), and powers the "no results → Search
  // similar" recovery pill.
  type SearchMode = 'url' | 'username' | 'occupation'
  const [searchMode, setSearchMode] = useState<SearchMode>('occupation')
  const [searchModeManual, setSearchModeManual] = useState(false)
  // Set to true after a targeted (URL/Username) search returns 0 hits
  // so we can render the "Search similar" recovery pill in the
  // empty-state spot.
  const [showSearchSimilar, setShowSearchSimilar] = useState(false)
  const [emailOnly, setEmailOnly] = useState(false)
  // Default sort prioritizes creators with email at the top. User can
  // toggle this off in the filter panel to see the raw column-only sort.
  // Per Dylan 2026-05-10: 'emails should default at the top of results
  // unless someone clicks a different filter.' Already the default on
  // first load — now persisted to localStorage so the choice survives
  // sessions, AND a fresh user / fresh storage still gets true.
  const [emailFirstSort, setEmailFirstSort] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    const saved = window.localStorage.getItem('email-first-sort')
    if (saved === null) return true // never touched → default on
    return saved === '1'
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('email-first-sort', emailFirstSort ? '1' : '0')
    }
  }, [emailFirstSort])

  // Backdrop theme — 4 options ('off' / 'rain' / 'drift' / 'fireworks' /
  // 'tornado'), each parameterized by the currently-active platform.
  // Pulse was dropped in v3 (2026-05-10) — its static color tint
  // graduated into the always-on PlatformShade. Existing localStorage
  // values of 'pulse' fall through to the default.
  //
  // 2026-05-23 per Dylan: default flipped from 'off' → 'tornado' so new
  // users land with a real moment. A one-time migration (keyed by
  // 'backdrop-theme-default-v2') bumps existing users who still have
  // the old 'off' default — that key gets set once and never again, so
  // any subsequent explicit choice (including switching back to 'off')
  // persists normally. Users who already picked rain/drift/fireworks
  // keep their pick; only the off-by-default crowd gets nudged.
  const [backdropTheme, setBackdropTheme] = useState<BackdropTheme>(() => {
    if (typeof window === 'undefined') return 'tornado'
    const migrationKey = 'backdrop-theme-default-v2'
    const migrated = window.localStorage.getItem(migrationKey) === 'true'
    const saved = window.localStorage.getItem('backdrop-theme')

    // First time we're applying the new default — bump 'off' (or any
    // unrecognized value) up to 'tornado'. Mark migrated so we never
    // override the user's choice again.
    if (!migrated) {
      window.localStorage.setItem(migrationKey, 'true')
      if (saved === 'rain' || saved === 'drift' || saved === 'fireworks' || saved === 'tornado') {
        return saved
      }
      return 'tornado'
    }

    // Post-migration: respect whatever the user has saved (including 'off').
    if (saved === 'rain' || saved === 'drift' || saved === 'fireworks' || saved === 'tornado' || saved === 'off') {
      return saved
    }
    return 'tornado'
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('backdrop-theme', backdropTheme)
    }
  }, [backdropTheme])

  // 2026-05-10 per Dylan: user-configurable backdrop fade duration.
  // Lives in the theme settings popover (gear icon next to "Themes"
  // in the hamburger menu). Range 5–120s; default 30s; 0 means
  // 'always on' (no auto-fade).
  const [backdropDurationSec, setBackdropDurationSec] = useState<number>(() => {
    if (typeof window === 'undefined') return 30
    const saved = window.localStorage.getItem('backdrop-duration-sec')
    const n = saved == null ? NaN : parseInt(saved, 10)
    return Number.isFinite(n) && n >= 0 && n <= 120 ? n : 30
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('backdrop-duration-sec', String(backdropDurationSec))
    }
  }, [backdropDurationSec])

  // Spotlight mode — 15-second foreground burst per Dylan 2026-05-10.
  // Triggered manually from the hamburger menu. When true, the
  // PlatformBackdrop renders ABOVE all content at full saturation
  // for exactly 15s, then auto-clears.
  const [spotlight, setSpotlight] = useState(false)
  const spotlightTimer = useRef<NodeJS.Timeout | null>(null)

  // 2026-05-10 v6 per Dylan: spotlight defaults ON — but as a
  // persistent VISUAL INTENSITY boost, not a foreground burst.
  // Rain/Drift now render bright (boosted opacity) at all times
  // unless the user toggles it off in the theme settings popover.
  // Fireworks/Tornado are unaffected — they still only PLAY on
  // theme-pick / platform-switch / manual button (the one-shot
  // gate uses the momentary `spotlight` boolean, not this one,
  // so it doesn't auto-fire on hard refresh).
  const [spotlightAlwaysOn, setSpotlightAlwaysOn] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    // 2026-05-24 per Dylan: "spotlight on themes should be on by default."
    // The state default is true, but users who toggled it off in a prior
    // session keep their false saved value indefinitely. One-time migration
    // (keyed by 'spotlight-always-on-default-v2') forces everyone back to
    // true on first read post-deploy. After that, an explicit toggle off
    // sticks normally.
    // v3 (2026-05-26): re-bumped — Dylan reported spotlight wasn't on by
    // default again. Whether the v2 migration mis-fired or a stray toggle
    // stuck it off, v3 force-resets everyone back to ON one more time.
    // After this fires, an explicit toggle-off still sticks.
    const migrationKey = 'spotlight-always-on-default-v3'
    const migrated = window.localStorage.getItem(migrationKey) === 'true'
    if (!migrated) {
      window.localStorage.setItem(migrationKey, 'true')
      window.localStorage.setItem('spotlight-always-on', 'true')
      return true
    }
    const saved = window.localStorage.getItem('spotlight-always-on')
    return saved === 'false' ? false : true // default true
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('spotlight-always-on', String(spotlightAlwaysOn))
    }
  }, [spotlightAlwaysOn])
  // Optional durationMs override — Fireworks/Tornado pass their own
  // show length so the spotlight clears right when the show ends.
  // Manual Spotlight button defaults to 15s.
  function triggerSpotlight(durationMs: number = 15_000) {
    setSpotlight(true)
    setBackdropVisible(true) // make sure it's actually visible during the burst
    if (spotlightTimer.current) clearTimeout(spotlightTimer.current)
    spotlightTimer.current = setTimeout(() => {
      setSpotlight(false)
      // Don't auto-fade backdropVisible — let the normal rules
      // (configurable duration / activity triggers) take it from here.
    }, durationMs)
  }
  useEffect(() => {
    // Cleanup on unmount.
    return () => {
      if (spotlightTimer.current) clearTimeout(spotlightTimer.current)
    }
  }, [])
  // Per-theme spotlight duration. Used by auto-trigger (theme pick)
  // AND by the manual Spotlight button so a Fireworks/Tornado pick
  // gets the show length it expects.
  function spotlightDurationFor(theme: BackdropTheme): number {
    if (theme === 'fireworks') return 8_500 // trimmed another 3s — finale 4.5-5.4s + text fades by 8.5s
    if (theme === 'tornado')   return 11_500 // 11.5s two-pass funnel
    return 15_000
  }
  // Wrapper around setBackdropTheme — every non-'off' theme auto-fires
  // the spotlight burst on pick. Gives the user a confirmation moment
  // that the theme is now active, at full saturation. Fireworks +
  // Tornado get their natural one-shot show length; Rain + Drift get
  // the default 15s burst before falling back to the persistent
  // ambient render driven by spotlightAlwaysOn.
  //
  // 'off' deliberately skips — no spotlight burst when the user is
  // turning the backdrop off, since there's nothing to spotlight.
  function handleBackdropThemeChange(theme: BackdropTheme) {
    setBackdropTheme(theme)
    if (theme !== 'off') {
      // Fire on next tick so the theme state has committed before
      // spotlight reads it.
      setTimeout(() => triggerSpotlight(spotlightDurationFor(theme)), 0)
    }
  }
  // Manual-spotlight wrapper used by the menu button — respects the
  // active theme's natural show length.
  function handleManualSpotlight() {
    triggerSpotlight(spotlightDurationFor(backdropTheme))
  }

  // Wave trigger counter — increment to re-fire the wave on demand.
  // Used by runSearch so the 'Find creators' click re-triggers the
  // backdrop even if no theme/platform/tab change occurred.
  const [waveCounter, setWaveCounter] = useState(0)
  function triggerBackdropWave() {
    setWaveCounter(c => c + 1)
  }

  // Backdrop visibility state — single source of truth. The driving
  // effect lives further down the file, right after activePlatform
  // is declared (temporal-dead-zone guard, same pattern as the
  // currentKeyword watcher).
  const [backdropVisible, setBackdropVisible] = useState<boolean>(false)
  const [showExport, setShowExport] = useState(false)
  // Export paywall (Dylan 2026-05-24). All exports now go through the
  // ExportGateModal which checks entitlement (free monthly quota / paid
  // credit / $25 charge) before generating the file.
  const [exportGateOpen, setExportGateOpen] = useState(false)
  const [exportGateRequest, setExportGateRequest] = useState<ExportRequest | null>(null)
  const openExportGate = useCallback((req: ExportRequest) => {
    setShowExport(false)
    setExportGateRequest(req)
    setExportGateOpen(true)
  }, [])
  // Ref + click-outside detection for the tab-nav Settings gear popover.
  // Auto-update search mode pill based on what the classifier sees
  // as the user types. Manual override (clicking a pill) sticks until
  // the keyword is cleared — at which point we drop back to auto.
  useEffect(() => {
    const trimmed = keyword.trim()
    if (!trimmed) {
      setSearchModeManual(false)
      setSearchMode('occupation') // default when empty
      setShowSearchSimilar(false) // clear recovery state on input clear
      return
    }
    if (searchModeManual) return
    const cls = classifySearchInput(trimmed)
    if (cls.kind === 'url') setSearchMode('url')
    else if (cls.kind === 'handle') setSearchMode('username')
    else setSearchMode('occupation')
  }, [keyword, searchModeManual])

  // Without this, the popover only closed by clicking the gear icon
  // again — clicking anywhere else left it stuck open.
  const exportMenuRef = useRef<HTMLDivElement>(null)
  // ── Keyboard shortcuts ─────────────────────────────────────────────
  // `/` focuses this ref; `?` toggles the cheat-sheet modal. The hook
  // suppresses itself when the user is typing in an input/textarea so
  // the keys still produce literal characters in notes / scope /
  // template fields.
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [showShortcutsModal, setShowShortcutsModal] = useState(false)
  const shortcutBindings: ShortcutBinding[] = useMemo(() => [
    {
      key: '/',
      handler: e => {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      },
      label: 'Focus search',
    },
    {
      key: '?',
      shift: true,
      handler: e => {
        e.preventDefault()
        setShowShortcutsModal(v => !v)
      },
      label: 'Toggle shortcut cheat sheet',
    },
  ], [])
  useKeyboardShortcuts(shortcutBindings, true)
  useEffect(() => {
    if (!showExport) return
    function onMouseDown(ev: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(ev.target as Node)) {
        setShowExport(false)
      }
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setShowExport(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [showExport])
  const [colConfig, setColConfig] = useState<ColConfig[]>(DEFAULT_COLS)
  const [showCustomize, setShowCustomize] = useState(false)
  const [draftCols, setDraftCols] = useState<ColConfig[]>(DEFAULT_COLS)
  // Per-platform Outreach column configs (Dylan 2026-05-23). Each
  // platform owns its own visibility/order/width layout. Active
  // config is derived from outreachColConfigByPlatform[activePlatform]
  // below, with PLATFORM_OUTREACH_DEFAULTS as the fallback when the
  // user hasn't customized that platform yet.
  const [outreachColConfigByPlatform, setOutreachColConfigByPlatform] = useState<
    Record<PlatformId, OutreachColConfig[]>
  >({
    youtube: PLATFORM_OUTREACH_DEFAULTS.youtube,
    instagram: PLATFORM_OUTREACH_DEFAULTS.instagram,
    tiktok: PLATFORM_OUTREACH_DEFAULTS.tiktok,
    twitter: PLATFORM_OUTREACH_DEFAULTS.twitter,
    linkedin: PLATFORM_OUTREACH_DEFAULTS.linkedin,
  })
  const [showOutreachCustomize, setShowOutreachCustomize] = useState(false)
  const [draftOutreachCols, setDraftOutreachCols] = useState<OutreachColConfig[]>(DEFAULT_OUTREACH_COLS)
  const [dismissed, setDismissed] = useState<Creator[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [loadMoreCreators, setLoadMoreCreators] = useState<Creator[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [currentKeyword, setCurrentKeyword] = useState('')
  // (Old behavior: the backdrop used to HIDE when a search started.
  // Per Dylan 2026-05-10 v3 that flipped — the search button now
  // TRIGGERS the wave via triggerBackdropWave() in runSearch. So the
  // hide-on-search watcher is gone; the wave plays out for its
  // configured duration, then fades.)
  // For niche-style searches, hold the underlying occupation list so
  // Load More can keep using the same multi-keyword expansion.
  const [currentKeywordsList, setCurrentKeywordsList] = useState<string[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [scoreWeights, setScoreWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS)
  const [scoreNarrative, setScoreNarrative] = useState('')
  const [showScoreSettings, setShowScoreSettings] = useState(false)
  const [guidanceEntries, setGuidanceEntries] = useState<GuidanceEntry[]>([])
  // 2026-05-10 per Dylan: persist activePlatform across refresh so
  // a filter selection survives reload. localStorage source of
  // truth; fall back to 'youtube' for first-time users / invalid
  // values.
  const [activePlatform, setActivePlatform] = useState<PlatformId>(() => {
    if (typeof window === 'undefined') return 'youtube'
    const saved = window.localStorage.getItem('active-platform')
    if (saved === 'youtube' || saved === 'instagram' || saved === 'tiktok' || saved === 'twitter' || saved === 'linkedin') {
      return saved
    }
    return 'youtube'
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('active-platform', activePlatform)
    }
  }, [activePlatform])

  // Backdrop visibility driver.
  //
  // 2026-05-10 v5 per Dylan — reverted auto-fire for one-shot themes:
  // Fireworks + Tornado are loud 14–16s shows. Auto-firing them on
  // load / platform switch / tab return felt like constant
  // interruption, so they're back to event-only behavior. They fire
  // ONLY when the user picks them (via handleBackdropThemeChange)
  // or hits the Spotlight button. Dormant otherwise.
  //
  // Continuous themes (Rain / Drift) still fire on every meaningful
  // change:
  //   • initial page load
  //   • theme switch
  //   • platform switch (while on Results)
  //   • returning to the Results tab from Outreach/Dismissed
  //   • clicking 'Find creators' (via runSearch → triggerBackdropWave)
  //
  // Placement note: this effect references activePlatform, which is
  // declared just above — keeps the temporal-dead-zone clean.
  useEffect(() => {
    // Don't fight the spotlight — it has its own visibility window
    // managed by triggerSpotlight(). When spotlight goes back to false,
    // this effect re-runs and applies the normal rules.
    if (spotlight) return
    if (backdropTheme === 'off') {
      setBackdropVisible(false)
      return
    }
    if (activeTab !== 'results') {
      setBackdropVisible(false)
      return
    }
    // One-shot themes — visibility is entirely owned by spotlight.
    // Bail out so we don't toggle visibility on continuous events; the
    // layer stays null between explicit triggers.
    if (backdropTheme === 'fireworks' || backdropTheme === 'tornado') return
    // Continuous themes (Rain / Drift) — show + auto-fade.
    setBackdropVisible(true)
    if (backdropDurationSec === 0) return
    const timer = setTimeout(() => setBackdropVisible(false), backdropDurationSec * 1000)
    return () => clearTimeout(timer)
  }, [backdropTheme, activePlatform, activeTab, spotlight, waveCounter, backdropDurationSec])

  // 2026-05-10 v6 per Dylan: one-shot themes (Fireworks/Tornado)
  // SHOULD re-fire when the user switches platforms in the
  // 'Find ___ creators' dropdown — that's the one trigger worth
  // keeping. They still stay dormant on tab return and search
  // (those were too noisy). The platform-change effect itself lives
  // further down — it depends on userId which is declared below.
  const prevPlatformRef = useRef<PlatformId>(activePlatform)
  const initialFireRef = useRef(false)

  const seenChannelIds = useRef<Set<string>>(new Set())

  // Auth + profile
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  // 2026-05-23 per Dylan: one-shot themes (Fireworks/Tornado) fire BOTH
  // on initial login/page-mount AND on platform switch. The first effect
  // gives users "the wave" when they land on the app; the second handles
  // re-firing when they pick a different platform in the dropdown.
  // initialFireRef guards against re-running the mount fire on every
  // re-render — once it flips true, only platform changes can re-fire.
  useEffect(() => {
    const prev = prevPlatformRef.current
    const isInitialFire = !initialFireRef.current && userId !== null

    if (!isInitialFire && prev === activePlatform) return // no change worth firing
    if (prev !== activePlatform) prevPlatformRef.current = activePlatform

    // Only fire if user is actually looking at the backdrop (Results tab).
    if (activeTab !== 'results') return

    if (backdropTheme === 'fireworks' || backdropTheme === 'tornado') {
      initialFireRef.current = true
      triggerSpotlight(spotlightDurationFor(backdropTheme))
    }
  }, [activePlatform, activeTab, backdropTheme, userId])
  // Stripe subscription state — populated alongside profile. The fields
  // are nullable because most users haven't subscribed yet; the UI
  // treats null as "no subscription, show pricing CTA".
  const [subscription, setSubscription] = useState<{
    status: string | null
    priceId: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    stripeCustomerId: string | null
  } | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showIntegrations, setShowIntegrations] = useState(false)
  // Airtable auto-push: connected = keep their base in sync. Status is
  // fetched on login and re-checked whenever the Integrations modal
  // closes (connect/disconnect happens in there).
  const [airtableConnected, setAirtableConnected] = useState(false)
  useEffect(() => {
    if (!profile || showIntegrations) return
    let alive = true
    fetch('/api/integrations/airtable')
      .then(r => r.json())
      .then(b => { if (alive) setAirtableConnected(!!b?.connected) })
      .catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile === null, showIntegrations])
  // Debounced push — 20s after the LAST outreach change (each change
  // resets the timer via the cleanup), so bursts of edits become one
  // upsert batch. Fire-and-forget; failures surface in the panel's
  // last_error, not as toasts.
  useEffect(() => {
    if (!airtableConnected || outreach.length === 0) return
    const t = setTimeout(() => {
      void fetch('/api/integrations/airtable/push', { method: 'POST' }).catch(() => {})
    }, 20_000)
    return () => clearTimeout(t)
  }, [outreach, airtableConnected])
  const [hasBackup, setHasBackup] = useState(false)
  // Phase 2: Send-via-Unipile preview modal. Triggered by a CustomEvent
  // dispatched from the existing email-link click handlers when the
  // current user has a Unipile-connected Gmail. Falls back to the
  // compose-URL flow otherwise.
  const [sendPreview, setSendPreview] = useState<{
    entryId: string
    to: string
    subject: string
    body: string
    recipientLabel: string
    /** When true, the send modal's primary button reads
     *  "Send follow-up" instead of "Send outreach". Set by the
     *  caller — Follow-up rows always pass true; the Lead Detail
     *  modal computes it from whether the entry has already been
     *  contacted (reachedOut/dateReachedOut). */
    isFollowUp?: boolean
  } | null>(null)
  const [unipileConnected, setUnipileConnected] = useState(false)
  // Phase 4: Conversation thread modal — opened by clicking the
  // 💬 icon on an outreach row that has a unipile_thread_id.
  const [threadModal, setThreadModal] = useState<{ entryId: string; label: string } | null>(null)
  // Manual migration prompt state
  const [pendingMigration, setPendingMigration] = useState<{ outreach: number; dismissed: number } | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showImportDismissed, setShowImportDismissed] = useState(false)

  // Derive the active platform config
  const platformConfig = PLATFORM_CONFIGS.find(p => p.id === activePlatform)!

  // Active platform's Outreach column config — derived from the
  // per-platform map. Falls back to the platform's PLATFORM_OUTREACH_DEFAULTS
  // when the user hasn't customized that platform yet.
  const outreachColConfig: OutreachColConfig[] =
    outreachColConfigByPlatform[activePlatform] ?? PLATFORM_OUTREACH_DEFAULTS[activePlatform]

  // Auto-show OUTREACH_PLATFORM_AUTOSHOW columns when the active
  // platform changes. Same pattern Results uses: switching to
  // Instagram auto-shows IG Followers/Posts, switching to X
  // auto-shows xFollowers/xPosts, etc. Only force-shows columns
  // that are currently hidden — doesn't override user reordering
  // or anything else.
  //
  // Skips on initial mount (autoShowFiredOnceRef) so we don't
  // override the user's saved config the moment the app loads.
  const autoShowFiredOnceRef = useRef(false)
  useEffect(() => {
    if (!autoShowFiredOnceRef.current) {
      autoShowFiredOnceRef.current = true
      return
    }
    const idsToShow = OUTREACH_PLATFORM_AUTOSHOW[activePlatform] ?? []
    if (idsToShow.length === 0) return
    const current = outreachColConfigByPlatform[activePlatform]
    if (!current) return
    let changed = false
    const next = current.map(col => {
      if (col.visible) return col
      if (!idsToShow.includes(col.id as string)) return col
      changed = true
      return { ...col, visible: true }
    })
    if (changed) {
      const updated: Record<PlatformId, OutreachColConfig[]> = {
        ...outreachColConfigByPlatform,
        [activePlatform]: next,
      }
      setOutreachColConfigByPlatform(updated)
      void saveOutreachColConfig(updated)
    }
    // outreachColConfigByPlatform intentionally not in deps — we
    // only want this firing on platform change, not on every config
    // tweak (which would create an infinite loop with the setter
    // above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlatform])

  // Setter that writes only to the active platform's slot AND
  // persists the whole map. Used by reorderOutreachCols + Customize
  // modal Save so user reorders/visibility changes stick to the
  // current platform without disturbing the other four.
  function setActivePlatformOutreachCols(next: OutreachColConfig[]) {
    const updated: Record<PlatformId, OutreachColConfig[]> = {
      ...outreachColConfigByPlatform,
      [activePlatform]: next,
    }
    setOutreachColConfigByPlatform(updated)
    void saveOutreachColConfig(updated)
  }

  // Auto-inject a locked guidance entry for the active platform (not stored in state)
  const platformEntry: GuidanceEntry | null = useMemo(() => {
    if (!platformConfig.condition) return null
    return {
      id: PLATFORM_LOCK_ID,
      text: platformConfig.label,
      timestamp: 0,
      rules: [{ condition: platformConfig.condition, points: 10, label: platformConfig.chipLabel }],
      summary: `Creator is active on ${platformConfig.label}`,
      weight: platformConfig.chipWeight,
    }
  }, [platformConfig])

  // Effective entries = platform lock (if any) + user chips
  const effectiveGuidanceEntries = useMemo(
    () => platformEntry ? [platformEntry, ...guidanceEntries] : guidanceEntries,
    [platformEntry, guidanceEntries]
  )

  // Effective col config: bring the platform's column to the front and ensure it's visible
  const effectiveColConfig = useMemo(() => {
    const isYouTube = platformConfig.id === 'youtube'
    const autoShow = PLATFORM_AUTOSHOW_COLS[platformConfig.id] ?? []

    // 2026-05-10 per Dylan: 'when you change Find ___ creators,
    // Insta/YouTube/X should default on the results columns; the
    // selected one is first, then email, then the other two; if a
    // 4th social is selected outside those 3, there will be 4
    // total.' Implemented as an explicit ordered cluster below:
    //   selected-platform-col → email → other social cols
    // The cluster is moved to the front of the visible-column list
    // (channel name is implicit, not in colConfig).
    //
    // 2026-05-11 update: for YouTube the cluster is just [email].
    // Dylan wants YouTube Results to read
    //   Channel · Email · Fit Score · Avg Views · Subscribers · Last
    //   Video · Instagram · X · LinkedIn
    // so the socials stay at the END in their DEFAULT_COLS order
    // rather than getting hoisted next to email. Other platforms still
    // get the full cluster treatment because their dedicated column
    // is the primary signal (IG view leads with the IG col, etc.).
    const TRIO_SOCIALS: ColId[] = ['instagram', 'twitter']
    const selected: ColId | null = (platformConfig.column as ColId | null) ?? null

    let cols = colConfig.map(c => {
      // Hide YouTube-only metrics on non-YouTube platforms.
      if (!isYouTube && (c.id === 'avgViews' || c.id === 'subscribers' || c.id === 'lastVideo' || c.id === 'lastShort')) {
        return { ...c, visible: false }
      }
      // Hide the dedicated YouTube column on YouTube platform — the
      // Channel name column already IS the YT link, so showing both
      // would just be duplicate hyperlinks. On every other platform
      // it gets force-shown by the cluster block below.
      // Dylan 2026-06-09.
      if (isYouTube && c.id === 'youtube') {
        return { ...c, visible: false }
      }
      // Force the selected platform's column visible.
      if (selected && c.id === selected) return { ...c, visible: true }
      // Force email + trio socials always visible in Results.
      if (c.id === 'email' || TRIO_SOCIALS.includes(c.id)) return { ...c, visible: true }
      // Force YouTube column visible on non-YouTube platforms — Dylan
      // 2026-06-09: when searching IG/X/TikTok/LinkedIn, the YT
      // channel link is high-signal context for evaluating fit.
      if (!isYouTube && c.id === 'youtube') return { ...c, visible: true }
      // Platform-specific auto-show columns (e.g. IG followers + posts).
      if (autoShow.includes(c.id)) return { ...c, visible: true }
      return c
    })

    // Build the desired ordered cluster:
    //   YouTube: [email]                                       — socials stay at end
    //   Other:   [selected, email, youtube, other trio socials]
    //
    // Dylan 2026-06-09: YouTube column hoisted to right after email
    // on non-YouTube platforms. Rationale: when searching IG/X/TT/LI,
    // the creator's YT channel is the most valuable cross-platform
    // signal (audience, output cadence, monetization) — surface it
    // ahead of the other social handles.
    const clusterIds: ColId[] = []
    if (isYouTube) {
      clusterIds.push('email')
    } else {
      if (selected && selected !== 'email') clusterIds.push(selected)
      clusterIds.push('email')
      clusterIds.push('youtube')
      for (const id of TRIO_SOCIALS) {
        if (id !== selected) clusterIds.push(id)
      }
    }
    // Remove these from wherever they currently are, then re-insert
    // them at the front of the column list in cluster order.
    const cluster: ColConfig[] = []
    for (const id of clusterIds) {
      const idx = cols.findIndex(c => c.id === id)
      if (idx >= 0) {
        const [m] = cols.splice(idx, 1)
        cluster.push(m)
      }
    }
    cols = [...cluster, ...cols]

    // Position auto-show metric columns (e.g. IG followers/posts) right
    // after the platform's social column so they read together.
    if (autoShow.length > 0 && selected) {
      const anchor = cols.findIndex(c => c.id === selected)
      const target = anchor >= 0 ? anchor + 1 : 0
      const moved: ColConfig[] = []
      for (const id of autoShow) {
        const idx = cols.findIndex(c => c.id === id)
        if (idx >= 0 && idx !== target + moved.length) {
          const [m] = cols.splice(idx, 1)
          moved.push(m)
        }
      }
      cols.splice(target, 0, ...moved)
    }
    return cols
  }, [colConfig, platformConfig])

  // search version ref — prevents stale searches from overwriting newer ones
  const searchVersion = useRef(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setSuggestions(pickRandom(ALL_OCCUPATIONS, 25))
    ;(async () => {
      // Resolve session + profile, decide whether to show onboarding
      const supabase = createSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        setUserEmail(user.email ?? null)

        // Team context — fire-and-forget. Failure is non-fatal; the
        // hamburger just won't show the team entry until next page load.
        // Also fetch team members so OutreachTab can render the
        // assignee filter + reassign popovers without a roundtrip on
        // first interaction.
        fetch('/api/team/context')
          .then(r => r.json())
          .then(async data => {
            setTeamContext({
              mode: data.mode === 'team' ? 'team' : 'individual',
              organization: data.organization
                ? { id: data.organization.id, name: data.organization.name }
                : null,
              role: data.role ?? null,
            })
            if (data.mode === 'team') {
              // Hydrate the member list. Soft-fails to empty array so
              // the team UI just doesn't render until next try.
              const { fetchTeamMembers } = await import('@/lib/team-client')
              const mRes = await fetchTeamMembers()
              if (mRes?.members) setTeamMembers(mRes.members)
            }
          })
          .catch(() => setTeamContext({ mode: 'individual', organization: null, role: null }))

        // Migration-tolerant profile load. The template columns
        // (email_template, ig_dm_template, etc.) and footer columns
        // were added in migration 0026. If that migration hasn't been
        // applied yet, the full SELECT below errors with "column does
        // not exist" → profileRow=null → subscription state never
        // populates → UpgradeButton flips back to "Upgrade" instead of
        // "Trial · Xd left" (and the rest of the home page goes blank).
        //
        // To avoid that blast radius, we try the full SELECT first; on
        // failure we retry with the legacy (pre-0026) SELECT that omits
        // the new template + footer columns. Optional fields stay
        // undefined and the defaults in lib/templates.ts kick in.
        const BASE_COLS = 'full_name, linkedin_url, pitch_line, subject_template, mail_client, onboarded, timezone, unipile_account_id, unipile_account_email, unipile_connected_at, physical_address, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, subscription_price_id, subscription_cancel_at_period_end'
        const TEMPLATE_COLS = 'email_template, ig_dm_template, linkedin_dm_template, x_dm_template, tiktok_dm_template, include_can_spam_footer, footer_disabled_acknowledged_at'
        const CONSENT_COLS = 'terms_privacy_agreed_at, terms_privacy_version'
        // target_audience (migration 0039) is its OWN tier. Audit
        // 2026-06-10: it was bundled into TEMPLATE_COLS, so if 0039
        // wasn't applied to prod, the FULL_COLS SELECT failed and the
        // fallback dropped ALL the 0026 template columns — every user's
        // custom templates appeared blank. Now a missing 0039 only
        // costs target_audience; templates survive.
        const TARGET_AUDIENCE_COL = 'target_audience'
        // followup_config (migration 0053) gets its OWN tier for the same
        // reason as target_audience — a missing 0053 must NOT blank out the
        // 0026 templates. It rides FULL only; MID/BASE omit it, so an
        // unapplied 0053 costs only followup_config (falls back to the
        // bundled default set), templates survive.
        const FOLLOWUP_COL = 'followup_config'
        const FULL_COLS = `${BASE_COLS}, ${TEMPLATE_COLS}, ${CONSENT_COLS}, ${TARGET_AUDIENCE_COL}, ${FOLLOWUP_COL}`
        const MID_COLS = `${BASE_COLS}, ${TEMPLATE_COLS}, ${CONSENT_COLS}` // everything except 0039 + 0053

        let { data: profileRow, error: profileErr } = await supabase
          .from('user_profile')
          .select(FULL_COLS)
          .eq('user_id', user.id)
          .maybeSingle()
        if (profileErr) {
          // Tier 2: drop only target_audience (0039 unapplied) — keeps
          // 0026 templates + 0027 consent intact.
          console.warn('[home-init] full SELECT failed (likely missing migration 0039), retrying without target_audience:', profileErr.message)
          const mid = await supabase
            .from('user_profile')
            .select(MID_COLS)
            .eq('user_id', user.id)
            .maybeSingle()
          if (mid.error) {
            // Tier 3: drop templates + consent too (pre-0026 env).
            console.warn('[home-init] mid SELECT failed (likely missing migration 0026), retrying with base cols:', mid.error.message)
            const retry = await supabase
              .from('user_profile')
              .select(BASE_COLS)
              .eq('user_id', user.id)
              .maybeSingle()
            profileRow = retry.data as unknown as typeof profileRow
            profileErr = retry.error
          } else {
            profileRow = mid.data as unknown as typeof profileRow
            profileErr = mid.error
          }
        }

        // Defensive: if no profile row exists (trigger may have failed),
        // create one ourselves before continuing. The INSERT only writes
        // base columns so it succeeds whether or not 0026 has applied.
        if (!profileRow) {
          console.warn('[home-init] no profile row, creating one')
          let inserted: typeof profileRow = null
          const ins1 = await supabase
            .from('user_profile')
            .insert({ user_id: user.id, email: user.email ?? '', onboarded: false })
            .select(FULL_COLS)
            .single()
          if (ins1.error) {
            const ins2 = await supabase
              .from('user_profile')
              .insert({ user_id: user.id, email: user.email ?? '', onboarded: false })
              .select(BASE_COLS)
              .single()
            inserted = ins2.data as unknown as typeof profileRow
          } else {
            inserted = ins1.data as unknown as typeof profileRow
          }
          profileRow = inserted
        }

        // Bump last_seen_at + auto-detect timezone on every load.
        //
        // last_seen_at: real "user is active" signal — auth's
        // last_sign_in_at only moves on re-authentication, so a
        // user with a valid session can be active daily and still
        // look idle in the admin dashboard. Backed by migration 0016.
        //
        // timezone: catches a user signing in from a new machine in a
        // different TZ. Backed by migration 0015. Cheap to write
        // unconditionally — it's a single TEXT column and we're
        // already writing the row.
        //
        // Failures non-fatal (e.g. a missing column on a not-yet-
        // migrated env): log + continue.
        try {
          const detectedTz =
            typeof Intl !== 'undefined'
              ? Intl.DateTimeFormat().resolvedOptions().timeZone || null
              : null
          const updates: Record<string, string> = {
            last_seen_at: new Date().toISOString(),
          }
          if (detectedTz && detectedTz !== profileRow?.timezone) {
            updates.timezone = detectedTz
          }
          await supabase
            .from('user_profile')
            .update(updates)
            .eq('user_id', user.id)
          if (profileRow && updates.timezone) profileRow.timezone = updates.timezone

          // ── GDPR Art. 7 consent backfill ─────────────────────────
          // If this user just completed signup (consent checkbox was
          // checked), the signup page stashed { agreedAt, version } in
          // localStorage AND in auth user_metadata. Either source is
          // valid audit-trail evidence; we promote whichever is present
          // into user_profile.terms_privacy_agreed_at on first home load.
          // Once written we clear the localStorage stash (DB is the
          // source of truth from here on).
          //
          // Tolerant of migration 0027 not having applied yet — the
          // UPDATE for missing columns errors silently and we log and
          // continue without crashing the home page.
          try {
            const tplRow = profileRow as typeof profileRow & {
              terms_privacy_agreed_at?: string | null
              terms_privacy_version?: string | null
            }
            const alreadyConsented = !!tplRow.terms_privacy_agreed_at
            if (!alreadyConsented) {
              type ConsentStash = { agreedAt: string; version: string }
              let consent: ConsentStash | null = null
              try {
                const raw =
                  typeof window !== 'undefined'
                    ? window.localStorage.getItem('co_terms_privacy_consent')
                    : null
                if (raw) consent = JSON.parse(raw) as ConsentStash
              } catch { /* ignore parse errors */ }
              // Fallback to user_metadata if localStorage was cleared.
              if (!consent && user.user_metadata) {
                const md = user.user_metadata as Record<string, unknown>
                if (typeof md.terms_privacy_agreed_at === 'string' && typeof md.terms_privacy_version === 'string') {
                  consent = {
                    agreedAt: md.terms_privacy_agreed_at,
                    version: md.terms_privacy_version,
                  }
                }
              }
              if (consent) {
                const { error: consentErr } = await supabase
                  .from('user_profile')
                  .update({
                    terms_privacy_agreed_at: consent.agreedAt,
                    terms_privacy_version: consent.version,
                  })
                  .eq('user_id', user.id)
                if (!consentErr) {
                  if (profileRow) {
                    profileRow.terms_privacy_agreed_at = consent.agreedAt
                    profileRow.terms_privacy_version = consent.version
                  }
                  try {
                    window.localStorage.removeItem('co_terms_privacy_consent')
                  } catch { /* ignore */ }
                }
              }
            }
          } catch (consentBackfillErr) {
            console.warn('[home-init] consent backfill failed:', consentBackfillErr)
          }
        } catch (tzErr) {
          console.warn('[home-init] last_seen/timezone update failed:', tzErr)
        }

        if (profileRow) {
          // Cast for migration-tolerant target_audience read — the
          // base SELECT may not include it on environments without
          // 0039 applied. Falls back to null.
          const profileRowAny = profileRow as typeof profileRow & {
            target_audience?: string | null
          }
          setProfile({
            fullName: profileRow.full_name ?? '',
            linkedinUrl: profileRow.linkedin_url ?? '',
            pitchLine: profileRow.pitch_line ?? '',
            targetAudience: profileRowAny.target_audience ?? null,
            subjectTemplate: profileRow.subject_template ?? undefined,
            mailClient: (profileRow.mail_client ?? 'default') as UserProfile['mailClient'],
            // Auth email — used by composeUrl to pin the Gmail/Outlook
            // compose window to the right multi-account browser session.
            userEmail: user.email ?? undefined,
            unipileAccountId: profileRow.unipile_account_id ?? null,
            unipileAccountEmail: profileRow.unipile_account_email ?? null,
            unipileConnectedAt: profileRow.unipile_connected_at
              ? new Date(profileRow.unipile_connected_at).getTime()
              : null,
            physicalAddress: profileRow.physical_address ?? null,
            // Per-platform templates + CAN-SPAM footer toggle. The
            // SELECT above includes these; nullable when the migration
            // hasn't applied yet, so we cast through a permissive
            // shape and default everything safely.
            ...(() => {
              const tplRow = profileRow as typeof profileRow & {
                email_template?: string | null
                ig_dm_template?: string | null
                linkedin_dm_template?: string | null
                x_dm_template?: string | null
                tiktok_dm_template?: string | null
                include_can_spam_footer?: boolean | null
                footer_disabled_acknowledged_at?: string | null
                terms_privacy_agreed_at?: string | null
                terms_privacy_version?: string | null
                followup_config?: UserProfile['followUpConfig']
              }
              return {
                emailTemplate: tplRow.email_template ?? null,
                igDmTemplate: tplRow.ig_dm_template ?? null,
                linkedinDmTemplate: tplRow.linkedin_dm_template ?? null,
                xDmTemplate: tplRow.x_dm_template ?? null,
                tiktokDmTemplate: tplRow.tiktok_dm_template ?? null,
                includeCanSpamFooter: tplRow.include_can_spam_footer ?? true,
                footerDisabledAcknowledgedAt:
                  tplRow.footer_disabled_acknowledged_at ?? null,
                termsPrivacyAgreedAt: tplRow.terms_privacy_agreed_at ?? null,
                termsPrivacyVersion: tplRow.terms_privacy_version ?? null,
                followUpConfig: tplRow.followup_config ?? null,
              }
            })(),
          })
          setUnipileConnected(!!profileRow.unipile_account_id)
          // Stripe subscription mirror. profileRow may not have these
          // columns yet on environments where migration 0022 hasn't
          // been applied — guard accordingly. Casting via a typed
          // helper since the wider profile select returns a permissive
          // shape and we don't want a TS error on missing optional cols.
          const subRow = profileRow as typeof profileRow & {
            stripe_customer_id?: string | null
            subscription_status?: string | null
            subscription_price_id?: string | null
            subscription_current_period_end?: string | null
            subscription_cancel_at_period_end?: boolean | null
          }
          setSubscription({
            status: subRow.subscription_status ?? null,
            priceId: subRow.subscription_price_id ?? null,
            currentPeriodEnd: subRow.subscription_current_period_end ?? null,
            cancelAtPeriodEnd: !!subRow.subscription_cancel_at_period_end,
            stripeCustomerId: subRow.stripe_customer_id ?? null,
          })
          if (!profileRow.onboarded) {
            setShowOnboarding(true)
          }
        } else {
          // Profile row couldn't be loaded or created (the defensive insert
          // above failed) — still show onboarding so the user sets a sender
          // name instead of silently landing with a blank "from" on their
          // outreach emails. (Audit P1.)
          setShowOnboarding(true)
        }
      }

      // Check if there's localStorage data waiting to be imported. If so,
      // show the manual migration prompt — never auto-migrate so the user
      // always sees what's happening.
      const pending = getPendingMigrationCounts()
      if (pending.hasAny && !getMigrationSkipped()) {
        setPendingMigration({ outreach: pending.outreach, dismissed: pending.dismissed })
      }
      // The "Retry data migration" item in the hamburger menu shows up when
      // a backup blob exists (created the first time we run a migration).
      setHasBackup(hasMigrationBackup())

      const storedOutreach = await getOutreach()
      setOutreach(storedOutreach)
      setOutreachIds(new Set(storedOutreach.map(e => e.channelId)))

      // Bind a reloader the team-aware UI can call after a reassign
      // so the row appears in its new bucket without a full page
      // refresh. Defined here so it closes over the same setters.
      reloadOutreachRef.current = async () => {
        const fresh = await getOutreach()
        setOutreach(fresh)
      }

      // Per-platform Outreach column configs. The shape is
      // `Partial<Record<PlatformId, OutreachColConfig[]>>` — any
      // platform the user hasn't customized yet is missing and
      // falls back to PLATFORM_OUTREACH_DEFAULTS. The merge function
      // below preserves user reordering AND surfaces any new columns
      // added since their last save.
      const storedByPlatform = await getOutreachColConfig()
      if (storedByPlatform) {
        const mergeForPlatform = (
          stored: OutreachColConfig[] | undefined,
          platform: PlatformId,
        ): OutreachColConfig[] => {
          if (!stored || stored.length === 0) return PLATFORM_OUTREACH_DEFAULTS[platform]
          // Iterate stored in stored order — preserves user reordering.
          const result: OutreachColConfig[] = []
          const seen = new Set<string>()
          for (const s of stored) {
            const def = ALL_OUTREACH_COLS.find(d => d.id === s.id)
            if (!def) continue // column removed since save — drop
            const width = Math.max(s.width, def.defaultWidth)
            result.push({ ...def, visible: s.visible, width })
            seen.add(s.id as string)
          }
          // Append any new columns (added since last save) at the end,
          // using the platform's default visibility so X-metric cols
          // don't show up on the YouTube view by accident.
          for (const def of ALL_OUTREACH_COLS) {
            if (seen.has(def.id as string)) continue
            const platformDef = PLATFORM_OUTREACH_DEFAULTS[platform].find(p => p.id === def.id)
            result.push(
              platformDef ?? { ...def, visible: def.defaultVisible, width: def.defaultWidth },
            )
          }
          return result
        }

        const merged: Record<PlatformId, OutreachColConfig[]> = {
          youtube:   mergeForPlatform(storedByPlatform.youtube,   'youtube'),
          instagram: mergeForPlatform(storedByPlatform.instagram, 'instagram'),
          tiktok:    mergeForPlatform(storedByPlatform.tiktok,    'tiktok'),
          twitter:   mergeForPlatform(storedByPlatform.twitter,   'twitter'),
          linkedin:  mergeForPlatform(storedByPlatform.linkedin,  'linkedin'),
        }

        // One-time deprecation (Dylan 2026-06-10): force-hide the
        // "Reached Out" + "Follow Up Date" columns in EXISTING saved
        // configs once, so the cleaned-up default actually reaches
        // users who already customized. Guarded by a localStorage flag
        // so we only do it once — afterward the user can freely re-add
        // either column via Customize Columns and it sticks.
        const DEPRECATE_FLAG = 'outreach-cols-deprecated-v1'
        const DEPRECATED_HIDDEN = new Set(['reachedOut', 'followUpDate'])
        let configToUse = merged
        try {
          if (typeof window !== 'undefined' && !window.localStorage.getItem(DEPRECATE_FLAG)) {
            configToUse = Object.fromEntries(
              (Object.entries(merged) as Array<[PlatformId, OutreachColConfig[]]>).map(([p, cols]) => [
                p,
                cols.map(c => (DEPRECATED_HIDDEN.has(c.id as string) ? { ...c, visible: false } : c)),
              ]),
            ) as Record<PlatformId, OutreachColConfig[]>
            window.localStorage.setItem(DEPRECATE_FLAG, '1')
            void saveOutreachColConfig(configToUse) // persist the cleaned layout
          }
        } catch { /* localStorage unavailable — non-fatal, just skip the one-time strip */ }

        setOutreachColConfigByPlatform(configToUse)
      }

      const storedMetrics = await getCustomMetrics()
      setCustomMetrics(storedMetrics)

      const storedDismissed = await getDismissed()
      setDismissed(storedDismissed)
      setDismissedIds(new Set(storedDismissed.map(c => c.channelId)))

      const { weights: w0, narrative: n0, guidance: g0 } = await loadPlatformState('youtube')
      setScoreWeights(w0)
      setScoreNarrative(n0)
      setGuidanceEntries(g0)
    })()
  }, [])

  // elapsed timer while loading
  useEffect(() => {
    if (loading) {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [loading])

  // Phase 2 send-via-Unipile bridge. Existing email-link click handlers
  // dispatch a `open-send-modal` CustomEvent with the prebuilt subject /
  // body / recipient when the user has a connected Unipile account.
  // We catch it here and open the SendPreviewModal — that way we don't
  // have to thread an onSendOutreach callback through every component
  // that renders an email link.
  useEffect(() => {
    function onOpenSendModal(ev: Event) {
      const detail = (ev as CustomEvent).detail as {
        entryId?: string
        to?: string
        subject?: string
        body?: string
        recipientLabel?: string
        isFollowUp?: boolean
      } | undefined
      if (!detail?.entryId || !detail.to || !detail.subject || !detail.body) return
      setSendPreview({
        entryId: detail.entryId,
        to: detail.to,
        subject: detail.subject,
        body: detail.body,
        recipientLabel: detail.recipientLabel ?? detail.to,
        isFollowUp: !!detail.isFollowUp,
      })
    }
    function onOpenThreadModal(ev: Event) {
      const detail = (ev as CustomEvent).detail as { entryId?: string; label?: string } | undefined
      if (!detail?.entryId) return
      setThreadModal({ entryId: detail.entryId, label: detail.label ?? '' })
    }
    window.addEventListener('open-send-modal', onOpenSendModal)
    window.addEventListener('open-thread-modal', onOpenThreadModal)
    return () => {
      window.removeEventListener('open-send-modal', onOpenSendModal)
      window.removeEventListener('open-thread-modal', onOpenThreadModal)
    }
  }, [])

  /**
   * Multi-column-sort click handler. Clicking any column header:
   *   - If column is already PRIMARY: toggles direction (desc → asc).
   *     A second click on asc removes the column from the chain
   *     entirely (so users can clear without a "reset" button).
   *   - If column is in the chain but NOT primary: promotes to
   *     primary, demotes the rest by one priority level. Direction
   *     resets to desc.
   *   - If column is NEW: prepends as primary, demotes the rest.
   *     Direction defaults to desc.
   *
   * Three-state per-column cycle: off → desc → asc → off.
   */
  // Wrapped in useCallback so the reference is stable across renders —
  // matters once children that receive `onSort` are memoized (Phase 3b).
  // Body uses only functional setState (setSorts(prev => …)), so an
  // empty dep array is safe here.
  // 2026-05-11 per Dylan: simplified from multi-sort to single-column
  // sort. The old behavior promoted the clicked column to primary
  // while keeping previous sorts as secondary, which surfaced a
  // priority badge ("1", "2", "3"...) that felt weird and useless.
  // Now clicking a header just replaces the sort. Three-state cycle:
  //   off → desc → asc → off.
  const handleSort = useCallback((col: SortCol) => {
    setSorts(prev => {
      const cur = prev[0]
      if (cur?.col === col) {
        if (cur.dir === 'desc') return [{ col, dir: 'asc' }]
        return [] // toggle off after asc
      }
      return [{ col, dir: 'desc' }]
    })
  }, [])

  // ── Delta saves (2026-07-09 perf) ────────────────────────────────────
  // The old shared saveOutreach(updated) wrapper persisted the ENTIRE
  // list through the full-snapshot storage path on every single-row
  // change — a 1-row status flip on a 500-lead board re-uploaded 500
  // rows (plus a full-table id read). These two commit helpers keep the
  // exact same state updates but persist only what actually changed.
  // Full-snapshot persistOutreach() remains in use where a whole list is
  // genuinely the payload (CSV import, localStorage migration).

  /** Commit new state + upsert ONLY the changed/added rows. `changed`
   *  must be the same objects placed into `updated`. */
  function saveOutreachDelta(updated: OutreachEntry[], changed: OutreachEntry[]) {
    setOutreach(updated)
    setOutreachIds(new Set(updated.map(e => e.channelId)))
    if (changed.length > 0) void upsertOutreachRows(changed)
  }

  /** Commit new state + delete ONLY the explicitly removed row ids.
   *  Pass ids from the user's action, never a diff (see storage.ts). */
  function saveOutreachRemoval(updated: OutreachEntry[], removedIds: string[]) {
    setOutreach(updated)
    setOutreachIds(new Set(updated.map(e => e.channelId)))
    if (removedIds.length > 0) void deleteOutreachRows(removedIds)
  }

  function addGuidanceEntry(entry: GuidanceEntry) {
    setGuidanceEntries(prev => {
      const updated = [...prev, entry]
      void savePlatformGuidance(activePlatform, updated)
      return updated
    })
  }

  function removeGuidanceEntry(id: string) {
    setGuidanceEntries(prev => {
      const updated = prev.filter(e => e.id !== id)
      void savePlatformGuidance(activePlatform, updated)
      return updated
    })
  }

  function updateGuidanceEntryWeight(id: string, weight: number) {
    setGuidanceEntries(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, weight } : e)
      void savePlatformGuidance(activePlatform, updated)
      return updated
    })
  }

  function resetAllGuidance() {
    setGuidanceEntries([])
    void clearPlatformGuidance(activePlatform)
  }

  function addToOutreach(c: Creator) {
    if (outreachIds.has(c.channelId)) {
      removeOutreachEntry(outreach.find(e => e.channelId === c.channelId)?.id || '')
      return
    }
    const entry: OutreachEntry = {
      id: `${c.channelId}-${Date.now()}`,
      channelId: c.channelId,
      channelName: c.channelName,
      channelUrl: c.channelUrl,
      description: c.description || '',
      email: c.email || '',
      // Carry the detected product (Results "Product" column) into the
      // outreach entry so it doesn't read blank after adding. Editable
      // afterwards — the user can replace it with their own pitch.
      product: c.productSummary || '',
      favorite: false,
      reachedOut: false,
      medium: '',
      mediumOther: '',
      headerUsed: '',
      status: 'Not Outreached',
      addedAt: Date.now(),
      // Short opaque ID embedded in outbound email subjects so the
      // inbound webhook can match replies. 8 chars of base36 ≈ 2.8e12
      // possible values — collision-free at our scale.
      trackingId: Math.random().toString(36).slice(2, 10),
      notes: '',
      followUpDate: '',
      dateReachedOut: '',
      touchpoints: '',
      responseDate: '',
      subscribers: c.subscribers || '',
      avgViews: c.avgViews || 0,
      fitScore: computeFitScore(c, scoreWeights, effectiveGuidanceEntries),
      linkedin: c.linkedin || '',
      instagram: c.instagram || '',
      twitter: c.twitter || '',
      tiktok: c.tiktok || '',
      website: c.website || '',
      contentNiche: '',
      phone: '',
      dealValue: '',
      contractSent: false,
      meetingScheduled: '',
    }
    saveOutreachDelta([...outreach, entry], [entry])
    // Pin the newly-added id so it shows at the top of the Outreach
    // tab, even if the user is currently on Results and the
    // OutreachTab component will mount fresh when they switch over.
    setRecentlyAddedIds(prev => new Set([...prev, entry.id]))
  }

  // Backfill the outreach "Product" from the Results "Product"
  // (productSummary) for leads added before the carry-over existed, or
  // added before their product finished enriching. Fill-ONLY: never
  // overwrites a product the user typed. Matched by channelId, so it
  // only touches leads that came from a loaded Result. Self-limiting —
  // once filled, entries stop matching, so it settles after one pass.
  useEffect(() => {
    if (creators.length === 0 || outreach.length === 0) return
    const productById = new Map<string, string>()
    for (const c of creators) {
      if (c.productSummary) productById.set(c.channelId, c.productSummary)
    }
    if (productById.size === 0) return
    const changedRows: OutreachEntry[] = []
    const updated = outreach.map(e => {
      if (!e.product && productById.has(e.channelId)) {
        const filled = { ...e, product: productById.get(e.channelId) as string }
        changedRows.push(filled)
        return filled
      }
      return e
    })
    if (changedRows.length > 0) saveOutreachDelta(updated, changedRows)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creators, outreach])

  // Log a manual follow-up send confirmed via the PendingResponsePrompt
  // ('followup' kind): bump touchpoints, stamp today as the last touch,
  // and schedule the next follow-up on the cadence (business days for
  // the first, calendar 7/14/21 after). Mirrors the "Followed up"
  // button in OutreachFollowUps so both paths stay in lock-step.
  function logFollowUpTouch(id: string) {
    const target = outreach.find(e => e.id === id)
    const cur = parseInt(target?.touchpoints || '0', 10) || 0
    const next = cur + 1
    const nextDate = nextFollowUpIso(next)
    const changedRow: OutreachEntry | null = target ? {
      ...target,
      touchpoints: String(next),
      dateReachedOut: todayIso(),
      followUpDate: nextDate,
      status: (target.status === 'Not Outreached' || !target.status) ? 'No Response' : target.status,
    } : null
    saveOutreachDelta(
      changedRow ? outreach.map(e => (e.id === id ? changedRow : e)) : outreach,
      changedRow ? [changedRow] : [],
    )
    // Visible receipt — mirrors markFollowedUp's toast so both logging
    // paths (return-prompt + button) confirm identically.
    toast.success(`Logged ${followUpStageLabel(cur).toLowerCase()} for ${target?.channelName || 'lead'} — now touch ${next}`, {
      description: `Next follow-up due ${formatDueDate(nextDate)}`,
    })
  }

  // Results reorder is safe to memoize — only stable setters + a
  // module-level import; nothing else captured.
  const reorderResultCols = useCallback((newConfig: ColConfig[]) => {
    setColConfig(newConfig)
    setDraftCols(newConfig)
    void saveColConfig(newConfig)
  }, [])

  // Outreach reorder is intentionally NOT memoized (Dylan 2026-06-09):
  // useCallback with [] deps was freezing the first-render version of
  // setActivePlatformOutreachCols (which captures both activePlatform
  // AND outreachColConfigByPlatform via closure). After the DB load
  // populated outreachColConfigByPlatform, drag-drop kept writing to
  // the snapshot from before the load — so the new order appeared to
  // "snap back" because the actual state update merged into a stale
  // map and was immediately re-derived from the latest map. Recreating
  // per render captures the current closure on every call, no extra
  // cost since OutreachTab isn't memoized anyway.
  const reorderOutreachCols = (newConfig: OutreachColConfig[]) => {
    setActivePlatformOutreachCols(newConfig)
    setDraftOutreachCols(newConfig)
  }

  // ---------------------------------------------------------------------
  // Phase 3b memoization helpers — extracted from inline arrows in JSX so
  // their reference is stable across renders. Required for the memoized
  // children (FollowUpRow, FUStat, FitScoreCell, etc.) to actually skip
  // re-renders when this parent re-renders for unrelated reasons.
  // ---------------------------------------------------------------------

  // Opens the lead-detail modal. Pure setter — empty deps are correct.
  const openLeadDetail = useCallback((id: string) => {
    setViewingLeadId(id)
  }, [])

  // Clears the "recently added" pin pool and its companion interacted
  // set. Both are local setters with no closure reads.
  const clearRecentlyAdded = useCallback(() => {
    setRecentlyAddedIds(new Set())
    setInteractedNewIds(new Set())
  }, [])

  // Marks a newly-added outreach id as "interacted" so the highlight
  // fades. Functional setter (prev => …) keeps this independent of
  // current state, so the empty dep array is correct.
  const markNewInteracted = useCallback((id: string) => {
    setInteractedNewIds(prev => {
      if (prev.has(id)) return prev // no-op if already marked
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  // Pending status-change requiring user confirmation. Currently used
  // for the "leaving Successful" intercept — flipping status away from
  // Successful auto-hides the row from Active Clients, so we ask first
  // (Dylan 2026-06-08). Other status flips proceed without prompting.
  const [pendingRevert, setPendingRevert] = useState<PendingRevert | null>(null)

  // Internal: apply ONE atomic multi-field update without running any
  // guards. Both the normal update paths and the modal-confirm path call
  // this. Extracted so the confirm callback can persist without
  // re-entering the guard (which would create an infinite loop).
  //
  // 2026-07-07 — multi-field by design. The old single-field version made
  // sequential callers (markFollowedUp fired FOUR back-to-back updates)
  // each map over the SAME stale `outreach` snapshot, so React kept only
  // the last one: "Followed up" saved the date but silently dropped the
  // touchpoint increment — which is why follow-up stages never advanced.
  // One call, one snapshot, all fields. Explicit fields always win over
  // the status side-effects below.
  function applyOutreachUpdates(id: string, fields: Partial<OutreachEntry>) {
    const target = outreach.find(x => x.id === id)
    if (!target) return
    // Kept as `e` so the status side-effect body below reads identically
    // to its long-standing map-callback form (same names, same logic) —
    // restructured 2026-07-09 so the updated row is computed once up
    // front and the DB write can be a single-row delta.
    const e = target
    const updated = { ...e, ...fields }

    if (fields.status !== undefined) {
      const value = fields.status
      // No toasts on status changes (Successful / Rejected / No
      // Response / Not Outreached / Open) — every transition was
      // popping a notification in the bottom-right which felt
      // noisy for routine triage. The confetti animation still
      // fires on first-time Successful so the dopamine moment
      // isn't lost.
      if (value === 'Successful' && e.status !== 'Successful') {
        celebrateSuccess()
        // 2026-05-23: pair the confetti with a subtle CTA toast
        // that lets the user jump straight to the new Active
        // Client engagement card.
        setSuccessToast({
          entryId: e.id,
          channelName: e.channelName || 'Engagement',
        })
      }

      // Status drives reachedOut: anything past "Not Outreached" / "" counts.
      if (fields.reachedOut === undefined) {
        updated.reachedOut = value !== 'Not Outreached' && value !== ''
      }

      const isActive = value === 'Open' || value === 'No Response'
      const isTerminal = value === 'Successful' || value === 'Rejected' || value === 'Not Outreached'

      if (isActive) {
        // First time the user actually reaches out → log the date + 1st touchpoint
        if (e.status === 'Not Outreached' || e.status === '') {
          if (!e.dateReachedOut && fields.dateReachedOut === undefined) updated.dateReachedOut = todayIso()
          const tps = parseInt(e.touchpoints || '0', 10) || 0
          if (tps === 0 && fields.touchpoints === undefined) updated.touchpoints = '1'
        }

        // Apply follow-up cadence: shorter early, longer later.
        // First follow-up lands 5 *business* days out (weekends skipped);
        // later touches keep their calendar cadence — see nextFollowUpIso.
        // Only auto-fills when the caller didn't provide a date AND the
        // user hasn't set one — manual dates win.
        // Re-engagement of an overdue No-Response lead also gets a fresh date.
        const existing = parseLocalDate(e.followUpDate)
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const isPastDue = existing && existing.getTime() < today.getTime()
        if (fields.followUpDate === undefined && (!e.followUpDate || isPastDue)) {
          const tps = parseInt(updated.touchpoints || e.touchpoints || '0', 10) || 1
          updated.followUpDate = nextFollowUpIso(tps)
        }
      }

      if (isTerminal) {
        // Done with this lead — drop them out of the follow-up queue
        // (unless the caller explicitly set a date in the same update).
        if (fields.followUpDate === undefined) updated.followUpDate = ''
        if (value === 'Successful' || value === 'Rejected') {
          // Stamp response date when there isn't one already.
          if (!e.responseDate && fields.responseDate === undefined) updated.responseDate = todayIso()
        }
      }
    }

    saveOutreachDelta(outreach.map(x => (x.id === id ? updated : x)), [updated])
  }

  // Back-compat single-field shim — the confirm-modal path and a few
  // direct callers use this signature.
  function applyOutreachUpdate(id: string, field: keyof OutreachEntry, value: any) {
    applyOutreachUpdates(id, { [field]: value } as Partial<OutreachEntry>)
  }

  // Public multi-field entry point — runs the Active-Clients revert
  // guard, then applies everything in ONE atomic save. When the guard
  // trips (leaving Successful), the non-status fields still apply
  // immediately; only the status flip waits for the user's confirm.
  function updateOutreachFields(id: string, fields: Partial<OutreachEntry>) {
    const status = fields.status
    if (status !== undefined && status !== 'Successful') {
      const target = outreach.find(e => e.id === id)
      if (target && target.status === 'Successful') {
        const { status: _pending, ...rest } = fields
        if (Object.keys(rest).length > 0) applyOutreachUpdates(id, rest)
        setPendingRevert({
          entry: target,
          newStatus: status as NonNullable<OutreachEntry['status']>,
        })
        return // wait for user — applyOutreachUpdate fires on confirm
      }
    }
    applyOutreachUpdates(id, fields)
  }

  // Public single-field entry point — same guard, one field. Kept as the
  // signature the whole app already passes around.
  function updateOutreachEntry(id: string, field: keyof OutreachEntry, value: any) {
    updateOutreachFields(id, { [field]: value } as Partial<OutreachEntry>)
  }

  const [searchingContactIds, setSearchingContactIds] = useState<Set<string>>(new Set())
  const [outreachBulkRunning, setOutreachBulkRunning] = useState(false)
  const [resultsBulkRunning, setResultsBulkRunning] = useState(false)
  const [dismissedBulkRunning, setDismissedBulkRunning] = useState(false)
  /** Inline progress for the bulk dismissed-email search. NULL = no
   *  search active or banner already faded. Replaces the prior toast-
   *  based progress per Dylan 2026-05-10 (sticky 'Done.' was annoying). */
  const [dismissedBulkProgress, setDismissedBulkProgress] = useState<{ current: number; total: number } | null>(null)
  const [dismissedSearchingIds, setDismissedSearchingIds] = useState<Set<string>>(new Set())

  // Aggressive single-row email search for a Dismissed creator. Saves the
  // updated record back to dismissed_creators in Supabase so re-opens of
  // the tab keep the found email.
  async function deepSearchDismissedEmail(channelId: string) {
    const c = dismissed.find(x => x.channelId === channelId)
    if (!c) return
    setDismissedSearchingIds(s => new Set(s).add(channelId))
    try {
      const params = new URLSearchParams({
        name: c.channelName,
        channelId: c.channelId,
        description: c.description || '',
        website: c.website || '',
        instagram: c.instagram || '',
        tiktok: c.tiktok || '',
        aggressive: 'true',
      })
      const r = await fetch(`/api/enrich?${params}`)
      const extra = await r.json()
      if (!r.ok) {
        toast.error(`Search failed: ${extra.error || 'unknown'}`)
        return
      }
      // 2026-05-10 (2nd fix) — Dylan reported emails STILL not
      // persisting through a refresh. Two real causes:
      //   1. `void saveDismissedRow(...)` was fire-and-forget. If the
      //      user refreshed before the HTTP completed, the save died
      //      with the page. AWAIT the save so it commits before the
      //      function returns.
      //   2. Capturing `updatedRow` inside a setDismissed updater
      //      closure was fragile — React can run that updater async
      //      after our await, and the closure variable timing wasn't
      //      reliable. Now: compute the merged Creator OUTSIDE the
      //      updater (the closure-captured `c` from .find() is fresh
      //      enough — nothing else mutates this row between the fetch
      //      kicking off and the response arriving). Pass the same
      //      explicit value to both setDismissed and saveDismissedRow.
      const cleanEmail = String(extra.email || '').trim()
      const merged: Creator = {
        ...c,
        email: c.email || cleanEmail,
        linkedin: c.linkedin || extra.linkedin || '',
        instagram: c.instagram || extra.instagram || '',
        twitter: c.twitter || extra.twitter || '',
        tiktok: c.tiktok || extra.tiktok || '',
        website: c.website || extra.website || '',
        subscribers: c.subscribers || extra.subscribers || '',
        avgViews: c.avgViews || (extra.avgViews && !isNaN(extra.avgViews) ? extra.avgViews : 0),
      }
      setDismissed(prev => prev.map(x => (x.channelId === channelId ? merged : x)))
      // 2026-05-10: silent on success per Dylan ('no need to show the
      // pop up'). Email appearing in the row IS the success signal.
      // Error toast retained — silent failure was how we got the
      // 'doesn't persist on refresh' bug in the first place.
      try {
        await saveDismissedRow(merged)
      } catch (saveErr) {
        const msg = (saveErr as Error).message
        console.error('[deepSearchDismissedEmail] save threw:', msg)
        toast.error(`Found email but save failed: ${msg}`, {
          description: 'The UI shows it but a refresh will lose it. Check the console for details.',
          duration: 10000,
        })
      }
    } catch (err: any) {
      toast.error(`Search failed: ${err?.message || err}`)
    } finally {
      setDismissedSearchingIds(s => { const n = new Set(s); n.delete(channelId); return n })
    }
  }

  // Bulk aggressive search across every Dismissed creator missing an email.
  // Keeps running in the background as the user navigates other tabs (the
  // SPA stays mounted).
  //
  // 2026-05-10 per Dylan: replaced the toast-based progress + sticky
  // 'Done.' success message with an inline subtle status banner in the
  // DismissedTab itself. Progress state lives on this component and is
  // passed down; nothing renders to a toast.
  async function deepSearchAllDismissed() {
    const targets = dismissed.filter(c => !c.email).map(c => c.channelId)
    if (targets.length === 0 || dismissedBulkRunning) return
    setDismissedBulkRunning(true)
    setDismissedBulkProgress({ current: 0, total: targets.length })
    try {
      const CONCURRENCY = 3
      let done = 0
      for (let i = 0; i < targets.length; i += CONCURRENCY) {
        const batch = targets.slice(i, i + CONCURRENCY)
        await Promise.all(batch.map(id => deepSearchDismissedEmail(id)))
        done += batch.length
        setDismissedBulkProgress({ current: done, total: targets.length })
      }
      // Auto-clear the progress banner ~2.5s after completion so the
      // 'Found N emails' final tally is visible briefly but doesn't
      // stick. No popup, no toast — just the banner fading.
      setTimeout(() => setDismissedBulkProgress(null), 2500)
    } finally {
      setDismissedBulkRunning(false)
    }
  }

  // [seedTestData] was here until 2026-05-11 — moved to
  // POST /api/admin/seed-test-data and surfaced via the admin
  // dashboard. Now lives behind the AuditMenu (magnify-glass)
  // dropdown on /admin alongside the other dev/diagnostic tools
  // (Inbound-debug, Email-test, Test-data).

  async function deepSearchAllOutreach() {
    const targets = outreach.filter(e => !e.email).map(e => e.id)
    if (targets.length === 0 || outreachBulkRunning) return
    setOutreachBulkRunning(true)
    try {
      const CONCURRENCY = 3
      for (let i = 0; i < targets.length; i += CONCURRENCY) {
        await Promise.all(targets.slice(i, i + CONCURRENCY).map(id => searchContactsForEntry(id)))
      }
    } finally {
      setOutreachBulkRunning(false)
    }
  }

  async function deepSearchAllResults() {
    const targets = creators.filter(c => !c.email && !c.enriching).map(c => c.channelId)
    if (targets.length === 0 || resultsBulkRunning) return
    setResultsBulkRunning(true)
    try {
      const CONCURRENCY = 3
      for (let i = 0; i < targets.length; i += CONCURRENCY) {
        await Promise.all(targets.slice(i, i + CONCURRENCY).map(id => deepSearchResultEmail(id)))
      }
    } finally {
      setResultsBulkRunning(false)
    }
  }
  const [deepSearchingResultIds, setDeepSearchingResultIds] = useState<Set<string>>(new Set())

  /**
   * Manually update an IG URL on a creator (the "Find IG" button in
   * the InstagramCell). Triggers two side effects:
   *   1. The cell will start polling /api/instagram-status now that
   *      a handle exists — Meta Graph metrics fill in if available.
   *   2. We POST the new handle to /api/enrich to refresh the
   *      enrichment cache, which fires a QStash job too.
   * Fire-and-forget on the API hit — the UI doesn't block on it.
   */
  function updateInstagramHandle(channelId: string, igUrl: string) {
    setCreators(list => list.map(x =>
      x.channelId === channelId ? { ...x, instagram: igUrl } : x,
    ))
    // Refresh enrichment in background so the QStash worker also kicks in.
    const c = creators.find(x => x.channelId === channelId)
    if (c) {
      const params = new URLSearchParams({
        name: c.channelName,
        channelId: c.channelId,
        description: c.description || '',
        website: c.website || '',
        instagram: igUrl,
        tiktok: c.tiktok || '',
      })
      void fetch(`/api/enrich?${params}`).catch(() => { /* swallow — UI already updated */ })
    }
  }

  async function deepSearchResultEmail(channelId: string) {
    const c = creators.find(x => x.channelId === channelId)
    if (!c) return
    setDeepSearchingResultIds(s => new Set(s).add(channelId))
    try {
      const params = new URLSearchParams({
        name: c.channelName,
        channelId: c.channelId,
        description: c.description || '',
        website: c.website || '',
        instagram: c.instagram || '',
        tiktok: c.tiktok || '',
        aggressive: 'true',
      })
      const r = await fetch(`/api/enrich?${params}`)
      const extra = await r.json()
      if (!r.ok) {
        toast.error(`Search failed: ${extra.error || 'unknown'}`)
        return
      }
      setCreators(list => list.map(x => x.channelId === channelId ? {
        ...x,
        email: x.email || extra.email || '',
        linkedin: x.linkedin || extra.linkedin || '',
        instagram: x.instagram || extra.instagram || '',
        twitter: x.twitter || extra.twitter || '',
        tiktok: x.tiktok || extra.tiktok || '',
        website: x.website || extra.website || '',
        subscribers: x.subscribers || extra.subscribers || '',
        avgViews: x.avgViews || (extra.avgViews && !isNaN(extra.avgViews) ? extra.avgViews : 0),
      } : x))
    } catch (err: any) {
      toast.error(`Search failed: ${err?.message || err}`)
    } finally {
      setDeepSearchingResultIds(s => { const n = new Set(s); n.delete(channelId); return n })
    }
  }

  async function searchContactsForEntry(id: string) {
    const entry = outreach.find(e => e.id === id)
    if (!entry) return
    setSearchingContactIds(s => new Set(s).add(id))
    try {
      const params = new URLSearchParams({
        name: entry.channelName,
        channelId: entry.channelId,
        description: entry.description || '',
        aggressive: 'true',
      })
      const r = await fetch(`/api/enrich?${params}`)
      const extra = await r.json()
      if (!r.ok) {
        toast.error(`Search failed: ${extra.error || 'unknown'}`)
        return
      }
      const cur = outreach.find(e => e.id === id)
      if (cur) {
        // Only fill in fields that are currently empty so we don't overwrite
        // anything the user has manually entered.
        const filled: OutreachEntry = {
          ...cur,
          email: cur.email || extra.email || '',
          linkedin: cur.linkedin || extra.linkedin || '',
          subscribers: cur.subscribers || extra.subscribers || '',
          avgViews: cur.avgViews || (extra.avgViews && !isNaN(extra.avgViews) ? extra.avgViews : 0),
        }
        // Single-row delta — also fixes the bulk-enrich race the old
        // whole-list save had here: 3 concurrent enrich resolutions each
        // persisted a full stale snapshot (slowest writer clobbered the
        // other two's emails in the DB). Row-scoped writes can't compete.
        saveOutreachDelta(outreach.map(e => (e.id === id ? filled : e)), [filled])
      }
      // (No email found is non-blocking — UI updates via setOutreach above.)
    } catch (err: any) {
      toast.error(`Search failed: ${err?.message || err}`)
    } finally {
      setSearchingContactIds(s => {
        const next = new Set(s); next.delete(id); return next
      })
    }
  }

  // Pending delete requiring user confirmation — only set when the
  // user is trying to delete a 'Successful' (= Active Client) row.
  // All other deletes proceed without a prompt. Dylan 2026-06-09.
  const [pendingDelete, setPendingDelete] = useState<OutreachEntry | null>(null)

  // Internal: skips the guard and does the actual delete. Used by
  // both the no-guard path (non-Successful rows) and the modal
  // confirm callback for Successful rows.
  function applyRemoveOutreach(id: string) {
    saveOutreachRemoval(outreach.filter(e => e.id !== id), [id])
  }

  function removeOutreachEntry(id: string) {
    // Successful rows are Active Clients — deleting wipes the
    // outreach row AND every client_* field (budget, lifecycle,
    // milestones, activity, contract, collaborators). Always
    // confirm to prevent fat-finger loss.
    const target = outreach.find(e => e.id === id)
    if (target && target.status === 'Successful') {
      setPendingDelete(target)
      return // wait for user — applyRemoveOutreach fires on confirm
    }
    applyRemoveOutreach(id)
  }

  // Dismissed writes are deltas too (2026-07-09 perf) — the old shared
  // saveDismissed(updated) wrapper ran the full-snapshot storage path
  // (paginated read of every existing id + whole-list re-upload) for a
  // single dismiss click. Full-snapshot persistDismissed() remains for
  // the CSV-import path only.

  function dismissCreator(c: Creator) {
    if (!dismissedIds.has(c.channelId)) {
      const updated = [...dismissed, c]
      setDismissed(updated)
      setDismissedIds(new Set(updated.map(x => x.channelId)))
      void upsertDismissedRows([c])
    }
    // also remove from load-more batch so it disappears immediately
    setLoadMoreCreators(prev => prev.filter(p => p.channelId !== c.channelId))
    setCreators(prev => prev.filter(p => p.channelId !== c.channelId))
  }

  function undismissCreator(id: string) {
    const updated = dismissed.filter(c => c.channelId !== id)
    setDismissed(updated)
    setDismissedIds(new Set(updated.map(x => x.channelId)))
    void deleteDismissedRows([id])
  }

  const runSearch = useCallback(async (
    kw: string,
    keywordsList?: string[],
    /** Optional mode override — passed by pill clicks so the search
     *  uses the freshly-selected mode without waiting for the
     *  setSearchMode setState to propagate through React's batching. */
    modeOverride?: SearchMode,
  ) => {
    if (!kw.trim() && !(keywordsList && keywordsList.length)) return
    // Capture the keyword for the DashboardInsightPill's "recent
    // searches" memory. Stored in localStorage as a deduped FIFO of
    // up to 10 entries. Best-effort: any error silently no-ops since
    // it's a UX nicety, not a correctness concern.
    try {
      const labelForHistory = kw.trim() || (keywordsList ?? []).filter(Boolean).join(', ')
      if (labelForHistory) {
        const raw = window.localStorage.getItem('creator-outreach.recentSearches')
        const prior: string[] = raw ? JSON.parse(raw) : []
        const next = [labelForHistory, ...prior.filter(s => s !== labelForHistory)].slice(0, 10)
        window.localStorage.setItem('creator-outreach.recentSearches', JSON.stringify(next))
      }
    } catch { /* ignore */ }
    const version = ++searchVersion.current
    setLoading(true)
    setCreators([])
    setLoadMoreCreators([])
    setCurrentKeyword(kw)
    setCurrentKeywordsList(keywordsList ?? [])
    seenChannelIds.current = new Set()
    // Reset the Load More page cursor — the next Load More starts at
    // page depth 2 again for this fresh search.
    loadMorePagesRef.current = 1
    setEnrichProgress({ current: 0, total: 0 })
    setActiveTab('results')
    setShowSearchSimilar(false) // reset every fresh search
    // Per Dylan 2026-05-10 v3: kicking off a search re-triggers the
    // backdrop wave so the user sees a visual confirmation. Plays for
    // the configured duration, then fades.
    triggerBackdropWave()

    // Effective mode for this run — caller-passed override wins over
    // state. Pill clicks pass override so they don't race the state
    // setter.
    const effectiveMode: SearchMode = modeOverride ?? searchMode

    // Niche-list searches (multiple comma-joined occupations) are always
    // broad keyword searches regardless of the pill state — the niche
    // chips only appear in occupation contexts and shouldn't try to
    // lookup a username.
    const useTargetedLookup =
      !keywordsList?.length &&
      (effectiveMode === 'url' || effectiveMode === 'username')

    if (useTargetedLookup) {
      // Build the lookup query based on the selected pill. URL mode
      // sends the input as ?url=, Username mode strips a leading @ and
      // sends ?handle=. Both hit /api/lookup-channel which resolves
      // everything to a YouTube channel (cross-platform handles tend
      // to match — Instagram URL → user looked up as YouTube handle).
      const trimmed = kw.trim()
      let lookupQs: string
      let displayLabel: string
      if (effectiveMode === 'url') {
        // Try to surface what the URL points at for the status text.
        const cls = classifySearchInput(trimmed)
        if (cls.kind === 'url') {
          // Recognised social URL — pass to the lookup as a URL when
          // the host is YouTube; otherwise pass the extracted handle
          // (the route resolves both forms via the YouTube backbone).
          if (cls.sourcePlatform === 'youtube') {
            lookupQs = `url=${encodeURIComponent(trimmed)}`
            displayLabel = cls.handle ? `@${cls.handle}` : 'channel'
          } else {
            const h = cls.handle || ''
            lookupQs = `handle=${encodeURIComponent(h)}`
            displayLabel = h ? `@${h}` : 'channel'
          }
        } else {
          // User clicked URL pill but typed something that's not a
          // recognised URL. Pass it through anyway — the server will
          // 404 it, then the "Search similar" pill recovers.
          lookupQs = `url=${encodeURIComponent(trimmed)}`
          displayLabel = trimmed.length > 30 ? trimmed.slice(0, 30) + '…' : trimmed
        }
      } else {
        // Username mode — strip a leading @ if present.
        const handle = trimmed.replace(/^@+/, '')
        lookupQs = `handle=${encodeURIComponent(handle)}`
        displayLabel = `@${handle}`
      }

      setStatus(`Looking up ${displayLabel}...`)

      try {
        const r = await fetch(`/api/lookup-channel?${lookupQs}`)
        const lookup = await r.json()
        if (version !== searchVersion.current) return

        if (!r.ok || !lookup.channelId) {
          // No automatic fallback — user picks "Search similar" pill
          // explicitly if they want to switch to broad keyword search.
          // The pill in the UI flips searchMode to 'occupation' and
          // re-fires runSearch with the same input.
          setStatus(`No matches for ${displayLabel} on YouTube.`)
          setShowSearchSimilar(true)
          setLoading(false)
          return
        }
        // Resolved to a real channel.
        {
          if (dismissedIds.has(lookup.channelId) || outreachIds.has(lookup.channelId)) {
            setStatus(`${lookup.channelName || displayLabel} is already in your outreach or dismissed list.`)
            setLoading(false)
            return
          }
          seenChannelIds.current.add(lookup.channelId)
          // The data model is YouTube-centric and the platform tabs
          // filter results to creators who have that social linked.
          // Right after a lookup the new creator hasn't been enriched
          // yet, so an IG/TikTok/X tab would hide the result behind
          // its filter ("0 of 1 — none have Instagram"). Snap to the
          // YouTube tab so the result is always visible, then the
          // user can flip tabs once the social columns populate.
          if (activePlatform !== 'youtube') {
            setActivePlatform('youtube')
          }
          const baseCreator: Creator = {
            channelId: lookup.channelId,
            channelName: lookup.channelName || '',
            channelUrl: lookup.channelUrl,
            avgViews: 0,
            subscribers: '',
            email: '',
            website: '',
            linkedin: '',
            twitter: '',
            instagram: '',
            tiktok: '',
            company: '',
            matchedVia: effectiveMode === 'url' ? 'url' : 'handle',
            videoTitles: [],
            videoDates: [],
            shortDates: [],
            description: lookup.description || '',
            enriching: true,
          }
          setCreators([baseCreator])
          setEnrichProgress({ current: 0, total: 1 })
          setStatus(`Found ${lookup.channelName || displayLabel}. Enriching contact info...`)
          try {
            const params = new URLSearchParams({
              name: baseCreator.channelName, channelId: baseCreator.channelId,
              description: baseCreator.description,
            })
            const er = await fetch(`/api/enrich?${params}`)
            const extra = await er.json()
            if (version !== searchVersion.current) return
            setCreators([{
              ...baseCreator,
              enriching: false,
              email: extra.email || '',
              subscribers: extra.subscribers || '',
              videoDates: extra.videoDates || [],
              shortDates: extra.shortDates || [],
              avgViews: (extra.avgViews != null && !isNaN(extra.avgViews)) ? extra.avgViews : 0,
              linkedin: extra.linkedin || '',
              instagram: extra.instagram || '',
              twitter: extra.twitter || '',
              tiktok: extra.tiktok || '',
              website: extra.website || '',
            }])
            setEnrichProgress({ current: 1, total: 1 })
            setStatus(`Done. ${lookup.channelName || displayLabel} ready — click + to add to Outreach.`)
          } catch {
            setCreators([{ ...baseCreator, enriching: false }])
            setStatus('Done (could not fetch extra contact info).')
          }
          setLoading(false)
          return
        }
      } catch (err: any) {
        // Targeted lookup failed at the network layer — show the
        // recovery pill (Search similar) instead of silently falling
        // through. User chooses whether to broaden.
        setStatus(`Lookup failed: ${err?.message || err}`)
        setShowSearchSimilar(true)
        setLoading(false)
        return
      }
    }

    // Occupation mode (or niche-list search) → broad keyword search.
    setStatus('Searching...')

    try {
      const regionCodes = regions.length > 0 ? regions : ['']
      // Niche-mode: pass the full list of occupations to the API as
      // `keywords=` so the server skips topic-map expansion and uses
      // each occupation directly. Single-keyword mode unchanged.
      const queryFragment = keywordsList && keywordsList.length
        ? `keywords=${encodeURIComponent(keywordsList.join(','))}`
        : `keyword=${encodeURIComponent(kw)}`
      // AI keyword expansion (2026-05-12): fire `expand=true` for single-
      // keyword occupation searches so the server asks Claude Haiku for
      // 3 sibling queries and merges their hits. Skip for niche-list
      // searches (already broad) and for url/username modes (those are
      // targeted lookups that bypass this code path entirely above).
      const shouldExpand =
        effectiveMode === 'occupation' &&
        !(keywordsList && keywordsList.length) &&
        !!kw.trim()
      const expandParam = shouldExpand ? '&expand=true' : ''

      // ── Search (JSON) + parallel enrichment ─────────────────────
      //
      // 2026-05-21 — reverted from SSE streaming back to bulk JSON
      // fetch. The streaming infrastructure (f6ce170 + ca2cdc2) was
      // skipping the canonical region-filter / progressive subs-tier
      // / fallback-queries / global-relevance-sort that the JSON
      // path applies at the end of search. Result: divorce-attorney
      // searches surfacing youth-coach channels, and IG/X views
      // showing fewer relevant matches than the YT-mode IG column.
      //
      // The JSON path runs the full canonical processing server-
      // side and returns the maxResults best matches sorted by
      // relevance. We then feed THAT full list into the queue-
      // based parallel enrichment pools from fff4b32 (PhaseA +
      // PhaseB) so handles + emails populate quickly without
      // depending on streaming.
      const enriched: Creator[] = []
      // 2026-05-21 — bumped Phase A 25 → 32. /api/enrich's first
      // path is the Postgres durable cache (creator_enrichment) which
      // returns ~50ms per hit; uncached YT scrapes are ~2s. At 32
      // concurrent we drain a 175-row batch in ~12s when fully
      // uncached, ~3-4s when mostly cached. Phase B stays at 8 to be
      // polite to DuckDuckGo on the email lookup.
      //
      // Phase C (background, coverage lift) — fetches recent video
      // descriptions for rows that finished Phase A without a complete
      // social profile and runs the shared social-text extractor on
      // them. Only rows still missing IG/X/TikTok/LinkedIn enqueue.
      // Concurrency 8 to be polite to YT's video-list page.
      //
      // Phase D (background, "Product" column) — for rows whose text
      // mentions a sellable product, summarizes WHAT they sell via
      // /api/enrich/product (one gated + cached Haiku call). Concurrency
      // 6 — these can make an AI call, so keep the fan-out modest.
      const PHASE_A_CONCURRENCY = 32
      const PHASE_B_CONCURRENCY = 8
      const PHASE_C_CONCURRENCY = 8
      const PHASE_D_CONCURRENCY = 6
      let phaseAActive = 0
      let phaseBActive = 0
      let phaseCActive = 0
      let phaseDActive = 0
      const phaseAQueue: number[] = []
      const phaseBQueue: number[] = []
      const phaseCQueue: number[] = []
      const phaseDQueue: number[] = []
      let phaseACompleted = 0
      let phaseBCompleted = 0
      let phaseCCompleted = 0
      let phaseDCompleted = 0
      let phaseAStartedCount = 0
      let phaseBStartedCount = 0
      let phaseCStartedCount = 0
      let phaseDStartedCount = 0

      // Throttled flush — coalesce multiple state changes per animation
      // frame so React doesn't re-render N times per second when
      // many enrichments land back-to-back.
      let flushPending = false
      const flushVisible = () => {
        flushPending = false
        if (version !== searchVersion.current) return
        setCreators([...enriched])
        // Status updates the running totals so the user can see
        // progress without staring at a static "Searching..." label.
        const total = enriched.length
        if (phaseACompleted < total) {
          setStatus(`Found ${total} creators. Resolving handles ${phaseACompleted}/${total}…`)
        } else if (phaseBCompleted < total) {
          setStatus(`Found ${total} creators. Looking up emails ${phaseBCompleted}/${total}…`)
        } else {
          setStatus(`Done — ${total} creators found.`)
        }
        setEnrichProgress({ current: phaseACompleted, total })
      }
      const scheduleFlush = () => {
        if (flushPending) return
        flushPending = true
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(flushVisible)
        } else {
          setTimeout(flushVisible, 0)
        }
      }

      async function runPhaseAFor(idx: number) {
        if (version !== searchVersion.current) return
        const c = enriched[idx]
        try {
          const params = new URLSearchParams({
            name: c.channelName, channelId: c.channelId,
            website: c.website || '', instagram: c.instagram || '',
            tiktok: c.tiktok || '', description: c.description || '',
          })
          params.set('fast', 'true')
          const r = await fetch(`/api/enrich?${params}`)
          if (!r.ok) throw new Error(`enrich ${r.status}`)
          const extra = await r.json()
          if (version !== searchVersion.current) return
          // Phase A merges socials + refined subs/avgViews into the
          // row. enriching stays TRUE so the row keeps showing the
          // "looking up email" indicator until Phase B writes the
          // email and flips enriching to false.
          enriched[idx] = {
            ...c,
            enriching: true,
            email: c.email || extra.email || '',
            subscribers: c.subscribers || extra.subscribers || '',
            videoDates: (extra.videoDates?.length ? extra.videoDates : c.videoDates) || [],
            shortDates: (extra.shortDates?.length ? extra.shortDates : c.shortDates) || [],
            avgViews: (extra.avgViews != null && !isNaN(extra.avgViews)) ? extra.avgViews : c.avgViews,
            linkedin: c.linkedin || extra.linkedin || '',
            instagram: c.instagram || extra.instagram || '',
            twitter: c.twitter || extra.twitter || '',
            tiktok: c.tiktok || extra.tiktok || '',
            website: c.website || extra.website || '',
          }
          // Chain into Phase B immediately — emails populate as soon
          // as a row's handles are resolved, in parallel with other
          // rows still in Phase A.
          phaseBQueue.push(idx)
          tryStartPhaseB()
          // Chain into Phase C if any platform's handle is still
          // missing — fetches video descriptions to catch handles
          // creators only mention in their video bios (background
          // coverage lift; doesn't block UI). Skip Phase C entirely
          // for rows that already have all four handles.
          const row = enriched[idx]
          if (!row.instagram || !row.twitter || !row.tiktok || !row.linkedin) {
            phaseCQueue.push(idx)
            tryStartPhaseC()
          }
          // Chain into Phase D (Product column). Trigger on a product
          // keyword OR a business signal (website / LinkedIn) — the
          // endpoint then fetches the creator's /about + video
          // descriptions and makes the real call on that rich text, so a
          // seller whose titles say nothing still gets caught. The endpoint
          // is cached + gates on rich text before any AI call, so the
          // broader trigger only adds cheap fetches, not AI spend on
          // non-sellers. One-shot per row (productSummary stays undefined
          // until Phase D writes a verdict).
          if (row.productSummary === undefined) {
            const productCorpus = [row.description || '', row.channelName || '', ...(row.videoTitles || [])].join(' ')
            if (corpusMentionsProduct(productCorpus) || row.website || row.linkedin) {
              phaseDQueue.push(idx)
              tryStartPhaseD()
            }
          }
        } catch {
          // Don't propagate — the row stays in its current state
          // and Phase B may still succeed at fetching an email.
        } finally {
          phaseACompleted++
          scheduleFlush()
        }
      }

      async function runPhaseBFor(idx: number) {
        if (version !== searchVersion.current) return
        const c = enriched[idx]
        try {
          const params = new URLSearchParams({
            name: c.channelName, channelId: c.channelId,
            website: c.website || '', instagram: c.instagram || '',
            tiktok: c.tiktok || '', description: c.description || '',
          })
          const r = await fetch(`/api/enrich?${params}`)
          if (!r.ok) throw new Error(`enrich ${r.status}`)
          const extra = await r.json()
          if (version !== searchVersion.current) return
          enriched[idx] = {
            ...c,
            enriching: false,
            email: c.email || extra.email || '',
            subscribers: c.subscribers || extra.subscribers || '',
            videoDates: (extra.videoDates?.length ? extra.videoDates : c.videoDates) || [],
            shortDates: (extra.shortDates?.length ? extra.shortDates : c.shortDates) || [],
            avgViews: (extra.avgViews != null && !isNaN(extra.avgViews)) ? extra.avgViews : c.avgViews,
            linkedin: c.linkedin || extra.linkedin || '',
            instagram: c.instagram || extra.instagram || '',
            twitter: c.twitter || extra.twitter || '',
            tiktok: c.tiktok || extra.tiktok || '',
            website: c.website || extra.website || '',
          }
        } catch {
          // Even on failure, drop the enriching flag so the row
          // doesn't keep showing the spinner forever.
          enriched[idx] = { ...c, enriching: false }
        } finally {
          phaseBCompleted++
          scheduleFlush()
        }
      }

      async function runPhaseCFor(idx: number) {
        if (version !== searchVersion.current) return
        const c = enriched[idx]
        // Re-check inside the worker — Phase B may have populated
        // socials by the time this row's Phase C slot opened up.
        if (c.instagram && c.twitter && c.tiktok && c.linkedin) {
          return
        }
        try {
          const r = await fetch(`/api/enrich/video-descs?channelId=${encodeURIComponent(c.channelId)}`)
          if (!r.ok) return
          const extra = await r.json() as {
            instagram?: string
            twitter?: string
            tiktok?: string
            linkedin?: string
          }
          if (version !== searchVersion.current) return
          // Only fill in missing handles — never overwrite a handle
          // we already have (which has higher confidence since it came
          // from the explicit Links section or /about description).
          // Re-read the row from enriched[] because Phase B may have
          // updated it in the meantime.
          const current = enriched[idx]
          const merged: Creator = {
            ...current,
            instagram: current.instagram || extra.instagram || '',
            twitter:   current.twitter   || extra.twitter   || '',
            tiktok:    current.tiktok    || extra.tiktok    || '',
            linkedin:  current.linkedin  || extra.linkedin  || '',
          }
          // Only mutate + flush when we actually found something new.
          if (
            merged.instagram !== current.instagram
            || merged.twitter !== current.twitter
            || merged.tiktok !== current.tiktok
            || merged.linkedin !== current.linkedin
          ) {
            enriched[idx] = merged
            scheduleFlush()
          }
        } catch {
          // Background pass — failures are silent. The row's
          // /about-derived socials (if any) stay as-is.
        } finally {
          phaseCCompleted++
        }
      }

      async function runPhaseDFor(idx: number) {
        if (version !== searchVersion.current) return
        const c = enriched[idx]
        // Already resolved (cache hit on a prior pass) — skip.
        if (c.productSummary !== undefined) { phaseDCompleted++; return }
        try {
          const r = await fetch('/api/enrich/product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channelId: c.channelId,
              name: c.channelName,
              description: c.description || '',
              videoTitles: c.videoTitles || [],
            }),
          })
          // Non-OK (eg. rate-limited) — leave undefined so the cell
          // reads "—"; the server-side cache fills on a later search.
          if (!r.ok) return
          const extra = await r.json() as { sells?: boolean; summary?: string }
          if (version !== searchVersion.current) return
          const current = enriched[idx]
          // '' = checked, nothing sellable. Non-empty = the summary.
          const summary = extra.sells && extra.summary ? extra.summary : ''
          if (current.productSummary !== summary) {
            enriched[idx] = { ...current, productSummary: summary }
            scheduleFlush()
          }
        } catch {
          // Background pass — silent. Row stays "—".
        } finally {
          phaseDCompleted++
        }
      }

      function tryStartPhaseA() {
        while (phaseAActive < PHASE_A_CONCURRENCY && phaseAQueue.length > 0) {
          const idx = phaseAQueue.shift()!
          phaseAActive++
          phaseAStartedCount++
          runPhaseAFor(idx).finally(() => {
            phaseAActive--
            tryStartPhaseA()
          })
        }
      }
      function tryStartPhaseB() {
        while (phaseBActive < PHASE_B_CONCURRENCY && phaseBQueue.length > 0) {
          const idx = phaseBQueue.shift()!
          phaseBActive++
          phaseBStartedCount++
          runPhaseBFor(idx).finally(() => {
            phaseBActive--
            tryStartPhaseB()
          })
        }
      }
      function tryStartPhaseC() {
        while (phaseCActive < PHASE_C_CONCURRENCY && phaseCQueue.length > 0) {
          const idx = phaseCQueue.shift()!
          phaseCActive++
          phaseCStartedCount++
          runPhaseCFor(idx).finally(() => {
            phaseCActive--
            tryStartPhaseC()
          })
        }
      }
      function tryStartPhaseD() {
        while (phaseDActive < PHASE_D_CONCURRENCY && phaseDQueue.length > 0) {
          const idx = phaseDQueue.shift()!
          phaseDActive++
          phaseDStartedCount++
          runPhaseDFor(idx).finally(() => {
            phaseDActive--
            tryStartPhaseD()
          })
        }
      }

      // Stream search results from each region via SSE so rows pop
      // in as YouTube-search batches resolve (~5-8s to first chunk
      // vs ~25-30s to wait for everything). Per-chunk quality filters
      // applied server-side: media blocklist + topical-focus rule
      // (nameScore > 0 OR matchingTitleCount >= 2) so streamed
      // results match the canonical quality bar. Re-enabled
      // 2026-05-21 after Dylan reported 90s waits with the
      // bulk-JSON path.
      setStatus('Searching YouTube…')

      // Handle-hint narrowing for URL/username searches that fell
      // through to broad mode. We need the input classification
      // BEFORE the stream starts so chunks can be filtered as they
      // arrive (otherwise we'd be appending rows we'll then narrow
      // out, causing visual churn).
      const inputCls = classifySearchInput(kw)
      const handleHint =
        inputCls.kind === 'handle' ? inputCls.handle :
        (inputCls.kind === 'url' && inputCls.handle) ? inputCls.handle :
        null

      // Streaming consumer — appends new channels to the enrichment
      // pools as each chunk arrives. Dedupe across regions by
      // channelId so a creator that surfaces in multiple regions is
      // only enriched once.
      const seenStreamIds = new Set<string>()
      let streamError: string | null = null
      let firstFlush = true
      const enqueueChannels = (channels: Creator[]) => {
        const newOnes: Creator[] = []
        for (const c of channels) {
          if (seenStreamIds.has(c.channelId)) continue
          seenStreamIds.add(c.channelId)
          if (dismissedIds.has(c.channelId)) continue
          if (outreachIds.has(c.channelId)) continue
          newOnes.push(c)
        }
        if (newOnes.length === 0) return
        // Track for Load More dedup
        for (const c of newOnes) seenChannelIds.current.add(c.channelId)
        for (const c of newOnes) {
          const idx = enriched.length
          enriched.push({ ...c, enriching: true })
          phaseAQueue.push(idx)
        }
        tryStartPhaseA()
        scheduleFlush()
        if (firstFlush) {
          firstFlush = false
          setStatus(`Found ${enriched.length} creators (still searching…). Resolving handles 0/${enriched.length}…`)
        }
      }

      try {
        await Promise.all(
          regionCodes.map(async code => {
            const glParam = code ? `&gl=${encodeURIComponent(code)}` : ''
            // bypassFilters ("showing all" toggle): drop the view-range
            // ceiling at the SERVER too, not just the client. Without
            // this, big-view creators were filtered out before they
            // ever reached the client and the toggle couldn't show
            // them. 1e9 is the route.ts upper bound (clampInt cap).
            const effectiveMinViews = bypassFilters ? 0 : minViews
            const effectiveMaxViews = bypassFilters ? 1_000_000_000 : maxViews
            const url = `/api/search?${queryFragment}&maxResults=${maxResults}&minViews=${effectiveMinViews}&maxViews=${effectiveMaxViews}${glParam}${expandParam}&stream=1`
            try {
              const resp = await fetch(url)
              await consumeSse(resp, ev => {
                if (version !== searchVersion.current) return
                if (ev.event === 'chunk') {
                  const data = ev.data as { channels?: Creator[] }
                  enqueueChannels(data.channels || [])
                } else if (ev.event === 'error') {
                  const data = ev.data as { message?: string }
                  streamError = data.message ?? 'search failed'
                }
              })
            } catch (e) {
              streamError = (e as Error).message
            }
          })
        )
      } catch (e) {
        if (version === searchVersion.current) {
          const m = friendlySearchError((e as Error).message)
          toast.error(m)
          setStatus(m)
        }
        return
      }
      if (version !== searchVersion.current) return
      if (streamError) {
        const m = friendlySearchError(streamError)
        toast.error(m)
        setStatus(m)
        return
      }

      // Handle-hint narrowing — applied AFTER the stream completes so
      // we have the full set to filter against. Drops any rows that
      // don't fuzzy-match the typed handle. Rows already started
      // enriching might get dropped here — wasted enrichment cost
      // is small (handle searches return tight result sets) and the
      // alternative (filter every chunk on the fly) would create
      // visual churn as rows get added then removed.
      if (handleHint) {
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
        const target = norm(handleHint)
        const targetCore = target.replace(/\d+$/, '')
        const matches = enriched.filter(c => {
          const n = norm(c.channelName)
          if (!n || !target) return false
          return n === target
            || n === targetCore
            || (target.length >= 4 && n.includes(target))
            || (targetCore.length >= 4 && n.includes(targetCore))
            || (n.length >= 4 && (target.includes(n) || targetCore.includes(n)))
        })
        if (matches.length > 0) {
          const kept = matches.slice(0, matches.length <= 3 ? matches.length : 5)
          enriched.length = 0
          enriched.push(...kept)
          scheduleFlush()
          const label = matches.length <= 3
            ? `Found ${kept.length} close match${kept.length === 1 ? '' : 'es'} for @${handleHint}.`
            : `${matches.length} channels match @${handleHint} — showing the closest 5.`
          setStatus(label)
        }
      }

      // Stream done; flush whatever's queued so the status text is
      // accurate before Phase A drain.
      flushVisible()
      setEnrichProgress({ current: phaseACompleted, total: enriched.length })
      if (enriched.length === 0) {
        setStatus('No creators found. Try a broader keyword, a different platform, or clearing any active filters.')
        return
      }
      setStatus(`Found ${enriched.length} creators. Resolving handles ${phaseACompleted}/${enriched.length}…`)

      // Wait for Phase A to drain so we can drop the blocking
      // spinner at the right moment. Phase B continues in the
      // background after this resolves.
      //
      // 2026-05-23 per Dylan ("second search has endlessly loaded
      // and wont let you change the search or anything"): bounded
      // by a hard 45s max-wait. If Phase A doesn't drain in 45s
      // it's almost certainly a hung enrichment request (no
      // explicit timeout on fetch()). We break out, mark the
      // search complete with whatever we have, and let the user
      // search again. The `finally` block below guarantees
      // setLoading(false) fires regardless.
      const POLL_DEADLINE_MS = 45_000
      const phaseADeadline = Date.now() + POLL_DEADLINE_MS
      while ((phaseAActive > 0 || phaseAQueue.length > 0) && version === searchVersion.current) {
        if (Date.now() > phaseADeadline) {
          console.warn('[search] Phase A drain timeout — proceeding with partial enrichment.')
          break
        }
        await new Promise(r => setTimeout(r, 80))
      }
      if (version !== searchVersion.current) return

      // Wait for Phase B to drain so we can show the final status.
      // The user can interact while we wait. Bounded same as Phase A.
      const phaseBDeadline = Date.now() + POLL_DEADLINE_MS
      while ((phaseBActive > 0 || phaseBQueue.length > 0) && version === searchVersion.current) {
        if (Date.now() > phaseBDeadline) {
          console.warn('[search] Phase B drain timeout — finalizing with partial contact data.')
          break
        }
        await new Promise(r => setTimeout(r, 80))
      }
      if (version !== searchVersion.current) return
      // Tracking these so the lint doesn't flag "started but never read".
      void phaseAStartedCount
      void phaseBStartedCount
      void phaseCStartedCount
      void phaseCCompleted
      void phaseDStartedCount
      void phaseDCompleted
      setStatus(`Done — ${enriched.length} creators found.`)
      setEnrichProgress({ current: 0, total: 0 })
      // Phase C may still be running in the background — that's fine,
      // additional handles trickle in over the next ~15-25s without
      // blocking the "Done" state. The user can keep working; any
      // new handles update rows in place.
    } catch (err: any) {
      if (version === searchVersion.current) {
        const m = friendlySearchError(err?.message || String(err))
        toast.error(m)
        setStatus(m)
      }
    } finally {
      // Belt-and-suspenders: ALWAYS clear loading if we're still the
      // current search. The earlier try/catch had setLoading(false)
      // inline at the end of the happy path, but a hung polling loop
      // could prevent it from being reached. Moving it here
      // guarantees the UI unblocks even when something stalls — the
      // user can always start a new search.
      if (version === searchVersion.current) {
        setLoading(false)
      }
    }
  }, [minViews, maxViews, maxResults, regions, dismissedIds, outreachIds, searchMode, activePlatform, bypassFilters])

  async function handleSearch() { await runSearch(keyword) }

  // When the "filtered ⇄ showing all" toggle flips, refetch the
  // search so the server-side view cap is dropped/re-applied. Without
  // this the toggle could only hide/unhide what was already fetched —
  // creators above maxViews never reached the client in the first
  // place. firstBypassMount guard avoids running on initial render.
  const firstBypassMount = useRef(true)
  useEffect(() => {
    if (firstBypassMount.current) {
      firstBypassMount.current = false
      return
    }
    if (currentKeyword && !loading) {
      void runSearch(currentKeyword)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only
    // want to react to bypassFilters; currentKeyword/loading checked
    // at call time inside.
  }, [bypassFilters])

  const handleLoadMore = useCallback(async () => {
    if (!currentKeyword || loadingMore || loading) return
    setLoadingMore(true)
    try {
      const regionCodes = regions.length > 0 ? regions : ['']
      const queryFragment = currentKeywordsList.length > 0
        ? `keywords=${encodeURIComponent(currentKeywordsList.join(','))}`
        : `keyword=${encodeURIComponent(currentKeyword)}`
      // Load More MUST skip the search cache via ?fresh=true — without
      // it, /api/search returns the same cached result set (10-min TTL)
      // as the initial search, so every channel is already in
      // seenChannelIds and `fresh` ends up empty (button does nothing
      // visible). Initial search keeps the cache for navigation speed.
      // Advance the page cursor so this Load More pulls the NEXT page
      // depth per query (2, 3, 4…) — genuinely new channels, not a
      // re-roll of page 1. Clamped server-side to 5.
      loadMorePagesRef.current += 1
      const pagesParam = loadMorePagesRef.current
      const allResponses = await Promise.all(
        regionCodes.map(code => {
          const glParam = code ? `&gl=${encodeURIComponent(code)}` : ''
          // Same bypass logic as initial search — keep Load More
          // consistent with whatever the toggle is currently set to.
          const effectiveMinViews = bypassFilters ? 0 : minViews
          const effectiveMaxViews = bypassFilters ? 1_000_000_000 : maxViews
          return fetch(`/api/search?${queryFragment}&maxResults=${maxResults}&minViews=${effectiveMinViews}&maxViews=${effectiveMaxViews}${glParam}&pages=${pagesParam}&fresh=true`).then(r => r.json())
        })
      )
      if (allResponses.some(d => d.error)) return
      const seenMerge = new Set<string>()
      const data = { channels: allResponses.flatMap(d => (d.channels as Creator[]) || []).filter(c => { if (seenMerge.has(c.channelId)) return false; seenMerge.add(c.channelId); return true }) }

      // Filter: skip already seen, dismissed, outreached
      const fresh = (data.channels as Creator[]).filter(
        c => !seenChannelIds.current.has(c.channelId)
          && !dismissedIds.has(c.channelId)
          && !outreachIds.has(c.channelId)
      )
      // Track all returned channels as seen (for future Load More calls)
      ;(data.channels as Creator[]).forEach(c => seenChannelIds.current.add(c.channelId))

      if (fresh.length === 0) return

      // Show batch immediately with enriching spinners, pre-sorted email-first
      const batch = fresh.map(c => ({ ...c, enriching: true }))
      const preSorted = [...batch].sort((a, b) => {
        const ae = a.email ? 1 : 0, be = b.email ? 1 : 0
        return be - ae
      })
      setLoadMoreCreators(prev => [...prev, ...preSorted])

      // Enrich in parallel batches. Bumped from 10 → 20 since user
      // already sees rows; we want load-more to fill in fast.
      const enriched = [...batch]
      const BATCH = 20
      for (let i = 0; i < enriched.length; i += BATCH) {
        const idxs = Array.from({ length: Math.min(BATCH, enriched.length - i) }, (_, k) => i + k)
        await Promise.all(idxs.map(async (idx) => {
          const c = enriched[idx]
          try {
            const params = new URLSearchParams({
              name: c.channelName, channelId: c.channelId,
              website: c.website || '', instagram: c.instagram || '',
              tiktok: c.tiktok || '', description: c.description || '',
            })
            const r = await fetch(`/api/enrich?${params}`)
            const extra = await r.json()
            enriched[idx] = {
              ...c, enriching: false,
              email: c.email || extra.email || '',
              subscribers: c.subscribers || extra.subscribers || '',
              videoDates: (extra.videoDates?.length ? extra.videoDates : c.videoDates) || [],
              shortDates: (extra.shortDates?.length ? extra.shortDates : c.shortDates) || [],
              avgViews: (extra.avgViews != null && !isNaN(extra.avgViews)) ? extra.avgViews : c.avgViews,
              linkedin: c.linkedin || extra.linkedin || '',
              instagram: c.instagram || extra.instagram || '',
              twitter: c.twitter || extra.twitter || '',
              tiktok: c.tiktok || extra.tiktok || '',
              website: c.website || extra.website || '',
            }
          } catch { enriched[idx] = { ...c, enriching: false } }
        }))
        // Re-sort after each enrichment batch: email-havers first, then fitScore desc
        const reSorted = [...enriched].sort((a, b) => {
          const ae = a.email ? 1 : 0, be = b.email ? 1 : 0
          if (ae !== be) return be - ae
          return computeFitScore(b, scoreWeights, effectiveGuidanceEntries) - computeFitScore(a, scoreWeights, effectiveGuidanceEntries)
        })
        setLoadMoreCreators(prev => {
          const keep = prev.slice(0, prev.length - batch.length)
          return [...keep, ...reSorted]
        })
      }
    } catch { /* ignore */ }
    finally { setLoadingMore(false) }
  }, [currentKeyword, currentKeywordsList, loadingMore, loading, minViews, maxViews, maxResults, regions, dismissedIds, outreachIds, bypassFilters])

  // 2026-05-24 — Results-tab exports (handleExportExcel / handleExportCSV)
  // removed per Dylan: "Only allow export on the outreach tab." The
  // settings gear on Results now shows only Customize columns + a
  // redirect link to the Outreach tab for export.
  //
  // Outreach exports go through ExportGateModal, which checks entitlement
  // (unlimited / 1 free monthly when <10 rows / pre-paid credit / $25
  // Stripe charge) before generating the file. CSV is now routed through
  // /api/export-outreach so the paywall can't be bypassed client-side.
  function handleExportOutreachExcel() {
    openExportGate({ format: 'xlsx', entries: outreach })
  }

  function handleExportOutreachCSV() {
    openExportGate({ format: 'csv', entries: outreach })
  }

  const baseList = creators
  // STRUCTURAL exclusions — always applied. These aren't user-toggled
  // "filters"; they're "already handled" (dismissed / added to Outreach)
  // or the active platform choice. The "Filtered ⇄ All" toggle never
  // bypasses these.
  const structuralList = baseList
    // Hide dismissed creators immediately even if they linger in
    // `creators` state momentarily — same logic the icon uses, so the
    // row + icon are always in sync.
    .filter(c => !dismissedIds.has(c.channelId))
    // Hide creators that have already been added to Outreach. Results
    // is meant to be "creators I haven't acted on yet" — once you add
    // someone, they belong in Outreach, not here.
    .filter(c => !outreachIds.has(c.channelId))
    .filter(c => {
      if (activePlatform === 'youtube') return true
      // Strict filter — only show rows that ALREADY have the active
      // platform's handle. Rows appear progressively in IG/X mode as
      // Phase A enrichment resolves their handles.
      if (activePlatform === 'instagram') return !!c.instagram
      if (activePlatform === 'tiktok')    return !!c.tiktok
      if (activePlatform === 'twitter')   return !!c.twitter
      if (activePlatform === 'linkedin')  return !!c.linkedin
      return true
    })
  // SOFT filters — avg views / subs / freshness / has-email. These are
  // what the "Filtered ⇄ All" toggle bypasses.
  const applySoftFilters = (list: Creator[]) => list
    // maxViews === 0 is the "no upper bound" sentinel — the "Any" and "10M+"
    // presets both set max=0. Treat it as unbounded; else they'd filter to
    // `avgViews <= 0` and hide every creator with views.
    .filter(c => c.avgViews >= minViews && (maxViews === 0 || c.avgViews <= maxViews))
    .filter(c => {
      if (minSubs === 0 && maxSubs === 0) return true
      const n = parseSubscriberCount(c.subscribers)
      if (n == null) return minSubs === 0 // unknown subs only pass when there's no min
      if (minSubs > 0 && n < minSubs) return false
      if (maxSubs > 0 && n > maxSubs) return false
      return true
    })
    // Per Dylan 2026-05-11: be lenient with creators whose video date
    // didn't scrape. parseRelativeDays('') returns Infinity which would
    // fail the filter — so pass-through when we have no date. Only
    // filter out creators with a KNOWN-stale date.
    .filter(c => {
      if (maxAgeDays === Infinity) return true
      const dateStr = c.videoDates?.[0]
      if (!dateStr) return true
      return parseRelativeDays(dateStr) <= maxAgeDays
    })
    .filter(c => !emailOnly || !!c.email)
  const softFilteredList = applySoftFilters(structuralList)
  // The "Filtered ⇄ All" toggle: when bypassFilters is on, skip the
  // soft filters entirely and show every structurally-valid creator.
  const currentList = bypassFilters ? structuralList : softFilteredList
  // How many the soft filters are currently hiding — drives whether the
  // toggle chip even appears (no point showing it when nothing's hidden).
  const softHiddenCount = structuralList.length - softFilteredList.length
  const progressPct = enrichProgress.total > 0 ? Math.round((enrichProgress.current / enrichProgress.total) * 100) : 0

  // "Load more" results, filtered to the same visibility rules as the
  // main list. Rendered below the "— additional results —" divider in
  // the DEFAULT (relevance) view.
  const loadMoreFiltered = useMemo(() => loadMoreCreators.filter(c =>
    !dismissedIds.has(c.channelId) &&
    !outreachIds.has(c.channelId) &&
    (bypassFilters || (
      c.avgViews >= minViews && (maxViews === 0 || c.avgViews <= maxViews) &&
      (maxAgeDays === Infinity || !c.videoDates?.[0] || parseRelativeDays(c.videoDates[0]) <= maxAgeDays) &&
      (!emailOnly || !!c.email)
    )) &&
    (activePlatform === 'youtube' || (activePlatform === 'instagram' ? !!c.instagram : activePlatform === 'tiktok' ? !!c.tiktok : activePlatform === 'twitter' ? !!c.twitter : activePlatform === 'linkedin' ? !!c.linkedin : true))
  ), [loadMoreCreators, dismissedIds, outreachIds, bypassFilters, minViews, maxViews, maxAgeDays, emailOnly, activePlatform])

  // When the user sorts by an EXPLICIT column (anything but the default
  // fitScore), the "additional results" must join the main list so the
  // sort is COMPLETE — otherwise product / subscriber / etc. rows stuck
  // in the load-more batch never reach the top ("click Product → all
  // product rows up, not just some"). For the default relevance view we
  // keep them in their own divider section (stable append, no list jump).
  const isExplicitResultsSort = !!sorts[0] && sorts[0].col !== 'fitScore'
  const resultsMainList = useMemo(() => {
    if (!isExplicitResultsSort || loadMoreFiltered.length === 0) return currentList
    const seen = new Set(currentList.map(c => c.channelId))
    return [...currentList, ...loadMoreFiltered.filter(c => !seen.has(c.channelId))]
  }, [isExplicitResultsSort, currentList, loadMoreFiltered])

  // Outreach-tab keyword filter, memoized (2026-07-09 perf): this was
  // computed inline in JSX, so EVERY re-render of this (large) component
  // re-scanned the whole board — even renders triggered by unrelated
  // state like toasts or theme ticks — and handed OutreachTab a fresh
  // array identity each time. Recomputes only when the data or the
  // keyword actually changes.
  const filteredOutreach = useMemo(
    () => filterOutreachByKeyword(outreach, keyword),
    [outreach, keyword],
  )

  return (
    <GuidanceContext.Provider value={{ entries: effectiveGuidanceEntries, addEntry: addGuidanceEntry, removeEntry: removeGuidanceEntry, updateEntryWeight: updateGuidanceEntryWeight, resetAll: resetAllGuidance }}>
    <TourProvider signedIn={!!userId} isAdmin={userEmail === 'dmeehanj@gmail.com'}>
    <main className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Always-on platform shade — subtle radial tint in the active
          platform color, ONLY on the Results tab. Per Dylan 2026-05-10:
          this is the 'shade I LOVE that stays on the entire time on
          Results, tied to the social media color.' Static, no
          animation, just presence. */}
      <PlatformShade platform={activePlatform} visible={activeTab === 'results'} />
      {/* Animated backdrop (Rain / Drift / Fireworks / Tornado) now
          lives INSIDE the sticky banner below (Dylan 2026-05-26 — it
          was scrolling off with the page when rendered as a separate
          fixed/portal layer). See the banner block for its mount. */}
      {/* Sticky glass top bar — same width-feel as the page below */}
      {/* Sticky glass nav — Dylan 2026-05-10 v2: dark mode's
          bg-background/40 was still too opaque against the near-black
          --background token, so animations couldn't read at the top.
          Reduced dark-mode opacity to 10% (light mode unchanged) and
          relying on backdrop-blur-sm + the border for visual
          separation. The wordmark + nav text are still readable
          because the blur softens what's behind. */}
      {/* Banner backdrop-blur is conditionally dropped for Drift —
          the floating-bubble icons were getting too soft to read
          through the blur. Other themes (Rain, Fireworks, Tornado)
          all look fine with the blur, so keep it for them. */}
      <div className={`sticky top-0 z-30 border-b border-border/60 bg-background/40 dark:bg-background/10 relative ${backdropTheme === 'drift' ? '' : 'backdrop-blur-sm'}`}>
        {/* Theme layer — lives INSIDE the sticky banner so it stays
            pinned to the top WITH the banner on scroll (no more
            fixed/portal that scrolled away). overflow-hidden clips the
            animation to the banner strip; this wrapper ONLY wraps the
            theme so it doesn't clip the nav's dropdowns. z-index flips
            above the content during a spotlight burst, otherwise sits
            behind it so icons read through the translucent glass. */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ zIndex: spotlight ? 40 : 0 }}
          aria-hidden
        >
          <PlatformBackdrop theme={backdropTheme} platform={activePlatform} visible={backdropVisible} spotlight={spotlight} intense={spotlightAlwaysOn} />
        </div>
        {/* Padding: tighter on phones (3) to give the wordmark + trial
            pill + hamburger enough room to coexist without overlap;
            generous on desktop (px-6 / px-8 + py-5) as before. */}
        <div className={`relative z-[1] ${activeTab === 'outreach' || activeTab === 'results' ? 'w-full max-sm:px-3 sm:px-6' : 'max-w-7xl mx-auto max-sm:px-3 sm:px-8'} max-sm:py-3 sm:py-5`}>
          <div className="flex items-center justify-between gap-4 max-sm:gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/landing" title="Visit the public site" className="hover:opacity-80 transition-opacity shrink-0">
                {/* Creator Outreach — confident wordmark. v3 (Dylan
                    2026-05-10): kept the gradient text-fill, sized
                    back up so it sits as a peer with the chunkier
                    platform pill instead of feeling smaller than it.
                    Mobile: shrink to text-lg so the wordmark + trial
                    pill + hamburger all fit on a 375px phone. */}
                <h1 className="font-bold tracking-[-0.02em] leading-none bg-gradient-to-r from-foreground to-foreground/75 bg-clip-text text-transparent max-sm:text-lg sm:text-2xl">
                  Creator Outreach
                </h1>
              </Link>
              {/* "Find [colored logo] creators" — brand-color icon is
                  the pop. Surrounding text gets font-medium contrast
                  so it doesn't disappear next to the chunkier pill. */}
              <div className="hidden md:flex items-center gap-2 text-sm" data-tour-id="platform-toggle">
                <span className="text-muted-foreground/90 font-medium">Find</span>
                <PlatformDropdown activePlatform={activePlatform} onChange={async (newPlatform) => {
                  // Save the CURRENT platform's state to Supabase
                  // (fire-and-forget so we don't await).
                  void savePlatformWeights(activePlatform, scoreWeights)
                  void savePlatformNarrative(activePlatform, scoreNarrative)
                  void savePlatformGuidance(activePlatform, guidanceEntries)
                  // Toggle the platform IMMEDIATELY so the UI responds
                  // on click — header label, column lens, filters all
                  // flip without waiting for the Supabase round-trip.
                  // Previously the await above made toggling feel
                  // chunky (per Dylan 2026-05-21). The brief mismatch
                  // between activePlatform and scoring weights for the
                  // ~200-500ms the load takes is benign — search isn't
                  // re-running and scoring still produces a stable view.
                  setActivePlatform(newPlatform)
                  try {
                    const { weights, narrative, guidance } = await loadPlatformState(newPlatform)
                    setScoreWeights(weights)
                    setScoreNarrative(narrative)
                    setGuidanceEntries(guidance)
                  } catch {
                    // Keep current scoring state on failure — the
                    // platform toggle still applies its filter + lens.
                  }
                }} />
                <span className="text-muted-foreground/90 font-medium">creators</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0" data-tour-id="header-pills">
              {/* Tips & tricks pill — curated power-user tips, cycles
                  through ~25 hand-written entries. Hidden below md.
                  Sibling of the dashboard insight pill but with
                  different scope: this one is about the APP
                  (features, shortcuts), the other is about YOUR DATA. */}
              <TipsAndTricksPill />
              {/* Dashboard insight pill — rules-based pattern detection
                  on cross-tab data (Results / Dismissed / Pipeline /
                  Follow-ups / Active Clients / Workflow). Hidden below
                  md so the mobile header stays uncluttered. Click
                  opens a popover with the full observation + refresh. */}
              {userId && (
                <DashboardInsightPill
                  entries={outreach}
                  userId={userId}
                  resultsCount={creators.length}
                  dismissedCount={dismissed.length}
                  profile={profile}
                />
              )}
              {/* In-app inbox — admin broadcasts + two-way direct
                  messages (migration 0042). Visible on mobile too,
                  unlike the insight pills. */}
              {userId && <InboxBell />}
              {/* Upgrade / Manage CTA — hides when Stripe isn't
                  configured (e.g. dev/preview without env vars). */}
              <UpgradeButton
                subscription={subscription}
                stripeConfigured={!!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
              />
              <HamburgerMenu
                userEmail={userEmail}
                userFullName={profile?.fullName || null}
                onOpenScoreSettings={() => setShowScoreSettings(true)}
                onOpenProfile={() => setShowProfile(true)}
                onOpenTemplates={() => setShowTemplates(true)}
                onOpenIntegrations={() => setShowIntegrations(true)}
                onImportOutreach={() => setShowImport(true)}
                onImportDismissed={() => setShowImportDismissed(true)}
                showRetryMigration={hasBackup}
                onRetryMigration={async () => {
                  const result = await retryMigrationFromBackup()
                  alert(result.ok ? `✓ ${result.message} Refreshing…` : `Migration retry failed: ${result.message}`)
                  if (result.ok) window.location.reload()
                }}
                backdropTheme={backdropTheme}
                onBackdropThemeChange={handleBackdropThemeChange}
                onTriggerSpotlight={handleManualSpotlight}
                spotlightActive={spotlight}
                backdropDurationSec={backdropDurationSec}
                onBackdropDurationChange={setBackdropDurationSec}
                spotlightAlwaysOn={spotlightAlwaysOn}
                onSpotlightAlwaysOnChange={setSpotlightAlwaysOn}
                subscriptionHref={
                  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
                    ? '/pricing'
                    : null
                }
                subscriptionLabel={(() => {
                  const l = computeUpgradeLabel(subscription)
                  return { cta: l.cta === 'Upgrade' ? 'Pricing' : l.cta, status: l.hint ?? 'Plans & checkout' }
                })()}
                onStartTour={() => {
                  // CustomEvent bridges to TourContext (which lives
                  // deeper in the tree, inside <TourProvider>). Same
                  // pattern as 'tour-navigate' / 'goto-active-client'.
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('tour-start'))
                  }
                }}
                teamContext={teamContext}
              />
            </div>
          </div>
        </div>
      </div>

      <div className={`${activeTab === 'outreach' || activeTab === 'results' ? 'w-full px-6' : 'max-w-7xl mx-auto px-8'} pt-6 pb-16`}>

        {/* Search-area wrapper — groups the mode pills + the search row
            so the pills can fade in/out based on whether anything inside
            has focus. Per Dylan 2026-05-10: hover trigger removed —
            clicking into the search bar is the only way to surface the
            pills. Hover was too easy to trip on mouseover, making the
            UI feel jumpy. */}
        <div className="group/searchgroup">

        {/* Search-mode pills — three modes (URL / Username / Occupation
            or Field) above the search bar. Auto-selected based on what
            the classifier sees as you type; clicking a pill overrides
            and sticks until the input is cleared. Drives whether the
            next search is a targeted /api/lookup-channel call (URL +
            Username) or a broad /api/search call (Occupation). Only
            visible on Results tab — Outreach/Dismissed use the search
            input as a local filter, not a search trigger. */}
        {activeTab === 'results' && (
          <div className="overflow-hidden transition-all duration-150 ease-out opacity-0 max-h-0 group-focus-within/searchgroup:opacity-100 group-focus-within/searchgroup:max-h-12">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold">Mode</span>
              {([
                { id: 'url' as const, label: 'URL', hint: 'youtube.com/@handle, instagram.com/...' },
                { id: 'username' as const, label: 'Username', hint: '@mrbeast or just a handle' },
                { id: 'occupation' as const, label: 'Occupation / Field', hint: 'fitness coach, productivity, etc.' },
              ]).map(p => {
                const isActive = searchMode === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    // 2026-05-10 per Dylan: clicking a pill made it disappear
                    // before the click registered, because Safari/Firefox
                    // don't grant focus to buttons on click — focus left
                    // the input, group-focus-within flipped false, the
                    // container collapsed. preventDefault on mousedown
                    // stops the input from losing focus so the pill row
                    // stays visible through the entire click cycle.
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => {
                      setSearchMode(p.id)
                      setSearchModeManual(true)
                      // If there's already a keyword and this is a real
                      // change, re-fire the search with the new mode so
                      // the user sees the effect immediately. The mode
                      // override param sidesteps React's setState batch —
                      // runSearch sees the new mode this turn.
                      if (!isActive && keyword.trim()) {
                        runSearch(keyword, undefined, p.id)
                      }
                    }}
                    title={`${p.hint}${searchModeManual && isActive ? ' (manual)' : ''}`}
                    aria-pressed={isActive}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      isActive
                        ? 'bg-purple-500/15 border-purple-500/50 text-purple-700 dark:text-purple-300 font-medium'
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-muted/40'
                    }`}
                  >
                    {p.label}
                  </button>
                )
              })}
              {searchModeManual && keyword.trim() && (
                <button
                  type="button"
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => setSearchModeManual(false)}
                  className="text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors underline-offset-2 hover:underline"
                  title="Reset to auto-detect"
                >
                  reset auto-detect
                </button>
              )}
            </div>
          </div>
        )}

        {/* Premium search bar — chunkier sizing + gradient glow on focus.
            The outer wrapper renders an absolute-positioned blur that
            fades in when any child is focused (group-focus-within),
            giving the whole row a soft purple-blue halo without
            adding state or refs. The input itself is taller (py-3 vs
            py-2.5) with rounded-xl corners and a wider focus ring. */}
        <div className="relative group/search mb-2" data-tour-id="search-input">
          {/* Soft ambient glow visible only when something inside the
              search row has focus. Sits beneath everything, doesn't
              capture clicks. */}
          <div
            className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-purple-500/10 via-blue-500/8 to-purple-500/10 opacity-0 blur-2xl transition-opacity duration-500 group-focus-within/search:opacity-100 pointer-events-none"
            aria-hidden
          />
          <div className="relative flex gap-2 flex-wrap">
            <div className="flex-1 min-w-64 relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px] text-muted-foreground/80 group-focus-within:text-purple-600 dark:group-focus-within:text-purple-400 transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                ref={searchInputRef}
                aria-label={
                  activeTab === 'outreach'
                    ? 'Filter outreach by name, email, notes, or niche'
                    : 'Search creators — by topic, YouTube URL, handle, or natural-language description'
                }
                className="w-full bg-card/70 backdrop-blur-sm border border-border/80 rounded-xl pl-11 pr-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-purple-500/60 focus:ring-4 focus:ring-purple-500/15 focus:bg-card hover:border-border transition-all duration-200 shadow-sm"
                placeholder={
                  activeTab === 'outreach'
                    ? 'Filter your outreach by name, email, notes, niche…'
                    : 'Search a topic, paste a YouTube URL, or @handle to find a specific creator…'
                }
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => {
                  // On Outreach tab, Enter is a no-op — the filter is
                  // already live as the user types. Suppressing prevents
                  // accidental YouTube search triggers from people who
                  // hit Enter out of habit.
                  if (e.key === 'Enter' && activeTab !== 'outreach') handleSearch()
                }}
              />
            </div>
          {/* Score settings icon — sized to match the chunkier input. */}
          <button
            onClick={() => setShowScoreSettings(true)}
            title="Lead Criteria"
            aria-label="Lead criteria — configure AI fit score"
            className={`px-3.5 py-3 rounded-xl border transition-all flex items-center gap-1.5 ${JSON.stringify(scoreWeights) !== JSON.stringify(DEFAULT_WEIGHTS) || scoreNarrative || effectiveGuidanceEntries.length > 0 ? 'bg-gradient-to-br from-purple-600 to-purple-700 border-purple-500/60 text-white shadow-md shadow-purple-500/20' : 'bg-card/70 backdrop-blur-sm border-border/80 text-muted-foreground hover:text-foreground hover:border-border'}`}
          >
            <span className="text-sm" aria-hidden>⚡</span>
          </button>
          {/* Filter icon */}
          <button
            onClick={() => setShowFilter(v => !v)}
            title={regions.length === 0 ? 'Filters — English-language search (no regional filter)' : regions.length === REGIONS.length ? 'Filters — Global (all regions)' : `Filters — searching: ${regions.map(code => REGIONS.find(r => r.code === code)?.label).join(', ')}`}
            aria-label={regions.length === 0 ? 'Filters — English-language search, no region selected' : regions.length === REGIONS.length ? 'Filters — searching globally across all regions' : `Filters — searching ${regions.map(code => REGIONS.find(r => r.code === code)?.label).join(', ')}`}
            aria-expanded={showFilter}
            aria-pressed={regions.length > 0}
            className={`px-3.5 py-3 rounded-xl border transition-all flex items-center gap-1.5 ${showFilter || regions.length > 0 ? 'bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500/60 text-white shadow-md shadow-blue-500/20' : 'bg-card/70 backdrop-blur-sm border-border/80 text-muted-foreground hover:text-foreground hover:border-border'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            {regions.length > 0 && (
              <span className="text-xs flex gap-px">
                {regions.length === REGIONS.length
                  ? '🌐'
                  : <>
                    {regions.slice(0, 3).map(code => REGIONS.find(r => r.code === code)?.flag).join('')}
                    {regions.length > 3 && <span className="text-[10px] font-bold">+{regions.length - 3}</span>}
                  </>
                }
              </span>
            )}
          </button>
          {/* Search button — spinner + "Searching…" stay visible the
              entire time `loading` is true, regardless of whether the
              user typed a new query mid-flight. Reflects "something
              is searching" honestly. When the user types a new query
              while one's in flight, the button BECOMES CLICKABLE again
              (the only state difference) so they can cancel + restart
              with Enter or a click — but the spinner keeps spinning
              until the loading state actually clears. */}
          {(() => {
            const typedSinceSearch =
              loading && keyword.trim().toLowerCase() !== currentKeyword.trim().toLowerCase()
            const onOutreach = activeTab === 'outreach'
            // Disabled only when truly idle-loading (not typed since
            // search). Lets the user click to fire a new search even
            // while the spinner is still going for the previous one.
            const isClickable = (!loading || typedSinceSearch) && !onOutreach
            return (
              <button
                onClick={handleSearch}
                disabled={!isClickable}
                title={
                  onOutreach
                    ? 'On Outreach tab the search bar filters your list — switch to Results to search YouTube.'
                    : typedSinceSearch
                    ? 'Hit Enter or click to search this new query — the spinner will reflect the new request.'
                    : undefined
                }
                className="relative bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold text-white shadow-md shadow-purple-500/20 transition-all hover:shadow-lg hover:shadow-purple-500/30 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {loading && (
                    <svg
                      className="w-3.5 h-3.5 animate-spin opacity-90"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  )}
                  {loading ? 'Searching…' : 'Search'}
                </span>
                {/* Shimmer animates the entire time we're loading — the
                    spinner + shimmer combo signals ongoing work even
                    after the user typed something new. */}
                {loading && (
                  <span className="absolute inset-0 shimmer-bg rounded-xl pointer-events-none" aria-hidden />
                )}
              </button>
            )
          })()}
          {/* Export moved out of the search bar (2026-05-09). It now
              lives inline with the tab nav, right next to Customize —
              closer to the actual data the user is exporting and out
              of the way of the search controls. See the tab bar
              section further below. */}
        </div>
        </div>
        </div>{/* /group/searchgroup — closes the focus/hover scope
                  that drives the smooth-hide of the mode pills above */}

        {/* (The previous live classification badge was removed in
            favor of the explicit search-mode pills above the search
            bar — pills carry the same affordance with a clearer
            interaction model.) */}

        {/* Filter panel — hidden by default */}
        {showFilter && (
          <div
            data-tour-id="filter-panel"
            className="flex flex-col gap-3 mb-3 p-4 bg-card border border-border rounded-xl shadow-sm shadow-black/5"
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-muted-foreground w-20 shrink-0">Avg views:</span>
              <input type="number" min={0} value={minViews}
                onChange={e => setMinViews(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-28 bg-muted border border-border rounded px-3 py-1 text-sm text-foreground focus:outline-none focus:border-blue-500"
                placeholder="Min" />
              <span className="text-muted-foreground/70 text-xs">to</span>
              <input type="number" min={0} value={maxViews}
                onChange={e => setMaxViews(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-28 bg-muted border border-border rounded px-3 py-1 text-sm text-foreground focus:outline-none focus:border-blue-500"
                placeholder="Max" />
              <span className="text-muted-foreground/70 text-xs">|</span>
              {VIEW_PRESETS.map(p => (
                <button key={p.label} onClick={() => { setMinViews(p.min); setMaxViews(p.max) }}
                  className={`text-xs px-3 py-1 rounded border transition-colors ${minViews === p.min && maxViews === p.max ? 'bg-blue-600 border-blue-500 text-white' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap border-t border-border pt-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0">Subscribers:</span>
              <input type="number" min={0} value={minSubs || ''}
                onChange={e => setMinSubs(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-28 bg-muted border border-border rounded px-3 py-1 text-sm text-foreground focus:outline-none focus:border-blue-500"
                placeholder="Min" />
              <span className="text-muted-foreground/70 text-xs">to</span>
              <input type="number" min={0} value={maxSubs || ''}
                onChange={e => setMaxSubs(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-28 bg-muted border border-border rounded px-3 py-1 text-sm text-foreground focus:outline-none focus:border-blue-500"
                placeholder="Max" />
              <span className="text-muted-foreground/70 text-xs">|</span>
              {[
                { label: '< 1K', min: 0, max: 1_000 },
                { label: '1K – 10K', min: 1_000, max: 10_000 },
                { label: '10K – 100K', min: 10_000, max: 100_000 },
                { label: '100K – 500K', min: 100_000, max: 500_000 },
                { label: '500K – 1M', min: 500_000, max: 1_000_000 },
                { label: '1M – 5M', min: 1_000_000, max: 5_000_000 },
                { label: '5M – 10M', min: 5_000_000, max: 10_000_000 },
                { label: '10M+', min: 10_000_000, max: 0 },
                { label: 'Any', min: 0, max: 0 },
              ].map(p => (
                <button key={p.label} onClick={() => { setMinSubs(p.min); setMaxSubs(p.max) }}
                  className={`text-xs px-3 py-1 rounded border transition-colors ${minSubs === p.min && maxSubs === p.max ? 'bg-blue-600 border-blue-500 text-white' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap border-t border-border pt-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0">Last posted:</span>
              {[
                { label: 'Last 7 days', days: 7 },
                { label: 'Last 30 days', days: 30 },
                { label: 'Last 90 days', days: 90 },
                { label: 'Last 6 months', days: 180 },
                { label: 'Last 12 months', days: 360 },
                { label: 'Any time', days: Infinity },
              ].map(p => (
                <button key={p.label} onClick={() => setMaxAgeDays(p.days)}
                  className={`text-xs px-3 py-1 rounded border transition-colors ${maxAgeDays === p.days ? 'bg-blue-600 border-blue-500 text-white' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap border-t border-border pt-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0">Show only:</span>
              <button
                onClick={() => setEmailOnly(v => !v)}
                className={`text-xs px-3 py-1 rounded border transition-colors ${emailOnly ? 'bg-blue-600 border-blue-500 text-white' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}
              >
                Has email
              </button>
              <button
                onClick={() => setEmailFirstSort(v => !v)}
                title="When on, creators with a discovered email sort to the top by default — until you click a column to sort by it, which takes over (emails still break ties within that sort)."
                className={`text-xs px-3 py-1 rounded border transition-colors ${emailFirstSort ? 'bg-blue-600 border-blue-500 text-white' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}
              >
                Email-first sort
              </button>
            </div>
            <div className="flex items-start gap-3 flex-wrap border-t border-border pt-3">
              <div className="flex flex-col w-20 shrink-0 mt-1 gap-0.5">
                <span className="text-xs text-muted-foreground">Region:</span>
                <span className="text-[10px] text-muted-foreground/70 leading-snug">Pick countries or go Global for all</span>
              </div>
              <div className="flex flex-wrap gap-1.5 flex-1" role="group" aria-label="Region filter">
                {/* English = no region filter (default) */}
                <button
                  onClick={() => setRegions([])}
                  title="No regional filter — English-language creators only"
                  aria-pressed={regions.length === 0}
                  className={`text-xs px-2.5 py-1 rounded border transition-colors flex items-center gap-1 ${regions.length === 0 ? 'bg-blue-600 border-blue-500 text-white' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}
                >
                  <span aria-hidden>🌐</span>
                  <span>English</span>
                </button>
                {/* Global = all countries */}
                <button
                  onClick={() => setRegions(REGIONS.map(r => r.code))}
                  title="Search across all countries simultaneously — slower but surfaces creators from every region"
                  aria-pressed={regions.length === REGIONS.length}
                  className={`text-xs px-2.5 py-1 rounded border transition-colors flex items-center gap-1 ${regions.length === REGIONS.length ? 'bg-blue-600 border-blue-500 text-white' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}
                >
                  <span aria-hidden>🗺️</span>
                  <span>Global</span>
                </button>
                {REGIONS.map(r => (
                  <button
                    key={r.code}
                    onClick={() => setRegions(prev => regions.includes(r.code) ? prev.filter(c => c !== r.code) : [...prev, r.code])}
                    aria-pressed={regions.includes(r.code)}
                    aria-label={`${r.label}${regions.includes(r.code) ? ' (selected)' : ''}`}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors flex items-center gap-1 ${regions.includes(r.code) ? 'bg-blue-600 border-blue-500 text-white' : 'bg-muted border-border text-foreground/80 hover:border-border'}`}
                  >
                    <span aria-hidden>{r.flag}</span>
                    <span>{r.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading progress — wrapped in role=status + aria-live=polite
            so screen readers announce the search/enrich progress
            without interrupting the user. Both the loading and idle
            status share the same live region so transitions read
            naturally ("Searching..." → "Enriching 12 / 100 creators"
            → "Done — 100 creators found"). */}
        <div role="status" aria-live="polite" aria-atomic="true" className="contents">
          {loading && (
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-1.5">
                <Spinner />
                <span className="text-sm text-foreground/80">
                  {enrichProgress.total === 0
                    ? 'Searching...'
                    : `Enriching ${enrichProgress.current} / ${enrichProgress.total} creators`}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">{elapsed}s elapsed</span>
              </div>
              {enrichProgress.total > 0 && (
                <div
                  className="w-full bg-muted rounded-full h-1.5"
                  role="progressbar"
                  aria-valuenow={enrichProgress.current}
                  aria-valuemin={0}
                  aria-valuemax={enrichProgress.total}
                  aria-label="Enrichment progress"
                >
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {!loading && status && (
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <p className="text-xs text-muted-foreground">{status}</p>
              {/* Search similar pill — appears when a targeted (URL or
                  Username) lookup returns no matches. Click to switch
                  the pill to Occupation/Field mode and re-run the
                  same input as a broad keyword search. The classifier
                  inside runSearch's broad-search path will narrow
                  results to channel-name fuzzy matches when the input
                  still looks handle-shaped. */}
              {showSearchSimilar && keyword.trim() && activeTab === 'results' && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchMode('occupation')
                    setSearchModeManual(true)
                    setShowSearchSimilar(false)
                    // Pass override to bypass setSearchMode batching —
                    // see pill onClick for the same pattern.
                    runSearch(keyword, undefined, 'occupation')
                  }}
                  className="text-xs px-3 py-1 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/40 hover:bg-purple-500/25 transition-colors font-medium inline-flex items-center gap-1.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  Search similar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Suggestions bar — niche filter on top, occupations below */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setShowSuggestions(v => !v)} className="text-xs text-muted-foreground hover:text-foreground/80 uppercase tracking-wide flex items-center gap-1 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 transition-transform ${showSuggestions ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Suggested searches
            </button>
            {/* Refresh chips — always available when the suggestion list
                is not narrowed to a specific niche. */}
            {showSuggestions && !(showNiches && selectedNiche) && (
              <button onClick={() => setSuggestions(pickRandom(ALL_OCCUPATIONS, 25))} title="Shuffle suggestions" aria-label="Shuffle suggested searches" className="text-muted-foreground hover:text-foreground/80 border border-border rounded p-0.5 hover:border-border transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
          {showSuggestions && (
            <>
              {/* Niche row — collapsed by default. The 'See niches' pill on the
                  left expands the row of all niches; clicking a niche fires a
                  multi-occupation search across every occupation in that niche. */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <button
                  onClick={() => {
                    setShowNiches(v => {
                      const next = !v
                      // Hiding the niche row also clears any active niche
                      // filter so the suggestions return to the mixed
                      // random sample.
                      if (!next) setSelectedNiche(null)
                      return next
                    })
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 ${showNiches ? 'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300' : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:border-border/80'}`}
                  title="Search every occupation in a niche at once"
                >
                  <span>{showNiches ? '✕' : '🎯'}</span>
                  <span>{showNiches ? 'Hide niches' : 'See niches'}</span>
                </button>
                {showNiches && (
                  <>
                    <button
                      onClick={() => setSelectedNiche(null)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedNiche == null ? 'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300' : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:border-border/80'}`}
                    >
                      All niches
                    </button>
                    {NICHE_BUCKETS.map(n => (
                      <button
                        key={n.id}
                        onClick={() => {
                          setSelectedNiche(n.id)
                          setKeyword(n.label)
                          runSearch(n.label, n.occupations)
                        }}
                        title={`Search all ${n.occupations.length} occupations: ${n.occupations.slice(0, 4).join(', ')}${n.occupations.length > 4 ? '…' : ''}`}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 ${selectedNiche === n.id ? 'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300' : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:border-border/80'}`}
                      >
                        <span>{n.emoji}</span>
                        <span>{n.label}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>

              {/* Occupation chips — quick single-occupation searches.
                  When the niche row is open AND a niche is selected, drill
                  into that niche's occupations. Otherwise show the random
                  mixed sample. */}
              <div className="flex flex-wrap gap-2">
                {(showNiches && selectedNiche
                  ? (NICHE_BUCKETS.find(n => n.id === selectedNiche)?.occupations || [])
                  : suggestions
                ).map(s => (
                  <button key={s} onClick={() => { setKeyword(s); runSearch(s) }}
                    className="text-xs px-3 py-1.5 rounded-full bg-muted text-foreground/80 hover:bg-muted hover:text-foreground border border-border hover:border-border transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Tabs + Customize */}
        <div className="flex items-center mb-4 border-b border-border" data-tour-id="main-tabs">
          <AnimatedTabs<ActiveTab>
            layoutGroup="main-tabs"
            ariaLabel="Main view"
            tabs={[
              {
                id: 'results',
                // Tab counter (Dylan 2026-05-26): just the visible count,
                // no second number. The old "80 of 175" read like a cap
                // — it wasn't (175 = raw search return, 80 = what's left
                // after the active filters). Showing only the actionable
                // count removes the "why am I missing 95?" confusion. A
                // small "· filtered" hint flags that filters are trimming,
                // with a tooltip pointing to where to loosen them.
                label: (() => {
                  const visible = currentList.length
                  if (creators.length === 0) return <>Results</>
                  // The "filtered ⇄ all" chip is a toggle. Originally only
                  // appeared when soft filters were hiding creators, but
                  // the toggle now also refetches the server without the
                  // 200K avg-view cap (Dylan 2026-05-30) — meaning even
                  // when softHiddenCount is 0, clicking it can surface
                  // bigger creators that the server filtered out. So
                  // we keep it visible whenever results exist. role="button"
                  // span (not <button>) so we don't nest an interactive
                  // button inside the tab's own button (invalid HTML);
                  // stopPropagation keeps the click from also firing the
                  // tab switch.
                  const showToggle = creators.length > 0
                  return (
                    <>Results{' '}
                      <span className="ml-1 text-xs text-muted-foreground">({visible})</span>
                      {showToggle && (
                        <span
                          role="button"
                          tabIndex={0}
                          data-tour-id="results-filter-toggle"
                          onClick={(e) => { e.stopPropagation(); setBypassFilters(v => !v) }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setBypassFilters(v => !v) } }}
                          title={bypassFilters
                            ? `Showing everything — server-side view cap dropped + client filters off. Click to refetch with your filters back on.`
                            : `Filtered: client filters applied + server capping avg views ≤ ${maxViews.toLocaleString()}. Click to refetch without the cap and include bigger creators.`}
                          className={`ml-1 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full border cursor-pointer transition-colors ${
                            bypassFilters
                              ? 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20'
                              : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
                          }`}
                        >
                          {bypassFilters ? 'showing all' : 'filtered'}
                        </span>
                      )}
                    </>
                  )
                })(),
              },
              {
                id: 'outreach',
                label: <>Outreach {outreach.length > 0 && <span className="ml-1 text-xs text-purple-700 dark:text-purple-400">({outreach.length})</span>}</>,
              },
              {
                id: 'dismissed',
                label: <>Dismissed {dismissed.length > 0 && <span className="ml-1 text-xs text-red-700 dark:text-red-400">({dismissed.length})</span>}</>,
              },
            ]}
            active={activeTab}
            onChange={(next) => {
              // Clear the keyword when changing tabs — the search bar
              // means different things per tab (YouTube search on
              // Results, local filter on Outreach / Dismissed) and a
              // leftover keyword from one context silently filtering
              // another led to "only newly-added showing" confusion.
              // Cleaner to start each tab with a blank search.
              if (next !== activeTab) setKeyword('')
              setActiveTab(next)
            }}
          />
          {/* Tab-nav gear popover (Dylan 2026-05-24 paywall remodel):
              - On Outreach > All / Favorites: shows Excel + CSV export
                buttons. Both go through ExportGateModal which checks
                entitlement before generating the file.
              - On Results: shows Customize columns + a "Export available
                on Outreach tab →" redirect link. Per Dylan, exports are
                now Outreach-only — the redirect link helps users find
                the new location without dead-ending the click.
              - Hidden entirely on: Dismissed, Outreach > Analytics
                (Analytics also gets the redirect inline below),
                Outreach > Follow-ups, Outreach > Active Clients. */}
          {activeTab !== 'dismissed' &&
            !(activeTab === 'outreach' && (outreachSubTab === 'analytics' || outreachSubTab === 'followups' || outreachSubTab === 'active')) && (
            <div className="ml-auto flex items-center gap-1.5">
              {/* Standalone "Customize columns" button on Results — Dylan
                  2026-06-09 said the entry was hard to find inside the
                  gear menu. Surface a direct shortcut next to the gear. */}
              {activeTab === 'results' && (
                <button
                  type="button"
                  onClick={() => {
                    const draft = activePlatform === 'youtube'
                      ? colConfig
                      : colConfig.filter(c => !YOUTUBE_ONLY_COL_IDS.includes(c.id))
                    setDraftCols(draft)
                    setShowCustomize(true)
                  }}
                  title="Customize columns — show / hide / reorder"
                  aria-label="Customize columns"
                  className="flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border hover:border-border/80 transition-colors mb-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h13M3 12h13M3 18h7" />
                  </svg>
                  <span className="hidden sm:inline">Customize</span>
                </button>
              )}
            <div ref={exportMenuRef} className="relative">
              <button
                onClick={() => setShowExport(v => !v)}
                title={activeTab === 'outreach' ? 'Export this list' : 'Customize columns (export is on the Outreach tab)'}
                aria-label="Export options"
                className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border hover:border-border/80 transition-colors mb-1"
              >
                {/* Outreach tab: download-tray icon (export-forward).
                    Results tab: same icon for visual consistency, but
                    the dropdown content shifts to Customize + redirect. */}
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </button>
              {showExport && (
                <div className="absolute right-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-2xl shadow-black/30 z-30 overflow-hidden">
                  {/* Customize columns — only shown on Results
                      (Outreach has its own customize entrypoint
                      inside its sub-tab nav). */}
                  {activeTab === 'results' && (
                    <button
                      onClick={() => {
                        const draft = activePlatform === 'youtube'
                          ? colConfig
                          : colConfig.filter(c => !YOUTUBE_ONLY_COL_IDS.includes(c.id))
                        setDraftCols(draft)
                        setShowCustomize(true)
                        setShowExport(false)
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors border-b border-border/60"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h13M3 12h13M3 18h7" />
                      </svg>
                      Customize columns
                    </button>
                  )}
                  {/* Export — disabled when the active list is empty.
                      Outreach tab gets full Excel/CSV. Everywhere else
                      gets a redirect link to Outreach. */}
                  {activeTab === 'outreach' ? (
                    <>
                      <button
                        onClick={handleExportOutreachExcel}
                        disabled={outreach.length === 0}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        Export Excel
                      </button>
                      <button
                        onClick={handleExportOutreachCSV}
                        disabled={outreach.length === 0}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors border-t border-border/60 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span className="text-base leading-none">📄</span>
                        Export CSV
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setActiveTab('outreach')
                        setShowExport(false)
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      <span className="flex-1">
                        <div>Export on Outreach tab</div>
                        <div className="text-[10px] text-muted-foreground/70 font-normal">Click to switch tabs →</div>
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
            </div>
          )}
          {/* Standalone Customize button on Results re-added 2026-06-09
              (Dylan: "the entry inside the gear was either hard to find
              or doesn't exist like I don't see it at all"). On Outreach
              the in-tab "Customize columns" link in OutreachTab still
              works. On Dismissed there's nothing to customize. */}
        </div>

        {/* Customize drawer */}
        {showCustomize && (
          <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/50" onClick={() => setShowCustomize(false)} />
            <div className="w-80 bg-card border-l border-border flex flex-col h-full">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="font-semibold text-foreground">Customize Columns</h2>
                <button onClick={() => setShowCustomize(false)} className="text-muted-foreground hover:text-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-muted-foreground px-5 pt-3 pb-1">Channel is always shown first.</p>
              {activePlatform !== 'youtube' && (
                <p className="text-xs text-muted-foreground/70 px-5 pb-2">YouTube-only metrics hidden for {platformConfig.label} view.</p>
              )}
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
                {draftCols.map((col, idx) => {
                  const isLocked = platformConfig.column === col.id
                  return (
                    <div key={col.id} className={`flex items-center gap-3 py-2 px-3 rounded group ${isLocked ? 'opacity-60' : 'hover:bg-muted'}`}>
                      <input
                        type="checkbox" checked={col.visible}
                        disabled={isLocked}
                        onChange={() => !isLocked && setDraftCols(d => d.map((c, i) => i === idx ? { ...c, visible: !c.visible } : c))}
                        className="w-4 h-4 rounded accent-blue-500 disabled:cursor-not-allowed"
                      />
                      <span className="flex-1 text-sm text-foreground">{col.label}</span>
                      {isLocked
                        ? <span className="text-[10px] text-muted-foreground shrink-0">auto-on</span>
                        : (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              disabled={idx === 0}
                              onClick={() => setDraftCols(d => { const n = [...d]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n })}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed px-1"
                            >↑</button>
                            <button
                              disabled={idx === draftCols.length - 1}
                              onClick={() => setDraftCols(d => { const n = [...d]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; return n })}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed px-1"
                            >↓</button>
                          </div>
                        )
                      }
                    </div>
                  )
                })}
              </div>
              <div className="px-5 py-4 border-t border-border flex gap-3">
                <button
                  onClick={() => setDraftCols(DEFAULT_COLS)}
                  className="flex-1 px-4 py-2 text-sm text-muted-foreground border border-border rounded hover:border-border hover:text-foreground transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={() => {
                    let saved = draftCols
                    if (activePlatform !== 'youtube') {
                      // Re-append YouTube-only cols so they're preserved for when user switches back
                      const ytOnly = colConfig.filter(c => YOUTUBE_ONLY_COL_IDS.includes(c.id))
                      saved = [...draftCols, ...ytOnly]
                    }
                    setColConfig(saved)
                    setDraftCols(saved)
                    void saveColConfig(saved)
                    setShowCustomize(false)
                  }}
                  className="flex-1 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {showAnalyticsCustomize && (
          <AnalyticsCustomizeShell onClose={() => setShowAnalyticsCustomize(false)}>
            <div className="w-96 bg-card border-l border-border flex flex-col h-full">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="font-semibold text-foreground">Customize Analytics</h2>
                <button onClick={() => setShowAnalyticsCustomize(false)} className="text-muted-foreground hover:text-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {/* Suggested — live preview cards with your real data */}
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Suggested · live preview</div>
                    <div className="text-[10px] text-muted-foreground/70">click any to add</div>
                  </div>
                  {(() => {
                    const existingLabels = new Set(draftMetrics.map(m => m.label.toLowerCase()))
                    const remaining = SUGGESTED_METRICS.filter(s => !existingLabels.has(s.label.toLowerCase()))
                    if (remaining.length === 0) return <div className="text-xs text-muted-foreground/70 italic">All suggestions added.</div>
                    return (
                      <div className="grid grid-cols-2 gap-2">
                        {remaining.map(s => {
                          const previewMetric = { ...s, id: `preview-${s.label}` } as import('@/lib/types').CustomMetric
                          const value = computeMetric(previewMetric, outreach)
                          const typeLabel = metricTypeLabel(s)
                          return (
                            <button
                              key={s.label}
                              onClick={() => setDraftMetrics(d => [...d, { ...s, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }])}
                              className="group text-left bg-muted/40 hover:bg-muted border border-border hover:border-purple-500/60 rounded-lg p-3 transition-colors"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate" title={s.label}>{s.label}</div>
                                <span className="text-[10px] text-muted-foreground/70 group-hover:text-purple-700 dark:text-purple-400 transition-colors">+ Add</span>
                              </div>
                              <div className="text-xl font-bold text-foreground tabular-nums">{value}</div>
                              <div className="text-[10px] text-muted-foreground capitalize mt-0.5">{typeLabel}</div>
                            </button>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>

                {/* Build your own */}
                <div>
                  <button
                    onClick={() => setShowAddMetric(true)}
                    className="w-full text-xs text-purple-700 dark:text-purple-300 hover:text-purple-800 dark:text-purple-200 border border-purple-500/30 hover:border-purple-500/60 rounded-md px-3 py-2 transition-colors"
                  >
                    + Build a custom metric
                  </button>
                </div>

                {/* Your metrics list */}
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Your metrics</div>
                    <div className="text-[10px] text-muted-foreground/70">{draftMetrics.length} card{draftMetrics.length === 1 ? '' : 's'}</div>
                  </div>
                  {draftMetrics.length === 0 ? (
                    <div className="text-xs text-muted-foreground/70 italic py-4 text-center">No metrics yet — add a suggestion or build your own above.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {draftMetrics.map((m, idx) => {
                        const value = computeMetric(m, outreach)
                        return (
                          <div key={m.id} className="flex items-center gap-2 py-2 px-3 rounded bg-muted/40 hover:bg-muted border border-border group">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-foreground truncate">{m.label}</div>
                              <div className="text-[10px] text-muted-foreground capitalize">{metricTypeLabel(m)}</div>
                            </div>
                            <span className="text-sm font-bold text-foreground tabular-nums">{value}</span>
                            <div className="flex gap-0.5">
                              <button
                                disabled={idx === 0}
                                onClick={() => setDraftMetrics(d => { const n = [...d]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n })}
                                className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed px-1"
                                title="Move up"
                              >↑</button>
                              <button
                                disabled={idx === draftMetrics.length - 1}
                                onClick={() => setDraftMetrics(d => { const n = [...d]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; return n })}
                                className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed px-1"
                                title="Move down"
                              >↓</button>
                              <button
                                onClick={() => setEditingMetric(m)}
                                className="text-muted-foreground hover:text-foreground px-1"
                                title="Edit"
                              >✎</button>
                              <button
                                onClick={() => setDraftMetrics(d => d.filter(x => x.id !== m.id))}
                                className="text-muted-foreground hover:text-red-700 dark:text-red-400 px-1"
                                title="Remove"
                              >✕</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="px-5 py-4 border-t border-border flex gap-3">
                <button
                  onClick={() => setDraftMetrics(customMetrics)}
                  className="flex-1 px-4 py-2 text-sm text-muted-foreground border border-border rounded hover:border-border hover:text-foreground transition-colors"
                >Reset</button>
                <button
                  onClick={async () => {
                    setCustomMetrics(draftMetrics)
                    await saveCustomMetrics(draftMetrics)
                    setShowAnalyticsCustomize(false)
                  }}
                  className="flex-1 px-4 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 rounded transition-colors"
                >Save</button>
              </div>
            </div>
          </AnalyticsCustomizeShell>
        )}

        {showOutreachCustomize && (
          <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/50" onClick={() => setShowOutreachCustomize(false)} />
            <div className="w-80 bg-card border-l border-border flex flex-col h-full">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="font-semibold text-foreground">Outreach Columns</h2>
                <button onClick={() => setShowOutreachCustomize(false)} className="text-muted-foreground hover:text-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <p className="text-xs text-muted-foreground px-5 pt-3 pb-1">Toggle columns on/off and drag to reorder.</p>
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
                {draftOutreachCols.map((col, idx) => (
                  <div key={col.id as string} className="flex items-center gap-3 py-2 px-3 rounded hover:bg-muted group">
                    <input type="checkbox" checked={col.visible}
                      onChange={() => setDraftOutreachCols(d => d.map((c, i) => i === idx ? { ...c, visible: !c.visible } : c))}
                      className="w-4 h-4 rounded accent-purple-500"
                    />
                    <span className="flex-1 text-sm text-foreground">{col.label}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button disabled={idx === 0} onClick={() => setDraftOutreachCols(d => { const n = [...d]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n })} className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed px-1">↑</button>
                      <button disabled={idx === draftOutreachCols.length - 1} onClick={() => setDraftOutreachCols(d => { const n = [...d]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; return n })} className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed px-1">↓</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-4 border-t border-border flex gap-3">
                {/* Reset goes back to THIS platform's default layout
                    (not the universal DEFAULT_OUTREACH_COLS), so the
                    user gets sensible per-platform defaults
                    (e.g. IG view resets back to IG-leading columns
                    not the YouTube-leading shape). */}
                <button onClick={() => setDraftOutreachCols(PLATFORM_OUTREACH_DEFAULTS[activePlatform])} className="flex-1 px-4 py-2 text-sm text-muted-foreground border border-border rounded hover:border-border hover:text-foreground transition-colors">Reset</button>
                <button onClick={() => {
                  // Save scopes to the active platform's slot — other
                  // platforms' configs untouched.
                  setActivePlatformOutreachCols(draftOutreachCols)
                  setShowOutreachCustomize(false)
                }} className="flex-1 px-4 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 rounded transition-colors">Save</button>
              </div>
            </div>
          </div>
        )}

        {/*
          Tab content fade — wrap each branch in a motion.div keyed
          by activeTab. Motion auto-plays the initial transition on
          every key change, giving a soft cross-fade between Results /
          Outreach / Dismissed without any extra state plumbing. ~150
          ms is the sweet spot — fast enough not to feel laggy, slow
          enough to read as a transition rather than a jarring swap.
        */}
        <motion.div
          key={activeTab}
          // Tab panel — id + aria-labelledby connect to the
          // matching <button role="tab"> in AnimatedTabs above.
          // Single panel that swaps content keyed by activeTab; the
          // id/labelledby pair updates with the active tab so screen
          // readers always announce the right relationship.
          id={tabPanelId('main-tabs', activeTab)}
          role="tabpanel"
          aria-labelledby={tabId('main-tabs', activeTab)}
          tabIndex={0}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
        {activeTab === 'outreach' ? (
          <>
            {/* Active-keyword chip — only shown when the user has
                something typed in the main search bar AND we're on
                the Outreach tab (where keyword filters the local
                list, not a YouTube search). Makes the filter state
                visible so it's clear why the All / Favorites views
                are narrowed. Click × to clear. Follow-ups + Analytics
                are unaffected by the filter (action queue / dashboard
                shouldn't be search-narrowed). */}
            {keyword.trim() && (
              <div className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-xs">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700 dark:text-amber-300" aria-hidden>
                  <line x1="22" y1="3" x2="3" y2="22" />
                  <path d="M22 3L13 22l-2-9-9-2L22 3z" />
                </svg>
                <span className="text-amber-900 dark:text-amber-200">
                  Filtering Outreach by <strong>&ldquo;{keyword.trim()}&rdquo;</strong>
                </span>
                <span className="text-amber-700/70 dark:text-amber-300/70">·</span>
                <span className="text-[11px] text-amber-700 dark:text-amber-300/80">
                  Follow-ups &amp; Analytics show all entries
                </span>
                <button
                  type="button"
                  onClick={() => setKeyword('')}
                  aria-label="Clear keyword filter"
                  className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
                >
                  ✕
                </button>
              </div>
            )}
            {(() => {
              const todayMs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime() })()
              // Sub-tab badge = action-needed count (overdue/today only), for
              // Open leads plus manually-scheduled first outreaches (a dated
              // 'Not Outreached' lead — the "+ Add follow-up" path, 2026-07-10).
              // No Response leads aren't counted; they're the "ghosted" bucket.
              const dueCount = outreach.filter(e => {
                const scheduledFirstTouch = (e.status === 'Not Outreached' || !e.status) && !!e.followUpDate
                if (e.status !== 'Open' && !scheduledFirstTouch) return false
                const d = parseLocalDate(e.followUpDate)
                if (!d) return false
                d.setHours(0, 0, 0, 0)
                return d.getTime() <= todayMs
              }).length
              const activeClientsCount = outreach.filter(e => e.status === 'Successful').length
              return <div data-tour-id="outreach-subtabs"><OutreachSubTabs active={outreachSubTab} onChange={setOutreachSubTab} dueCount={dueCount} activeClientsCount={activeClientsCount} /></div>
            })()}
            {/* Sub-tab panel — same id/labelledby pattern as the
                main tabs above. Single wrapping div whose ARIA
                attributes update with the active sub-tab. */}
            <div
              role="tabpanel"
              id={tabPanelId('outreach-subtabs', outreachSubTab)}
              aria-labelledby={tabId('outreach-subtabs', outreachSubTab)}
              tabIndex={0}
            >
            {outreachSubTab === 'analytics' ? (
              <OutreachAnalytics
                entries={outreach}
                customMetrics={customMetrics}
                onOpenCustomize={() => { setDraftMetrics(customMetrics); setShowAnalyticsCustomize(true) }}
                onExportExcel={handleExportOutreachExcel}
                onExportCsv={handleExportOutreachCSV}
              />
            ) : outreachSubTab === 'active' ? (
              // Active Clients view — surfaces rows with status='Successful'
              // as engagement cards with budget / timeline / scope /
              // contract URL / engagement notes. onPatch updates the
              // local outreach state so the card UI reflects the save
              // immediately without a full reload.
              <ActiveClients
                entries={outreach}
                onPatch={(id, patch) => {
                  setOutreach(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))
                }}
                onFollowOnCreated={async () => {
                  // Wrap-up created a new outreach_entries row for a
                  // repeat engagement (Definitely / Likely). Re-fetch
                  // the full list so it appears in the pipeline + the
                  // outreachIds set is updated for the Results filter.
                  try {
                    const fresh = await getOutreach()
                    setOutreach(fresh)
                    setOutreachIds(new Set(fresh.map(e => e.channelId)))
                  } catch (e) {
                    console.warn('[ActiveClients/onFollowOnCreated] refresh failed:', e)
                  }
                }}
                initialSelectedId={activeClientPreselect}
                onInitialSelectedConsumed={() => setActiveClientPreselect(null)}
              />
            ) : outreachSubTab === 'followups' ? (
              // Follow-ups uses UNFILTERED outreach — it's an action
              // queue (what to do next), not a search view. The
              // dueCount badge above also reads from unfiltered
              // outreach, so this keeps badge + view in sync. Keyword
              // filter on the Outreach tab applies only to All /
              // Favorites views (which are search-oriented).
              <OutreachFollowUps
                entries={outreach}
                onUpdate={updateOutreachEntry}
                onUpdateFields={updateOutreachFields}
                onOpenEntry={openLeadDetail}
                profile={profile}
              />
            ) : (
              <div data-tour-id="outreach-table">
              <OutreachTab
                entries={filteredOutreach}
                colConfig={outreachColConfig}
                onUpdate={updateOutreachEntry}
                onRemove={removeOutreachEntry}
                onOpenCustomize={() => { setDraftOutreachCols(outreachColConfig); setShowOutreachCustomize(true) }}
                onReorderCols={reorderOutreachCols}
                onOpenManualAdd={() => setShowManualAdd(true)}
                onSearchContacts={searchContactsForEntry}
                searchingIds={searchingContactIds}
                onSearchAll={deepSearchAllOutreach}
                bulkRunning={outreachBulkRunning}
                profile={profile}
                emptyVariant="all"
                onOpenEntry={openLeadDetail}
                // Disable recently-added pinning when a keyword
                // filter is active. Keyword search is a "find specific
                // entry" workflow; pinning recently-added on top of a
                // filtered list creates the misleading "only showing
                // newly added" perception. Browsing (no keyword) keeps
                // pinning so new entries surface naturally.
                recentlyAddedIds={keyword.trim() ? new Set() : recentlyAddedIds}
                onClearRecentlyAdded={clearRecentlyAdded}
                interactedNewIds={interactedNewIds}
                onMarkNewInteracted={markNewInteracted}
                teamMembers={teamMembers}
                teamRole={teamContext?.role ?? null}
                currentUserId={userId}
                onReassigned={() => { void reloadOutreach() }}
              />
              </div>
            )}
            </div>
          </>
        ) : activeTab === 'dismissed' ? (
          <DismissedTab
            dismissed={dismissed}
            onUndismiss={undismissCreator}
            onDeepSearch={deepSearchDismissedEmail}
            deepSearchingIds={dismissedSearchingIds}
            onSearchAll={deepSearchAllDismissed}
            bulkRunning={dismissedBulkRunning}
            bulkProgress={dismissedBulkProgress}
            profile={profile}
          />
        ) : (
          <>
            {/* Per Dylan 2026-05-11: the green 'Emails first' badge
                above results was removed. Emails-first remains the
                default sort silently; if the user picks an explicit
                column sort, that takes precedence. State + setter
                kept so the behavior is still wired up — the prior
                toggle UX may come back later as a hidden setting. */}
            <div data-tour-id="results-table">
            <CreatorTable
              creators={resultsMainList} outreachIds={outreachIds}
              dismissedIds={dismissedIds}
              onAddToOutreach={addToOutreach}
              onDismiss={dismissCreator}
              onReorderCols={reorderResultCols}
              loading={loading}
              sorts={sorts} onSort={handleSort}
              colConfig={effectiveColConfig}
              emailFirst={emailFirstSort}
              // Default (relevance) view: extra "Load more" rows render
              // below the divider. Explicit column sort: they're folded
              // into the main list (resultsMainList) so the sort is
              // complete, and we drop the separate section here.
              loadMoreBatch={(activeTab === 'results' && !isExplicitResultsSort) ? loadMoreFiltered : undefined}
              scoreWeights={scoreWeights}
              scoreNarrative={scoreNarrative}
              activePlatform={activePlatform}
              totalUnfiltered={creators.length}
              profile={profile}
              onDeepSearch={deepSearchResultEmail}
              deepSearchingIds={deepSearchingResultIds}
              onDeepSearchAll={deepSearchAllResults}
              onOpenCustomize={() => { setDraftCols(colConfig); setShowCustomize(true) }}
              bulkRunning={resultsBulkRunning}
              onUpdateInstagram={updateInstagramHandle}
            />
            </div>
            {/* Per Dylan 2026-05-10: 'Load More Creators' should not
                appear at all before any search has happened. Previously
                the button was disabled but visible, which created a
                misleading 'something to click' affordance on a blank
                page. Now it shows only once currentKeyword is set
                (i.e. a search has run at least once). */}
            {activeTab === 'results' && !!currentKeyword && (
              <div className="mt-5 flex flex-col items-center gap-2">
                {loadingMore ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner />
                    <span>Loading more creators...</span>
                  </div>
                ) : (
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="px-6 py-2 bg-muted hover:bg-muted border border-border hover:border-border text-foreground/80 hover:text-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Load More Creators
                  </button>
                )}
              </div>
            )}
          </>
        )}
        </motion.div>
      </div>

      {showScoreSettings && (
        <ScoreSettingsModal
          weights={scoreWeights}
          narrative={scoreNarrative}
          guidanceEntries={guidanceEntries}
          activePlatform={activePlatform}
          onAddGuidance={addGuidanceEntry}
          onRemoveGuidance={removeGuidanceEntry}
          onUpdateGuidanceWeight={updateGuidanceEntryWeight}
          onResetGuidance={resetAllGuidance}
          onSave={(w, n) => {
            setScoreWeights(w)
            setScoreNarrative(n)
            void savePlatformWeights(activePlatform, w)
            void savePlatformNarrative(activePlatform, n)
          }}
          onClose={() => setShowScoreSettings(false)}
        />
      )}

      {showOnboarding && userId && (
        <OnboardingModal
          userId={userId}
          onComplete={() => {
            setShowOnboarding(false)
            // Re-fetch profile so the email template picks up the new name immediately
            ;(async () => {
              const supabase = createSupabaseClient()
              const { data } = await supabase
                .from('user_profile')
                .select('full_name, linkedin_url, pitch_line, subject_template, mail_client')
                .eq('user_id', userId)
                .single()
              if (data) setProfile({
                fullName: data.full_name ?? '',
                linkedinUrl: data.linkedin_url ?? '',
                pitchLine: data.pitch_line ?? '',
                subjectTemplate: data.subject_template ?? undefined,
                mailClient: (data.mail_client ?? 'default') as UserProfile['mailClient'],
                userEmail: userEmail ?? undefined,
              })
            })()
          }}
        />
      )}

      {showProfile && userId && (
        <ProfileModal
          userId={userId}
          initial={profile ?? { fullName: '', linkedinUrl: '', pitchLine: '' }}
          onSave={(next) => setProfile(next)}
          onClose={() => setShowProfile(false)}
        />
      )}

      {showTemplates && (
        <TemplatesModal
          profile={profile}
          onClose={() => setShowTemplates(false)}
          // Merge the saved template / footer fields back into the
          // in-memory profile so other surfaces (composer preview,
          // outreach link click) pick up the change immediately.
          onSaved={(updated) => {
            setProfile(prev => (prev ? { ...prev, ...updated } : prev))
          }}
        />
      )}

      {showIntegrations && (
        <IntegrationsModal onClose={() => setShowIntegrations(false)} />
      )}

      {/* Keyboard-shortcut cheat sheet — opened by `?` (Shift+/) */}
      <KeyboardShortcutsModal
        open={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />

      {threadModal && (
        <ThreadModal
          entryId={threadModal.entryId}
          recipientLabel={threadModal.label}
          userEmail={userEmail}
          onClose={() => setThreadModal(null)}
        />
      )}

      {sendPreview && (
        <SendPreviewModal
          entryId={sendPreview.entryId}
          to={sendPreview.to}
          initialSubject={sendPreview.subject}
          initialBody={sendPreview.body}
          recipientLabel={sendPreview.recipientLabel}
          isFollowUp={sendPreview.isFollowUp}
          // CAN-SPAM compliance signals — the modal nudges the user to
          // set a business address before sending if it's missing.
          physicalAddress={profile?.physicalAddress ?? null}
          onOpenProfile={() => {
            setSendPreview(null)
            setShowProfile(true)
          }}
          onClose={() => setSendPreview(null)}
          onSent={(result) => {
            // Optimistically reflect the send in the local outreach state:
            // bump status to "No Response" if it was untouched, and stamp
            // the Unipile ids so the conversation view / open tracking
            // can attribute back. Server already persisted these — we
            // just mirror to avoid a full refetch.
            setOutreach(prev => prev.map(e => {
              if (e.id !== result.entryId) return e
              const wasUntouched = e.status === 'Not Outreached' || !e.status
              return {
                ...e,
                unipileMessageId: result.messageId,
                unipileProviderId: result.providerId,
                unipileThreadId: result.threadId,
                unipileTrackingId: result.trackingId,
                unipileSentAt: Date.now(),
                status: wasUntouched ? 'No Response' : e.status,
                reachedOut: wasUntouched ? true : e.reachedOut,
                dateReachedOut: wasUntouched ? new Date().toISOString() : e.dateReachedOut,
              }
            }))
          }}
        />
      )}

      {pendingMigration && userId && !showOnboarding && (
        <MigrationPromptModal
          outreachCount={pendingMigration.outreach}
          dismissedCount={pendingMigration.dismissed}
          onMigrate={async () => {
            const result = await runManualMigration()
            if (result.ok) setPendingMigration(null)
            return result
          }}
          onSkip={() => {
            setMigrationSkipped()
            setPendingMigration(null)
          }}
        />
      )}

      {showImport && (
        <ImportOutreachModal
          onImport={async (entries) => {
            // Merge with existing outreach (don't overwrite — append + de-dupe by channelId)
            const merged = [...entries, ...outreach]
            const seen = new Set<string>()
            const deduped = merged.filter(e => {
              if (seen.has(e.channelId)) return false
              seen.add(e.channelId)
              return true
            })
            await persistOutreach(deduped)
            const fresh = await getOutreach()
            setOutreach(fresh)
            setOutreachIds(new Set(fresh.map(e => e.channelId)))
            setShowImport(false)
          }}
          onClose={() => setShowImport(false)}
        />
      )}

      {showImportDismissed && (
        <ImportDismissedModal
          onImport={async (items) => {
            // Merge + de-dupe by channelId
            const merged = [...items, ...dismissed]
            const seen = new Set<string>()
            const deduped = merged.filter(c => {
              if (seen.has(c.channelId)) return false
              seen.add(c.channelId)
              return true
            })
            await persistDismissed(deduped)
            const fresh = await getDismissed()
            setDismissed(fresh)
            setDismissedIds(new Set(fresh.map(c => c.channelId)))
            setShowImportDismissed(false)
          }}
          onClose={() => setShowImportDismissed(false)}
        />
      )}

      {viewingLeadId && (() => {
        const entry = outreach.find(e => e.id === viewingLeadId)
        if (!entry) return null
        return (
          <LeadDetailModal
            entry={entry}
            onUpdate={updateOutreachEntry}
            onClose={() => setViewingLeadId(null)}
            profile={profile}
          />
        )
      })()}

      {showManualAdd && (
        <ManualAddOutreachModal
          existingChannelIds={outreachIds}
          onAdd={async (entry) => {
            // Delta write (2026-07-09 perf): only the new row goes to the
            // DB; the refetch below still rebuilds full state as before.
            await upsertOutreachRows([entry])
            const fresh = await getOutreach()
            setOutreach(fresh)
            setOutreachIds(new Set(fresh.map(e => e.channelId)))
          }}
          onClose={() => setShowManualAdd(false)}
        />
      )}

      {(showAddMetric || editingMetric) && (
        <CustomMetricModal
          initial={editingMetric ?? undefined}
          entries={outreach}
          onSave={async (m) => {
            // Always mutate the draft — user clicks Save in the drawer to commit.
            setDraftMetrics(d => {
              const exists = d.some(x => x.id === m.id)
              return exists ? d.map(x => x.id === m.id ? m : x) : [...d, m]
            })
          }}
          onDelete={editingMetric ? async () => {
            setDraftMetrics(d => d.filter(x => x.id !== editingMetric.id))
          } : undefined}
          onClose={() => { setShowAddMetric(false); setEditingMetric(null) }}
        />
      )}
    </main>
    <Tour />
    {/* First-run tutorial picker — visible only for users who haven't
        completed or skipped a tour yet. Reads `showFirstRunPicker`
        from TourContext, which auto-fires for signed-in users after
        the app shell has had a moment to mount. */}
    <FirstRunPickerHost isAdmin={userEmail === 'dmeehanj@gmail.com'} />
    {/* Subtle success toast — fires when an outreach row flips to
        Successful. Lives outside <main> so its fixed position isn't
        affected by any transform-induced stacking on ancestor
        elements. */}
    {successToast && (
      <SuccessToast
        entryId={successToast.entryId}
        channelName={successToast.channelName}
        onDismiss={() => setSuccessToast(null)}
      />
    )}
    {/* Export paywall gate — opens when the user clicks Excel/CSV on
        the Outreach tab. Decides which message (free / $25) to show
        and routes to Stripe Checkout when payment is needed. Dylan
        2026-05-24 monetization push. */}
    <ExportGateModal
      open={exportGateOpen}
      request={exportGateRequest}
      onClose={() => setExportGateOpen(false)}
    />
    {/* Pending-Response prompt — surfaces after the user clicks an
        email link and returns from their mail client. Replaces the
        old silent auto-flip with an explicit confirmation. Dylan
        2026-05-31. Extended 2026-07-07: a 'followup' click on an
        already-reached lead confirms as "log the touch" instead —
        touchpoints+1, fresh last-touch date, next follow-up on the
        cadence — so firing a follow-up email advances the stage
        without a separate "Followed up" click. */}
    <PendingResponsePrompt
      onConfirm={(rowId, kind) => {
        if (kind === 'followup') {
          logFollowUpTouch(rowId)
        } else {
          updateOutreachEntry(rowId, 'status', 'No Response')
        }
      }}
    />
    {/* Revert-Successful confirm — fires when the user changes status
        from 'Successful' to anything else (which would silently hide
        the entry from Active Clients). Dylan 2026-06-08. */}
    <RevertSuccessfulConfirmModal
      pending={pendingRevert}
      onCancel={() => setPendingRevert(null)}
      onConfirm={() => {
        if (pendingRevert) {
          applyOutreachUpdate(pendingRevert.entry.id, 'status', pendingRevert.newStatus)
          setPendingRevert(null)
        }
      }}
    />
    {/* Delete-Successful confirm — fires when the user deletes an
        outreach row whose status is Successful. Stronger warning
        than revert because delete is permanent (wipes all client_*
        fields too). Dylan 2026-06-09. */}
    <DeleteSuccessfulConfirmModal
      entry={pendingDelete}
      onCancel={() => setPendingDelete(null)}
      onConfirm={() => {
        if (pendingDelete) {
          applyRemoveOutreach(pendingDelete.id)
          setPendingDelete(null)
        }
      }}
    />
    </TourProvider>
    </GuidanceContext.Provider>
  )
}
