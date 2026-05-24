/**
 * Team / Organization domain model + permission helpers.
 *
 * The app supports two account modes:
 *   • INDIVIDUAL — legacy single-user, no org. Their outreach rows
 *     have organization_id = NULL.
 *   • TEAM — user belongs to an Organization with a role
 *     (owner/admin/member). Outreach rows have organization_id set.
 *
 * Permissions are role-based. Each helper here is intentionally small
 * and pure so it can be exercised in unit tests and surfaced to the
 * UI without ambiguity:
 *
 *   canSeeAllOrgRows(role)       — Owner/Admin can; Member cannot
 *   canAssignToOthers(role)      — Owner/Admin can reassign rows
 *   canInviteMembers(role)       — Owner/Admin can invite
 *   canRemoveMembers(role)       — Owner/Admin (Admin can't remove Owner)
 *   canManageBilling(role)       — Owner only
 *   canChangeOrgName(role)       — Owner/Admin
 *
 * RLS in Postgres is the ENFORCEMENT layer — see migration 0035. The
 * helpers in this file are for UI gating (showing/hiding buttons)
 * and for nicer error messages on the server. NEVER rely on the
 * client to enforce permissions; always re-check in the API route
 * via the DB.
 */

/** All possible roles within an Organization. */
export type OrganizationRole = 'owner' | 'admin' | 'member'

/** Tier label for individual users (no org). */
export type AccountMode = 'individual' | 'team'

/** Shape of an Organization row. */
export interface Organization {
  id: string
  name: string
  slug: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStatus: string | null
  subscriptionCurrentPeriodEnd: string | null
  seatsProvisioned: number
  unlimitedExports: boolean
  createdAt: string
  updatedAt: string
}

/** Shape of an organization_members row. */
export interface OrganizationMember {
  id: string
  organizationId: string
  userId: string
  role: OrganizationRole
  invitedBy: string | null
  invitedAt: string | null
  joinedAt: string
}

/** Shape of an organization_invitations row (admin-facing). */
export interface OrganizationInvitation {
  id: string
  organizationId: string
  email: string
  role: 'admin' | 'member' // cannot invite as owner
  // Token is omitted from client-facing types — it lives only in the
  // email link and server-side validation. The Team page renders status
  // + email, not the secret.
  invitedBy: string
  expiresAt: string
  acceptedAt: string | null
  acceptedBy: string | null
  createdAt: string
}

/** Convenient summary used by hooks + middleware. */
export interface TeamContext {
  mode: AccountMode
  /** Present only when mode='team'. */
  organization: Organization | null
  /** Present only when mode='team'. */
  role: OrganizationRole | null
}

// =====================================================================
// Permission predicates.
// =====================================================================
// All permission helpers accept the current user's role (or null for
// individual users) and return a boolean. They never throw and never
// mutate. Use them to gate UI and as fast-path checks in API routes
// BEFORE doing the DB roundtrip.

/**
 * Can see all rows in the org, including ones not assigned to them.
 * Owner + Admin yes; Member only sees their own creates / assignments.
 *
 * Individual users return TRUE (they trivially see all their own rows
 * because there's no org boundary).
 */
export function canSeeAllOrgRows(role: OrganizationRole | null): boolean {
  if (role === null) return true
  return role === 'owner' || role === 'admin'
}

/** Can re-assign any outreach row to any team member. */
export function canAssignToOthers(role: OrganizationRole | null): boolean {
  if (role === null) return false
  return role === 'owner' || role === 'admin'
}

/** Can send invites to add new members. */
export function canInviteMembers(role: OrganizationRole | null): boolean {
  if (role === null) return false
  return role === 'owner' || role === 'admin'
}

/**
 * Can remove a target member with the given role from the org.
 *
 *   Owner  → can remove anyone except themselves (use transferOwner first)
 *   Admin  → can remove other Admins and Members; CANNOT remove Owner
 *   Member → can never remove anyone
 *
 * Caller should pass actorRole + targetRole; we return whether the
 * action is permitted at the role level. The server enforces this
 * via API gate; the UI uses it to hide the "Remove" button.
 */
