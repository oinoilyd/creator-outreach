/**
 * lib/import/column-map.ts — forgiving spreadsheet→outreach column mapping.
 *
 * Pulled out of ImportOutreachModal so the matching logic is reusable +
 * testable on its own. The whole point is NO ROADBLOCKS when a CRM export
 * (HubSpot, Salesforce, Pipedrive, a random sheet) doesn't use our exact
 * column names:
 *
 *   • Fuzzy header matching — normalize (lowercase, strip punctuation) and
 *     accept exact alias, then substring/token overlap. "Email Address",
 *     "Contact Email", "E-mail" all → email.
 *   • Greedy + no double-assign — each spreadsheet column maps to at most
 *     one field; higher-priority fields claim first.
 *   • Split names — HubSpot exports "First Name" + "Last Name" separately;
 *     we combine them into one display name.
 *   • Manual override — autoMapColumns() is only a best guess; the modal
 *     lets the user fix any mapping, so an unrecognized sheet is never a
 *     dead end.
 */
import type { OutreachEntry } from '@/lib/types'

export type ImportField =
  | 'channelName'
  | 'lastName'
  | 'email'
  | 'channelUrl'
  | 'description'
  | 'product'
  | 'status'
  | 'reachedOut'
  | 'medium'
  | 'headerUsed'
  | 'instagram'
  | 'linkedin'
  | 'twitter'
  | 'tiktok'
  | 'website'

/** Case-insensitive header alias table. First-listed aliases are the most
 *  canonical. Add to these as real exports surface new naming patterns. */
export const COLUMN_ALIASES: Record<ImportField, readonly string[]> = {
  channelName: ['channel name', 'name', 'full name', 'creator', 'creator name', 'channel', 'lead name', 'contact name', 'company', 'company name', 'first name', 'firstname', 'given name'],
  lastName:    ['last name', 'lastname', 'surname', 'family name'],
  email:       ['email', 'email address', 'contact email', 'e-mail', 'mail', 'work email', 'primary email'],
  channelUrl:  ['youtube url', 'youtube', 'channel url', 'url', 'link', 'profile url', 'profile', 'yt url', 'website url'],
  description: ['description', 'notes', 'note', 'comments', 'about', 'bio', 'summary', 'message'],
  product:     ['product', 'service', 'offering', 'product/service'],
  status:      ['status', 'state', 'stage', 'lead status', 'deal stage', 'pipeline stage', 'lifecycle stage'],
  reachedOut:  ['reached out', 'contacted', 'reached', 'has reached out', 'outreach started'],
  medium:      ['medium', 'method', 'outreach method', 'channel of contact'],
  headerUsed:  ['subject line', 'subject', 'email subject', 'header'],
  instagram:   ['instagram', 'ig', 'ig url', 'instagram url', 'instagram handle', 'instagram profile'],
  linkedin:    ['linkedin', 'linkedin url', 'linkedin profile', 'linkedin profile url'],
  twitter:     ['twitter', 'x', 'x url', 'twitter url', 'x handle', 'twitter handle'],
  tiktok:      ['tiktok', 'tiktok url', 'tiktok handle', 'tiktok profile'],
  website:     ['website', 'site', 'web', 'homepage', 'web site'],
}

/** Priority order for greedy assignment — earlier fields claim a column
 *  before later ones, so "Email" can't be stolen by a fuzzy URL match. */
const FIELD_PRIORITY: ImportField[] = [
  'email', 'channelName', 'lastName', 'channelUrl',
  'instagram', 'linkedin', 'twitter', 'tiktok', 'website',
  'status', 'description', 'product', 'reachedOut', 'medium', 'headerUsed',
]

export function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Best-guess mapping from spreadsheet headers → fields. Returns a partial
 * map (field → header). Each header is used at most once. Two passes:
 * exact normalized-alias match first (precise), then substring/token
 * overlap (fuzzy) for anything still unclaimed.
 */
export function autoMapColumns(headers: string[]): Partial<Record<ImportField, string>> {
  const norm = headers.map((raw) => ({ raw, n: normalizeHeader(raw) })).filter((h) => h.n.length > 0)
  const used = new Set<string>()
  const map: Partial<Record<ImportField, string>> = {}

  const claim = (field: ImportField, raw: string) => {
    map[field] = raw
    used.add(raw)
  }

  // Pass 1 — exact normalized alias match.
  for (const field of FIELD_PRIORITY) {
    if (map[field]) continue
    const aliases = COLUMN_ALIASES[field].map(normalizeHeader)
    const hit = norm.find((h) => !used.has(h.raw) && aliases.includes(h.n))
    if (hit) claim(field, hit.raw)
  }

  // Pass 2 — fuzzy: header contains an alias or vice-versa. Guard against
  // very short aliases (<=2 chars like "x"/"ig") matching too eagerly by
  // requiring an exact hit for those (already handled in pass 1).
  for (const field of FIELD_PRIORITY) {
    if (map[field]) continue
    const aliases = COLUMN_ALIASES[field].map(normalizeHeader).filter((a) => a.length >= 3)
    const hit = norm.find(
      (h) => !used.has(h.raw) && aliases.some((a) => h.n.includes(a) || a.includes(h.n)),
    )
    if (hit) claim(field, hit.raw)
  }

  return map
}

function cell(row: Record<string, unknown>, header: string | undefined): string {
  if (!header) return ''
  const v = row[header]
  return v == null ? '' : String(v).trim()
}

