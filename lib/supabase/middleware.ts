import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasLiveSubscription, isPaywallBypassed } from '@/lib/billing/paywall'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

// /roadmap intentionally NOT public — Dylan wants signin/signup to
// access it. Unauthed visit → middleware redirects to /auth/signin.
// Legal pages (/terms, /privacy, /refunds, /cookies, /support) ARE
// public — they're referenced from the landing-page footer + must
// be reachable for compliance.
//
// /unsubscribe is public because the recipient who clicks it has
// never signed in to our app — they're a creator on the other end
// of one of our users' outreach emails. CAN-SPAM §5(a)(3) requires
// the opt-out link to work without any registration or sign-in
// barrier, so the auth middleware must let them through.
const PUBLIC_PATHS = [
  '/auth/signin', '/auth/signup', '/auth/check-email', '/auth/callback',
  '/auth/confirm', '/auth/forgot-password', '/auth/reset-password',
  '/landing',
  '/terms', '/privacy', '/refunds', '/cookies', '/support',
  '/security', '/subprocessors',
  '/unsubscribe',
]

// Paths an authenticated-but-unsubscribed user is allowed to reach.
// They need:
//   • a way TO subscribe                 → /pricing
//   • a way to complete checkout         → /billing/sync (Stripe success URL)
//   • a way OUT — back to the public site /landing, or sign out entirely
//     (/auth/signout). Without these escape hatches the user is trapped
//     on /pricing with no way to browse the marketing site or sign out.
//   • legal / compliance pages           → /terms, /privacy, etc.
const PAYWALL_ALLOWED_PATHS = [
  '/pricing',
  '/billing/sync',
  '/landing',
  '/auth/signout',
  '/api/stripe/checkout',   // start Checkout from /pricing
  '/api/stripe/portal',     // open Stripe Portal from /pricing
  '/api/auth',              // signout endpoints
  '/terms', '/privacy', '/refunds', '/cookies', '/support',
  '/security', '/subprocessors',
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

  // ── Paywall gate ────────────────────────────────────────────────────
  // Authenticated user. Decide whether they need to subscribe first.
  // Cheap path: bypass-email check needs no DB hit. Falls back to a
  // single user_profile lookup for subscription_status.
  if (user) {
    const isPaywallAllowed = PAYWALL_ALLOWED_PATHS.some(p => path.startsWith(p))

    // Asset / image / api-internal paths never get paywalled here — the
    // middleware matcher in middleware.ts already excludes _next/static,
    // _next/image, and any path with a file extension, so the only API
    // routes that hit this function are non-extension app routes. Stripe
    // and signout endpoints are explicitly allowed above.
    if (!isPaywallAllowed && !path.startsWith('/api/')) {
      // Cheap path first — bypass-list lookup is in-memory, no DB hit.
      // Skips the subscription query entirely for Dylan / Ryan / test
      // accounts, which is the hottest authenticated request on the app.
      if (!isPaywallBypassed(user.email ?? null)) {
        // Look up subscription_status. maybeSingle handles brand-new users
        // whose profile row may not exist yet (will be created on first
        // /page.tsx load — for now treat as no-sub which sends them to
        // /pricing to start the trial).
        const { data: profileRow } = await supabase
          .from('user_profile')
          .select('subscription_status')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!hasLiveSubscription(profileRow?.subscription_status ?? null)) {
          const url = request.nextUrl.clone()
          url.pathname = '/pricing'
          url.searchParams.set('required', '1')
          return NextResponse.redirect(url)
        }
      }
    }
  }

  return supabaseResponse
}
