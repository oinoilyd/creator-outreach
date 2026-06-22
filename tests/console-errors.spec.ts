import { test, expect } from '@playwright/test'

/**
 * Console-error guard for every public page.
 *
 * WHY THIS EXISTS: `tsc` and `next build` are static checks — they pass
 * even when a page throws a React hydration mismatch or a client-side
 * runtime error, because those only surface when the page actually
 * runs in a browser. Two real hydration bugs (PlatformRain on the auth
 * shell, FitScoreOrbital on the landing page — both from non-reproducible
 * Math.sin/cos across the SSR vs client JS engines) shipped silently for
 * exactly this reason. This spec loads each public route in a real
 * browser and FAILS if the console logs any error, closing that gap so
 * the next one breaks CI instead of reaching customers.
 *
 * Routes mirror PUBLIC_PATHS in lib/supabase/middleware.ts (the pages
 * reachable without auth). Authed pages (the app, /admin) need a test
 * user — tracked separately under the @auth tag.
 */
const PUBLIC_ROUTES = [
  '/landing',
  '/pricing',
  '/terms',
  '/privacy',
  '/refunds',
  '/cookies',
  '/support',
  '/security',
  '/subprocessors',
  '/unsubscribe',
  '/auth/signin',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/check-email',
]

// Deliberately-ignored console noise. Keep this list TINY and
// justified — every entry is a hole in the guard.
const IGNORE: RegExp[] = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i, // Next dev HMR chatter
]

const isIgnored = (text: string) => IGNORE.some(re => re.test(text))

for (const route of PUBLIC_ROUTES) {
  test(`no console errors on ${route}`, async ({ page }) => {
    const errors: string[] = []

    page.on('console', msg => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) {
        errors.push(`[console.error] ${msg.text()}`)
      }
    })
    page.on('pageerror', err => {
      errors.push(`[pageerror] ${err.name}: ${err.message}`)
    })

    await page.goto(route, { waitUntil: 'load' })
    // Hydration runs just after the HTML lands — give React a beat so
    // any mismatch is logged before we assert.
    await page.waitForTimeout(1800)

    expect(
      errors,
      `Console errors on ${route}:\n${errors.join('\n') || '(none)'}`,
    ).toEqual([])
  })
}
