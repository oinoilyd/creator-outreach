import { test, expect } from '@playwright/test'

/**
 * Landing-page smoke tests — Apollo-style production /landing.
 *
 * Single variant now. Tests target structural elements (sections,
 * counts, CTA presence) so future copy tweaks don't require test
 * edits. Headline content check is intentionally loose: just verify
 * an h1 exists with non-trivial text.
 */

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/landing')
  })

  test('hero renders with h1 + primary CTA', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
    const text = await heading.textContent()
    expect((text || '').trim().length).toBeGreaterThan(10)

    // Primary CTA — auth-aware; either signup or app link
    const cta = page.locator('a[href="/auth/signup"], a[href="/"]').first()
    await expect(cta).toBeVisible()
  })

  test('OperatorConsole hero visual is mounted', async ({ page }) => {
    // The hero visual is a region with an aria-label mentioning Creator Outreach.
    // Loose match so future label tweaks don't break the test.
    await expect(
      page.getByLabel(/creator outreach.*(results|queue|table|live)/i),
    ).toBeVisible()
  })

  test('Solutions section present with 4 product tiles', async ({ page }) => {
    // Heading was rewritten again 2026-05-08 from "Four pieces, one
    // loop" to "Search. Score. Reach out. Measure." per Dylan ("clean
    // up Four pieces, one loop"). Direct verb sequence is what the
    // app actually does.
    await expect(page.getByRole('heading', { name: /search\.\s*score\.\s*reach out\.\s*measure/i })).toBeVisible()
    // Solution tile h3s
    const tiles = page.locator('section#solutions h3')
    expect(await tiles.count()).toBe(4)
  })

  test('Three product narratives (Sourcing / Outreach / Analytics)', async ({ page }) => {
    await expect(page.getByText(/01\s*\/\s*sourcing/i)).toBeVisible()
    await expect(page.getByText(/02\s*\/\s*outreach/i)).toBeVisible()
    await expect(page.getByText(/03\s*\/\s*analytics/i)).toBeVisible()
  })

  test('Pricing section shows $0 free tier', async ({ page }) => {
    const pricing = page.locator('#pricing')
    await expect(pricing).toBeVisible()
    await expect(pricing.getByText('$0')).toBeVisible()
    await expect(pricing.getByText(/beta/i).first()).toBeVisible()
  })

  test('Customers section present with testimonials', async ({ page }) => {
    const customers = page.locator('#customers')
    await expect(customers).toBeVisible()
    // 3 testimonial figures
    const figures = customers.locator('figure')
    expect(await figures.count()).toBeGreaterThanOrEqual(3)
  })

  test('Footer with sitemap columns + copyright', async ({ page }) => {
    const footer = page.locator('footer')
    await expect(footer).toBeVisible()
    await expect(footer.getByText(/©.*creator outreach/i)).toBeVisible()
    // At least 4 footer column headings (Product / Resources / Company / Legal)
    const headings = footer.locator('div > div').filter({ hasText: /product|resources|company|legal/i })
    expect(await headings.count()).toBeGreaterThanOrEqual(3)
  })

  test('hamburger menu opens and closes', async ({ page }) => {
    // Regression: prior version had click-outside that could close
    // the menu before it opened, plus a mounted-placeholder pattern
    // that left the theme toggle invisible. Both fixed 2026-05-08.
    const hamburger = page.getByRole('button', { name: 'Open menu' })
    await expect(hamburger).toBeVisible()
    await hamburger.click()
    // Menu should now contain at least one utility link.
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(page.getByRole('menu').getByRole('link', { name: /talk to founder/i })).toBeVisible()
  })

  test('theme toggle is visible and switches modes', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /switch to (light|dark) mode/i })
    await expect(toggle).toBeVisible()
    // Whichever mode we start in, clicking flips the <html> class.
    const startedDark = await page.locator('html').evaluate(el => el.classList.contains('dark'))
    await toggle.click()
    const nowDark = await page.locator('html').evaluate(el => el.classList.contains('dark'))
    expect(nowDark).not.toBe(startedDark)
  })

  test('mobile viewport — no horizontal scroll, key sections visible', async ({ page }) => {
    // 375 = iPhone SE / mid-range Android. Most realistic narrow case.
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/landing')
    await page.waitForLoadState('networkidle')

    // No horizontal scroll — sections shouldn't blow past viewport.
    const overflow = await page.evaluate(() => {
      const docW = document.documentElement.scrollWidth
      const winW = window.innerWidth
      return docW - winW
    })
    expect(overflow).toBeLessThanOrEqual(1) // sub-pixel rounding tolerance

    // h1 + primary CTA still visible
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('a[href="/auth/signup"], a[href="/"]').first()).toBeVisible()

    // Hamburger + theme toggle both reachable on mobile
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible()
    await expect(page.getByRole('button', { name: /switch to (light|dark) mode/i })).toBeVisible()
  })

  test('no console errors on initial load', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto('/landing')
    await page.waitForLoadState('networkidle')
    const ours = errors.filter(e => !/sentry|google|fb|twitter|hotjar/i.test(e))
    expect(ours).toEqual([])
  })
})
