import type { User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Centralized admin-only check. Used by routes under `/api/admin/*`
 * AFTER `requireUser()` validates the session.
 *
 * Pattern (every admin route):
 *   const auth = await requireUser()
 *   if (auth instanceof NextResponse) return auth
 *   const forbid = forbidIfNotAdmin(auth)
 *   if (forbid) return forbid
 *   // ... handler
 *
 * Currently keyed off the user's email. Migrating to Supabase custom
 * claims (e.g. `app_metadata.is_admin`) is documented as a follow-up
 * in SECURITY-AUDIT.md and .brain/security.md.
 */
const ADMIN_EMAIL_ALLOWLIST = new Set<string>([
  'dmeehanj@gmail.com',
])

export function isAdminUser(user: User | null | undefined): boolean {
  if (!user) return false
  if (!user.email) return false
  return ADMIN_EMAIL_ALLOWLIST.has(user.email.toLowerCase())
}

export function forbidIfNotAdmin(user: User | null | undefined): NextResponse | null {
  if (isAdminUser(user)) return null
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
