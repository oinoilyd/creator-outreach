export interface Creator {
  channelId: string
  channelName: string
  channelUrl: string
  avgViews: number
  subscribers: string
  email: string
  website: string
  linkedin: string
  twitter: string
  instagram: string
  tiktok: string
  company: string
  matchedVia: string
  videoTitles: string[]
  videoDates: string[]
  shortDates: string[]
  description: string
  enriching?: boolean
}

export type SortCol =
  | 'channelName' | 'avgViews' | 'subscribers' | 'lastVideo' | 'lastShort'
  | 'email' | 'website' | 'linkedin' | 'instagram' | 'twitter' | 'tiktok'
  | 'fitScore'
  // Instagram-API-derived metrics. Sortable columns the user can
  // surface via Customize Columns or auto-shown when filtering by IG.
  | 'igFollowers' | 'igPosts'
export type SortDir = 'asc' | 'desc'

/**
 * Multi-column sort key. The Results table now supports chaining
 * sorts — clicking column headers in sequence builds an array of
 * SortKey, with the most-recently-clicked at index 0 (= highest
 * priority). The comparator iterates them in order, returning the
 * first non-zero comparison.
 */
export type SortKey = { col: SortCol; dir: SortDir }
export type ColId =
  | 'avgViews' | 'subscribers' | 'lastVideo' | 'lastShort'
  | 'email' | 'linkedin' | 'website' | 'instagram' | 'twitter' | 'tiktok'
  | 'fitScore'
  | 'igFollowers' | 'igPosts'
export type ActiveTab = 'results' | 'outreach' | 'dismissed'

export interface ScoreWeights {
  recency: number
  views: number
  reachability: number
  relevance: number
  quality: number
}

export type GuidanceCondition =
  | 'has_email' | 'no_email'
  | 'has_instagram' | 'has_tiktok' | 'has_twitter' | 'has_website' | 'has_linkedin'
  | 'multi_platform'
  | 'subs_gte' | 'subs_lte'
  | 'views_gte' | 'views_lte'
  | 'posts_recent'
  | 'has_product_mention'
  | 'has_english_description'

export interface GuidanceRule {
  condition: GuidanceCondition
  value?: number
  points: number
  label: string
}

export interface GuidanceEntry {
  id: string
  text: string
  timestamp: number
  rules: GuidanceRule[]
  summary: string
  weight: number
}

export interface GuidancePreset {
  label: string
  description: string
  emoji: string
  entry: Omit<GuidanceEntry, 'id' | 'timestamp'>
}

export interface GuidanceContextType {
  entries: GuidanceEntry[]
  addEntry: (e: GuidanceEntry) => void
  removeEntry: (id: string) => void
  updateEntryWeight: (id: string, weight: number) => void
  resetAll: () => void
}

export interface OutreachEntry {
  id: string
  channelId: string
  channelName: string
  channelUrl: string
  description: string
  email: string
  product: string
  favorite: boolean
  reachedOut: boolean
  medium: 'Email' | 'LinkedIn' | 'Other' | ''
  mediumOther: string
  headerUsed: string
  status: 'Not Outreached' | 'Open' | 'Rejected' | 'Successful' | 'No Response' | ''
  addedAt: number
  notes: string
  followUpDate: string
  dateReachedOut: string
  touchpoints: string
  responseDate: string
  subscribers: string
  avgViews: number
  fitScore: number
  linkedin: string
  instagram: string
  twitter: string
  tiktok: string
  website: string
  contentNiche: string
  phone: string
  dealValue: string
  contractSent: boolean
  meetingScheduled: string
  /** Short opaque ID embedded in outbound email subjects as [CO-#{id}].
   *  Used by the inbound webhook (/api/inbound-email) to match a
   *  forwarded reply back to the originating outreach entry. NULL for
   *  legacy entries created before the tracking system was wired.
   *  Deprecated path — new sends route via Unipile and match by
   *  unipileProviderId / unipileThreadId; kept here so legacy
   *  entries created before the migration still resolve replies. */
  trackingId?: string
  /** Unipile's internal id for the most recent outbound message. */
  unipileMessageId?: string | null
  /** Gmail Message-ID header — what In-Reply-To on replies will reference. */
  unipileProviderId?: string | null
  /** Conversation thread id grouping every message in the back-and-forth. */
  unipileThreadId?: string | null
  /** Server-side tracking id Unipile labels outbound messages with so
   *  open/click events can be attributed back to this entry. */
  unipileTrackingId?: string | null
  /** Epoch ms when we last sent via Unipile. */
  unipileSentAt?: number | null
  /** Number of distinct open events on the most recent outbound. */
  openCount?: number
  /** Epoch ms of the most recent open event. */
  lastOpenedAt?: number | null
  /** User opt-in: when the entry's follow_up_date hits and no reply
   *  has been received, the cron auto-fires a follow-up email. */
  autoFollowup?: boolean
  /** Epoch ms of the last auto-follow-up send (prevents re-firing). */
  lastAutoFollowupAt?: number | null
}

