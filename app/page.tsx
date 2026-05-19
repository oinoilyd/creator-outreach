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
import { CreatorTable } from '@/components/creators/CreatorTable'
import { GuidanceContext } from '@/components/creators/FitScoreCell'
import { AnimatedTabs, tabId, tabPanelId } from '@/components/AnimatedTabs'
import { OutreachSubTabs } from '@/components/outreach/OutreachSubTabs'
import { AnalyticsCustomizeShell } from '@/components/outreach/AnalyticsCustomizeShell'
import { OutreachAnalytics } from '@/components/outreach/OutreachAnalytics'
import { OutreachTab } from '@/components/outreach/OutreachTab'
import { OutreachFollowUps } from '@/components/follow-ups/OutreachFollowUps'
import { ActiveClients } from '@/components/active-clients/ActiveClients'
import { motion } from 'motion/react'
import {
  ALL_OCCUPATIONS, VIEW_PRESETS, NICHE_BUCKETS,
  pickRandom, formatSubscribers, parseRelativeDays, parseSubscriberCount,
} from '@/lib/format'
import {
  DEFAULT_WEIGHTS,
  computeFitScore,
  sortCreators,
} from '@/lib/scoring'
import {
  ALL_OUTREACH_COLS, DEFAULT_OUTREACH_COLS, DEFAULT_COLS,
  YOUTUBE_ONLY_COL_IDS, COL_SORT, PLATFORM_AUTOSHOW_COLS,
} from '@/lib/columns'
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
  getDismissed, saveDismissed as persistDismissed, saveDismissedRow,
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
  isoDaysFromNow,
} from '@/lib/dates'
import {
  markEmailBounced,
  filterOutreachByKeyword,
  nextFollowUpDays,
} from '@/lib/outreach'

