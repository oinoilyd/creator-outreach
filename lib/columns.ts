import type { ColId, ColConfig, OutreachColDef, OutreachColConfig, SortCol } from './types'

export const ALL_OUTREACH_COLS: OutreachColDef[] = [
  { id: 'channelName',     label: 'Channel',           defaultVisible: true,  defaultWidth: 160 },
  { id: 'channelUrl',      label: 'YT',                defaultVisible: true,  defaultWidth: 42  },
  { id: 'email',           label: 'Email',             defaultVisible: true,  defaultWidth: 190 },
  { id: 'description',     label: 'Description',       defaultVisible: true,  defaultWidth: 230 },
  { id: 'product',         label: 'Product',           defaultVisible: true,  defaultWidth: 160 },
  { id: 'reachedOut',      label: 'Reached Out',       defaultVisible: true,  defaultWidth: 96  },
  { id: 'medium',          label: 'Medium',            defaultVisible: true,  defaultWidth: 170 },
  { id: 'headerUsed',      label: 'Subject Line',      defaultVisible: true,  defaultWidth: 210 },
  { id: 'status',          label: 'Status',            defaultVisible: true,  defaultWidth: 130 },
  { id: 'notes',           label: 'Notes',             defaultVisible: true,  defaultWidth: 220 },
  { id: 'followUpDate',    label: 'Follow Up Date',    defaultVisible: false, defaultWidth: 140 },
  { id: 'dateReachedOut',  label: 'Date Reached Out',  defaultVisible: false, defaultWidth: 145 },
  { id: 'touchpoints',     label: '# Touchpoints',     defaultVisible: false, defaultWidth: 110 },
  { id: 'responseDate',    label: 'Response Date',     defaultVisible: false, defaultWidth: 140 },
  { id: 'subscribers',     label: 'Subscribers',       defaultVisible: false, defaultWidth: 110 },
  { id: 'avgViews',        label: 'Avg Views',         defaultVisible: false, defaultWidth: 110 },
  { id: 'fitScore',        label: 'Fit Score',         defaultVisible: false, defaultWidth: 100 },
  { id: 'linkedin',        label: 'LinkedIn',          defaultVisible: false, defaultWidth: 100 },
  { id: 'contentNiche',    label: 'Content Niche',     defaultVisible: false, defaultWidth: 130 },
  { id: 'phone',           label: 'Phone',             defaultVisible: false, defaultWidth: 130 },
  { id: 'dealValue',       label: 'Deal Value',        defaultVisible: false, defaultWidth: 110 },
  { id: 'contractSent',    label: 'Contract Sent',     defaultVisible: false, defaultWidth: 110 },
  { id: 'meetingScheduled',label: 'Meeting Scheduled', defaultVisible: false, defaultWidth: 150 },
]

export const DEFAULT_OUTREACH_COLS: OutreachColConfig[] =
  ALL_OUTREACH_COLS.map(c => ({ ...c, visible: c.defaultVisible, width: c.defaultWidth }))

export const DEFAULT_COLS: ColConfig[] = [
  { id: 'fitScore',    label: 'Fit Score',   visible: true  },
  { id: 'avgViews',    label: 'Avg Views',   visible: true  },
  { id: 'subscribers', label: 'Subscribers', visible: true  },
  { id: 'lastPosted',  label: 'Last Posted', visible: true  },
  { id: 'email',       label: 'Email',       visible: true  },
  { id: 'linkedin',    label: 'LinkedIn',    visible: true  },
  { id: 'website',     label: 'Website',     visible: false },
  { id: 'instagram',   label: 'Instagram',   visible: false },
  { id: 'twitter',     label: 'X',           visible: false },
  { id: 'tiktok',      label: 'TikTok',      visible: false },
]

export const YOUTUBE_ONLY_COL_IDS: ColId[] = ['avgViews', 'subscribers', 'lastPosted']

export const COL_SORT: Partial<Record<ColId, SortCol>> = {
  fitScore: 'fitScore', avgViews: 'avgViews', subscribers: 'subscribers', lastPosted: 'lastPosted',
  email: 'email', linkedin: 'linkedin', website: 'website',
  instagram: 'instagram', twitter: 'twitter', tiktok: 'tiktok',
}
