/**
 * Client-side team helpers + types. Keeps lib/team-context.ts on the
 * server side (it imports the service-role client which can't ship to
 * the browser bundle).
 */

import type { OrganizationRole } from './team'

/** Shape returned by GET /api/team/members for use across team UI. */
export interface TeamMember {
  id: string
  userId: string
  email: string
  fullName: string
  role: OrganizationRole
  joinedAt: string
  invitedAt: string | null
}

/** Response shape from GET /api/team/members. */
export interface MembersResponse {
  organization_id: string
  your_role: OrganizationRole
  members: TeamMember[]
}

/**
 * Fetch the current user's team members. Returns null if the user
 * isn't in a team (404) or the request fails for any reason — UI
 * should treat null as "individual mode, show no team filter."
 */
export async function fetchTeamMembers(): Promise<MembersResponse | null> {
  try {
    const res = await fetch('/api/team/members')
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** POST /api/team/assign for a single row. Returns true on success. */
export async function reassignOutreach(
  entryId: string,
  assigneeUserId: string,
): Promise<boolean> {
  try {
    const res = await fetch('/api/team/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entryIds: [entryId],
        assigneeUserId,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