export default function Home() {
  const [keyword, setKeyword] = useState('')
  // Per-region cap. Bumped 100 → 175 (2026-05-12) to pair with the AI
  // keyword expansion: with 3 sibling-keyword variants in play, the
  // raw channel pool per region grows roughly 1.5–2× before dedupe, so
  // we let the server keep more of them per region. Final shown count
  // after merging regions + dedupe stays user-readable.
  const maxResults = 175
  const [minViews, setMinViews] = useState(0)
  const [maxViews, setMaxViews] = useState(200000)
  const [minSubs, setMinSubs] = useState(0)
  const [maxSubs, setMaxSubs] = useState(0) // 0 = no upper limit
  // Default to 6 months — most current/active creators only. User
  // can widen via the Last Posted preset row in the filter panel.
  const [maxAgeDays, setMaxAgeDays] = useState<number>(180)
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
  function readTabFromUrl(): { tab: ActiveTab; sub: 'all' | 'favorites' | 'analytics' | 'followups' | 'active' } {
    if (typeof window === 'undefined') return { tab: 'results', sub: 'all' }
    const params = new URLSearchParams(window.location.search)
    const t = params.get('tab')
    const s = params.get('sub')
    const tab: ActiveTab =
      t === 'outreach' || t === 'dismissed' || t === 'results' ? t : 'results'
    const sub: 'all' | 'favorites' | 'analytics' | 'followups' | 'active' =
      s === 'favorites' || s === 'analytics' || s === 'followups' || s === 'active' || s === 'all' ? s : 'all'
    return { tab, sub }
  }
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => readTabFromUrl().tab)
  const [outreachSubTab, setOutreachSubTab] = useState<'all' | 'favorites' | 'analytics' | 'followups' | 'active'>(
    () => readTabFromUrl().sub,
  )

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

  // Backdrop theme — 4 options ('off' / 'rain' / 'drift' / 'aura'),
  // each parameterized by the currently-active platform. Pulse was
  // dropped in v3 (2026-05-10) — its static color tint graduated
  // into the always-on PlatformShade. Existing localStorage values
  // of 'pulse' fall through to 'off' on next load.
  // Defaults 'off' so the app stays minimal until the user opts in.
  // Persisted to localStorage so the chosen vibe survives sessions.
  const [backdropTheme, setBackdropTheme] = useState<BackdropTheme>(() => {
    if (typeof window === 'undefined') return 'off'
    const saved = window.localStorage.getItem('backdrop-theme')
    if (saved === 'rain' || saved === 'drift' || saved === 'fireworks' || saved === 'tornado' || saved === 'off') {
      return saved
    }
    return 'off'
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
  const [outreachColConfig, setOutreachColConfig] = useState<OutreachColConfig[]>(DEFAULT_OUTREACH_COLS)
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
  // keeping. They still stay dormant on hard refresh, tab return,
  // and search (those were too noisy).
  //
  // The ref-based dedupe ensures we only fire on actual platform
  // CHANGES, not on initial mount or on theme/tab changes.
  const prevPlatformRef = useRef<PlatformId>(activePlatform)
  useEffect(() => {
    const prev = prevPlatformRef.current
    if (prev === activePlatform) return // initial mount, no real change
    prevPlatformRef.current = activePlatform
    // Only fire if user is actually looking at the backdrop (Results tab).
    if (activeTab !== 'results') return
    if (backdropTheme === 'fireworks' || backdropTheme === 'tornado') {
      triggerSpotlight(spotlightDurationFor(backdropTheme))
    }
  }, [activePlatform, activeTab, backdropTheme])

  const seenChannelIds = useRef<Set<string>>(new Set())

  // Auth + profile
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
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
      // Force the selected platform's column visible.
      if (selected && c.id === selected) return { ...c, visible: true }
      // Force email + trio socials always visible in Results.
      if (c.id === 'email' || TRIO_SOCIALS.includes(c.id)) return { ...c, visible: true }
      // Platform-specific auto-show columns (e.g. IG followers + posts).
      if (autoShow.includes(c.id)) return { ...c, visible: true }
      return c
    })

    // Build the desired ordered cluster:
    //   YouTube: [email]                         — socials stay at end
    //   Other:   [selected, email, other trio socials]
    const clusterIds: ColId[] = []
    if (isYouTube) {
      clusterIds.push('email')
    } else {
      if (selected && selected !== 'email') clusterIds.push(selected)
      clusterIds.push('email')
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
        const FULL_COLS = `${BASE_COLS}, ${TEMPLATE_COLS}, ${CONSENT_COLS}`

        let { data: profileRow, error: profileErr } = await supabase
          .from('user_profile')
          .select(FULL_COLS)
          .eq('user_id', user.id)
          .maybeSingle()
        if (profileErr) {
          console.warn('[home-init] full SELECT failed (likely missing migration 0026), retrying with base cols:', profileErr.message)
          const retry = await supabase
            .from('user_profile')
            .select(BASE_COLS)
            .eq('user_id', user.id)
            .maybeSingle()
          profileRow = retry.data as unknown as typeof profileRow
          profileErr = retry.error
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
          setProfile({
            fullName: profileRow.full_name ?? '',
            linkedinUrl: profileRow.linkedin_url ?? '',
            pitchLine: profileRow.pitch_line ?? '',
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

      const storedOutreachCols = await getOutreachColConfig()
      if (storedOutreachCols) {
        // Merge stored config with any new columns added since last
        // save. If a stored width is BELOW the current default, raise
        // it — we widen defaults occasionally for legibility (e.g. YT
        // 42 → 56) and existing users would otherwise stay clipped.
        const merged = ALL_OUTREACH_COLS.map(def => {
          const stored = storedOutreachCols.find(s => s.id === def.id)
          if (!stored) return { ...def, visible: def.defaultVisible, width: def.defaultWidth }
          const width = Math.max(stored.width, def.defaultWidth)
          return { ...def, visible: stored.visible, width }
        })
        setOutreachColConfig(merged)
        setDraftOutreachCols(merged)
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

  function saveOutreach(updated: OutreachEntry[]) {
    setOutreach(updated)
    setOutreachIds(new Set(updated.map(e => e.channelId)))
    void persistOutreach(updated)
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
      product: '',
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
    saveOutreach([...outreach, entry])
    // Pin the newly-added id so it shows at the top of the Outreach
    // tab, even if the user is currently on Results and the
    // OutreachTab component will mount fresh when they switch over.
    setRecentlyAddedIds(prev => new Set([...prev, entry.id]))
  }

  // Both reorder handlers are stable: they touch only setters + a
  // module-level persistence import, so an empty dep array is correct.
  const reorderResultCols = useCallback((newConfig: ColConfig[]) => {
    setColConfig(newConfig)
    setDraftCols(newConfig)
    void saveColConfig(newConfig)
  }, [])

  const reorderOutreachCols = useCallback((newConfig: OutreachColConfig[]) => {
    setOutreachColConfig(newConfig)
    setDraftOutreachCols(newConfig)
    void saveOutreachColConfig(newConfig)
  }, [])

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

  function updateOutreachEntry(id: string, field: keyof OutreachEntry, value: any) {
    saveOutreach(outreach.map(e => {
      if (e.id !== id) return e
      const updated = { ...e, [field]: value }

      if (field === 'status') {
        // No toasts on status changes (Successful / Rejected / No
        // Response / Not Outreached / Open) — every transition was
        // popping a notification in the bottom-right which felt
        // noisy for routine triage. The confetti animation still
        // fires on first-time Successful so the dopamine moment
        // isn't lost.
        if (value === 'Successful' && e.status !== 'Successful') {
          celebrateSuccess()
        }

        // Status drives reachedOut: anything past "Not Outreached" / "" counts.
        updated.reachedOut = value !== 'Not Outreached' && value !== ''

        const isActive = value === 'Open' || value === 'No Response'
        const isTerminal = value === 'Successful' || value === 'Rejected' || value === 'Not Outreached'

        if (isActive) {
          // First time the user actually reaches out → log the date + 1st touchpoint
          if (e.status === 'Not Outreached' || e.status === '') {
            if (!e.dateReachedOut) updated.dateReachedOut = todayIso()
            const tps = parseInt(e.touchpoints || '0', 10) || 0
            if (tps === 0) updated.touchpoints = '1'
          }

          // Apply follow-up cadence: shorter early, longer later.
          // Only auto-fills when the user hasn't set a date — manual dates win.
          // Re-engagement of an overdue No-Response lead also gets a fresh date.
          const existing = parseLocalDate(e.followUpDate)
          const today = new Date(); today.setHours(0, 0, 0, 0)
          const isPastDue = existing && existing.getTime() < today.getTime()
          if (!e.followUpDate || isPastDue) {
            const tps = parseInt(updated.touchpoints || e.touchpoints || '0', 10) || 1
            updated.followUpDate = isoDaysFromNow(nextFollowUpDays(tps))
          }
        }

        if (isTerminal) {
          // Done with this lead — drop them out of the follow-up queue.
          updated.followUpDate = ''
          if (value === 'Successful' || value === 'Rejected') {
            // Stamp response date when there isn't one already.
            if (!e.responseDate) updated.responseDate = todayIso()
          }
        }
      }

      return updated
    }))
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
      saveOutreach(outreach.map(e => {
        if (e.id !== id) return e
        // Only fill in fields that are currently empty so we don't overwrite
        // anything the user has manually entered.
        return {
          ...e,
          email: e.email || extra.email || '',
          linkedin: e.linkedin || extra.linkedin || '',
          subscribers: e.subscribers || extra.subscribers || '',
          avgViews: e.avgViews || (extra.avgViews && !isNaN(extra.avgViews) ? extra.avgViews : 0),
        }
      }))
      // (No email found is non-blocking — UI updates via setOutreach above.)
    } catch (err: any) {
      toast.error(`Search failed: ${err?.message || err}`)
    } finally {
      setSearchingContactIds(s => {
        const next = new Set(s); next.delete(id); return next
      })
    }
  }

  function removeOutreachEntry(id: string) {
    saveOutreach(outreach.filter(e => e.id !== id))
  }

  function saveDismissed(updated: Creator[]) {
    setDismissed(updated)
    setDismissedIds(new Set(updated.map(c => c.channelId)))
    void persistDismissed(updated)
  }

  function dismissCreator(c: Creator) {
    if (!dismissedIds.has(c.channelId)) saveDismissed([...dismissed, c])
    // also remove from load-more batch so it disappears immediately
    setLoadMoreCreators(prev => prev.filter(p => p.channelId !== c.channelId))
    setCreators(prev => prev.filter(p => p.channelId !== c.channelId))
  }

  function undismissCreator(id: string) {
    saveDismissed(dismissed.filter(c => c.channelId !== id))
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
    const version = ++searchVersion.current
    setLoading(true)
    setCreators([])
    setLoadMoreCreators([])
    setCurrentKeyword(kw)
    setCurrentKeywordsList(keywordsList ?? [])
    seenChannelIds.current = new Set()
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
      const allResponses = await Promise.all(
        regionCodes.map(code => {
          const glParam = code ? `&gl=${encodeURIComponent(code)}` : ''
          return fetch(`/api/search?${queryFragment}&maxResults=${maxResults}&minViews=${minViews}&maxViews=${maxViews}${glParam}${expandParam}`).then(r => r.json())
        })
      )
      if (version !== searchVersion.current) return  // superseded by newer search
      const firstError = allResponses.find(d => d.error)
      if (firstError) { setStatus(`Error: ${firstError.error}`); return }
      // merge and deduplicate by channelId
      const seenMerge = new Set<string>()
      const data = { channels: allResponses.flatMap(d => (d.channels as Creator[]) || []).filter(c => { if (seenMerge.has(c.channelId)) return false; seenMerge.add(c.channelId); return true }) }

      // Track all returned channel IDs so Load More skips them
      ;(data.channels as Creator[]).forEach((c: Creator) => seenChannelIds.current.add(c.channelId))

      // Filter out dismissed and already-outreached channels from results
      let visible = (data.channels as Creator[]).filter(
        (c: Creator) => !dismissedIds.has(c.channelId) && !outreachIds.has(c.channelId)
      )

      // Name-match narrowing for handle-shaped inputs that landed in
      // broad-keyword mode. Two ways this fires:
      //   1. User clicked the "Search similar" pill after a username
      //      lookup failed — they typed `TinaHuang1`, occupation
      //      search runs, we narrow to channels whose name matches.
      //   2. User manually picked occupation mode but typed something
      //      that looks like a handle/url. We still help.
      // For pure phrase searches (`fitness`, `productivity coach`)
      // this doesn't fire — classifier returns 'phrase' and we keep
      // the full keyword pile.
      const inputCls = classifySearchInput(kw)
      const handleHint =
        inputCls.kind === 'handle' ? inputCls.handle :
        (inputCls.kind === 'url' && inputCls.handle) ? inputCls.handle :
        null
      if (handleHint) {
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
        const target = norm(handleHint)
        const targetCore = target.replace(/\d+$/, '') // drop trailing digits (TinaHuang1 → tinahuang)
        const matches = visible.filter(c => {
          const n = norm(c.channelName)
          if (!n || !target) return false
          return n === target
            || n === targetCore
            || (target.length >= 4 && n.includes(target))
            || (targetCore.length >= 4 && n.includes(targetCore))
            || (n.length >= 4 && (target.includes(n) || targetCore.includes(n)))
        })
        if (matches.length > 0 && matches.length <= 3) {
          visible = matches
          setStatus(`Found ${matches.length} close match${matches.length === 1 ? '' : 'es'} for @${handleHint}.`)
        } else if (matches.length > 0) {
          visible = matches.slice(0, 5)
          setStatus(`${matches.length} channels match @${handleHint} — showing the closest 5.`)
        }
        // matches.length === 0 → keep the full keyword pile, status
        // stays "Searching..." from the broad-search step.
      }

      const enriched = visible.map(c => ({ ...c, enriching: true }))
      setCreators([...enriched])
      setEnrichProgress({ current: 0, total: enriched.length })
      setStatus(`Found ${enriched.length} creators. Resolving handles...`)

      // Two-phase enrichment.
      //
      // Phase A (fast, blocking): /api/enrich?fast=true for everyone,
      // BATCH=20 in parallel. ~1.5–2s per creator → ~10–15s for 100.
      // Returns YouTube /about + videos + shorts only — i.e. all
      // social handles (IG/TT/X/LinkedIn) + subscribers + recency.
      // Email column stays empty until Phase B fills it in. The IG /
      // TikTok / X / LinkedIn filter tabs work immediately at the
      // end of Phase A.
      //
      // Phase B (slow, background): /api/enrich (full mode) for
      // everyone, BATCH=8 to be polite to DDG. Fills in emails as
      // they resolve. User keeps interacting; rows update in place.
      // Doesn't block setLoading(false); the spinner stops after A.

      async function runPhase(fast: boolean, concurrency: number, statusFn: (i: number, total: number) => string) {
        for (let i = 0; i < enriched.length; i += concurrency) {
          if (version !== searchVersion.current) return
          const batchIndices = Array.from({ length: Math.min(concurrency, enriched.length - i) }, (_, k) => i + k)
          await Promise.all(batchIndices.map(async (idx) => {
            const c = enriched[idx]
            try {
              const params = new URLSearchParams({
                name: c.channelName, channelId: c.channelId,
                website: c.website || '', instagram: c.instagram || '',
                tiktok: c.tiktok || '', description: c.description || '',
              })
              if (fast) params.set('fast', 'true')
              const r = await fetch(`/api/enrich?${params}`)
              const extra = await r.json()
              // In Phase A we keep `enriching:true` so the email
              // column shows "looking..." until Phase B writes the
              // email. In Phase B we flip it to false.
              enriched[idx] = {
                ...c,
                enriching: fast ? true : false,
                email: c.email || extra.email || enriched[idx].email || '',
                subscribers: c.subscribers || extra.subscribers || enriched[idx].subscribers || '',
                videoDates: (extra.videoDates?.length ? extra.videoDates : enriched[idx].videoDates) || [],
                shortDates: (extra.shortDates?.length ? extra.shortDates : enriched[idx].shortDates) || [],
                avgViews: (extra.avgViews != null && !isNaN(extra.avgViews)) ? extra.avgViews : enriched[idx].avgViews,
                linkedin: c.linkedin || extra.linkedin || enriched[idx].linkedin || '',
                instagram: c.instagram || extra.instagram || enriched[idx].instagram || '',
                twitter: c.twitter || extra.twitter || enriched[idx].twitter || '',
                tiktok: c.tiktok || extra.tiktok || enriched[idx].tiktok || '',
                website: c.website || extra.website || enriched[idx].website || '',
              }
            } catch {
              if (!fast) enriched[idx] = { ...enriched[idx], enriching: false }
            }
          }))
          if (version === searchVersion.current) {
            setEnrichProgress({ current: Math.min(i + concurrency, enriched.length), total: enriched.length })
            setStatus(statusFn(Math.min(i + concurrency, enriched.length), enriched.length))
            setCreators([...enriched])
          }
        }
      }

      // Phase A — fast pass (fills socials + subs + recency).
      await runPhase(
        true,
        20,
        (done, total) => `Resolving handles ${done} / ${total}...`,
      )

      if (version !== searchVersion.current) return

      // Phase A done — user can already see + filter rows. Drop the
      // blocking spinner and let Phase B trickle emails in.
      setLoading(false)
      setStatus(`Found ${enriched.length} creators. Looking up emails in background...`)
      setEnrichProgress({ current: 0, total: enriched.length })

      // Phase B — slow pass, in background. Lower concurrency to be
      // polite to DDG (we don't want to get rate-limited mid-search).
      await runPhase(
        false,
        8,
        (done, total) => `Looking up emails ${done} / ${total}...`,
      )

      if (version === searchVersion.current) {
        setStatus(`Done — ${enriched.length} creators found.`)
        setEnrichProgress({ current: 0, total: 0 })
      }
    } catch (err: any) {
      if (version === searchVersion.current) {
        setStatus(`Error: ${err.message}`)
        setLoading(false)
      }
    }
  }, [minViews, maxViews, maxResults, regions, dismissedIds, outreachIds, searchMode, activePlatform])

  async function handleSearch() { await runSearch(keyword) }

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
      const allResponses = await Promise.all(
        regionCodes.map(code => {
          const glParam = code ? `&gl=${encodeURIComponent(code)}` : ''
          return fetch(`/api/search?${queryFragment}&maxResults=${maxResults}&minViews=${minViews}&maxViews=${maxViews}${glParam}&fresh=true`).then(r => r.json())
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
  }, [currentKeyword, currentKeywordsList, loadingMore, loading, minViews, maxViews, maxResults, regions, dismissedIds, outreachIds])

  async function handleExportExcel(list: Creator[]) {
    setShowExport(false)
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels: list }),
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'creators.xlsx'
    a.click()
  }

  function handleExportCSV(list: Creator[]) {
    setShowExport(false)
    const headers = ['Channel Name', 'YouTube URL', 'Avg Views', 'Subscribers', 'Last Posted', 'Email', 'LinkedIn', 'Website', 'Instagram', 'X', 'TikTok']
    const rows = list.map(c => [
      c.channelName, c.channelUrl, c.avgViews, formatSubscribers(c.subscribers),
      c.videoDates?.[0] || '', c.email, c.linkedin, c.website, c.instagram, c.twitter, c.tiktok,
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'creators.csv'
    a.click()
  }

  async function handleExportOutreachExcel() {
    setShowExport(false)
    const res = await fetch('/api/export-outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: outreach }),
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'outreach.xlsx'
    a.click()
  }

  function handleExportOutreachCSV() {
    setShowExport(false)
    const headers = ['Channel Name', 'YT', 'Email', 'Description', 'Product', 'Reached Out', 'Medium', 'Subject Line', 'Status']
    const rows = outreach.map(e => [
      e.channelName, e.channelUrl, e.email, e.description, e.product,
      e.reachedOut ? 'Yes' : 'No',
      e.medium === 'Other' ? e.mediumOther : e.medium,
      e.headerUsed,
      e.status || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'outreach.csv'
    a.click()
  }

  const baseList = creators
  const currentList = baseList
    // Hide dismissed creators immediately even if they linger in
    // `creators` state momentarily — same logic the icon uses, so the
    // row + icon are always in sync.
    .filter(c => !dismissedIds.has(c.channelId))
    .filter(c => c.avgViews >= minViews && c.avgViews <= maxViews)
    .filter(c => {
      if (minSubs === 0 && maxSubs === 0) return true
      const n = parseSubscriberCount(c.subscribers)
      if (n == null) return minSubs === 0 // unknown subs only pass when there's no min
      if (minSubs > 0 && n < minSubs) return false
      if (maxSubs > 0 && n > maxSubs) return false
      return true
    })
    // Per Dylan 2026-05-11: be lenient with creators whose video date
    // didn't scrape (more common after the May-10 politeness rate-
    // limiting). parseRelativeDays('') returns Infinity which would
    // fail the filter — so explicitly pass-through when we have no
    // date to evaluate. Only filter out creators with a KNOWN-stale date.
    .filter(c => {
      if (maxAgeDays === Infinity) return true
      const dateStr = c.videoDates?.[0]
      if (!dateStr) return true // no data → innocent until proven stale
      return parseRelativeDays(dateStr) <= maxAgeDays
    })
    .filter(c => !emailOnly || !!c.email)
    .filter(c => {
      if (activePlatform === 'youtube') return true
      if (activePlatform === 'instagram') return !!c.instagram
      if (activePlatform === 'tiktok') return !!c.tiktok
      if (activePlatform === 'twitter') return !!c.twitter
      if (activePlatform === 'linkedin') return !!c.linkedin
      return true
    })
  const progressPct = enrichProgress.total > 0 ? Math.round((enrichProgress.current / enrichProgress.total) * 100) : 0

  return (
    <GuidanceContext.Provider value={{ entries: effectiveGuidanceEntries, addEntry: addGuidanceEntry, removeEntry: removeGuidanceEntry, updateEntryWeight: updateGuidanceEntryWeight, resetAll: resetAllGuidance }}>
    <main className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Always-on platform shade — subtle radial tint in the active
          platform color, ONLY on the Results tab. Per Dylan 2026-05-10:
          this is the 'shade I LOVE that stays on the entire time on
          Results, tied to the social media color.' Static, no
          animation, just presence. */}
      <PlatformShade platform={activePlatform} visible={activeTab === 'results'} />
      {/* Animated backdrop — Rain / Drift / Fireworks layered on top
          of the shade. User opt-in via the hamburger menu. Fades
          after 30s or on first work-action; the shade underneath
          stays. Spotlight=true pushes this layer ABOVE content at
          full saturation for 15 seconds (Dylan 2026-05-10). */}
      <PlatformBackdrop theme={backdropTheme} platform={activePlatform} visible={backdropVisible} spotlight={spotlight} intense={spotlightAlwaysOn} />
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
      <div className={`sticky top-0 z-30 border-b border-border/60 bg-background/40 dark:bg-background/10 ${backdropTheme === 'drift' ? '' : 'backdrop-blur-sm'}`}>
        <div className={`${activeTab === 'outreach' || activeTab === 'results' ? 'w-full px-6' : 'max-w-7xl mx-auto px-8'} py-5`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/landing" title="Visit the public site" className="hover:opacity-80 transition-opacity shrink-0">
                {/* Creator Outreach — confident wordmark. v3 (Dylan
                    2026-05-10): kept the gradient text-fill, sized
                    back up so it sits as a peer with the chunkier
                    platform pill instead of feeling smaller than it. */}
                <h1 className="text-2xl font-bold tracking-[-0.02em] leading-none bg-gradient-to-r from-foreground to-foreground/75 bg-clip-text text-transparent">
                  Creator Outreach
                </h1>
              </Link>
              {/* "Find [colored logo] creators" — brand-color icon is
                  the pop. Surrounding text gets font-medium contrast
                  so it doesn't disappear next to the chunkier pill. */}
              <div className="hidden md:flex items-center gap-2 text-sm">
                <span className="text-muted-foreground/90 font-medium">Find</span>
                <PlatformDropdown activePlatform={activePlatform} onChange={async (newPlatform) => {
                  void savePlatformWeights(activePlatform, scoreWeights)
                  void savePlatformNarrative(activePlatform, scoreNarrative)
                  void savePlatformGuidance(activePlatform, guidanceEntries)
                  const { weights, narrative, guidance } = await loadPlatformState(newPlatform)
                  setScoreWeights(weights)
                  setScoreNarrative(narrative)
                  setGuidanceEntries(guidance)
                  setActivePlatform(newPlatform)
                }} />
                <span className="text-muted-foreground/90 font-medium">creators</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
        <div className="relative group/search mb-2">
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
          <div className="flex flex-col gap-3 mb-3 p-4 bg-card border border-border rounded-xl shadow-sm shadow-black/5">
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
                title="When on, creators with a discovered email always sort to the top regardless of which column you're sorting by"
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
        <div className="flex items-center mb-4 border-b border-border">
          <AnimatedTabs<ActiveTab>
            layoutGroup="main-tabs"
            ariaLabel="Main view"
            tabs={[
              {
                id: 'results',
                // Tab counter — show filtered count when a platform filter
                // is on so the visible row count and the displayed number
                // match. Earlier behavior showed e.g. "(100)" when only
                // 5 rows were visible because IG-filtered. Now: amber
                // pill highlights the filter-narrowed count.
                label: (() => {
                  const filtered = currentList.length
                  const total = creators.length
                  if (total === 0) return <>Results</>
                  const isNarrowed = filtered !== total
                  const platformLabel = activePlatform !== 'youtube'
                    ? PLATFORM_CONFIGS.find(p => p.id === activePlatform)?.label
                    : null
                  return (
                    <>Results{' '}
                      {isNarrowed ? (
                        <span className="ml-1 text-xs inline-flex items-center gap-1">
                          <span className="text-amber-700 dark:text-amber-400 font-medium">{filtered}</span>
                          <span className="text-muted-foreground">of {total}</span>
                          {platformLabel && (
                            <span className="text-muted-foreground/70 hidden sm:inline">· {platformLabel}</span>
                          )}
                        </span>
                      ) : (
                        <span className="ml-1 text-xs text-muted-foreground">({total})</span>
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
          {/* Settings gear in the main tab nav — combines Customize
              columns + Export options. Hidden on:
                - Dismissed (no customize, no export wired)
                - Outreach > Analytics (has its OWN dedicated gear
                  with Customize metrics + Export, see OutreachAnalytics)
                - Outreach > Follow-ups (no column-customize concept,
                  no export needed there per Dylan)
              The remaining surfaces (Results, Outreach > All / Favorites)
              still get the gear with Export options. */}
          {activeTab !== 'dismissed' &&
            !(activeTab === 'outreach' && (outreachSubTab === 'analytics' || outreachSubTab === 'followups' || outreachSubTab === 'active')) && (
            <div ref={exportMenuRef} className="ml-auto relative">
              <button
                onClick={() => setShowExport(v => !v)}
                title="View settings — customize columns or export this list"
                aria-label="View settings"
                className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border hover:border-border/80 transition-colors mb-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
                  {/* Export — disabled when the active list is empty. */}
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
                    <>
                      <button
                        onClick={() => handleExportExcel(currentList)}
                        disabled={currentList.length === 0}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span className="text-base leading-none">📊</span>
                        Export Excel
                      </button>
                      <button
                        onClick={() => handleExportCSV(currentList)}
                        disabled={currentList.length === 0}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 transition-colors border-t border-border/60 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span className="text-base leading-none">📄</span>
                        Export CSV
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Old standalone Customize button removed (2026-05-09).
              On Results tab, customize is now an entry inside the
              Settings gear popover above. On Outreach the in-tab
              "Customize columns" link in OutreachTab still works.
              On Dismissed there's nothing to customize (fixed
              schema). */}
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
                <button onClick={() => setDraftOutreachCols(DEFAULT_OUTREACH_COLS)} className="flex-1 px-4 py-2 text-sm text-muted-foreground border border-border rounded hover:border-border hover:text-foreground transition-colors">Reset</button>
                <button onClick={() => {
                  setOutreachColConfig(draftOutreachCols)
                  void saveOutreachColConfig(draftOutreachCols)
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
              // Sub-tab badge = action-needed count (Open + overdue/today only).
              // No Response leads aren't counted; they're the "ghosted" bucket.
              const dueCount = outreach.filter(e => {
                if (e.status !== 'Open') return false
                const d = parseLocalDate(e.followUpDate)
                if (!d) return false
                d.setHours(0, 0, 0, 0)
                return d.getTime() <= todayMs
              }).length
              const activeClientsCount = outreach.filter(e => e.status === 'Successful').length
              return <OutreachSubTabs active={outreachSubTab} onChange={setOutreachSubTab} favCount={outreach.filter(e => e.favorite).length} dueCount={dueCount} activeClientsCount={activeClientsCount} />
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
                onOpenEntry={openLeadDetail}
                profile={profile}
              />
            ) : (
              <OutreachTab
                entries={filterOutreachByKeyword(
                  outreachSubTab === 'favorites' ? outreach.filter(e => e.favorite) : outreach,
                  keyword,
                )}
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
                emptyVariant={outreachSubTab === 'favorites' ? 'favorites' : 'all'}
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
              />
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
            <CreatorTable
              creators={currentList} outreachIds={outreachIds}
              dismissedIds={dismissedIds}
              onAddToOutreach={addToOutreach}
              onDismiss={dismissCreator}
              onReorderCols={reorderResultCols}
              loading={loading}
              sorts={sorts} onSort={handleSort}
              colConfig={effectiveColConfig}
              emailFirst={emailFirstSort}
              loadMoreBatch={activeTab === 'results' ? loadMoreCreators.filter(c =>
                !dismissedIds.has(c.channelId) &&
                c.avgViews >= minViews && c.avgViews <= maxViews &&
                // Same pass-through-on-missing-date logic as the main list filter above.
                (maxAgeDays === Infinity || !c.videoDates?.[0] || parseRelativeDays(c.videoDates[0]) <= maxAgeDays) &&
                (!emailOnly || !!c.email) &&
                (activePlatform === 'youtube' || (activePlatform === 'instagram' ? !!c.instagram : activePlatform === 'tiktok' ? !!c.tiktok : activePlatform === 'twitter' ? !!c.twitter : activePlatform === 'linkedin' ? !!c.linkedin : true))
              ) : undefined}
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
            const next = [entry, ...outreach]
            await persistOutreach(next)
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
    </GuidanceContext.Provider>
  )
}
