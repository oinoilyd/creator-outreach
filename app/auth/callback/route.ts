import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * OAuth + email confirmation callback.
 * Supabase redirects here with a `code` param after the user clicks the
 * confirmation link in their email or completes the OAuth flow. We exchange
 * the code for a session, then redirect to wherever they were trying to go.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Code missing or invalid — bounce back to sign-in with a hint
  return NextResponse.redirect(`${origin}/auth/signin?error=callback_failed`)
}
