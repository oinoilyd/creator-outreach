/**
 * Cross-tab metrics payload shared between the client pill,
 * the /api/insights/dashboard route, and the detector module
 * in detect.ts. Keep these three in sync.
 */
export interface DashboardMetrics {
  // Outreach Pipeline sub-tab
  total: number
  reachedOut: number
  responseReceived: number
  successful: number
  notOutreached: number
  open: number
  noResponse: number
  rejected: number
  responseRate: number
  winRate: number
  pipelineValue: number
  leadsWithEmailNotReached: number
  byMedium: Record<'Email' | 'LinkedIn' | 'Other', { reached: number; won: number }>

  // Follow-ups sub-tab
  followupOverdue: number
  followupDueToday: number
  followupDueThisWeek: number

  // Analytics sub-tab (velocity)
  addedLast7: number
  reachedLast7: number
  wonLast30: number

  // Active Clients sub-tab
  activeClientsTotal: number
  activeNow: number
  lifecyclePaused: number
  lifecycleCompleted: number
  lifecycleChurned: number
  totalBooked: number
  personalRevenue: number
  completedRealised: number
  avgRating: number | null
  repeatDefinitely: number
  repeatLikely: number
  repeatMaybe: number
  repeatNo: number

  // Results + Dismissed tabs (sourcing)
  resultsCount: number
  dismissedCount: number
  dismissalRatio: number

  // Profile + Settings + Templates (workflow setup)
  workflow: {
    hasPitchLine: boolean
    hasFullName: boolean
    hasPhysicalAddress: boolean
    gmailConnected: boolean
    customEmailTemplate: boolean
    customIgTemplate: boolean
    customLinkedinTemplate: boolean
    mailClient: string
  }
}
