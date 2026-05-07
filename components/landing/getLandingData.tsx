import { createClient } from '@/lib/supabase/server'

/**
 * Tiny shared loader for landing-page variants. Each /landing/vN
 * route calls this once at the top of its server component to
 * resolve auth state without duplicating the supabase setup five
 * times. Kept as a server-only file (no 'use client').
 */
export async function getLandingAuthState(): Promise<{ isAuthed: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { isAuthed: !!user }
}
