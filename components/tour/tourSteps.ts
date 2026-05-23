/**
 * Tour step definitions — the script for the first-run product tour.
 *
 * Each step either anchors on a real UI element (via data-tour-id
 * attribute that the page renders into the right spot) or floats as
 * a centered modal (target === null) for welcome / wrap-up screens.
 *
 * onEnter fires when the step becomes active — used to navigate the
 * app to the right surface (switch tabs, open a sub-tab) before the
 * tooltip renders. Always wrap navigation in onEnter, never in the
 * step body, so going back/forward stays consistent.
 */

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto'

export interface TourHelpers {
  /** Set the main tab (Results / Outreach / Dismissed). */
  navigate: (tab: 'results' | 'outreach' | 'dismissed', sub?: 'all' | 'analytics' | 'followups' | 'active') => void
}

export interface TourStep {
  id: string
  /** CSS selector to look up the target element. null = centered modal. */
  target: string | null
  title: string
  body: string
  placement?: TourPlacement
  /** Fires when the step becomes active. Use for tab switches that
   *  need to happen before the spotlight aligns. */
  onEnter?: (helpers: TourHelpers) => void
  /** Custom "next" CTA label. Defaults to 'Next'. */
  nextLabel?: string
  /** Custom CTA for the final step. Replaces 'Next' with 'Finish'. */
  isFinal?: boolean
}

export const TOUR_STEPS: TourStep[] = [
  // ─────────────────────────────────────────────────────────────
  // 1. Welcome
  // ─────────────────────────────────────────────────────────────
  {
    id: 'welcome',
    target: null,
    title: 'Welcome to Creator Outreach',
    body: 'This app turns a creator search into a tracked outreach pipeline. Quick 90-second tour of the spine — you can skip any time and retake it from the hamburger menu.',
    nextLabel: "Let's go",
  },

  // ─────────────────────────────────────────────────────────────
  // 2. Platform toggle
  // ─────────────────────────────────────────────────────────────
  {
    id: 'platform',
    target: '[data-tour-id="platform-toggle"]',
    title: 'Pick your platform',
    body: 'YouTube, Instagram, TikTok, X, or LinkedIn. Scoring re-tunes per platform — YouTube weighs views and recency, Instagram weighs followers and post cadence, etc.',
    placement: 'bottom',
    onEnter: ({ navigate }) => navigate('results'),
  },

  // ─────────────────────────────────────────────────────────────
  // 3. Search
  // ─────────────────────────────────────────────────────────────
  {
    id: 'search',
    target: '[data-tour-id="search-input"]',
    title: 'Search for creators',
    body: 'Type a niche, keyword, or @handle. Results stream in scored by fit — channel name match, recent activity, and reachability all factor in.',
    placement: 'bottom',
  },

  // ─────────────────────────────────────────────────────────────
  // 4. Add to outreach
  // ─────────────────────────────────────────────────────────────
  {
    id: 'add-to-outreach',
    target: '[data-tour-id="results-table"]',
    title: 'Add to your pipeline',
    body: 'Click the + on any creator row to drop them into outreach. The X next to it dismisses them so they never come back in future searches.',
    placement: 'top',
  },

  // ─────────────────────────────────────────────────────────────
  // 5. Outreach tab
  // ─────────────────────────────────────────────────────────────
  {
    id: 'outreach-tab',
    target: '[data-tour-id="main-tabs"]',
    title: 'Outreach — your working surface',
    body: 'This is where you live day-to-day. Four sub-tabs: Pipeline (your leads), Follow-ups (action queue), Active Clients (wins), Analytics (stats).',
    placement: 'bottom',
    onEnter: ({ navigate }) => navigate('outreach', 'all'),
  },

  // ─────────────────────────────────────────────────────────────
  // 6. Status + follow-up
  // ─────────────────────────────────────────────────────────────
  {
    id: 'status',
    target: '[data-tour-id="outreach-table"]',
    title: 'Status drives the workflow',
    body: 'Mark a lead Open after first reach-out. Set a follow-up date — overdue ones auto-surface in the Follow-ups sub-tab. When you mark a lead Successful, an Active Client engagement auto-creates.',
    placement: 'top',
    onEnter: ({ navigate }) => navigate('outreach', 'all'),
  },

  // ─────────────────────────────────────────────────────────────
  // 7. Active Clients sub-tab
  // ─────────────────────────────────────────────────────────────
  {
    id: 'active-clients',
    target: '[data-tour-id="outreach-subtabs"]',
    title: 'Active Clients — engagement depth',
    body: 'Each won lead becomes an engagement card with scope, milestones, contract upload, team members with revenue splits, and an audit-trail activity log.',
    placement: 'bottom',
    onEnter: ({ navigate }) => navigate('outreach', 'active'),
  },

  // ─────────────────────────────────────────────────────────────
  // 8. Analytics
  // ─────────────────────────────────────────────────────────────
  {
    id: 'analytics',
    target: '[data-tour-id="outreach-subtabs"]',
    title: 'Analytics — five lenses',
    body: 'Five layouts on the same data: Overview, Sales pipeline, Active Clients, Cash flow, Activity. Click Change Layout to switch lenses, or the time-range pills to filter.',
    placement: 'bottom',
    onEnter: ({ navigate }) => navigate('outreach', 'analytics'),
  },

  // ─────────────────────────────────────────────────────────────
  // 9. Header pills + hamburger
  // ─────────────────────────────────────────────────────────────
  {
    id: 'header-pills',
    target: '[data-tour-id="header-pills"]',
    title: 'Insight & Tips in the header',
    body: 'The Insight pill cycles through your live stats with context. The Tips pill cycles through feature shortcuts. Click either to expand.',
    placement: 'bottom',
  },

  // ─────────────────────────────────────────────────────────────
  // 10. Wrap-up
  // ─────────────────────────────────────────────────────────────
  {
    id: 'end',
    target: null,
    title: "You're set",
    body: "Run a search to start your first pipeline. The hamburger menu has Profile, Templates, Billing — and 'Take a tour' to retake this any time.",
    nextLabel: 'Finish',
    isFinal: true,
  },
]
