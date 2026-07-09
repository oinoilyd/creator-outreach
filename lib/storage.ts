/**
 * Persistence layer.
 *
 * All read/write of user data goes through here. Backend: Supabase.
 * Public function signatures match the original localStorage-backed
 * version, so call sites in page.tsx don't need to change.
 *
 * On first sign-in, migrateLocalStorageToSupabase() seeds the user's
 * Supabase row with anything found in their browser's localStorage.
 */

import { createClient } from './supabase/client'
import { reportSaveFailure } from './error-log'
import type {
  OutreachEntry, Creator, ScoreWeights, GuidanceEntry,
  ColConfig, OutreachColConfig, PlatformId,
  ClientLifecycle, ClientMilestone, ClientActivityEvent,
  ClientRepeatLikelihood, EngagementStatus, ClientCollaborator,
} from './types'
import { DEFAULT_WEIGHTS } from './scoring'

const isClient = () => typeof window !== 'undefined'

async function userId(): Promise<string | null> {
  if (!isClient()) return null
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

// ── OutreachEntry mapping (camelCase ↔ snake_case) ─────────────────────────

function rowToOutreach(r: any): OutreachEntry {
  // Status is the source of truth for reachedOut; the boolean column is kept
  // for back-compat but always derived from status on read.
  const status: OutreachEntry['status'] =
    (r.status as OutreachEntry['status']) || (r.reached_out ? 'Open' : 'Not Outreached')
  const reachedOut = status !== 'Not Outreached'
  return {
    id: r.id,
    channelId: r.channel_id,
    channelName: r.channel_name,
    channelUrl: r.channel_url,
    description: r.description ?? '',
    email: r.email ?? '',
    product: r.product ?? '',
    favorite: !!r.favorite,
    reachedOut,
    medium: (r.medium ?? '') as OutreachEntry['medium'],
    mediumOther: r.medium_other ?? '',
    headerUsed: r.header_used ?? '',
    status,
    addedAt: Number(r.added_at) || 0,
    notes: r.notes ?? '',
    followUpDate: r.follow_up_date ?? '',
    dateReachedOut: r.date_reached_out ?? '',
    touchpoints: r.touchpoints ?? '',
    responseDate: r.response_date ?? '',
    subscribers: r.subscribers ?? '',
    avgViews: r.avg_views ?? 0,
    fitScore: r.fit_score ?? 0,
    linkedin: r.linkedin ?? '',
    instagram: r.instagram ?? '',
    twitter: r.twitter ?? '',
    tiktok: r.tiktok ?? '',
    website: r.website ?? '',
    contentNiche: r.content_niche ?? '',
    phone: r.phone ?? '',
    dealValue: r.deal_value ?? '',
    contractSent: !!r.contract_sent,
    meetingScheduled: r.meeting_scheduled ?? '',
    // Platform-specific metric columns (migration 0033). NULL when
    // not yet collected — UI renders em-dash. Scraping pipelines
    // for X / TikTok land in a follow-up commit.
    xFollowers: r.x_followers != null ? Number(r.x_followers) : null,
    xPosts: r.x_posts != null ? Number(r.x_posts) : null,
    tiktokFollowers: r.tiktok_followers != null ? Number(r.tiktok_followers) : null,
    tiktokLikes: r.tiktok_likes != null ? Number(r.tiktok_likes) : null,
    trackingId: r.tracking_id ?? undefined,
    unipileMessageId: r.unipile_message_id ?? null,
    unipileProviderId: r.unipile_provider_id ?? null,
    unipileThreadId: r.unipile_thread_id ?? null,
    unipileTrackingId: r.unipile_tracking_id ?? null,
    unipileSentAt: r.unipile_sent_at ? new Date(r.unipile_sent_at).getTime() : null,
    openCount: r.open_count ?? 0,
    lastOpenedAt: r.last_opened_at ? new Date(r.last_opened_at).getTime() : null,
    autoFollowup: !!r.auto_followup,
    lastAutoFollowupAt: r.last_auto_followup_at ? new Date(r.last_auto_followup_at).getTime() : null,
    followUpSetId: r.followup_set_id ?? null,
    // Active-client fields (migration 0028) — surface in the Active
    // Clients sub-tab when status='Successful'.
    clientBudgetAmount: r.client_budget_amount ?? null,
    clientBudgetCurrency: r.client_budget_currency ?? null,
    clientTimelineStart: r.client_timeline_start ?? null,
    clientTimelineEnd: r.client_timeline_end ?? null,
    clientScope: r.client_scope ?? null,
    clientContractUrl: r.client_contract_url ?? null,
    clientNotes: r.client_notes ?? null,
    // Active-client expansion (migration 0029)
    clientLifecycle: (r.client_lifecycle ?? null) as ClientLifecycle | null,
    clientMilestones: Array.isArray(r.client_milestones) ? (r.client_milestones as ClientMilestone[]) : [],
    clientActivity: Array.isArray(r.client_activity) ? (r.client_activity as ClientActivityEvent[]) : [],
    clientContractPath: r.client_contract_path ?? null,
    clientContractName: r.client_contract_name ?? null,
    clientContractSize: typeof r.client_contract_size === 'number' ? r.client_contract_size : null,
    clientContractUploadedAt: r.client_contract_uploaded_at ?? null,
    // Engagement wrap-up (migration 0030)
    clientFinalValue: r.client_final_value ?? null,
    clientCompletionDate: r.client_completion_date ?? null,
    clientRating: typeof r.client_rating === 'number' ? r.client_rating : null,
    clientRepeatLikelihood: (r.client_repeat_likelihood ?? null) as ClientRepeatLikelihood | null,
    clientTestimonial: r.client_testimonial ?? null,
    clientTestimonialPublic: !!r.client_testimonial_public,
    engagementStatus: (r.engagement_status ?? null) as EngagementStatus | null,
    // Collaborators (migration 0032)
    clientCollaborators: Array.isArray(r.client_collaborators)
      ? (r.client_collaborators as ClientCollaborator[])
      : [],
    // Team fields (migration 0035). Read-tolerant: undefined for
    // legacy rows or individual users whose DB hasn't been migrated.
    organizationId: r.organization_id ?? null,
    createdByUserId: r.created_by_user_id ?? null,
    assignedToUserId: r.assigned_to_user_id ?? null,
  }
}

/**
 * Convert an OutreachEntry into a DB row.
 *
 * @param newRowOrgContext  When the row is NEW (not yet in the DB), pass
 *   the user's org membership so we stamp organization_id + audit fields
 *   on insert. For EXISTING rows (upsert paths), pass null so we DON'T
 *   overwrite audit fields that may have been changed by an admin
 *   (e.g., assigned_to_user_id reassignment). Migration 0035 fields.
 */
function outreachToRow(
  e: OutreachEntry,
  uid: string,
  newRowOrgContext: { organizationId: string | null } | null = null,
) {
  return {
    id: e.id,
    user_id: uid,
    channel_id: e.channelId,
    channel_name: e.channelName,
    channel_url: e.channelUrl,
    description: e.description,
    email: e.email,
    product: e.product,
    favorite: e.favorite,
    reached_out: e.reachedOut,
    medium: e.medium,
    medium_other: e.mediumOther,
    header_used: e.headerUsed,
    status: e.status,
    notes: e.notes,
    follow_up_date: e.followUpDate,
    date_reached_out: e.dateReachedOut,
    touchpoints: e.touchpoints,
    response_date: e.responseDate,
    subscribers: e.subscribers,
    avg_views: e.avgViews,
    fit_score: e.fitScore,
    linkedin: e.linkedin,
    instagram: e.instagram,
    twitter: e.twitter,
    tiktok: e.tiktok,
    website: e.website,
    content_niche: e.contentNiche,
    phone: e.phone,
    deal_value: e.dealValue,
    contract_sent: e.contractSent,
    meeting_scheduled: e.meetingScheduled,
    // Platform-specific metrics (migration 0033). Pass null when
    // not collected so Postgres doesn't reject the row.
    x_followers: e.xFollowers ?? null,
    x_posts: e.xPosts ?? null,
    tiktok_followers: e.tiktokFollowers ?? null,
    tiktok_likes: e.tiktokLikes ?? null,
    added_at: e.addedAt,
    tracking_id: e.trackingId ?? null,
    unipile_message_id: e.unipileMessageId ?? null,
    unipile_provider_id: e.unipileProviderId ?? null,
    unipile_thread_id: e.unipileThreadId ?? null,
    unipile_tracking_id: e.unipileTrackingId ?? null,
    unipile_sent_at: e.unipileSentAt ? new Date(e.unipileSentAt).toISOString() : null,
    open_count: e.openCount ?? 0,
    last_opened_at: e.lastOpenedAt ? new Date(e.lastOpenedAt).toISOString() : null,
    auto_followup: !!e.autoFollowup,
    last_auto_followup_at: e.lastAutoFollowupAt ? new Date(e.lastAutoFollowupAt).toISOString() : null,
    // followup_set_id (migration 0053) — which follow-up template set this
    // lead uses. NULL = the user's default set. Written here like
    // engagement_status below; needs 0053 applied.
    followup_set_id: e.followUpSetId ?? null,
    // engagement_status (migration 0030) IS written here so the
    // pending-confirmation pill's Confirm/Deny actions persist through
    // the normal outreach save path. NULL is the default for every
    // legacy row and the JSON serialization is safe even when the
    // column hasn't been applied yet (Postgres ignores NULLs in the
    // upsert payload — Supabase will error if the COLUMN is missing
    // but that's the case migration 0030 explicitly fixes).
    engagement_status: e.engagementStatus ?? null,
    // Team membership fields (migration 0035) — only stamped for NEW
    // rows so we don't clobber admin reassignments on subsequent
    // upserts. organization_id is always set when context is provided
    // so an admin saving in the same org keeps the boundary intact.
    // For non-team users (org context null), all three stay null and
    // RLS falls back to the user_id check.
    ...(newRowOrgContext
      ? {
          organization_id: newRowOrgContext.organizationId,
          created_by_user_id: uid,
          assigned_to_user_id: uid,
        }
      : {}),
    // NB: client_* fields are NOT written here on purpose. The general
    // outreach save path should stay migration-tolerant for those
    // (0028/0029 may not be applied on every env). Active-client edits
    // use a dedicated updateActiveClientFields() function below that
    // writes only the client_* columns + handles missing-column
    // errors gracefully.
  }
}

/**
 * Fetch the current user's organization membership (if any), for
 * stamping organization_id on new rows. Returns null for individual
 * users or when migration 0035 hasn't been applied.
 *
 * Single client call, cached at module level so repeated saves within
 * the same session don't re-query.
 */
let cachedOrgMembership: { uid: string; organizationId: string | null } | null = null
async function getOwnOrgMembership(uid: string): Promise<{ organizationId: string | null }> {
  if (cachedOrgMembership && cachedOrgMembership.uid === uid) {
    return { organizationId: cachedOrgMembership.organizationId }
  }
  const supabase = createClient()
  try {
    const { data, error } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', uid)
      .maybeSingle()
    if (error) {
      // Likely "relation does not exist" before 0035 is applied.
      // Treat as individual user.
      cachedOrgMembership = { uid, organizationId: null }
      return { organizationId: null }
    }
    const orgId = (data as { organization_id: string } | null)?.organization_id ?? null
    cachedOrgMembership = { uid, organizationId: orgId }
    return { organizationId: orgId }
  } catch {
    cachedOrgMembership = { uid, organizationId: null }
    return { organizationId: null }
  }
}

/**
 * Patch the active-client metadata on an outreach entry.
 *
 * Separated from the general outreachToRow path because these columns
 * were added in migration 0028 and may not exist on environments that
 * haven't applied it yet. The function writes ONLY the client_* fields
 * — leaving everything else untouched — and tolerates a missing-column
 * error by surfacing a clean message back to the caller instead of
 * cascading the failure.
 *
 * Returns { ok, error } so the modal can surface inline feedback.
 */
export interface ActiveClientPatch {
  clientBudgetAmount?: number | null
  clientBudgetCurrency?: string | null
  clientTimelineStart?: string | null
  clientTimelineEnd?: string | null
  clientScope?: string | null
  clientContractUrl?: string | null
  clientNotes?: string | null
  // 0029 expansion
  clientLifecycle?: ClientLifecycle | null
  clientMilestones?: ClientMilestone[]
  clientActivity?: ClientActivityEvent[]
  clientContractPath?: string | null
  clientContractName?: string | null
  clientContractSize?: number | null
  clientContractUploadedAt?: string | null
  // 0030 wrap-up
  clientFinalValue?: number | null
  clientCompletionDate?: string | null
  clientRating?: number | null
  clientRepeatLikelihood?: ClientRepeatLikelihood | null
  clientTestimonial?: string | null
  clientTestimonialPublic?: boolean
  engagementStatus?: EngagementStatus | null
  // 0032 collaborators
  clientCollaborators?: ClientCollaborator[]
}

export async function updateActiveClientFields(
  entryId: string,
  patch: ActiveClientPatch,
): Promise<{ ok: boolean; error?: string }> {
  const uid = await userId()
  if (!uid) return { ok: false, error: 'Not signed in.' }
  const supabase = createClient()

  // Build the DB-shaped update — only include keys the caller explicitly
  // provided so partial updates don't accidentally clear other columns.
  const dbUpdate: Record<string, string | number | null> = {}
  if ('clientBudgetAmount' in patch) {
    dbUpdate.client_budget_amount = typeof patch.clientBudgetAmount === 'number' ? patch.clientBudgetAmount : null
  }
  if ('clientBudgetCurrency' in patch) {
    dbUpdate.client_budget_currency = patch.clientBudgetCurrency || null
  }
  if ('clientTimelineStart' in patch) {
    dbUpdate.client_timeline_start = patch.clientTimelineStart || null
  }
  if ('clientTimelineEnd' in patch) {
    dbUpdate.client_timeline_end = patch.clientTimelineEnd || null
  }
  if ('clientScope' in patch) {
    dbUpdate.client_scope = patch.clientScope || null
  }
  if ('clientContractUrl' in patch) {
    dbUpdate.client_contract_url = patch.clientContractUrl || null
  }
  if ('clientNotes' in patch) {
    dbUpdate.client_notes = patch.clientNotes || null
  }
  // 0029 expansion fields — JSONB columns + contract-file metadata.
  // Cast through `unknown` because the Record signature above is keyed
  // for string/number/null primitives; JSONB and arrays need a wider
  // type. supabase-js accepts the raw shape.
  if ('clientLifecycle' in patch) {
    ;(dbUpdate as Record<string, unknown>).client_lifecycle = patch.clientLifecycle ?? null
  }
  if ('clientMilestones' in patch) {
    ;(dbUpdate as Record<string, unknown>).client_milestones = patch.clientMilestones ?? []
  }
  if ('clientActivity' in patch) {
    ;(dbUpdate as Record<string, unknown>).client_activity = patch.clientActivity ?? []
  }
  if ('clientContractPath' in patch) {
    dbUpdate.client_contract_path = patch.clientContractPath || null
  }
  if ('clientContractName' in patch) {
    dbUpdate.client_contract_name = patch.clientContractName || null
  }
  if ('clientContractSize' in patch) {
    dbUpdate.client_contract_size = typeof patch.clientContractSize === 'number' ? patch.clientContractSize : null
  }
  if ('clientContractUploadedAt' in patch) {
    dbUpdate.client_contract_uploaded_at = patch.clientContractUploadedAt || null
  }
  // 0030 wrap-up fields
  if ('clientFinalValue' in patch) {
    dbUpdate.client_final_value = typeof patch.clientFinalValue === 'number' ? patch.clientFinalValue : null
  }
  if ('clientCompletionDate' in patch) {
    dbUpdate.client_completion_date = patch.clientCompletionDate || null
  }
  if ('clientRating' in patch) {
    dbUpdate.client_rating = typeof patch.clientRating === 'number' ? patch.clientRating : null
  }
  if ('clientRepeatLikelihood' in patch) {
    dbUpdate.client_repeat_likelihood = patch.clientRepeatLikelihood ?? null
  }
  if ('clientTestimonial' in patch) {
    dbUpdate.client_testimonial = patch.clientTestimonial || null
  }
  if ('clientTestimonialPublic' in patch) {
    ;(dbUpdate as Record<string, unknown>).client_testimonial_public = !!patch.clientTestimonialPublic
  }
  if ('engagementStatus' in patch) {
    dbUpdate.engagement_status = patch.engagementStatus ?? null
  }
  if ('clientCollaborators' in patch) {
    // JSONB column — cast through unknown because dbUpdate's signature
    // is keyed for primitives only. Supabase-js accepts the raw shape.
    ;(dbUpdate as Record<string, unknown>).client_collaborators = patch.clientCollaborators ?? []
  }

  const { error } = await supabase
    .from('outreach_entries')
    .update(dbUpdate)
    .eq('id', entryId)
    .eq('user_id', uid)
  if (error) {
    // Schema-error detection — three known variants depending on
    // whether the column doesn't exist at all OR Supabase's PostgREST
    // schema cache is stale because migration just ran. Both surface
    // to the user as "the migration hasn't been applied yet."
    const isSchemaError =
      error.code === '42703'
      || /column .* does not exist/i.test(error.message)
      || /could not find the .* column/i.test(error.message)
      || /schema cache/i.test(error.message)
    if (isSchemaError) {
      return {
        ok: false,
        error: 'SCHEMA_MISSING',
      }
    }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

// ── Engagement wrap-up (migration 0030) ────────────────────────────
//
// One atomic op that does everything when an engagement is marked
// Completed via the wrap-up modal:
//
//   1. Patches the original entry — lifecycle='completed', final
//      value, completion date, rating, repeat likelihood,
//      testimonial. Appends a structured snapshot (contract,
//      testimonial, referrals, deliverables, wrap-up note) to
//      client_notes so the historical record survives even if the
//      signed contract URL eventually expires.
//   2. Appends 1-2 activity events to the engagement's timeline.
//   3. If repeat=definitely OR repeat=likely → creates a NEW
//      outreach_entries row for the SAME channel as a follow-on
//      engagement. 'likely' rows get engagement_status='pending_
//      confirmation' so the UI prompts the user to confirm/deny.

export interface WrapUpPayload {
  finalValue: number | null
  completionDate: string                 // YYYY-MM-DD
  rating: number                         // 1-5
  repeatLikelihood: ClientRepeatLikelihood
  testimonial?: string
  testimonialPublic?: boolean
  referrals?: string                     // free text
  deliverableUrls?: string               // free text, one per line
  wrapUpNote?: string                    // free text
}

export interface WrapUpResult {
  ok: boolean
  error?: string
  newEntryId?: string                    // populated when repeat created a follow-on
}

const REPEAT_FOLLOWUP_DAYS: Record<ClientRepeatLikelihood, number | null> = {
  definitely: 30,
  likely:     60,
  maybe:      120,
  no:         null,
}

/**
 * Format the wrap-up payload + existing engagement context into a
 * single prepend block for client_notes. Existing notes (if any) are
 * preserved underneath.
 */
function buildWrapUpNotesBlock(payload: WrapUpPayload, entry: {
  clientContractName?: string | null
  clientContractUrl?: string | null
  clientContractUploadedAt?: string | null
  clientNotes?: string | null
}): string {
  const lines: string[] = []
  const stamp = new Date().toISOString().slice(0, 10)
  lines.push(`[Wrap-up · ${stamp}]`)
  // Contract snapshot — what was attached at close, surviving the
  // 7-day signed-URL expiry on the storage object.
  if (entry.clientContractName) {
    const dt = entry.clientContractUploadedAt
      ? new Date(entry.clientContractUploadedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : '?'
    lines.push(`Contract on file: ${entry.clientContractName} (uploaded ${dt})`)
  }
  if (entry.clientContractUrl) {
    lines.push(`External contract link: ${entry.clientContractUrl}`)
  }
  if (payload.testimonial?.trim()) {
    const publicTag = payload.testimonialPublic ? ' [OK to use publicly]' : ' [private — internal only]'
    lines.push(`Testimonial${publicTag}: ${payload.testimonial.trim()}`)
  }
  if (payload.referrals?.trim()) {
    lines.push(`Referrals: ${payload.referrals.trim()}`)
  }
  if (payload.deliverableUrls?.trim()) {
    lines.push(`Deliverables:`)
    for (const url of payload.deliverableUrls.split('\n').map(s => s.trim()).filter(Boolean)) {
      lines.push(`  · ${url}`)
    }
  }
  if (payload.wrapUpNote?.trim()) {
    lines.push(`Wrap-up note: ${payload.wrapUpNote.trim()}`)
  }
  const block = lines.join('\n')
  const existing = (entry.clientNotes || '').trim()
  return existing ? `${block}\n\n— Previous notes —\n${existing}` : block
}

/**
 * Atomic wrap-up. Returns the original entry id + (optionally) the
 * newly-created follow-on row id.
 */
export async function wrapUpEngagement(
  entry: OutreachEntry,
  payload: WrapUpPayload,
): Promise<WrapUpResult> {
  const uid = await userId()
  if (!uid) return { ok: false, error: 'Not signed in.' }
  const supabase = createClient()

  // 1) Build the activity event(s) we'll append to the engagement's
  //    timeline. Single combined event keeps the timeline readable.
  const ratingDisplay = '★'.repeat(payload.rating) + '☆'.repeat(5 - payload.rating)
  const valueDisplay = payload.finalValue != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: entry.clientBudgetCurrency || 'USD', maximumFractionDigits: 0 }).format(payload.finalValue)
    : '—'
  const summary = `Engagement completed: ${valueDisplay} · ${ratingDisplay} · repeat ${payload.repeatLikelihood}`
  const newActivity = [
    ...(entry.clientActivity || []),
    { ts: Date.now(), type: 'lifecycle' as const, summary: 'Marked completed' },
    { ts: Date.now() + 1, type: 'lifecycle' as const, summary },
  ]

  // 2) Build the patch.
  const composedNotes = buildWrapUpNotesBlock(payload, entry)
  const patch: ActiveClientPatch = {
    clientLifecycle: 'completed',
    clientFinalValue: payload.finalValue,
    clientCompletionDate: payload.completionDate,
    clientRating: payload.rating,
    clientRepeatLikelihood: payload.repeatLikelihood,
    clientTestimonial: payload.testimonial?.trim() || null,
    clientTestimonialPublic: !!payload.testimonialPublic,
    clientNotes: composedNotes,
    clientActivity: newActivity,
  }

  // 3) Apply the patch on the original entry.
  const patchResult = await updateActiveClientFields(entry.id, patch)
  if (!patchResult.ok) return patchResult

  // 4) For repeat=definitely / likely, create a follow-on entry on
  //    the SAME channel. Skip for maybe / no — the user can manually
  //    re-engage later via the normal outreach flow.
  let newEntryId: string | undefined
  if (payload.repeatLikelihood === 'definitely' || payload.repeatLikelihood === 'likely') {
    newEntryId = await createFollowOnEngagement(entry, payload)
  }

  return { ok: true, newEntryId }
}

/**
 * Insert a new outreach_entries row for a repeat engagement. The new
 * row carries the same channel info (channelId, channelName, etc.)
 * but resets the engagement-specific state. For Likely repeats we
 * set engagement_status='pending_confirmation' so the UI renders a
 * confirm/deny pill.
 */
async function createFollowOnEngagement(
  original: OutreachEntry,
  payload: WrapUpPayload,
): Promise<string | undefined> {
  const uid = await userId()
  if (!uid) return undefined
  const supabase = createClient()

  // Follow-up date = today + N days based on likelihood. For 'no'
  // we wouldn't get here, but be defensive about NULL.
  const days = REPEAT_FOLLOWUP_DAYS[payload.repeatLikelihood] ?? 30
  const followUpDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const newId = `${original.channelId}-${Date.now()}`

  // Compose notes for the follow-on so the user knows where it came
  // from. Includes a back-pointer to the prior engagement id.
  const valueDisplay = payload.finalValue != null
    ? `$${payload.finalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : 'unknown value'
  const ratingDisplay = '★'.repeat(payload.rating) + '☆'.repeat(5 - payload.rating)
  const notes =
    `Repeat engagement following completed deal (${valueDisplay} · ${ratingDisplay}). ` +
    `Original engagement id: ${original.id}. ` +
    `Auto-created via wrap-up flow on ${new Date().toISOString().slice(0, 10)}.`

  const row = {
    id: newId,
    user_id: uid,
    channel_id: original.channelId,
    channel_name: original.channelName,
    channel_url: original.channelUrl,
    description: original.description ?? '',
    email: original.email ?? '',
    product: original.product ?? '',
    favorite: false,
    reached_out: false,
    medium: '',
    medium_other: '',
    header_used: '',
    status: 'Not Outreached',
    notes,
    follow_up_date: followUpDate,
    date_reached_out: '',
    touchpoints: '',
    response_date: '',
    subscribers: original.subscribers ?? '',
    avg_views: original.avgViews ?? 0,
    fit_score: original.fitScore ?? 0,
    linkedin: original.linkedin ?? '',
    instagram: original.instagram ?? '',
    twitter: original.twitter ?? '',
    tiktok: original.tiktok ?? '',
    website: original.website ?? '',
    content_niche: original.contentNiche ?? '',
    phone: original.phone ?? '',
    deal_value: '',
    contract_sent: false,
    meeting_scheduled: '',
    added_at: Date.now(),
    tracking_id: Math.random().toString(36).slice(2, 10),
    // The new sub-state — Likely repeats render a confirm pill,
    // Definitely repeats just enter the normal pipeline.
    engagement_status: payload.repeatLikelihood === 'likely' ? 'pending_confirmation' : null,
  }

  // Stamp team fields (migration 0035) for NEW rows so the repeat
  // engagement inherits the org boundary + audit fields.
  const orgCtx = await getOwnOrgMembership(uid)
  const rowWithOrg = orgCtx.organizationId
    ? {
        ...row,
        organization_id: orgCtx.organizationId,
        created_by_user_id: uid,
        assigned_to_user_id: uid,
      }
    : row

  const { error } = await supabase
    .from('outreach_entries')
    .insert(rowWithOrg)
  if (error) {
    // Audit 2026-06-10: this was console-only. The wrap-up still
    // returns ok:true, so the user thinks the repeat engagement was
    // created when it silently wasn't. Surface to admin so the drop
    // is visible.
    console.error('[wrapUpEngagement] follow-on insert failed:', error.message)
    void reportSaveFailure({ functionName: 'createFollowOnEngagement', error, payloadKeys: Object.keys(rowWithOrg) })
    return undefined
  }
  return newId
}

// ── Manual-add active client ───────────────────────────────────────
//
// Direct entry path used when the user signed a client off-platform
// (existing relationship, referral, etc.) and wants to track the
// engagement without faking an outreach loop. Creates an
// outreach_entries row with status='Successful' AND lifecycle='active'
// so it shows up immediately in the Active Clients view.

export interface ManualActiveClientInput {
  channelName: string
  channelUrl: string
  email: string
  budget: number | null
  currency: string
  timelineStart: string
  timelineEnd: string
  scope: string
  notes: string
}

export interface ManualActiveClientResult {
  ok: boolean
  error?: string
  newEntryId?: string
}

export async function createManualActiveClient(
  input: ManualActiveClientInput,
): Promise<ManualActiveClientResult> {
  const uid = await userId()
  if (!uid) return { ok: false, error: 'Not signed in.' }
  if (!input.channelName.trim()) return { ok: false, error: 'Channel name is required.' }

  const supabase = createClient()

  // Synthesize a channel id so the row has a unique identifier even
  // though we never fetched it from YouTube. Prefix 'manual-' so we
  // can distinguish these from search-sourced entries later if we
  // need to.
  const ts = Date.now()
  const slug = input.channelName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'client'
  const channelId = `manual-${slug}-${ts}`
  const newId = `${channelId}-${ts}`
  const trackingId = Math.random().toString(36).slice(2, 10)

  const row = {
    id: newId,
    user_id: uid,
    channel_id: channelId,
    channel_name: input.channelName.trim(),
    channel_url: input.channelUrl.trim() || '',
    description: '',
    email: input.email.trim() || '',
    product: '',
    favorite: false,
    reached_out: true,
    medium: '',
    medium_other: '',
    header_used: '',
    status: 'Successful',
    notes: '',
    follow_up_date: '',
    date_reached_out: '',
    touchpoints: '',
    response_date: '',
    subscribers: '',
    avg_views: 0,
    fit_score: 0,
    linkedin: '',
    instagram: '',
    twitter: '',
    tiktok: '',
    website: '',
    content_niche: '',
    phone: '',
    deal_value: '',
    contract_sent: false,
    meeting_scheduled: '',
    added_at: ts,
    tracking_id: trackingId,
    engagement_status: null,
    // Active-client fields — set from the manual-add form.
    client_lifecycle: 'active',
    client_budget_amount: typeof input.budget === 'number' ? input.budget : null,
    client_budget_currency: input.currency || 'USD',
    client_timeline_start: input.timelineStart || null,
    client_timeline_end: input.timelineEnd || null,
    client_scope: input.scope || null,
    client_notes: input.notes || null,
    // Activity seed — surfaces in the timeline so the user has
    // context for where this engagement came from.
    client_activity: [
      {
        ts: Date.now(),
        type: 'created',
        summary: 'Engagement created manually (off-platform client)',
      },
    ],
  }

  // Stamp team fields (migration 0035) for NEW rows so the manually-
  // added active client respects the org boundary.
  const orgCtx = await getOwnOrgMembership(uid)
  const rowWithOrg = orgCtx.organizationId
    ? {
        ...row,
        organization_id: orgCtx.organizationId,
        created_by_user_id: uid,
        assigned_to_user_id: uid,
      }
    : row

  const { error } = await supabase
    .from('outreach_entries')
    .insert(rowWithOrg)
  if (error) {
    // Schema-missing detection — both 0028/0029/0030 columns could
    // trigger this if any migration hasn't been applied. Return the
    // sentinel so the UI shows the same yellow banner as other
    // schema errors.
    const isSchemaError =
      error.code === '42703'
      || /column .* does not exist/i.test(error.message)
      || /could not find the .* column/i.test(error.message)
      || /schema cache/i.test(error.message)
    if (isSchemaError) return { ok: false, error: 'SCHEMA_MISSING' }
    return { ok: false, error: error.message }
  }
  return { ok: true, newEntryId: newId }
}

// ── Contract file upload (Supabase Storage) ────────────────────────
//
// Uploads to bucket `contracts`, path `<user_id>/<entry_id>/<slug>`.
// RLS on storage.objects (see migration 0029) restricts read/write
// to the owner. Returns the storage path + signed URL on success.

const CONTRACTS_BUCKET = 'contracts'
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7  // 7 days

/** Slug a filename for safe storage paths. Preserves the extension. */
function slugFilename(name: string): string {
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  const safe = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'contract'
  return `${safe}${ext.toLowerCase()}`
}

export interface UploadContractResult {
  ok: boolean
  path?: string
  name?: string
  size?: number
  signedUrl?: string
  uploadedAt?: string
  error?: string
}

/**
 * Upload a contract file to the user's `contracts/` folder and return
 * a 7-day signed URL for viewing. Does NOT update the outreach row —
 * the caller patches client_contract_* fields separately so the
 * activity log can capture the change in one round-trip.
 *
 * 30s hard timeout so the UI can never hang in "Uploading…" forever.
 * Triggered when the bucket doesn't exist, the network blips, or the
 * file is so large Supabase decides to chunk it slowly.
 */
const UPLOAD_TIMEOUT_MS = 30_000

export async function uploadContractFile(
  entryId: string,
  file: File,
): Promise<UploadContractResult> {
  const uid = await userId()
  if (!uid) return { ok: false, error: 'Not signed in.' }
  const supabase = createClient()

  const safeName = slugFilename(file.name)
  const ts = Date.now()
  const path = `${uid}/${entryId}/${ts}-${safeName}`

  // Race the upload against a timeout. If the timeout wins we surface
  // a clean error instead of leaving the UI stuck on "Uploading…".
  const uploadPromise = supabase.storage
    .from(CONTRACTS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })
  let upErr: { message: string } | null = null
  try {
    const result = await Promise.race([
      uploadPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('upload-timeout')), UPLOAD_TIMEOUT_MS),
      ),
    ])
    upErr = result.error
  } catch (e) {
    const msg = (e as Error).message || String(e)
    if (msg === 'upload-timeout') {
      return {
        ok: false,
        error: 'Upload timed out after 30s. The contracts bucket may not exist yet — run migration 0029 in Supabase, then retry.',
      }
    }
    return { ok: false, error: msg }
  }
  if (upErr) {
    // Schema/bucket-missing detection — multiple variants depending on
    // which Supabase layer reports it (storage API vs PostgREST).
    const m = upErr.message || ''
    if (
      /bucket .* not found/i.test(m)
      || /not exist/i.test(m)
      || /no such bucket/i.test(m)
      || /could not find .* bucket/i.test(m)
    ) {
      return {
        ok: false,
        error: 'Contracts bucket not yet available. Run migration 0029 in Supabase, then retry.',
      }
    }
    return { ok: false, error: upErr.message }
  }

  const { data: signed, error: sigErr } = await supabase.storage
    .from(CONTRACTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (sigErr) {
    // Upload succeeded but signing failed — return the path so the
    // row can still record the upload; UI will retry signing on view.
    return { ok: true, path, name: file.name, size: file.size, uploadedAt: new Date().toISOString() }
  }

  return {
    ok: true,
    path,
    name: file.name,
    size: file.size,
    signedUrl: signed?.signedUrl,
    uploadedAt: new Date().toISOString(),
  }
}

/**
 * Refresh a signed URL for an already-uploaded contract. Called from
 * the detail modal on open so previously-uploaded files render with
 * a working preview link.
 */
export async function getContractSignedUrl(path: string): Promise<string | null> {
  if (!path) return null
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from(CONTRACTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error) return null
  return data?.signedUrl ?? null
}

/** Delete a contract file from storage. Best-effort — the row update
 *  proceeds even if the storage delete fails (e.g., file already gone). */
export async function removeContractFile(path: string): Promise<{ ok: boolean; error?: string }> {
  if (!path) return { ok: true }
  const supabase = createClient()
  const { error } = await supabase.storage.from(CONTRACTS_BUCKET).remove([path])
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Outreach entries ────────────────────────────────────────────────────────

export async function getOutreach(): Promise<OutreachEntry[]> {
  const uid = await userId()
  if (!uid) {
    console.warn('[getOutreach] no user; returning []')
    return []
  }
  const supabase = createClient()
  const { data, error } = await supabase
    .from('outreach_entries')
    .select('*')
    .order('added_at', { ascending: false })
  if (error) console.error('[getOutreach] read failed:', error.message)
  console.log(`[getOutreach] returned ${data?.length ?? 0} rows`)
  return (data ?? []).map(rowToOutreach)
}

export async function saveOutreach(entries: OutreachEntry[]): Promise<void> {
  const uid = await userId()
  if (!uid) {
    console.warn('[saveOutreach] no user; skipping')
    return
  }
  const supabase = createClient()
  const newIds = new Set(entries.map(e => e.id))

  // Read the user's existing rows so we can diff against the
  // requested new state.
  const { data: existing } = await supabase
    .from('outreach_entries')
    .select('id')
    .eq('user_id', uid)
  const existingCount = (existing ?? []).length
  const toDelete = (existing ?? []).filter(r => !newIds.has(r.id)).map(r => r.id)

  // ── DATA LOSS SAFEGUARD (2026-05-21, post-Ryan-incident) ────────
  //
  // The previous version of this function would obediently delete
  // every existing row not present in `entries`. That's fine in
  // theory but catastrophic in practice:
  //
  //   1. App loads → getOutreach() hits a transient error (e.g., a
  //      schema-cache lag right after a migration), returns []
  //   2. setOutreach([]) — local state is now empty
  //   3. User does ANY save action (favorite a row, add new lead,
  //      change status) → saveOutreach([new]) or saveOutreach([])
  //   4. Diff says "delete everything that was there before" →
  //      wipes their entire outreach list
  //
  // This safeguard refuses suspicious mass-deletions:
  //   • Block if requested entries is EMPTY but DB has >= 5 rows.
  //     (Empty saves are valid only when starting from scratch.)
  //   • Block if the delete would remove > 50% of existing rows
  //     AND > 10 rows. (Real user-driven deletes rarely batch-delete
  //     more than half their data at once.)
  //
  // Errors instead of silently swallowing so we see the issue in
  // logs and the upsert can still proceed for any new rows.
  if (toDelete.length > 0) {
    const requestedEmpty = entries.length === 0
    const wouldDeleteHalf = existingCount > 10
      && toDelete.length / existingCount > 0.5
    const suspicious =
      (requestedEmpty && existingCount >= 5)
      || wouldDeleteHalf
    if (suspicious) {
      console.error(
        `[saveOutreach] REFUSED bulk delete — user=${uid} ` +
        `existing=${existingCount} requested=${entries.length} ` +
        `wouldDelete=${toDelete.length}. Likely a load failure ` +
        `or stale local state. Skipping delete; upsert continues.`,
      )
      // Continue without the delete — preserves existing data, just
      // upserts whatever the caller actually wanted to write.
    } else {
      const { error: delErr } = await supabase.from('outreach_entries').delete().in('id', toDelete)
      if (delErr) {
        console.error('[saveOutreach] delete failed:', delErr.message)
        void reportSaveFailure({ functionName: 'saveOutreach_delete', error: delErr, payloadKeys: ['id'] })
      }
    }
  }

  // Upsert the rest — always safe (it only writes, never deletes).
  if (entries.length > 0) {
    // Resolve org membership once so we stamp organization_id +
    // created_by + assigned_to on NEW rows (entries with IDs not in
    // `existing`). Existing rows keep their audit fields untouched,
    // preserving any admin re-assignment.
    const orgCtx = await getOwnOrgMembership(uid)
    const existingIds = new Set((existing ?? []).map(r => r.id))
    const rows = entries.map(e => {
      const isNew = !existingIds.has(e.id)
      return outreachToRow(
        e,
        uid,
        isNew ? { organizationId: orgCtx.organizationId } : null,
      )
    })
    const { error: upErr } = await supabase
      .from('outreach_entries')
      .upsert(rows, { onConflict: 'id' })
    if (upErr) {
      console.error('[saveOutreach] upsert failed:', upErr.message, upErr)
      // Replaces the silent-failure pattern that caused the
      // 2026-05-23 → 2026-06-08 data-loss window. reportSaveFailure
      // logs to client_error_log (admin sees in /admin Error Inbox)
      // AND fires a blocking alert if the current user IS admin.
      // Regular users see nothing scary — but the error is captured.
      void reportSaveFailure({
        functionName: 'saveOutreach',
        error: upErr,
        payloadKeys: rows[0] ? Object.keys(rows[0]) : [],
      })
    }
  }
}

/**
 * Run a Supabase write, retrying transient failures (2 retries with a
 * short backoff) before reporting the last error. Added 2026-07-09 with
 * the delta-write refactor: the old full-snapshot saves got incidental
 * crash-recovery for free — ANY later save re-uploaded the whole list,
 * sweeping a previously-failed row's change to the DB. Delta writes only
 * ever re-send a row when THAT row changes again, so a failed write must
 * retry itself instead of waiting to be rescued. The callback builds a
 * fresh request each attempt (a Supabase builder is single-use).
 */
async function withWriteRetry<E extends { message: string }>(
  write: () => PromiseLike<{ error: E | null }>,
): Promise<{ error: E | null }> {
  let last: E | null = null
  for (let attempt = 0; attempt <= 2; attempt++) {
    if (attempt > 0) await new Promise(res => setTimeout(res, 400 * attempt))
    const { error } = await write()
    last = error
    if (!last) break
  }
  return { error: last }
}

/**
 * Delta-persist: upsert EXACTLY these rows — nothing else is read,
 * written, or deleted. Added 2026-07-09 because every single-row change
 * (status flip, follow-up log, one add) went through the full-snapshot
 * saveOutreach() above, re-uploading the user's entire board — the main
 * source of click lag on large lists.
 *
 * Write semantics match saveOutreach() for the touched rows:
 *   • Ids missing from the DB are stamped with org/audit fields exactly
 *     like saveOutreach's isNew branch; ids that exist keep their audit
 *     fields untouched (outreachToRow omits them, and PostgREST upserts
 *     only the columns present). New-shape and existing-shape rows are
 *     upserted in SEPARATE calls so a batch never mixes key sets —
 *     PostgREST derives the column list per request, and a mixed batch
 *     could null the org fields on the existing rows.
 *   • The existence check is scoped `.in('id', ids)` with NO user_id
 *     filter — deliberately wider than saveOutreach's `.eq('user_id')`
 *     read: a teammate-owned row an org admin edits is correctly seen
 *     as existing (not re-stamped with the admin's audit fields).
 *   • If the existence read fails, all touched rows are treated as new
 *     — the same fallback saveOutreach has always had (its ignored read
 *     error yields an empty existing-set).
 *   • Failures retry (withWriteRetry) then log via reportSaveFailure
 *     with the affected row names so the error inbox is actionable.
 *
 * Inherently safer than the snapshot path: no diff, so no delete arm —
 * a stale or empty local state can never translate into row deletion.
 */
export async function upsertOutreachRows(entries: OutreachEntry[]): Promise<void> {
  if (entries.length === 0) return
  const uid = await userId()
  if (!uid) {
    console.warn('[upsertOutreachRows] no user; skipping')
    return
  }
  const supabase = createClient()
  const { data: existing } = await supabase
    .from('outreach_entries')
    .select('id')
    .in('id', entries.map(e => e.id))
  const existingIds = new Set((existing ?? []).map(r => r.id))
  const newEntries = entries.filter(e => !existingIds.has(e.id))
  const existingEntries = entries.filter(e => existingIds.has(e.id))
  const orgCtx = newEntries.length > 0 ? await getOwnOrgMembership(uid) : null
  const groups = [
    existingEntries.map(e => ({ row: outreachToRow(e, uid, null), name: e.channelName || e.id })),
    newEntries.map(e => ({ row: outreachToRow(e, uid, { organizationId: orgCtx?.organizationId ?? null }), name: e.channelName || e.id })),
  ]
  for (const group of groups) {
    if (group.length === 0) continue
    const rows = group.map(g => g.row)
    const { error: upErr } = await withWriteRetry(() =>
      supabase.from('outreach_entries').upsert(rows, { onConflict: 'id' }),
    )
    if (upErr) {
      console.error('[upsertOutreachRows] upsert failed:', upErr.message, upErr)
      void reportSaveFailure({
        functionName: 'upsertOutreachRows',
        error: upErr,
        payloadKeys: rows[0] ? Object.keys(rows[0]) : [],
        rowIds: group.map(g => g.name),
      })
    }
  }
}

/**
 * Delta-delete: remove EXACTLY these row ids. Callers must pass ids the
 * user explicitly acted on (clicked remove) — NEVER a diff against local
 * state. That's the whole safety model: saveOutreach's mass-delete guard
 * exists because its deletes are diff-derived and a failed load could
 * fabricate a wipe; explicit ids can't fabricate anything.
 *
 * Same predicate as saveOutreach's delete arm (id only, no user_id
 * filter): ids are globally unique, RLS scopes reachability, and org
 * admins must stay able to delete teammates' rows.
 */
export async function deleteOutreachRows(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const uid = await userId()
  if (!uid) {
    console.warn('[deleteOutreachRows] no user; skipping')
    return
  }
  const supabase = createClient()
  const { error } = await withWriteRetry(() =>
    supabase.from('outreach_entries').delete().in('id', ids),
  )
  if (error) {
    console.error('[deleteOutreachRows] delete failed:', error.message)
    void reportSaveFailure({ functionName: 'deleteOutreachRows', error, payloadKeys: ['id'], rowIds: ids })
  }
}

// ── Dismissed creators ──────────────────────────────────────────────────────

export async function getDismissed(): Promise<Creator[]> {
  const uid = await userId()
  if (!uid) {
    console.warn('[getDismissed] no user; returning []')
    return []
  }
  const supabase = createClient()
  // Supabase caps any single select at 1,000 rows server-side, which
  // silently truncated large dismissed lists. Page through in 1,000-row
  // batches until a short page — no ceiling.
  const PAGE = 1000
  const all: Creator[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('dismissed_creators')
      .select('data, dismissed_at')
      .order('dismissed_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('[getDismissed] read failed:', error.message)
      break
    }
    all.push(...(data ?? []).map(r => r.data as Creator))
    if (!data || data.length < PAGE) break
  }
  console.log(`[getDismissed] returned ${all.length} rows`)
  return all
}

export async function saveDismissed(items: Creator[]): Promise<void> {
  const uid = await userId()
  if (!uid) return
  const supabase = createClient()
  const newIds = new Set(items.map(c => c.channelId))

  // Page past Supabase's 1,000-row select cap — otherwise rows beyond
  // the first page are invisible to the diff below.
  const existing: { channel_id: string }[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from('dismissed_creators')
      .select('channel_id')
      .eq('user_id', uid)
      .range(from, from + 999)
    existing.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const toDelete = existing.filter(r => !newIds.has(r.channel_id)).map(r => r.channel_id)
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('dismissed_creators')
      .delete()
      .eq('user_id', uid)
      .in('channel_id', toDelete)
    if (delErr) {
      // Audit 2026-06-10: the upsert path below already surfaces via
      // reportSaveFailure; this delete path was fully swallowed. A
      // failed delete means un-dismissed creators reappear on reload.
      console.error('[saveDismissed] delete failed:', delErr.message)
      void reportSaveFailure({ functionName: 'saveDismissed_delete', error: delErr, payloadKeys: ['user_id', 'channel_id'] })
    }
  }

  if (items.length > 0) {
    // Batch writes at 500 rows so large lists don't hit payload limits.
    let upErr: { message: string } | null = null
    for (let i = 0; i < items.length && !upErr; i += 500) {
      const { error } = await supabase
        .from('dismissed_creators')
        .upsert(
          items.slice(i, i + 500).map(c => ({ user_id: uid, channel_id: c.channelId, data: c })),
          { onConflict: 'user_id,channel_id' },
        )
      upErr = error
    }
    if (upErr) {
      console.error('[saveDismissed] upsert failed:', upErr.message, upErr)
      void reportSaveFailure({
        functionName: 'saveDismissed',
        error: upErr,
        payloadKeys: ['user_id', 'channel_id', 'data'],
      })
    }
  }
}

/**
 * Persist a SINGLE dismissed-creator row by channel id. Used by the
 * deep-email-search path where multiple lookups can resolve
 * concurrently — calling the full-snapshot saveDismissed() per
 * resolution would race (each saver captures a snapshot, the slowest
 * one wins, found emails for other creators get clobbered). This
 * upserts just the one row so concurrent calls don't compete.
 *
 * 2026-05-10 — added after Dylan reported "dismissed emails I deep-
 * search and were found didn't save when I refreshed the page."
 */
export async function saveDismissedRow(c: Creator): Promise<void> {
  const uid = await userId()
  if (!uid) {
    throw new Error('[saveDismissedRow] no authenticated user — sign in first')
  }
  const supabase = createClient()
  const { error } = await supabase
    .from('dismissed_creators')
    .upsert(
      { user_id: uid, channel_id: c.channelId, data: c },
      { onConflict: 'user_id,channel_id' },
    )
  if (error) {
    console.error('[saveDismissedRow] upsert failed:', error.message, error)
    void reportSaveFailure({
      functionName: 'saveDismissedRow',
      error,
      payloadKeys: ['user_id', 'channel_id', 'data'],
    })
    // 2026-05-10: throw so the caller surfaces the error visibly
    // instead of silently swallowing. Dylan reported deep-searched
    // emails not persisting; the old version logged to console only,
    // so we never knew if the save was actually failing.
    throw new Error(`Save failed: ${error.message}`)
  }
}

/**
 * Delta-persist: upsert EXACTLY these dismissed rows. Added 2026-07-09 —
 * dismissing one creator ran the full-snapshot saveDismissed() (paginated
 * read of every existing id + re-upload of the whole list), which dragged
 * once the list grew past a few hundred. Same write shape as
 * saveDismissed's upsert arm (500-row batches, onConflict user_id +
 * channel_id, reportSaveFailure), no read, no delete. Unlike
 * saveDismissedRow above this doesn't throw — it's for fire-and-forget
 * dismiss clicks, which follow the same silent-success/reported-failure
 * contract as every other save path.
 */
export async function upsertDismissedRows(items: Creator[]): Promise<void> {
  if (items.length === 0) return
  const uid = await userId()
  if (!uid) {
    console.warn('[upsertDismissedRows] no user; skipping')
    return
  }
  const supabase = createClient()
  let upErr: { message: string } | null = null
  for (let i = 0; i < items.length && !upErr; i += 500) {
    const batch = items.slice(i, i + 500)
    const { error } = await withWriteRetry(() =>
      supabase
        .from('dismissed_creators')
        .upsert(
          batch.map(c => ({ user_id: uid, channel_id: c.channelId, data: c })),
          { onConflict: 'user_id,channel_id' },
        ),
    )
    upErr = error
  }
  if (upErr) {
    console.error('[upsertDismissedRows] upsert failed:', upErr.message, upErr)
    void reportSaveFailure({
      functionName: 'upsertDismissedRows',
      error: upErr,
      payloadKeys: ['user_id', 'channel_id', 'data'],
      rowIds: items.map(c => c.channelName || c.channelId),
    })
  }
}

/**
 * Delta-delete dismissed rows by channel id — the un-dismiss (restore)
 * action. Callers pass channel ids the user explicitly clicked, never a
 * diff (see deleteOutreachRows for the safety rationale). Predicate
 * matches saveDismissed's delete arm exactly: user_id + channel_id,
 * because channel ids are NOT globally unique across users.
 */
export async function deleteDismissedRows(channelIds: string[]): Promise<void> {
  if (channelIds.length === 0) return
  const uid = await userId()
  if (!uid) {
    console.warn('[deleteDismissedRows] no user; skipping')
    return
  }
  const supabase = createClient()
  const { error } = await withWriteRetry(() =>
    supabase
      .from('dismissed_creators')
      .delete()
      .eq('user_id', uid)
      .in('channel_id', channelIds),
  )
  if (error) {
    console.error('[deleteDismissedRows] delete failed:', error.message)
    void reportSaveFailure({ functionName: 'deleteDismissedRows', error, payloadKeys: ['user_id', 'channel_id'], rowIds: channelIds })
  }
}

// ── Column configurations ───────────────────────────────────────────────────

export async function getColConfig(): Promise<ColConfig[] | null> {
  const uid = await userId()
  if (!uid) return null
  const supabase = createClient()
  const { data } = await supabase
    .from('user_preferences')
    .select('col_config')
    .eq('user_id', uid)
    .single()
  return (data?.col_config as ColConfig[] | null) ?? null
}

export async function saveColConfig(config: ColConfig[]): Promise<void> {
  const uid = await userId()
  if (!uid) return
  const supabase = createClient()
  const { error } = await supabase.from('user_preferences').update({ col_config: config }).eq('user_id', uid)
  if (error) {
    console.error('[saveColConfig] update failed:', error.message)
    void reportSaveFailure({ functionName: 'saveColConfig', error, payloadKeys: ['col_config'] })
  }
}

/**
 * Per-platform Outreach column configs (Dylan 2026-05-23). The
 * stored shape is `Record<PlatformId, OutreachColConfig[]>` — each
 * platform owns its own column layout so switching the top-banner
 * platform toggle loads the user's chosen view for that channel.
 *
 * Backward-compat migration: prior to this change the same
 * outreach_col_config column held a single OutreachColConfig[]
 * (effectively the YouTube layout). On first read we detect the
 * old shape and lift it onto the 'youtube' key, leaving the other
 * four platforms to fall back to their PLATFORM_OUTREACH_DEFAULTS
 * on first switch. NO existing user customization is lost.
 *
 * Save always writes the full map back, so once a user touches
 * Customize Columns on any platform, the persisted shape is fully
 * migrated.
 */
export async function getOutreachColConfig(): Promise<
  Partial<Record<import('./types').PlatformId, OutreachColConfig[]>> | null
> {
  const uid = await userId()
  if (!uid) return null
  const supabase = createClient()
  const { data } = await supabase
    .from('user_preferences')
    .select('outreach_col_config')
    .eq('user_id', uid)
    .single()
  const stored = data?.outreach_col_config
  if (!stored) return null

  // Old shape: a single array. Lift to the 'youtube' key — that was
  // the de facto platform the array was tuned for.
  if (Array.isArray(stored)) {
    return { youtube: stored as OutreachColConfig[] }
  }

  // New shape: per-platform map. Trust the stored keys, but type-cast
  // through `unknown` so TypeScript stops worrying about its JSON
  // origins.
  return stored as unknown as Partial<
    Record<import('./types').PlatformId, OutreachColConfig[]>
  >
}

export async function saveOutreachColConfig(
  configByPlatform: Partial<Record<import('./types').PlatformId, OutreachColConfig[]>>,
): Promise<void> {
  const uid = await userId()
  if (!uid) return
  const supabase = createClient()
  const { error } = await supabase
    .from('user_preferences')
    .update({ outreach_col_config: configByPlatform })
    .eq('user_id', uid)
  if (error) {
    console.error('[saveOutreachColConfig] update failed:', error.message)
    void reportSaveFailure({ functionName: 'saveOutreachColConfig', error, payloadKeys: ['outreach_col_config'] })
  }
}

// ── Custom analytics metrics ───────────────────────────────────────────────

export async function getCustomMetrics(): Promise<import('./types').CustomMetric[]> {
  const uid = await userId()
  if (!uid) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('user_preferences')
    .select('custom_metrics')
    .eq('user_id', uid)
    .single()
  const arr = data?.custom_metrics
  return Array.isArray(arr) ? arr as import('./types').CustomMetric[] : []
}

export async function saveCustomMetrics(metrics: import('./types').CustomMetric[]): Promise<void> {
  const uid = await userId()
  if (!uid) return
  const supabase = createClient()
  const { error } = await supabase.from('user_preferences').update({ custom_metrics: metrics }).eq('user_id', uid)
  if (error) {
    console.error('[saveCustomMetrics] update failed:', error.message)
    void reportSaveFailure({ functionName: 'saveCustomMetrics', error, payloadKeys: ['custom_metrics'] })
  }
}

// ── Per-platform scoring state (read-modify-write on platform_state JSONB) ──

async function getPlatformState(uid: string): Promise<Record<string, { weights?: ScoreWeights; narrative?: string; guidance?: GuidanceEntry[] }>> {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_preferences')
    .select('platform_state')
    .eq('user_id', uid)
    .single()
  return (data?.platform_state as any) ?? {}
}

async function setPlatformState(uid: string, ps: Record<string, any>): Promise<void> {
  const supabase = createClient()
  // platform_state holds score weights + guidance + narrative for all
  // five platforms — the data that drives the fit-score ranking. A
  // silent failure here meant a whole scoring-config session reverted
  // on refresh with no signal. Surfaced via reportSaveFailure (audit
  // 2026-06-10). This is the shared writer for savePlatformWeights /
  // savePlatformNarrative / savePlatformGuidance.
  const { error } = await supabase.from('user_preferences').update({ platform_state: ps }).eq('user_id', uid)
  if (error) {
    console.error('[setPlatformState] update failed:', error.message)
    void reportSaveFailure({ functionName: 'setPlatformState', error, payloadKeys: ['platform_state'] })
  }
}

export async function savePlatformWeights(platform: PlatformId, weights: ScoreWeights): Promise<void> {
  const uid = await userId()
  if (!uid) return
  const ps = await getPlatformState(uid)
  ps[platform] = { ...(ps[platform] ?? {}), weights }
  await setPlatformState(uid, ps)
}

export async function savePlatformNarrative(platform: PlatformId, narrative: string): Promise<void> {
  const uid = await userId()
  if (!uid) return
  const ps = await getPlatformState(uid)
  ps[platform] = { ...(ps[platform] ?? {}), narrative }
  await setPlatformState(uid, ps)
}

export async function savePlatformGuidance(platform: PlatformId, entries: GuidanceEntry[]): Promise<void> {
  const uid = await userId()
  if (!uid) return
  const ps = await getPlatformState(uid)
  ps[platform] = { ...(ps[platform] ?? {}), guidance: entries }
  await setPlatformState(uid, ps)
}

export async function clearPlatformGuidance(platform: PlatformId): Promise<void> {
  const uid = await userId()
  if (!uid) return
  const ps = await getPlatformState(uid)
  if (ps[platform]) {
    ps[platform] = { ...ps[platform], guidance: [] }
    await setPlatformState(uid, ps)
  }
}

export async function loadPlatformState(platform: PlatformId): Promise<{
  weights: ScoreWeights
  narrative: string
  guidance: GuidanceEntry[]
}> {
  const uid = await userId()
  if (!uid) return { weights: DEFAULT_WEIGHTS, narrative: '', guidance: [] }
  const ps = await getPlatformState(uid)
  const slot = ps[platform] ?? {}
  return {
    weights: (slot.weights as ScoreWeights | undefined) ?? DEFAULT_WEIGHTS,
    narrative: slot.narrative ?? '',
    guidance: (slot.guidance as GuidanceEntry[] | undefined) ?? [],
  }
}

// ── One-time localStorage → Supabase migration ──────────────────────────────
// Runs once per user on first sign-in. If the user already has Supabase data
// (any outreach row, or platform_state with content), we skip — they've
// already migrated or are starting fresh on a new device.

const PLATFORMS: PlatformId[] = ['youtube', 'instagram', 'tiktok', 'twitter', 'linkedin']
const BACKUP_KEY = 'creator-supabase-migration-backup'

function lsGet(key: string): string | null {
  if (!isClient()) return null
  try { return localStorage.getItem(key) } catch { return null }
}

/**
 * Snapshot all relevant localStorage keys into a single backup blob.
 * Stored under BACKUP_KEY so the original data is recoverable even if
 * migration fails halfway.
 */
function createMigrationBackup(): { snapshot: Record<string, string>; backupExists: boolean } {
  if (!isClient()) return { snapshot: {}, backupExists: false }
  const snapshot: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      if (k === BACKUP_KEY) continue
      if (!k.startsWith('creator-') && !k.startsWith('outreach-')) continue
      const v = localStorage.getItem(k)
      if (v != null) snapshot[k] = v
    }
    if (Object.keys(snapshot).length > 0) {
      const existing = localStorage.getItem(BACKUP_KEY)
      // Only overwrite backup if we don't already have one — first backup is safest
      if (!existing) {
        localStorage.setItem(BACKUP_KEY, JSON.stringify(snapshot))
      }
    }
  } catch { /* ignore */ }
  return { snapshot, backupExists: !!localStorage.getItem(BACKUP_KEY) }
}

export function hasMigrationBackup(): boolean {
  if (!isClient()) return false
  try { return !!localStorage.getItem(BACKUP_KEY) } catch { return false }
}

const SKIP_PROMPT_KEY = 'creator-supabase-migration-prompt-skipped'

export function getMigrationSkipped(): boolean {
  if (!isClient()) return false
  try { return localStorage.getItem(SKIP_PROMPT_KEY) === '1' } catch { return false }
}

export function setMigrationSkipped(): void {
  if (!isClient()) return
  try { localStorage.setItem(SKIP_PROMPT_KEY, '1') } catch { /* ignore */ }
}

/**
 * Count what's in localStorage waiting to be migrated. Used by the manual
 * "Import your saved data?" prompt. Returns zero counts if nothing's there.
 */
export function getPendingMigrationCounts(): { outreach: number; dismissed: number; hasAny: boolean } {
  if (!isClient()) return { outreach: 0, dismissed: 0, hasAny: false }
  let outreach = 0, dismissed = 0
  try {
    const o = lsGet('creator-outreach')
    if (o) {
      const arr = JSON.parse(o)
      if (Array.isArray(arr)) outreach = arr.length
    }
  } catch { /* ignore */ }
  try {
    const d = lsGet('creator-dismissed')
    if (d) {
      const arr = JSON.parse(d)
      if (Array.isArray(arr)) dismissed = arr.length
    }
  } catch { /* ignore */ }
  // hasAny also covers other migrate-able keys (preferences, platform state)
  let hasOther = false
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      if (k === BACKUP_KEY || k === SKIP_PROMPT_KEY) continue
      if (k.startsWith('creator-') || k.startsWith('outreach-')) {
        hasOther = true
        break
      }
    }
  } catch { /* ignore */ }
  return { outreach, dismissed, hasAny: outreach > 0 || dismissed > 0 || hasOther }
}

/**
 * The user-triggered version of the migration. Same logic as the auto
 * migration but always runs (no "skip if Supabase has data" check),
 * called from the manual prompt. Returns a status the modal can display.
 */
/**
 * TESTING ONLY: wipe the current user's outreach + dismissed + preferences
 * + onboarding flag from Supabase. Also clears the migration backup blob and
 * the "skipped migration" flag from this browser's localStorage so the
 * onboarding modal + migration prompt re-trigger on next sign-in.
 *
 * Doesn't delete the user's auth account. Doesn't touch other users' data.
 * RLS scopes the deletes to the current user.
 */
export async function resetForTesting(): Promise<{ ok: boolean; message: string }> {
  const uid = await userId()
  if (!uid) return { ok: false, message: 'Not signed in.' }
  const supabase = createClient()

  const errors: string[] = []
  const { error: e1 } = await supabase.from('outreach_entries').delete().eq('user_id', uid)
  if (e1) errors.push(`outreach: ${e1.message}`)
  const { error: e2 } = await supabase.from('dismissed_creators').delete().eq('user_id', uid)
  if (e2) errors.push(`dismissed: ${e2.message}`)
  const { error: e3 } = await supabase
    .from('user_preferences')
    .update({ col_config: null, outreach_col_config: null, platform_state: {} })
    .eq('user_id', uid)
  if (e3) errors.push(`preferences: ${e3.message}`)
  const { error: e4 } = await supabase
    .from('user_profile')
    .update({ onboarded: false, full_name: '', linkedin_url: '', pitch_line: '' })
    .eq('user_id', uid)
  if (e4) errors.push(`profile: ${e4.message}`)

  // Clear test-only flags so modals re-trigger
  if (isClient()) {
    try {
      localStorage.removeItem(BACKUP_KEY)
      localStorage.removeItem(SKIP_PROMPT_KEY)
    } catch { /* ignore */ }
  }

  if (errors.length > 0) return { ok: false, message: `Some resets failed: ${errors.join(' | ')}` }
  return { ok: true, message: 'Reset complete. Reloading…' }
}

export async function runManualMigration(): Promise<{ ok: boolean; message: string }> {
  const uid = await userId()
  if (!uid) return { ok: false, message: 'Not signed in.' }
  if (!isClient()) return { ok: false, message: 'Not running in a browser.' }

  // Take a backup first (no-op if one already exists)
  createMigrationBackup()

  let outreachSaved = 0, dismissedSaved = 0
  let messages: string[] = []

  try {
    const raw = lsGet('creator-outreach')
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length > 0) {
        await saveOutreach(arr as OutreachEntry[])
        outreachSaved = arr.length
      }
    }
  } catch (e: any) { messages.push(`Outreach error: ${e?.message || e}`) }

  try {
    const raw = lsGet('creator-dismissed')
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length > 0) {
        await saveDismissed(arr as Creator[])
        dismissedSaved = arr.length
      }
    }
  } catch (e: any) { messages.push(`Dismissed error: ${e?.message || e}`) }

  try {
    const raw = lsGet('creator-col-config')
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) await saveColConfig(arr as ColConfig[])
    }
  } catch { /* ignore */ }

  try {
    const raw = lsGet('outreach-col-config')
    if (raw) {
      const arr = JSON.parse(raw)
      // Legacy localStorage format was a single array (no per-
      // platform support). Lift to the 'youtube' slot — that was
      // the effective platform the array was tuned for. Other
      // platforms inherit PLATFORM_OUTREACH_DEFAULTS at runtime.
      if (Array.isArray(arr)) {
        await saveOutreachColConfig({ youtube: arr as OutreachColConfig[] })
      }
    }
  } catch { /* ignore */ }

  // Per-platform state
  const newPs: Record<string, any> = {}
  const legacyW = lsGet('creator-score-weights')
  const legacyN = lsGet('creator-score-narrative')
  const legacyG = lsGet('creator-guidance-entries')
  if (legacyW || legacyN || legacyG) {
    newPs.youtube = newPs.youtube ?? {}
    if (legacyW) try { newPs.youtube.weights = JSON.parse(legacyW) } catch {}
    if (legacyN) newPs.youtube.narrative = legacyN
    if (legacyG) try {
      const g = JSON.parse(legacyG)
      if (Array.isArray(g)) newPs.youtube.guidance = g
    } catch {}
  }
  for (const p of PLATFORMS) {
    const w = lsGet(`creator-score-weights-${p}`)
    const n = lsGet(`creator-score-narrative-${p}`)
    const g = lsGet(`creator-guidance-entries-${p}`)
    if (!w && !n && !g) continue
    newPs[p] = newPs[p] ?? {}
    if (w) try { newPs[p].weights = JSON.parse(w) } catch {}
    if (n) newPs[p].narrative = n
    if (g) try {
      const arr = JSON.parse(g)
      if (Array.isArray(arr)) newPs[p].guidance = arr
    } catch {}
  }
  if (Object.keys(newPs).length > 0) {
    try { await setPlatformState(uid, newPs) } catch { /* ignore */ }
  }

  // Mark prompt as handled so it doesn't pop again
  setMigrationSkipped()

  if (messages.length > 0) {
    return { ok: false, message: messages.join('; ') }
  }
  const parts: string[] = []
  if (outreachSaved > 0) parts.push(`${outreachSaved} outreach`)
  if (dismissedSaved > 0) parts.push(`${dismissedSaved} dismissed`)
  return {
    ok: true,
    message: parts.length > 0 ? `Imported ${parts.join(' + ')}.` : 'Settings imported.',
  }
}

export async function migrateLocalStorageToSupabase(): Promise<void> {
  const uid = await userId()
  if (!uid) {
    console.warn('[migration] no authenticated user; skipping')
    return
  }
  const supabase = createClient()

  // SAFETY NET 1: snapshot localStorage before any save in case migration fails
  const { snapshot } = createMigrationBackup()
  if (Object.keys(snapshot).length > 0) {
    console.info(`[migration] backup created: ${Object.keys(snapshot).length} keys preserved under "${BACKUP_KEY}"`)
  }

  // Skip if user already has data in Supabase
  const { data: existingOutreach, error: existErr } = await supabase
    .from('outreach_entries')
    .select('id')
    .eq('user_id', uid)
    .limit(1)
  if (existErr) {
    console.warn('[migration] read check failed:', existErr.message)
  }
  if (existingOutreach && existingOutreach.length > 0) {
    console.info('[migration] supabase already has outreach rows; skipping')
    return
  }

  const { data: prefRow } = await supabase
    .from('user_preferences')
    .select('platform_state')
    .eq('user_id', uid)
    .single()
  const psNotEmpty = prefRow?.platform_state && Object.keys(prefRow.platform_state).length > 0
  if (psNotEmpty) {
    console.info('[migration] supabase already has platform state; skipping')
    return
  }
  console.info('[migration] running localStorage → Supabase migration')

  // Track expected vs. actual counts for SAFETY NET 2 (verification)
  let expectedOutreach = 0
  let expectedDismissed = 0

  // Outreach
  try {
    const raw = lsGet('creator-outreach')
    const parsed = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed) && parsed.length > 0) {
      expectedOutreach = parsed.length
      console.info(`[migration] migrating ${parsed.length} outreach entries`)
      await saveOutreach(parsed as OutreachEntry[])
    }
  } catch (e) { console.warn('[migration] outreach failed:', e) }

  // Dismissed
  try {
    const raw = lsGet('creator-dismissed')
    const parsed = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed) && parsed.length > 0) {
      expectedDismissed = parsed.length
      console.info(`[migration] migrating ${parsed.length} dismissed creators`)
      await saveDismissed(parsed as Creator[])
    }
  } catch (e) { console.warn('[migration] dismissed failed:', e) }

  // Column configs
  try {
    const raw = lsGet('creator-col-config')
    const parsed = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed)) await saveColConfig(parsed as ColConfig[])
  } catch (e) { console.warn('[migration] col config failed:', e) }

  try {
    const raw = lsGet('outreach-col-config')
    const parsed = raw ? JSON.parse(raw) : null
    // Legacy single-array format → lift to 'youtube' slot in the
    // new per-platform map shape (2026-05-23 per-platform configs).
    if (Array.isArray(parsed)) {
      await saveOutreachColConfig({ youtube: parsed as OutreachColConfig[] })
    }
  } catch (e) { console.warn('[migration] outreach col config failed:', e) }

  // Per-platform state — handle both legacy un-suffixed keys (assume youtube)
  // and the current per-platform-suffixed keys.
  const newPs: Record<string, any> = {}

  // Legacy keys → youtube
  const legacyW = lsGet('creator-score-weights')
  const legacyN = lsGet('creator-score-narrative')
  const legacyG = lsGet('creator-guidance-entries')
  if (legacyW || legacyN || legacyG) {
    newPs.youtube = newPs.youtube ?? {}
    if (legacyW) try { newPs.youtube.weights = JSON.parse(legacyW) } catch {}
    if (legacyN) newPs.youtube.narrative = legacyN
    if (legacyG) try {
      const g = JSON.parse(legacyG)
      if (Array.isArray(g)) newPs.youtube.guidance = g
    } catch {}
  }

  // Current per-platform keys
  for (const p of PLATFORMS) {
    const w = lsGet(`creator-score-weights-${p}`)
    const n = lsGet(`creator-score-narrative-${p}`)
    const g = lsGet(`creator-guidance-entries-${p}`)
    if (!w && !n && !g) continue
    newPs[p] = newPs[p] ?? {}
    if (w) try { newPs[p].weights = JSON.parse(w) } catch {}
    if (n) newPs[p].narrative = n
    if (g) try {
      const arr = JSON.parse(g)
      if (Array.isArray(arr)) newPs[p].guidance = arr
    } catch {}
  }

  if (Object.keys(newPs).length > 0) {
    console.info(`[migration] migrating platform state for ${Object.keys(newPs).join(', ')}`)
    await setPlatformState(uid, newPs)
  }

  // SAFETY NET 2: verify counts in Supabase match what we expected
  try {
    const { count: actualOutreach } = await supabase
      .from('outreach_entries').select('id', { count: 'exact', head: true })
    const { count: actualDismissed } = await supabase
      .from('dismissed_creators').select('channel_id', { count: 'exact', head: true })
    if (expectedOutreach !== (actualOutreach ?? 0) || expectedDismissed !== (actualDismissed ?? 0)) {
      console.error(
        `[migration] count mismatch! outreach: expected ${expectedOutreach}, got ${actualOutreach ?? 0}; ` +
        `dismissed: expected ${expectedDismissed}, got ${actualDismissed ?? 0}. ` +
        `Backup preserved under "${BACKUP_KEY}" — use "Retry migration" in the menu.`,
      )
    } else {
      console.info(`[migration] verified: outreach=${actualOutreach}, dismissed=${actualDismissed}`)
    }
  } catch (e) {
    console.warn('[migration] verification check failed:', e)
  }

  console.info('[migration] complete')
}

/**
 * SAFETY NET 3: manual retry from the backup snapshot we made before migration.
 * Use this if the auto-migration silently failed (e.g. data didn't show up).
 * Reads from the backup blob (not live localStorage) so it's idempotent.
 */
export async function retryMigrationFromBackup(): Promise<{ ok: boolean; message: string }> {
  const uid = await userId()
  if (!uid) return { ok: false, message: 'Not signed in.' }
  if (!isClient()) return { ok: false, message: 'Not running in a browser.' }

  let backup: Record<string, string>
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    if (!raw) return { ok: false, message: 'No backup found. Migration was never run on this browser.' }
    backup = JSON.parse(raw)
  } catch {
    return { ok: false, message: 'Backup is corrupted and unreadable.' }
  }

  let restored: string[] = []

  try {
    if (backup['creator-outreach']) {
      const arr = JSON.parse(backup['creator-outreach'])
      if (Array.isArray(arr) && arr.length > 0) {
        await saveOutreach(arr as OutreachEntry[])
        restored.push(`${arr.length} outreach`)
      }
    }
    if (backup['creator-dismissed']) {
      const arr = JSON.parse(backup['creator-dismissed'])
      if (Array.isArray(arr) && arr.length > 0) {
        await saveDismissed(arr as Creator[])
        restored.push(`${arr.length} dismissed`)
      }
    }
    if (backup['creator-col-config']) {
      const arr = JSON.parse(backup['creator-col-config'])
      if (Array.isArray(arr)) await saveColConfig(arr as ColConfig[])
    }
    if (backup['outreach-col-config']) {
      const arr = JSON.parse(backup['outreach-col-config'])
      // Legacy backup format was a single array (pre per-platform).
      // Lift to 'youtube' slot — same migration shape as above.
      if (Array.isArray(arr)) {
        await saveOutreachColConfig({ youtube: arr as OutreachColConfig[] })
      }
    }

    // Per-platform state from backup
    const ps: Record<string, any> = {}
    for (const p of PLATFORMS) {
      const w = backup[`creator-score-weights-${p}`]
      const n = backup[`creator-score-narrative-${p}`]
      const g = backup[`creator-guidance-entries-${p}`]
      if (!w && !n && !g) continue
      ps[p] = ps[p] ?? {}
      if (w) try { ps[p].weights = JSON.parse(w) } catch {}
      if (n) ps[p].narrative = n
      if (g) try {
        const arr = JSON.parse(g)
        if (Array.isArray(arr)) ps[p].guidance = arr
      } catch {}
    }
    if (Object.keys(ps).length > 0) {
      await setPlatformState(uid, ps)
      restored.push('platform state')
    }
  } catch (e: any) {
    return { ok: false, message: `Retry failed: ${e?.message || e}` }
  }

  return {
    ok: true,
    message: restored.length > 0 ? `Restored ${restored.join(', ')}.` : 'Backup was empty — nothing to restore.',
  }
}

// Legacy alias kept so existing callers don't break — now a no-op since
// migration is handled in migrateLocalStorageToSupabase.
export async function migrateLegacyKeys(): Promise<void> {
  // intentionally empty
}