interface DetectedSocials {
  channelUrl?: string
  instagram?: string
  linkedin?: string
  twitter?: string
  tiktok?: string
  website?: string
}

/** Scan every string value in a row for known social URLs, regardless of
 *  what the column is called. A safety net when URLs live in oddly-named
 *  columns the mapping didn't catch. */
export function detectSocialsFromRow(row: Record<string, unknown>): DetectedSocials {
  const result: DetectedSocials = {}
  for (const val of Object.values(row)) {
    if (typeof val !== 'string') continue
    const url = val.trim()
    if (!/^https?:\/\//i.test(url)) continue
    if (/youtube\.com\/(channel|c|user|@)/i.test(url) && !result.channelUrl) result.channelUrl = url
    else if (/instagram\.com\//i.test(url) && !result.instagram) result.instagram = url
    else if (/linkedin\.com\//i.test(url) && !result.linkedin) result.linkedin = url
    else if (/(twitter|x)\.com\//i.test(url) && !result.twitter) result.twitter = url
    else if (/tiktok\.com\//i.test(url) && !result.tiktok) result.tiktok = url
    else if (!result.website) result.website = url
  }
  return result
}

function extractChannelId(channelUrl: string): string {
  const m = channelUrl.match(/\/channel\/(UC[\w-]{22})/)
  return m ? m[1] : ''
}

export interface BuildResult {
  entries: OutreachEntry[]
  /** Rows skipped because they had no usable name — surfaced to the user
   *  so a partial import doesn't look like silent data loss. */
  skipped: number
}

/**
 * Turn spreadsheet rows into OutreachEntry records using a (possibly
 * user-edited) field→header mapping. Rows without a resolvable name are
 * skipped and counted, never fatal.
 */
export function buildEntriesFromMapping(
  rows: Record<string, unknown>[],
  mapping: Partial<Record<ImportField, string>>,
  nowMs: number,
): BuildResult {
  const entries: OutreachEntry[] = []
  let skipped = 0
  let i = 0

  for (const r of rows) {
    const get = (field: ImportField) => cell(r, mapping[field])

    // Name = mapped name (+ last name if split, e.g. HubSpot First/Last).
    const first = get('channelName')
    const last = get('lastName')
    const channelName = [first, last].filter(Boolean).join(' ').trim()
    if (!channelName) {
      skipped++
      continue
    }

    const detected = detectSocialsFromRow(r)
    const explicitUrl = get('channelUrl')
    const channelUrl = detected.channelUrl || (/youtube\.com/i.test(explicitUrl) ? explicitUrl : '')
    const ytChannelId = channelUrl ? extractChannelId(channelUrl) : ''

    const id = ytChannelId ? `${ytChannelId}-${nowMs + i}` : `manual-${nowMs + i}`
    const channelId = ytChannelId || id

    const reachedOutRaw = get('reachedOut').toLowerCase()
    const reachedOut = reachedOutRaw === 'yes' || reachedOutRaw === 'true' || reachedOutRaw === '1'

    const instagram = detected.instagram || get('instagram')
    const linkedin = detected.linkedin || get('linkedin')
    const twitter = detected.twitter || get('twitter')
    const tiktok = detected.tiktok || get('tiktok')
    const website = detected.website || get('website')

    entries.push({
      id,
      channelId,
      channelName,
      channelUrl: channelUrl || instagram || linkedin || twitter || tiktok || website || (explicitUrl && !/youtube\.com/i.test(explicitUrl) ? explicitUrl : '') || '',
      description: get('description'),
      email: get('email'),
      product: get('product'),
      favorite: false,
      reachedOut,
      medium: (get('medium') as OutreachEntry['medium']) || '',
      mediumOther: '',
      headerUsed: get('headerUsed'),
      status: ((): OutreachEntry['status'] => {
        const raw = get('status') as OutreachEntry['status']
        if (raw) return raw
        return reachedOut ? 'Open' : 'Not Outreached'
      })(),
      addedAt: nowMs + i,
      notes: '',
      followUpDate: '',
      dateReachedOut: '',
      touchpoints: '',
      responseDate: '',
      subscribers: '',
      avgViews: 0,
      fitScore: 0,
      linkedin,
      instagram,
      twitter,
      tiktok,
      website,
      contentNiche: '',
      phone: '',
      dealValue: '',
      contractSent: false,
      meetingScheduled: '',
    })
    i++
  }

  return { entries, skipped }
}

/** Fields surfaced in the manual-mapping UI, in display order. The rest
 *  (reachedOut/medium/headerUsed) still auto-map silently. */
export const MAP_FIELDS: { field: ImportField; label: string; required?: boolean }[] = [
  { field: 'channelName', label: 'Name', required: true },
  { field: 'lastName', label: 'Last name (if separate)' },
  { field: 'email', label: 'Email' },
  { field: 'channelUrl', label: 'Profile / channel URL' },
  { field: 'description', label: 'Notes / description' },
  { field: 'status', label: 'Status / stage' },
  { field: 'product', label: 'Product / service' },
  { field: 'instagram', label: 'Instagram' },
  { field: 'linkedin', label: 'LinkedIn' },
  { field: 'twitter', label: 'X / Twitter' },
  { field: 'tiktok', label: 'TikTok' },
  { field: 'website', label: 'Website' },
]
