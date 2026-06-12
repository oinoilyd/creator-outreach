/**
 * Email opt-in lookup. user_profile.email_opt_in (migration 0048) is the
 * per-account "also email me" preference. Reading another user's row is
 * RLS-blocked for the admin's authenticated client, so this uses the
 * service role. Fails OPEN (returns an empty opt-out set) — if the lookup
 * breaks we'd rather still notify than silently drop messages.
 */
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Returns the subset of the given user_ids who have email turned OFF. */
export async function getEmailOptedOut(userIds: string[]): Promise<Set<string>> {
  const out = new Set<string>()
  if (userIds.length === 0) return out
  const sb = getServiceClient()
  if (!sb) return out
  const { data, error } = await sb
    .from('user_profile')
    .select('user_id')
    .in('user_id', userIds)
    .eq('email_opt_in', false)
  if (error) return out // fail open
  for (const r of (data ?? []) as Array<{ user_id: string }>) out.add(r.user_id)
  return out
}

/** Convenience: is this single user opted IN to email? (default true) */
export async function isEmailOptedIn(userId: string): Promise<boolean> {
  const opted = await getEmailOptedOut([userId])
  return !opted.has(userId)
}
