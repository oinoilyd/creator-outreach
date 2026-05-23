import type { ColId, ColConfig, OutreachColDef, OutreachColConfig, PlatformId, SortCol } from './types'

export const ALL_OUTREACH_COLS: OutreachColDef[] = [
  { id: 'favorite',        label: '★',                 defaultVisible: true,  defaultWidth: 38,  tooltip: 'Click the star next to a row to favorite it. View favorites under Outreach → Favorites.' },
  { id: 'channelName',     label: 'Channel',           defaultVisible: true,  defaultWidth: 160, tooltip: 'The creator\'s channel name.' },
  // Channel link column — label is platform-specific. The column
  // header in OutreachTab swaps the label based on the active
  // platform (YT / IG / X / TT / LI). The default label "YT" is
  // a fallback only — runtime overrides this when activePlatform
  // is set.
  { id: 'channelUrl',      label: 'YT',                defaultVisible: true,  defaultWidth: 56,  tooltip: 'Click to open the channel page.' },
  { id: 'email',           label: 'Email',             defaultVisible: true,  defaultWidth: 190, tooltip: 'The creator\'s contact email. Click the green address to open a draft outreach email.' },
  { id: 'description',     label: 'Description',       defaultVisible: true,  defaultWidth: 230, tooltip: 'Channel description / bio.' },
  { id: 'product',         label: 'Product',           defaultVisible: true,  defaultWidth: 160, tooltip: 'Which product or pitch you\'re sending this creator.' },
  { id: 'reachedOut',      label: 'Reached Out',       defaultVisible: true,  defaultWidth: 96,  tooltip: 'Check this once you\'ve actually sent the outreach.' },
  { id: 'medium',          label: 'Medium',            defaultVisible: true,  defaultWidth: 170, tooltip: 'How you reached out — Email, LinkedIn, or Other.' },
  { id: 'headerUsed',      label: 'Subject Line',      defaultVisible: true,  defaultWidth: 210, tooltip: 'The subject line or opening hook you used.' },
  { id: 'status',          label: 'Status',            defaultVisible: true,  defaultWidth: 130, tooltip: 'Outcome of your outreach: Open, Successful, Rejected, or No Response.' },
  { id: 'notes',           label: 'Notes',             defaultVisible: true,  defaultWidth: 220, tooltip: 'Free-form notes about this lead.' },
  { id: 'followUpDate',    label: 'Follow Up Date',    defaultVisible: true,  defaultWidth: 140, tooltip: 'When to ping them again. Auto-set to today + 14 days when you mark a row as Open or No Response. Past dates with status Open show as Overdue in the Follow-ups tab.' },
  { id: 'autoFollowup',    label: 'Auto Follow-up',    defaultVisible: false, defaultWidth: 110, tooltip: 'When ON, a cron auto-sends a follow-up email when this row\'s Follow Up Date hits AND no reply has been received. Requires connected Gmail (via Profile → Connect Gmail). Skips Successful/Rejected rows. Caps at 1 auto-send per 24h to prevent runaway.' },
  { id: 'openCount',       label: 'Opens',             defaultVisible: false, defaultWidth: 88,  tooltip: 'Number of times the most recent email was opened (tracked via Unipile pixel). Opens fire reliably ~70% of the time — absence isn\'t reliable signal but presence is. Off until you enable tracking on send.' },
  { id: 'dateReachedOut',  label: 'Date Reached Out',  defaultVisible: false, defaultWidth: 145, tooltip: 'Date you sent the outreach. Used by the velocity stat.' },
  { id: 'touchpoints',     label: '# Touchpoints',     defaultVisible: false, defaultWidth: 110, tooltip: 'How many times you\'ve contacted this creator.' },
  { id: 'responseDate',    label: 'Response Date',     defaultVisible: false, defaultWidth: 140, tooltip: 'Date the creator responded.' },
  { id: 'subscribers',     label: 'Subscribers',       defaultVisible: false, defaultWidth: 110, tooltip: 'Subscriber count at the time of import.' },
  { id: 'avgViews',        label: 'Avg Views',         defaultVisible: false, defaultWidth: 110, tooltip: 'Average views per video.' },
  { id: 'fitScore',        label: 'Fit Score',         defaultVisible: false, defaultWidth: 100, tooltip: 'Lead-fit score from your scoring weights when this creator was added.' },
  { id: 'linkedin',        label: 'LinkedIn',          defaultVisible: false, defaultWidth: 100, tooltip: 'LinkedIn profile URL for the creator.' },
  // Instagram defaults VISIBLE — Dylan: "Instagram has such a large
  // success rate, default a column to include Instagram." Existing
  // users pick this up automatically because the merge logic in
  // app/page.tsx falls back to defaultVisible when a column isn't
  // present in their stored config.
  { id: 'instagram',       label: 'Instagram',         defaultVisible: true,  defaultWidth: 130, tooltip: 'Creator\'s Instagram handle. Click to open the profile in a new tab — DM templating coming soon.' },
  { id: 'contentNiche',    label: 'Content Niche',     defaultVisible: false, defaultWidth: 130, tooltip: 'Content niche or category, free-form.' },
  { id: 'phone',           label: 'Phone',             defaultVisible: false, defaultWidth: 130, tooltip: 'Phone number if you have one.' },
  { id: 'dealValue',       label: 'Pipeline $',        defaultVisible: true,  defaultWidth: 110, tooltip: 'Estimated $ value of this deal. Summed in Analytics → Pipeline $ across non-rejected entries.' },
  { id: 'contractSent',    label: 'Contract Sent',     defaultVisible: false, defaultWidth: 110, tooltip: 'Whether a contract has been sent.' },
  { id: 'meetingScheduled',label: 'Meeting Scheduled', defaultVisible: false, defaultWidth: 150, tooltip: 'Date/time of a scheduled meeting.' },

  // Platform-specific metric columns (added 2026-05-23). Default OFF
  // across the board — they auto-show only when the user switches
  // the top-banner platform toggle to the matching channel via
  // OUTREACH_PLATFORM_AUTOSHOW below. Render as em-dash when the
  // underlying field is NULL (data not collected yet — scraping
  // pipelines for X / TikTok land in a follow-up commit).
  { id: 'xFollowers',      label: 'X Followers',       defaultVisible: false, defaultWidth: 110, tooltip: 'Creator\'s X (Twitter) follower count. Populated via the X enrichment pipeline — em-dash when not yet collected.' },
  { id: 'xPosts',          label: 'X Posts',           defaultVisible: false, defaultWidth: 90,  tooltip: 'Recent X post count (rolling window).' },
  { id: 'tiktokFollowers', label: 'TT Followers',      defaultVisible: false, defaultWidth: 110, tooltip: 'TikTok follower count.' },
  { id: 'tiktokLikes',     label: 'TT Likes',          defaultVisible: false, defaultWidth: 100, tooltip: 'TikTok cumulative likes — usually a better engagement signal than raw post count.' },

  // "Added to outreach" — last column in the default order so it
  // sits at the right edge where audit/timestamp columns belong.
  // Default visible so newly-added rows are obvious + sortable. The
  // newly-added pin (see app/page.tsx) hoists fresh entries to the
  // top regardless of this column's sort state, until the user
  // clicks any column header to express a sort intent.
  //
  // Width 175 = "Added to outreach" label fits without truncation
  // alongside the drag handle + sort chevrons in the header. Bumped
  // from 130 → 175 (2026-05-09) after the label was getting clipped.
  { id: 'addedAt',         label: 'Added to outreach', defaultVisible: true,  defaultWidth: 175, tooltip: 'When this entry landed on your outreach board. Newly-added rows pin to the top automatically until you click any column header to sort by something else. Sortable.' },
]

