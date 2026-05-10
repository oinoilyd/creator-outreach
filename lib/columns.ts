import type { ColId, ColConfig, OutreachColDef, OutreachColConfig, SortCol } from './types'

export const ALL_OUTREACH_COLS: OutreachColDef[] = [
  { id: 'favorite',        label: '★',                 defaultVisible: true,  defaultWidth: 38,  tooltip: 'Click the star next to a row to favorite it. View favorites under Outreach → Favorites.' },
  { id: 'channelName',     label: 'Channel',           defaultVisible: true,  defaultWidth: 160, tooltip: 'The creator\'s channel name.' },
  { id: 'channelUrl',      label: 'YT',                defaultVisible: true,  defaultWidth: 56,  tooltip: 'Click to open the channel on YouTube.' },
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

export const DEFAULT_COLS: ColConfig[] = [
  { id: 'fitScore',    label: 'Fit Score',   visible: true  },
  { id: 'avgViews',    label: 'Avg Views',   visible: true  },
  { id: 'subscribers', label: 'Subscribers', visible: true  },
  { id: 'lastVideo',   label: 'Last Video',  visible: true  },
  // Last Short defaults off — YouTube's /shorts tab returns sparse
  // publishedTime data for many channels (especially smaller ones),
  // so the column reads as mostly empty and ends up noise. Available
  // via Customize Columns when actually needed.
  { id: 'lastShort',   label: 'Last Short',  visible: false },
  { id: 'email',       label: 'Email',       visible: true  },
  { id: 'linkedin',    label: 'LinkedIn',    visible: true  },
  { id: 'website',     label: 'Website',     visible: false },
  // Instagram defaults VISIBLE in the Results table too — same
  // reasoning as the Outreach default above. Drives the IG handle
  // into the search results immediately so users see it before
  // adding to outreach.
  { id: 'instagram',   label: 'Instagram',   visible: true  },
  // Instagram-derived metrics — defaults OFF (the Instagram column
  // already gives you the DM link). They auto-show when the user
  // flips the platform filter to Instagram (per platform config in
  // app/page.tsx) and are always available via Customize Columns.
  { id: 'igFollowers', label: 'IG Followers',visible: false },
  { id: 'igPosts',     label: 'IG Posts',    visible: false },
  { id: 'twitter',     label: 'X',           visible: false },
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
