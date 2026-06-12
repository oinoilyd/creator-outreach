/**
 * Admin-side types + client helpers for the inbox composer
 * (Phase 3/4). The admin can broadcast site-wide, DM an individual,
 * reply to any thread, and turn a contact-form inquiry into a direct
 * thread. All admin reads/writes go through /api/admin/inbox/* which
 * is gated by forbidIfNotAdmin.
 */
import type { InboxMessage } from '@/lib/inbox'

export interface AdminThreadSummary {
  id: string
  type: 'broadcast' | 'direct'
  subject: string
  allowReplies: boolean
  updatedAt: string
  /** For direct threads: the other party's email (null for broadcast). */
  withEmail: string | null
  lastMessage: { body: string; fromAdmin: boolean; createdAt: string } | null
  /** Latest message is from the user → awaiting an admin reply. */
  needsReply: boolean
  /** Spun from a contact-form inquiry. */
  fromInquiry: boolean
  /** Set when the ticket was closed. */
  closedAt: string | null
}

export interface AdminRecipient {
  userId: string
  email: string
}

export interface AdminInboxList {
  threads: AdminThreadSummary[]
  recipients: AdminRecipient[]
}

export interface AdminThreadDetail {
  id: string
  type: 'broadcast' | 'direct'
  subject: string
  allowReplies: boolean
  withEmail: string | null
  messages: InboxMessage[]
  closedAt: string | null
}

// ── client helpers ──────────────────────────────────────────────────

export async function fetchAdminInbox(): Promise<AdminInboxList> {
  const res = await fetch('/api/admin/inbox', { cache: 'no-store' })
  if (!res.ok) return { threads: [], recipients: [] }
  return res.json()
}

export async function fetchAdminThread(threadId: string): Promise<AdminThreadDetail | null> {
  const res = await fetch(`/api/admin/inbox/${threadId}`, { cache: 'no-store' })
  if (!res.ok) return null
  return res.json()
}

export interface CreateThreadInput {
  kind: 'broadcast' | 'direct'
  subject: string
  body: string
  allowReplies?: boolean
  targetUserId?: string
  /** Broadcast only: also email every user that an announcement landed. */
  emailEveryone?: boolean
}

export async function createAdminThread(
  input: CreateThreadInput,
): Promise<{ ok: boolean; error?: string; threadId?: string }> {
  const res = await fetch('/api/admin/inbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) return { ok: false, error: data?.error || `HTTP ${res.status}` }
  return { ok: true, threadId: data?.threadId }
}

export async function adminReply(
  threadId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/inbox/${threadId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) return { ok: false, error: data?.error || `HTTP ${res.status}` }
  return { ok: true }
}

/** Close (or reopen) a ticket. Closed → the user can't reply. */
export async function closeThread(
  threadId: string,
  closed: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/inbox/${threadId}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ closed }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) return { ok: false, error: data?.error || `HTTP ${res.status}` }
  return { ok: true }
}

export interface ReplyFromContactResult {
  ok: boolean
  error?: string
  /** No account matched the inquiry email — admin should reply by email. */
  noAccount?: boolean
  email?: string
  threadId?: string
}

export async function replyFromContact(
  contactId: string,
  body: string,
): Promise<ReplyFromContactResult> {
  const res = await fetch('/api/admin/inbox/from-contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contactId, body }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    return { ok: false, error: data?.error || `HTTP ${res.status}`, noAccount: data?.noAccount, email: data?.email }
  }
  return { ok: true, threadId: data?.threadId }
}

// ── Saved replies (canned responses) ────────────────────────────────

export interface SavedReply {
  id: string
  title: string
  body: string
}

export async function fetchSavedReplies(): Promise<SavedReply[]> {
  const res = await fetch('/api/admin/inbox/saved-replies', { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json().catch(() => null)
  return (data?.replies ?? []) as SavedReply[]
}

export async function createSavedReply(title: string, body: string): Promise<SavedReply | null> {
  const res = await fetch('/api/admin/inbox/saved-replies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body }),
  })
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  return (data?.reply ?? null) as SavedReply | null
}

export async function deleteSavedReply(id: string): Promise<void> {
  await fetch(`/api/admin/inbox/saved-replies?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
}