export const DEFAULT_OUTREACH_COLS: OutreachColConfig[] =
  ALL_OUTREACH_COLS.map(c => ({ ...c, visible: c.defaultVisible, width: c.defaultWidth }))

/**
 * 2026-05-23 per Dylan: Outreach columns are now per-platform. Each
 * platform gets its own default layout (column visibility +
 * ordering). When the user customizes columns, the save is scoped
 * to the active platform — switching platforms loads that
 * platform's customization.
 *
 * Platform-specific metric columns auto-show when their platform is
 * active (e.g. xFollowers + xPosts visible only when X is active).
 * The platform's channel-link column is hoisted near the start so
 * the "open in [platform]" affordance is always within easy reach.
 *
 * To re-rank or add a platform later: add the platform's entry to
 * this map. The runtime reads PLATFORM_OUTREACH_DEFAULTS[activePlatform]
 * when no user-customized config exists for that platform.
 */
function buildPlatformDefault(
  visibleIds: ReadonlyArray<keyof typeof ALL_OUTREACH_COLS[number]['id'] | string>,
  hiddenOverrides: ReadonlyArray<string> = [],
): OutreachColConfig[] {
  // Build a fresh array based on DEFAULT_OUTREACH_COLS, then override
  // visibility for the platform-specific show/hide lists.
  return DEFAULT_OUTREACH_COLS.map(c => {
    const id = c.id as string
    if (visibleIds.includes(id)) return { ...c, visible: true }
    if (hiddenOverrides.includes(id)) return { ...c, visible: false }
    return c
  })
}

