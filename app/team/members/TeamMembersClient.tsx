'use client'

/**
 * TeamMembersClient — interactive part of the Team page.
 *
 * Lists members + pending invites. Lets Owner/Admin invite + remove.
 * Member view is read-only (no invite form, no remove buttons).
 *
 * Self-fetches /api/team/members + /api/team/invitations on mount and
 * after each mutation so the UI always reflects server truth.
 */

import { useEffect, useState } from 'react'
import {
  canInviteMembers,
  canInviteAtRole,
  canRemoveTargetMember,
  formatPriceCents,
  teamMonthlyPriceCents,
  extraSeatsQuantity,
  roleLabel,
  roleDescription,
  TEAM_BASE_SEATS,
  type OrganizationRole,
} from '@/lib/team'

interface MemberRow {
  id: string
  userId: string
  email: string
  fullName: string
  role: OrganizationRole
  joinedAt: string
}

interface InviteRow {
  id: string
  email: string
  role: 'admin' | 'member'
  expires_at: string
  accepted_at: string | null
  created_at: string
}

interface Props {
  yourRole: OrganizationRole
  organizationId: string
  subscriptionStatus: string | null
  memberCountForBilling: number | undefined
}

export function TeamMembersClient({ yourRole, subscriptionStatus }: Props) {
  const [members, setMembers] = useState<MemberRow[]>([])
  const [invitations, setInvitations] = useState<InviteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviting, setInviting] = useState(false)
  const [lastAcceptUrl, setLastAcceptUrl] = useState<string | null>(null)

  const canInvite = canInviteMembers(yourRole)

  async function refetch() {
    setLoading(true)
    setError(null)
    try {
      const [mRes, iRes] = await Promise.all([
        fetch('/api/team/members').then(r => r.json()),
        canInvite ? fetch('/api/team/invitations').then(r => r.json()) : Promise.resolve({ invitations: [] }),
      ])
      setMembers(mRes.members ?? [])
      setInvitations((iRes.invitations ?? []).filter((i: InviteRow) => !i.accepted_at))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load team')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return
    setInviting(true)
    setError(null)
    setLastAcceptUrl(null)
    try {
      const res = await fetch('/api/team/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: inviteRole }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || `Invite failed (HTTP ${res.status}).`)
        return
      }
      // If the email didn't send (Resend unconfigured), show the
      // accept URL so admin can copy/paste it.
      if (data?.emailSent === false && data?.acceptUrl) {
        setLastAcceptUrl(data.acceptUrl)
      }
      setInviteEmail('')
      await refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.')
    } finally {
      setInviting(false)
    }
  }

  async function handleRemove(memberId: string, email: string) {
    if (!confirm(`Remove ${email} from the team? This frees their seat (billing updates).`)) return
    try {
      const res = await fetch(`/api/team/members?id=${encodeURIComponent(memberId)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || `Could not remove member (HTTP ${res.status}).`)
        return
      }
      await refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.')
    }
  }

  async function handleCancelInvite(id: string, email: string) {
    if (!confirm(`Cancel the pending invite to ${email}?`)) return
    try {
      const res = await fetch(`/api/team/invitations?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || `Could not cancel invite (HTTP ${res.status}).`)
        return
      }
      await refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.')
    }
  }

  // Live billing preview based on member count.
  const memberCount = members.length
  const pendingCount = invitations.length
  const projected = memberCount + pendingCount
  const projectedExtra = extraSeatsQuantity(projected)
  const projectedPrice = teamMonthlyPriceCents(projected)

  return (
    <div className="space-y-6">
      {/* Plan + billing preview */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-sm text-muted-foreground">Team plan</div>
            <div className="text-2xl font-bold text-foreground">
              {formatPriceCents(projectedPrice)}<span className="text-sm font-normal text-muted-foreground">/mo</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {TEAM_BASE_SEATS} included{projectedExtra > 0 && ` + ${projectedExtra} extra ${projectedExtra === 1 ? 'seat' : 'seats'}`} ·{' '}
              {memberCount} member{memberCount === 1 ? '' : 's'}
              {pendingCount > 0 && ` + ${pendingCount} pending`}
            </div>
          </div>
          {subscriptionStatus && (
            <div className="inline-flex items-center gap-2">
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                subscriptionStatus === 'active' || subscriptionStatus === 'trialing'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
              }`}>
                {subscriptionStatus === 'trialing' ? 'Free trial' : subscriptionStatus}
              </span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Invite form — Owner/Admin only */}
      {canInvite && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Invite a teammate</h2>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="teammate@example.com"
              required
              disabled={inviting}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as 'admin' | 'member')}
              disabled={inviting}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
            >
              <option value="member">Member</option>
              {canInviteAtRole(yourRole, 'admin') && <option value="admin">Admin</option>}
            </select>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            They&apos;ll get an email link. Seat billing adjusts on accept.
          </p>
          {lastAcceptUrl && (
            <div className="mt-3 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-100">
              <p className="font-medium mb-1">Email didn&apos;t send — share this link manually:</p>
              <code className="block break-all bg-background/50 p-1.5 rounded">{lastAcceptUrl}</code>
            </div>
          )}
        </div>
      )}

      {/* Member list */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Members ({memberCount})</h2>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : members.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">No members yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {members.map(m => {
              const canRemove = canRemoveTargetMember(yourRole, m.role)
              return (
                <li key={m.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{m.fullName || m.email}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                  </div>
                  <span
                    className={`text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      m.role === 'owner' ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400'
                      : m.role === 'admin' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                      : 'bg-muted text-muted-foreground/80'
                    }`}
                    title={roleDescription(m.role)}
                  >
                    {roleLabel(m.role)}
                  </span>
                  {canRemove && (
                    <button
                      onClick={() => handleRemove(m.id, m.email)}
                      className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Pending invitations */}
      {canInvite && invitations.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Pending invites ({invitations.length})</h2>
          </div>
          <ul className="divide-y divide-border">
            {invitations.map(inv => (
              <li key={inv.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">{inv.email}</div>
                  <div className="text-xs text-muted-foreground">
                    Expires {new Date(inv.expires_at).toLocaleDateString()} ·{' '}
                    {roleLabel(inv.role as OrganizationRole)}
                  </div>
                </div>
                <button
                  onClick={() => handleCancelInvite(inv.id, inv.email)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
