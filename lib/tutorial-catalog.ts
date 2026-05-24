/**
 * TUTORIAL CATALOG — canonical source of truth for every tour step.
 *
 * ──────────────────────────────────────────────────────────────────
 *  HOW TO MAINTAIN THIS FILE WHEN YOU ADD A NEW FEATURE
 * ──────────────────────────────────────────────────────────────────
 *
 * Three things to do, every time:
 *
 *   1. Drop `data-tour-id="my-feature"` on the UI element you want
 *      the tour to anchor to. Example:
 *
 *        <button data-tour-id="my-feature">...</button>
 *
 *      If the feature lives in a panel/section, put the attribute on
 *      the WRAPPING element so the spotlight covers the whole region,
 *      not just one button.
 *
 *   2. Add ONE step to the CATALOG_STEPS array below, with:
 *        - id           — unique kebab-case identifier
 *        - target       — `[data-tour-id="my-feature"]`
 *        - tiers        — which tutorial variants include this step:
 *                         ['short'], ['pro'], ['granular'], or any combo
 *        - title        — short headline (max ~40 chars)
 *        - body         — 1-2 sentences of plain English
 *        - onEnter      — optional: navigate the app to the right
 *                         surface before the spotlight aligns
 *        - placement    — optional tooltip placement: top/bottom/left/right
 *        - previewSketch— optional: 'result-row' or 'outreach-row'
 *                         shows an in-tooltip mock if the real DOM
 *                         target is missing (empty-state fallback)
 *
 *   3. That's it. The step automatically appears in every tier you
 *      tagged. The hamburger sub-menu, first-run picker, and admin
 *      preview page all derive from this catalog.
 *
 * ──────────────────────────────────────────────────────────────────
 *  TIER MENTAL MODEL
 * ──────────────────────────────────────────────────────────────────
 *
 *   short      — the SPINE. ~90 seconds. Pure "this is the workflow."
 *                Search → score → add → outreach → status → win. New
 *                users + people who clicked "I just want to use it."
 *
 *   pro        — short + customization moments. ~4-5 minutes.
 *                Adds: Lead Criteria, Templates, Follow-ups,
 *                Active Clients lifecycle, Wrap-up flow, Themes.
 *                For people who plan to actually live in the app.
 *
 *   granular   — pro + every advanced surface. ~8-10 minutes.
 *                Adds: per-platform column configs, AI keyword
 *                expansion, region filters, custom analytics
 *                metrics, referrals → outreach, under-budget flag,
 *                win celebration picker, connection status (admin).
 *                For power users + admins.
 *
 * ──────────────────────────────────────────────────────────────────
 *  WHEN YOU REMOVE A FEATURE
 * ──────────────────────────────────────────────────────────────────
 *
 *   Delete the catalog entry. The tour gracefully degrades — steps
 *   whose `target` selector misses fall back to a centered modal
 *   with the text, or render the `previewSketch` if specified.
 *
 * ──────────────────────────────────────────────────────────────────
 *  PREVIEW + DEBUG
 * ──────────────────────────────────────────────────────────────────
 *
 *   Visit /admin/tutorial-preview to scrub through any tier's steps
 *   without re-triggering first-run flow. Shows what each step looks
 *   like, which tiers include it, and flags missing data-tour-id
 *   anchors in the live DOM.
 */

export type TutorialTier = 'short' | 'pro' | 'granular'

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto'

export interface TourHelpers {
  /** Set the main tab (Results / Outreach / Dismissed) + optional sub. */
  navigate: (
    tab: 'results' | 'outreach' | 'dismissed',
    sub?: 'all' | 'analytics' | 'followups' | 'active',
  ) => void
}

export type TourPreviewSketch =
  | 'result-row'        // single Results row with the + button highlighted
  | 'outreach-row'      // single Outreach Pipeline row with status pill
  | 'active-client-card'// single Active Client engagement card
  | 'analytics-kpi'     // KPI tile row

export interface CatalogStep {
  id: string
  /** Which tutorial variants include this step. */
  tiers: ReadonlyArray<TutorialTier>
  /** CSS selector to anchor the spotlight on. `null` = centered modal. */
  target: string | null
  title: string
  body: string
  placement?: TourPlacement
  onEnter?: (helpers: TourHelpers) => void
  /** Custom "next" CTA label. Defaults to 'Next'. */
  nextLabel?: string
  /** When the real DOM target is missing (e.g. empty data), render
   *  this in-tooltip mock so the user still sees what it looks like. */
  previewSketch?: TourPreviewSketch
  /** Admin-only steps — skipped automatically for non-admin users.
   *  Use sparingly; reserved for internal-tools features like
   *  /admin/connection-status. */
  adminOnly?: boolean
}

// ════════════════════════════════════════════════════════════════════
//  THE CATALOG — every step in tier-order. Update this file when you
//  ship a new user-facing feature.
// ════════════════════════════════════════════════════════════════════