/**
 * Per-platform default column configs. Used when:
 *   • the user has no customized config saved yet for that platform
 *   • a brand-new user signs in
 *   • a platform-switch happens before the user has touched
 *     Customize Columns for the target platform.
 *
 * Each platform's default emphasises:
 *   1. That platform's contact handle column (instagram / twitter /
 *      tiktok / linkedin)
 *   2. That platform's metric columns (igFollowers/igPosts for IG,
 *      xFollowers/xPosts for X, etc.)
 * — while hiding the OTHER platforms' metric columns to keep the
 * table focused.
 */
export const PLATFORM_OUTREACH_DEFAULTS: Record<PlatformId, OutreachColConfig[]> = {
  // YouTube — the historical default. Subscribers + Avg Views
  // visible (the YouTube-specific metric pair). X / TikTok columns
  // hidden.
  youtube: buildPlatformDefault(
    ['favorite', 'channelName', 'channelUrl', 'email', 'description', 'product', 'subscribers', 'avgViews', 'reachedOut', 'medium', 'headerUsed', 'status', 'notes', 'followUpDate', 'instagram', 'dealValue', 'addedAt'],
    ['xFollowers', 'xPosts', 'tiktokFollowers', 'tiktokLikes', 'linkedin', 'twitter', 'tiktok'],
  ),
  // Instagram — IG handle + IG metrics lead. YouTube-specific metrics
  // hidden (subscribers / avgViews are YT data; IG creators won't have
  // it filled).
  instagram: buildPlatformDefault(
    ['favorite', 'channelName', 'instagram', 'email', 'description', 'product', 'reachedOut', 'medium', 'headerUsed', 'status', 'notes', 'followUpDate', 'dealValue', 'addedAt'],
    ['subscribers', 'avgViews', 'xFollowers', 'xPosts', 'tiktokFollowers', 'tiktokLikes', 'channelUrl', 'linkedin', 'twitter', 'tiktok'],
  ),
  // TikTok — TikTok handle + TikTok metrics lead.
  tiktok: buildPlatformDefault(
    ['favorite', 'channelName', 'tiktok', 'email', 'description', 'product', 'tiktokFollowers', 'tiktokLikes', 'reachedOut', 'medium', 'headerUsed', 'status', 'notes', 'followUpDate', 'dealValue', 'addedAt'],
    ['subscribers', 'avgViews', 'xFollowers', 'xPosts', 'channelUrl', 'instagram', 'linkedin', 'twitter'],
  ),
  // X (Twitter) — X handle + X metrics lead.
  twitter: buildPlatformDefault(
    ['favorite', 'channelName', 'twitter', 'email', 'description', 'product', 'xFollowers', 'xPosts', 'reachedOut', 'medium', 'headerUsed', 'status', 'notes', 'followUpDate', 'dealValue', 'addedAt'],
    ['subscribers', 'avgViews', 'tiktokFollowers', 'tiktokLikes', 'channelUrl', 'instagram', 'linkedin', 'tiktok'],
  ),
  // LinkedIn — LinkedIn handle leads. No platform-specific metric
  // columns yet (LinkedIn scraping is restricted).
  linkedin: buildPlatformDefault(
    ['favorite', 'channelName', 'linkedin', 'email', 'description', 'product', 'reachedOut', 'medium', 'headerUsed', 'status', 'notes', 'followUpDate', 'dealValue', 'addedAt'],
    ['subscribers', 'avgViews', 'xFollowers', 'xPosts', 'tiktokFollowers', 'tiktokLikes', 'channelUrl', 'instagram', 'twitter', 'tiktok'],
  ),
}

/**
 * Per-platform "auto-show on toggle" column IDs. When the active
 * platform changes via the top-banner toggle, these columns get
 * force-shown in the active config (Customize Columns can still
 * hide them again — the auto-show only nudges them visible on the
 * first switch).
 *
 * Symmetric with PLATFORM_AUTOSHOW_COLS in Results — same pattern,
 * different surface.
 */
