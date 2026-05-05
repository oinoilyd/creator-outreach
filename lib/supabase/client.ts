import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

/**
 * Supabase client for use in Client Components.
 * Lives in the browser, talks to Supabase using the publishable key.
 * Row Level Security on the database is what actually enforces access.
 */
export function createClient() {
  if (!supabaseUrl || !supabaseKey) {
    const missing = [!supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL', !supabaseKey && 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']
      .filter(Boolean).join(', ')
    throw new Error(`Supabase env var(s) missing in build: ${missing}. Check Vercel → Settings → Environment Variables.`)
  }
  return createBrowserClient(supabaseUrl, supabaseKey)
}
