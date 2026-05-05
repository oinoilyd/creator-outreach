import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

/**
 * Supabase client for use in Client Components.
 * Lives in the browser, talks to Supabase using the publishable key.
 * Row Level Security on the database is what actually enforces access.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl!, supabaseKey!)
}
