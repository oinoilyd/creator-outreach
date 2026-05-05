import { NextResponse } from 'next/server'
import { createClient } from './supabase/server'

/**
 * Verify the request has a valid Supabase session.
 * Returns either the authenticated user or a 401 NextResponse to short-circuit.
 *
 * Usage:
 *   const auth = await requireUser()
 *   if (auth instanceof NextResponse) return auth
 *   const user = auth
 *   // ...handler logic, with `user.id` available for scoping
 */
export async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return user
}