export const CATALOG_STEPS: CatalogStep[] = [
  // ────────────────────────────────────────────────────────────────
  //  ACT 1 — ORIENTATION
  // ────────────────────────────────────────────────────────────────

  {
    id: 'welcome',
    tiers: ['short', 'pro', 'granular'],
    target: null,
    title: 'Welcome to Creator Outreach',
    body: 'This app turns a creator search into a tracked outreach pipeline. Quick tour of the spine — you can skip any time and retake it from the hamburger menu.',
    nextLabel: "Let's go",
  },

  {
    id: 'platform-toggle',
    tiers: ['short', 'pro', 'granular'],
    target: '[data-tour-id="platform-toggle"]',
    title: 'Pick your platform',
    body: 'YouTube, Instagram, TikTok, X, or LinkedIn. Scoring re-tunes per platform — YouTube weighs views and recency, Instagram weighs followers and post cadence, etc. The Outreach columns and themes also re-flow per platform.',
    placement: 'bottom',
    onEnter: ({ navigate }) => navigate('results'),
  },

  {
    id: 'search-input',
    tiers: ['short', 'pro', 'granular'],
    target: '[data-tour-id="search-input"]',
    title: 'Search for creators',
    body: 'Type a niche, keyword, or @handle. Results stream in scored by fit — channel name match, recent activity, and reachability all factor in.',
    placement: 'bottom',
  },

  // ────────────────────────────────────────────────────────────────
  //  ACT 1.5 — SEARCH POWER-USER (Pro + Granular only)
  // ────────────────────────────────────────────────────────────────

  {
    id: 'lead-criteria',
    tiers: ['pro', 'granular'],
    target: '[data-tour-id="search-input"]',
    title: 'Tune the fit score',
    body: 'Click the lightning icon next to the search bar to open Lead Criteria. Drag the 5 dimension weights — Recency, Reach, Reachability, Relevance, Quality — and even add custom criteria in plain English ("based in the US", "talks about value investing"). The score re-ranks live.',
    placement: 'bottom',
  },

  {
    id: 'search-filters',
    tiers: ['granular'],
    target: '[data-tour-id="search-input"]',
    title: 'Region filters + AI expansion',
    body: 'The filter icon scopes search by region (US/EU/global). For single-keyword searches, AI keyword expansion is on by default — Claude Haiku fans your query out into 3 sibling queries and merges the hits, giving you ~3× the reach without typing more.',
    placement: 'bottom',
  },

  // ────────────────────────────────────────────────────────────────
  //  ACT 2 — ADDING TO OUTREACH
  // ────────────────────────────────────────────────────────────────

  {
    id: 'add-to-outreach',
    tiers: ['short', 'pro', 'granular'],
    target: '[data-tour-id="add-to-outreach-button"]',
    title: 'Add to your pipeline',
    body: 'Click the + on any creator row to drop them into outreach. The X next to it dismisses them so they never come back in future searches.',
    placement: 'left',
    previewSketch: 'result-row',
  },

  // ────────────────────────────────────────────────────────────────
  //  ACT 3 — THE OUTREACH SURFACE
  // ────────────────────────────────────────────────────────────────

  {
    id: 'outreach-tab',
    tiers: ['short', 'pro', 'granular'],
    target: '[data-tour-id="main-tabs"]',
    title: 'Outreach — your working surface',
    body: 'This is where you live day-to-day. Four sub-tabs: Pipeline (your leads), Follow-ups (action queue), Active Clients (wins), Analytics (stats).',
    placement: 'bottom',
    onEnter: ({ navigate }) => navigate('outreach', 'all'),
  },

  {
    id: 'status-drives-workflow',
    tiers: ['short', 'pro', 'granular'],
    target: '[data-tour-id="outreach-table"]',
    title: 'Status drives the workflow',
    body: 'Mark a lead Open after first reach-out. Set a follow-up date — overdue ones auto-surface in the Follow-ups sub-tab. When you mark a lead Successful, an Active Client engagement auto-creates and confetti fires.',
    placement: 'top',
    onEnter: ({ navigate }) => navigate('outreach', 'all'),
    previewSketch: 'outreach-row',
  },

  {
    id: 'per-platform-columns',
    tiers: ['granular'],
    target: '[data-tour-id="outreach-table"]',
    title: 'Columns reflow per platform',
    body: 'When you switch the top-banner platform toggle, the Outreach columns re-arrange to lead with that platform\'s metrics. YouTube view shows subscribers + avg views; Instagram view shows IG followers + posts; X shows X followers, etc. Each platform remembers its own layout — Customize Columns saves per-platform.',
    placement: 'top',
    onEnter: ({ navigate }) => navigate('outreach', 'all'),
  },

  {
    id: 'templates',
    tiers: ['pro', 'granular'],
    target: '[data-tour-id="outreach-table"]',
    title: 'Per-platform message templates',
    body: 'In the hamburger menu, Templates lets you write outreach templates per platform — Email, LinkedIn DM, IG DM. Variables like {name}, {channel}, {product} fill in automatically when you compose. CAN-SPAM footer toggle for email.',
    placement: 'top',
    onEnter: ({ navigate }) => navigate('outreach', 'all'),
  },

  {
    id: 'followups',
    tiers: ['pro', 'granular'],
    target: '[data-tour-id="outreach-subtabs"]',
    title: 'Follow-ups — what\'s due today',
    body: 'Auto-cadence (3 → 7 → 14 → 30 days) kicks in when you mark a row Open. The Follow-ups sub-tab surfaces only what\'s due today or overdue. Click "Mark followed up" to reset the cadence.',
    placement: 'bottom',
    onEnter: ({ navigate }) => navigate('outreach', 'followups'),
  },

  // ────────────────────────────────────────────────────────────────
  //  ACT 4 — ACTIVE CLIENTS
  // ────────────────────────────────────────────────────────────────

  {
    id: 'active-clients',
    tiers: ['short', 'pro', 'granular'],
    target: '[data-tour-id="outreach-subtabs"]',
    title: 'Active Clients — engagement depth',
    body: 'Each won lead becomes an engagement card with scope, milestones, contract upload, team members with revenue splits, and an audit-trail activity log.',
    placement: 'bottom',
    onEnter: ({ navigate }) => navigate('outreach', 'active'),
  },

  {
    id: 'lifecycle-states',
    tiers: ['pro', 'granular'],
    target: '[data-tour-id="outreach-subtabs"]',
    title: 'Lifecycle states',
    body: 'Each engagement moves through Active → Paused → Completed (won) or Churned (lost). The card shows the current state with a live pulse + a contextual one-liner. Switching to Completed opens the wrap-up flow.',
    placement: 'bottom',
    onEnter: ({ navigate }) => navigate('outreach', 'active'),
    previewSketch: 'active-client-card',
  },

  {
    id: 'wrap-up-flow',
    tiers: ['pro', 'granular'],
    target: '[data-tour-id="outreach-subtabs"]',
    title: 'The wrap-up flow',
    body: 'Marking Completed opens a modal that captures the final value, a 5-star rating, repeat likelihood (Definitely / Likely / Maybe / No), an optional testimonial, deliverable links, and referrals.',
    placement: 'bottom',
    onEnter: ({ navigate }) => navigate('outreach', 'active'),
  },

  {
    id: 'referrals-spawn-outreach',
    tiers: ['granular'],
    target: '[data-tour-id="outreach-subtabs"]',
    title: 'Referrals become Outreach entries',
    body: 'In the wrap-up flow, each "Referrals mentioned" row spawns a new entry in your Outreach tab when the engagement closes. Happy clients who name-drop friends turn directly into warm-intro leads — no copy-paste, no losing names to a notes paragraph.',
    placement: 'bottom',
    onEnter: ({ navigate }) => navigate('outreach', 'active'),
  },

  {
    id: 'under-budget-flag',
    tiers: ['granular'],
    target: '[data-tour-id="outreach-subtabs"]',
    title: 'Under-budget flag',
    body: 'When you close an engagement at less than the contract budget, an amber "Under contract" pill appears on the card and in the detail modal. Helps you spot pricing-slippage patterns ("I keep closing 15% under on Instagram deals") across your wins.',
    placement: 'bottom',
    onEnter: ({ navigate }) => navigate('outreach', 'active'),
  },

  // ────────────────────────────────────────────────────────────────
  //  ACT 5 — ANALYTICS
  // ────────────────────────────────────────────────────────────────

  {
    id: 'analytics',
    tiers: ['short', 'pro', 'granular'],
    target: '[data-tour-id="outreach-subtabs"]',
    title: 'Analytics — five lenses',
    body: 'Five layouts on the same data: Overview, Sales pipeline, Active Clients, Cash flow, Activity. Click Change Layout to switch lenses, or the time-range pills to filter.',
    placement: 'bottom',
    onEnter: ({ navigate }) => navigate('outreach', 'analytics'),
  },

  {
    id: 'custom-metrics',
    tiers: ['granular'],
    target: '[data-tour-id="outreach-subtabs"]',
    title: 'Build your own metrics',
    body: 'The Customize button on Analytics lets you build custom metrics without writing formulas. Pick a field, pick an aggregation (sum / count / avg / win rate), pick a status filter — done. Pin whichever ones matter to you; the AI insight card narrates the most-newsworthy delta.',
    placement: 'bottom',
    onEnter: ({ navigate }) => navigate('outreach', 'analytics'),
    previewSketch: 'analytics-kpi',
  },

  // ────────────────────────────────────────────────────────────────
  //  ACT 6 — HEADER + SETTINGS
  // ────────────────────────────────────────────────────────────────

  {
    id: 'header-pills',
    tiers: ['short', 'pro', 'granular'],
    target: '[data-tour-id="header-pills"]',
    title: 'Insight & Tips in the header',
    body: 'The Insight pill cycles through your live stats with context. The Tips pill cycles through feature shortcuts. Click either to expand.',
    placement: 'bottom',
  },

  {
    id: 'hamburger-menu',
    tiers: ['pro', 'granular'],
    target: null,
    title: 'The hamburger menu',
    body: 'Top-right of the header. Holds Profile, Templates, Lead Criteria, Subscription, Tutorials (this menu), Roadmap, and Appearance — where you pick your visual theme and Win celebration style.',
    placement: 'left',
  },

  {
    id: 'themes',
    tiers: ['pro', 'granular'],
    target: null,
    title: 'Backdrop themes',
    body: 'Under Appearance → Themes, pick Rain, Drift, Fireworks, or Tornado (the default). Each plays in a thin banner strip at the top, color-matched to your active platform. Themes fire on platform switch, on sign-in, and on the Spotlight button.',
    placement: 'left',
  },

  {
    id: 'win-celebration',
    tiers: ['granular'],
    target: null,
    title: 'Win celebration style',
    body: 'Also under Appearance: pick what fires when you mark an outreach Successful. Full confetti (default), Fireworks burst, Subtle pulse, or Off. The success toast (bottom-right CTA to the new Active Client) still appears regardless of which effect you pick.',
    placement: 'left',
  },

  // ────────────────────────────────────────────────────────────────
  //  ACT 7 — ADMIN (admin users only, granular tier)
  // ────────────────────────────────────────────────────────────────

  {
    id: 'connection-status',
    tiers: ['granular'],
    target: null,
    title: 'Connection status (admin)',
    body: 'In /admin, the Connection Status panel pings every external integration every 60s — Supabase, Redis, Meta Graph, Instagram scrape, YouTube API, Stripe, Anthropic, Unipile, Resend, QStash. Each row tags its fragility so you can see at a glance which break risks are HTML-shape-change vs token-rotation vs rate-limit.',
    placement: 'left',
    adminOnly: true,
  },

  // ────────────────────────────────────────────────────────────────
  //  ACT 8 — WRAP-UP
  // ────────────────────────────────────────────────────────────────

  {
    id: 'end',
    tiers: ['short', 'pro', 'granular'],
    target: null,
    title: "You're set",
    body: "Run a search to start your first pipeline. The hamburger menu has Profile, Templates, Tutorials, Roadmap — and you can replay any tutorial tier any time.",
    nextLabel: 'Finish',
  },
]

