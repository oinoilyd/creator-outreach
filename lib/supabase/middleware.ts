import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

// /roadmap intentionally NOT public — Dylan wants signin/signup to
// access it. Unauthed visit → middleware redirects to /auth/signin.
// Legal pages (/terms, /privacy, /refunds, /cookies, /support) ARE
// public — they're referenced from the landing-page footer + must
// be reachable for compliance.
const PUBLIC_PATHS = [
  '/auth/signin', '/auth/signup', '/auth/check-email', '/auth/callback',
  '/auth/confirm', '/auth/forgot-password', '/auth/reset-password',
  '/landing',
  '/terms', '/privacy', '/refunds', '/cookies', '/support',
]

/**
 * Refreshes the user's session on every request and gates protected routes.
 * Public paths (/auth/*) stay accessible to logged-out visitors. Everything
 * else redirects to /auth/signin if no session.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some(p => path.startsWith(p))

  if (!user && !isPublic) {
    // Unauthenticated visit to "/" → show the public landing page (URL stays "/")
    if (path === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/landing'
      return NextResponse.rewrite(url)
    }
    const url = request.nextUrl.clone()
    url.pathname = '/auth/signin'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  if (user && (path === '/auth/signin' || path === '/auth/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