export const OUTREACH_PLATFORM_AUTOSHOW: Record<PlatformId, ReadonlyArray<string>> = {
  youtube:   ['channelUrl', 'subscribers', 'avgViews'],
  instagram: ['instagram'],
  tiktok:    ['tiktok', 'tiktokFollowers', 'tiktokLikes'],
  twitter:   ['twitter', 'xFollowers', 'xPosts'],
  linkedin:  ['linkedin'],
}

/**
 * The "channel link" column header label per platform. The shared
 * `channelUrl` column shows "YT" by default; on non-YouTube
 * platforms the channel link concept doesn't apply (we use the
 * platform-handle column instead), so this falls back to "Link"
 * when the column is shown anyway.
 */
export const PLATFORM_CHANNEL_LINK_LABEL: Record<PlatformId, string> = {
  youtube:   'YT',
  instagram: 'Link',
  tiktok:    'Link',
  twitter:   'Link',
  linkedin:  'Link',
}

// 2026-05-11 per Dylan: YouTube column order should be
//   Channel · Email · Fit Score · Avg Views · Subscribers · Last Video
//   · Instagram · X · LinkedIn
// Channel is rendered as a hardcoded header in CreatorTable and isn't
// part of DEFAULT_COLS. The order below matches everything AFTER
// Channel. The effectiveColConfig() reorder in app/page.tsx still
// hoists the active-platform's column to the front for non-YouTube
// platforms (Instagram view leads with the IG col, etc.), but for
// YouTube only `email` is hoisted — the socials stay at the end in
// this order. See app/page.tsx effectiveColConfig for the runtime
// override.
export const DEFAULT_COLS: ColConfig[] = [
  { id: 'email',       label: 'Email',       visible: true  },
  { id: 'fitScore',    label: 'Fit Score',   visible: true  },
  { id: 'avgViews',    label: 'Avg Views',   visible: true  },
  { id: 'subscribers', label: 'Subscribers', visible: true  },
  { id: 'lastVideo',   label: 'Last Video',  visible: true  },
  // Last Short defaults off — YouTube's /shorts tab returns sparse
  // publishedTime data for many channels (especially smaller ones),
  // so the column reads as mostly empty and ends up noise. Available
  // via Customize Columns when actually needed.
  { id: 'lastShort',   label: 'Last Short',  visible: false },
  // Socials default VISIBLE in Results per Dylan 2026-05-10. He sees
  // strong returns on Instagram + X and wants both surfaced in the
  // default layout. LinkedIn defaults visible too. Order matches the
  // PlatformDropdown order: Instagram → X → LinkedIn.
  { id: 'instagram',   label: 'Instagram',   visible: true  },
  { id: 'twitter',     label: 'X',           visible: true  },
  { id: 'linkedin',    label: 'LinkedIn',    visible: true  },
  { id: 'website',     label: 'Website',     visible: false },
  // Instagram-derived metrics — defaults OFF (the Instagram column
  // already gives you the DM link). They auto-show when the user
  // flips the platform filter to Instagram (per platform config in
  // app/page.tsx) and are always available via Customize Columns.
  { id: 'igFollowers', label: 'IG Followers',visible: false },
  { id: 'igPosts',     label: 'IG Posts',    visible: false },
  { id: 'tiktok',      label: 'TikTok',      visible: false },
]

export const YOUTUBE_ONLY_COL_IDS: ColId[] = ['avgViews', 'subscribers', 'lastVideo', 'lastShort']

/** Columns that are surfaced ONLY when the platform filter is set to
 *  the matching channel. The platform-tab change handler in
 *  app/page.tsx flips these visible / hidden as the active platform
 *  changes, so the user doesn't have to dig into Customize Columns
 *  to see followers when they pick Instagram. */
export const PLATFORM_AUTOSHOW_COLS: Record<string, ColId[]> = {
  instagram: ['igFollowers', 'igPosts'],
  // Future: tiktok / twitter / linkedin metric columns when we wire
  // those data sources too.
}

// Non-Partial Record so TypeScript compile-fails when a new ColId is
// added without a sort mapping. Guarantees every column header — both
// default and any opt-in via Customize Columns — exposes click-to-sort.
export const COL_SORT: Record<ColId, SortCol> = {
  fitScore: 'fitScore', avgViews: 'avgViews', subscribers: 'subscribers',
  lastVideo: 'lastVideo', lastShort: 'lastShort',
  email: 'email', linkedin: 'linkedin', website: 'website',
  instagram: 'instagram', twitter: 'twitter', tiktok: 'tiktok',
  igFollowers: 'igFollowers', igPosts: 'igPosts',
}