export interface OutreachColDef {
  id: keyof OutreachEntry
  label: string
  defaultVisible: boolean
  defaultWidth: number
  tooltip?: string
}

export interface OutreachColConfig extends OutreachColDef {
  visible: boolean
  width: number
}

export interface ColConfig {
  id: ColId
  label: string
  visible: boolean
}

export type PlatformId = 'youtube' | 'instagram' | 'tiktok' | 'twitter' | 'linkedin'

export interface PlatformConfig {
  id: PlatformId
  label: string
  emoji: string
  activeBg: string
  condition: GuidanceCondition | null
  column: ColId | null
  chipLabel: string
  chipWeight: number
}

export type MailClient = 'default' | 'gmail' | 'outlook' | 'yahoo'

export interface UserProfile {
  fullName: string
  linkedinUrl: string
  pitchLine: string
  // Custom subject line for outreach emails. Supports placeholders
  // {name}, {channel}, {content} that lib/format.ts substitutes at
  // compose time. Empty or undefined falls back to the default subject.
  subjectTemplate?: string
  // Which email-compose URL to use when the user clicks an outreach
  // email link. 'default' uses mailto: (OS default), the others open
  // the provider's web compose in a new tab.
  mailClient?: MailClient
  /** The user's auth email (the address they signed up / signed in
   *  with). Read-only — not editable via ProfileModal. Used by
   *  composeUrl to inject &authuser=... into the Gmail / Outlook
   *  compose URL so multi-account browser users open the compose
   *  window in the right account. */
  userEmail?: string
  /** Unipile account identifier for the user's connected Gmail.
   *  Populated after the user completes the hosted-auth flow at
   *  /api/unipile/connect → Unipile-hosted OAuth → webhook callback.
   *  When non-null, outreach can be sent programmatically via
   *  Unipile's API instead of opening a Gmail compose URL. NULL =
   *  user hasn't connected Gmail yet. */
  unipileAccountId?: string | null
  /** Display-only — the Gmail address the user authorized. Cached
   *  here so the profile UI can show "Connected as: foo@gmail.com"
   *  without an extra round-trip to Unipile. */
  unipileAccountEmail?: string | null
  /** When the user first completed OAuth (epoch ms). Useful for
   *  analytics + detecting stale connections. */
  unipileConnectedAt?: number | null
  /** Sender's postal address. Required by CAN-SPAM §5(a)(5) — every
   *  commercial email must include a valid physical address. Surfaced
   *  in the composer warning when missing and auto-appended to the
   *  outgoing email footer by buildOutreachContent. */
  physicalAddress?: string | null
  /** Per-platform message templates. NULL/undefined = use bundled default
   *  in lib/templates.ts. Variables supported in each template:
   *  {name} {channel} {content} {pitch} {sender_first} {sender_full} {linkedin}.
   *  Migration 0026 backs these as nullable TEXT columns. */
  emailTemplate?: string | null
  igDmTemplate?: string | null
  linkedinDmTemplate?: string | null
  xDmTemplate?: string | null
  tiktokDmTemplate?: string | null
  /** CAN-SPAM footer toggle. Defaults TRUE (compliant). When FALSE, the
   *  email footer is suppressed AND footerDisabledAcknowledgedAt must
   *  be set — that timestamp is the user's audit-trail acknowledgment
   *  of compliance responsibility. */
  includeCanSpamFooter?: boolean
  footerDisabledAcknowledgedAt?: string | null
}

// ── Custom analytics metrics (Outreach > Analytics tab) ─────────────────────

export type MetricStatusFilter = 'any' | 'Not Outreached' | 'Open' | 'Successful' | 'Rejected' | 'No Response'
export type MetricMediumFilter = 'any' | 'Email' | 'LinkedIn' | 'Other'
export type MetricTristate = 'any' | 'yes' | 'no'
export type MetricWindow = 'all' | 'last7' | 'last30'
export type MetricSumField = 'dealValue' | 'avgViews' | 'fitScore' | 'touchpoints'

export interface MetricFilter {
  status: MetricStatusFilter
  medium: MetricMediumFilter
  hasEmail: MetricTristate
  hasLinkedin: MetricTristate
  favorite: MetricTristate
  reachedOut: MetricTristate
  window: MetricWindow
}

export interface CustomMetric {
  id: string
  label: string
  type: 'count' | 'percentage' | 'sum' | 'average'
  // Filter applied to the numerator / set being measured.
  filter: MetricFilter
  // For 'percentage' only — denominator filter (numerator uses `filter`)
  denomFilter?: MetricFilter
  // For 'sum' and 'average' — which numeric field to aggregate
  sumField?: MetricSumField
}

export const EMPTY_METRIC_FILTER: MetricFilter = {
  status: 'any',
  medium: 'any',
  hasEmail: 'any',
  hasLinkedin: 'any',
  favorite: 'any',
  reachedOut: 'any',
  window: 'all',
}
