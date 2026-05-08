import { test, expect } from '@playwright/test'

/**
 * CSP regression tests.
 *
 * Why this file exists:
 *   On 2026-05-08 the production landing page silently failed to
 *   hydrate — buttons rendered as static HTML with no React event
 *   handlers attached, so the theme toggle and hamburger were dead
 *   on the live site even though every Playwright test passed.
 *
 *   Root cause: production CSP had `script-src 'self'
 *   https://vercel.live` with no 'unsafe-inline' and no
 *   'unsafe-eval'. Next.js 16 + Turbopack production runtime needs
 *   BOTH:
 *     • 'unsafe-inline' — so the inline `self.__next_f.push(...)`
 *       hydration scripts can execute.
 *     • 'unsafe-eval' — so the Turbopack chunk-resolver runtime
 *       (which uses new Function/eval for module loading) can run.
 *
 *   Without both, React never hydrates and every interactive
 *   surface looks fine but does nothing. The existing Playwright
 *   tests didn't catch this because they run against `next dev`
 *   which uses a permissive dev CSP.
 *
 *   These tests assert the production CSP shape directly so the
 *   bug can't recur silently.
 */
test.describe('CSP — production hydration prerequisites', () => {
  test('script-src allows unsafe-inline + unsafe-eval (or nonce)', async ({ request }) => {
    const res = await request.get('/landing')
    const csp = res.headers()['content-security-policy']
    expect(csp, 'CSP header missing').toBeTruthy()

    // Pull out the script-src directive specifically.
    const scriptSrc = csp.split(';').map(s => s.trim()).find(s => s.startsWith('script-src'))
    expect(scriptSrc, 'script-src directive missing from CSP').toBeTruthy()

    // Either: classic permissive shape (what the codebase ships now)
    //   script-src 'self' 'unsafe-inline' 'unsafe-eval' ...
    // OR: nonce-based shape (the long-term fix)
    //   script-src 'self' 'nonce-XXX' 'strict-dynamic' ...
    const hasInline = scriptSrc!.includes("'unsafe-inline'")
    const hasEval = scriptSrc!.includes("'unsafe-eval'")
    const hasNonce = /'nonce-[A-Za-z0-9+/=_-]{8,}'/.test(scriptSrc!)
    const hasStrictDynamic = scriptSrc!.includes("'strict-dynamic'")

    const permissive = hasInline && hasEval
    const nonceBased = hasNonce && hasStrictDynamic

    expect(
      permissive || nonceBased,
      `script-src must allow Next.js hydration. Got: ${scriptSrc}\n` +
        'Need either:\n' +
        '  (a) classic permissive: include both unsafe-inline AND unsafe-eval\n' +
        '  (b) nonce-based: include a nonce-* token AND strict-dynamic',
    ).toBe(true)
  })

  test('landing page actually hydrates (React fibers attached)', async ({ page }) => {
    // End-to-end: regardless of CSP shape, the live site MUST hydrate.
    // This is the "did the fix work?" test, complementary to the CSP
    // shape test above.
    await page.goto('/landing', { waitUntil: 'networkidle' })

    const hydrated = await page.evaluate(() => {
      const hasFiber = (el: Element | null) =>
        !!el && Object.keys(el).some(k => k.startsWith('__reactFiber$'))
      const hasProps = (el: Element | null) =>
        !!el && Object.keys(el).some(k => k.startsWith('__reactProps$'))
      const toggle = document.querySelector('button[aria-label*="Switch to"]')
      const ham = document.querySelector('button[aria-label="Open menu"]')
      return {
        bodyHydrated: hasFiber(document.body),
        toggleHydrated: hasProps(toggle),
        hamHydrated: hasProps(ham),
      }
    })

    expect(hydrated.bodyHydrated, 'page body never hydrated').toBe(true)
    expect(hydrated.toggleHydrated, 'theme toggle has no React handlers').toBe(true)
    expect(hydrated.hamHydrated, 'hamburger has no React handlers').toBe(true)
  })
})