export function canRemoveTargetMember(
  actorRole: OrganizationRole | null,
  targetRole: OrganizationRole,
): boolean {
  if (actorRole === null) return false
  if (actorRole === 'member') return false
  if (actorRole === 'admin') return targetRole !== 'owner'
  // Owner can remove anyone (UI should still prevent self-remove via
  // a separate check; this helper is role-vs-role only).
  return actorRole === 'owner'
}

/** Only Owner can manage billing (change plan, update card, cancel). */
export function canManageBilling(role: OrganizationRole | null): boolean {
  return role === 'owner'
}

/** Can change the org's display name + slug. Owner + Admin. */
export function canChangeOrgName(role: OrganizationRole | null): boolean {
  if (role === null) return false
  return role === 'owner' || role === 'admin'
}

/**
 * Can a user invite at this proposed role? Owners can invite anyone;
 * Admins cannot invite another Owner (and shouldn't be able to invite
 * an Admin either, per principle of least privilege — Admin can only
 * invite Members).
 *
 * Adjust if Dylan wants Admins to be able to invite other Admins.
 */
export function canInviteAtRole(
  actorRole: OrganizationRole | null,
  proposedRole: 'admin' | 'member',
): boolean {
  if (actorRole === null) return false
  if (actorRole === 'member') return false
  if (actorRole === 'admin') return proposedRole === 'member'
  return actorRole === 'owner' // owner can invite admin or member
}

// =====================================================================
// Seat math.
// =====================================================================
// Team plan = $150/mo flat for 5 seats + $35/mo per seat over 5.
// We model this in Stripe as TWO subscription items:
//   item 1: TEAM_BASE_PRICE  — recurring $150/mo, quantity always 1
//   item 2: TEAM_SEAT_PRICE  — recurring $35/mo per unit,
//                              quantity = max(0, totalMembers - 5)
// When members grow, we bump item 2's quantity (Stripe prorates the
// rest of the period). When members shrink, we lower the quantity
// (Stripe credits the unused time).

/** # of seats included in the base $150/mo Team plan. */
export const TEAM_BASE_SEATS = 5

/** Cost (in cents) of the base Team plan. */
export const TEAM_BASE_PRICE_CENTS = 15_000 // $150.00

/** Cost (in cents) of each additional seat beyond TEAM_BASE_SEATS. */
export const TEAM_SEAT_PRICE_CENTS = 3_500 // $35.00

/** Stable lookup_keys for the two Stripe Prices we manage. */
export const TEAM_BASE_PRICE_LOOKUP_KEY = 'team_base_v1'
export const TEAM_SEAT_PRICE_LOOKUP_KEY = 'team_seat_v1'

/**
 * Given the total member count (including Owner), return the quantity
 * for the seat add-on item.
 *
 *   1–5 members → 0 extra seats
 *   6 members   → 1 extra seat
 *   10 members  → 5 extra seats
 *
 * Negative inputs return 0 (defensive).
 */
export function extraSeatsQuantity(totalMembers: number): number {
  if (totalMembers <= TEAM_BASE_SEATS) return 0
  return totalMembers - TEAM_BASE_SEATS
}

/**
 * Total monthly price in cents for a given member count, for display in
 * the UI (e.g., "$185/mo" preview when admin clicks Invite on the 6th
 * person).
 */
export function teamMonthlyPriceCents(totalMembers: number): number {
  return TEAM_BASE_PRICE_CENTS + TEAM_SEAT_PRICE_CENTS * extraSeatsQuantity(totalMembers)
}

/** Format cents as a $X.XX string for UI labels. */
export function formatPriceCents(cents: number): string {
  if (cents % 100 === 0) return `$${(cents / 100).toFixed(0)}`
  return `$${(cents / 100).toFixed(2)}`
}

// =====================================================================
// Display helpers.
// =====================================================================

/** Human-readable label for a role. */
export function roleLabel(role: OrganizationRole): string {
  switch (role) {
    case 'owner': return 'Owner'
    case 'admin': return 'Admin'
    case 'member': return 'Member'
  }
}

/** One-line description of what a role can do, for tooltips. */
export function roleDescription(role: OrganizationRole): string {
  switch (role) {
    case 'owner':  return 'Billing + everything. Only one Owner per team.'
    case 'admin':  return 'Invite/remove members, assign outreach, see all team data. Cannot change billing.'
    case 'member': return 'Sees only outreach assigned to them or that they created.'
  }
}
