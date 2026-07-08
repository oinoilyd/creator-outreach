/**
 * The bounded lead-field surface both integrations speak — shared by the
 * server routes (lib/integrations.ts re-exports) and the Integrations
 * panel UI. Client-safe: no node imports.
 */

export const LEAD_FIELDS: { key: string; col: string; label: string }[] = [
  { key: 'channelName', col: 'channel_name', label: 'Channel Name' },
  { key: 'channelUrl', col: 'channel_url', label: 'Channel URL' },
  { key: 'email', col: 'email', label: 'Email' },
  { key: 'status', col: 'status', label: 'Status' },
  { key: 'product', col: 'product', label: 'Product / Pitch' },
  { key: 'notes', col: 'notes', label: 'Notes' },
  { key: 'followUpDate', col: 'follow_up_date', label: 'Follow-up Date' },
  { key: 'dateReachedOut', col: 'date_reached_out', label: 'Last Contacted' },
  { key: 'touchpoints', col: 'touchpoints', label: 'Touchpoints' },
  { key: 'dealValue', col: 'deal_value', label: 'Deal Value' },
  { key: 'instagram', col: 'instagram', label: 'Instagram' },
  { key: 'website', col: 'website', label: 'Website' },
  { key: 'subscribers', col: 'subscribers', label: 'Subscribers' },
]

export const VALID_STATUSES = new Set([
  'Not Outreached', 'Open', 'Rejected', 'Successful', 'No Response', '',
])