// ════════════════════════════════════════════════════════════════════
//  Tier metadata — used by the picker UI + hamburger sub-menu
// ════════════════════════════════════════════════════════════════════

export interface TierMeta {
  id: TutorialTier
  label: string
  /** Display sub-label / time estimate. */
  duration: string
  /** Short pitch for the picker UI. */
  pitch: string
  /** Color accent class for the picker card. */
  accent: 'emerald' | 'violet' | 'amber'
}

export const TIER_META: Record<TutorialTier, TierMeta> = {
  short: {
    id: 'short',
    label: 'Quick tour',
    duration: '~90 seconds',
    pitch: 'The spine of the workflow. Search, score, outreach, win. Skip the customization details.',
    accent: 'emerald',
  },
  pro: {
    id: 'pro',
    label: 'Pro tour',
    duration: '~4 minutes',
    pitch: 'Quick tour plus the surfaces power users live in: Lead Criteria, Templates, Follow-ups, Wrap-up flow, Themes.',
    accent: 'violet',
  },
  granular: {
    id: 'granular',
    label: 'The deep dive',
    duration: '~8 minutes',
    pitch: 'Pro tour plus every advanced surface: per-platform column configs, AI keyword expansion, custom metrics, referrals → outreach, under-budget flag, win celebration picker, admin tools.',
    accent: 'amber',
  },
}

/**
 * Return the ordered step list for a given tier. Admin-only steps
 * are filtered out for non-admin users. Steps preserve catalog order.
 */
export function stepsForTier(
  tier: TutorialTier,
  options: { isAdmin?: boolean } = {},
): CatalogStep[] {
  const { isAdmin = false } = options
  return CATALOG_STEPS.filter(s => {
    if (!s.tiers.includes(tier)) return false
    if (s.adminOnly && !isAdmin) return false
    return true
  })
}

/** Convenience: step count for a tier (used by picker UI). */
export function stepCountForTier(
  tier: TutorialTier,
  options: { isAdmin?: boolean } = {},
): number {
  return stepsForTier(tier, options).length
}
