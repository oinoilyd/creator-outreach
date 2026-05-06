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
  description: string
  enriching?: boolean
}

export type SortCol =
  | 'channelName' | 'avgViews' | 'subscribers' | 'lastPosted'
  | 'email' | 'website' | 'linkedin' | 'instagram' | 'twitter' | 'tiktok'
  | 'fitScore'
export type SortDir = 'asc' | 'desc'
export type ColId =
  | 'avgViews' | 'subscribers' | 'lastPosted'
  | 'email' | 'linkedin' | 'website' | 'instagram' | 'twitter' | 'tiktok'
  | 'fitScore'
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
  contentNiche: string
  phone: string
  dealValue: string
  contractSent: boolean
  meetingScheduled: string
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

export interface UserProfile {
  fullName: string
  linkedinUrl: string
  pitchLine: string
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
