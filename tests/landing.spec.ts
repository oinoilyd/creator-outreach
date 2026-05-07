import { test, expect } from '@playwright/test'

/**
 * Landing-page smoke tests — five-variant redesign.
 *
 * Each /landing/v[1-5] page is a wildly different visual direction
 * (Editorial, Maximalist, Premium Tech, Trading Terminal, Operator's
 * Notebook). The shared invariants we care about: every variant
 * renders an h1, has a primary CTA link, has a footer, and produces
 * no console errors. /landing redirects to /landing/v1.
 *
 * Variant-specific copy is intentionally NOT asserted — it's the
 * point of having five concepts that the wording differs. We verify
 * structure only.
 */

const VARIANTS = ['v1', 'v2', 'v3', 'v4', 'v5'] as const

test.describe('Landing — version switcher', () => {
  test('/landing redirects to /landing/v1', async ({ page }) => {
    await page.goto('/landing')
    await expect(page).toHaveURL(/\/landing\/v1/)
  })

  test('switcher bar exposes all 5 variants', async ({ page }) => {
    await page.goto('/landing/v1')
    for (const v of VARIANTS) {
      await expect(
        page.getByRole('link', { name: new RegExp(`^${v.toUpperCase()}\\s*·`, 'i') }),
      ).toBeVisible()
    }
  })

  test('clicking V3 navigates to /landing/v3', async ({ page }) => {
    await page.goto('/landing/v1')
    await page.getByRole('link', { name: /^V3\s*·/i }).click()
    await expect(page).toHaveURL(/\/landing\/v3/)
  })
})

for (const variant of VARIANTS) {
  test.describe(`Landing variant ${variant}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/landing/${variant}`)
    })

    test('renders an h1', async ({ page }) => {
      const h1 = page.getByRole('heading', { level: 1 })
      await expect(h1).toBeVisible()
      const text = await h1.textContent()
      expect((text || '').trim().length).toBeGreaterThan(5)
    })

    test('has a primary CTA link to signup or app', async ({ page }) => {
      // Each variant uses different copy ("Try free", "Start free",
      // "Try it FREE", "EXEC NEW SESSION", "Try it (it's free)").
      // Catch-all: at least one link points to /auth/signup or /.
      const cta = page.locator('a[href="/auth/signup"], a[href="/"]').first()
      await expect(cta).toBeVisible()
    })

    test('has a footer', async ({ page }) => {
      await expect(page.locator('footer')).toBeVisible()
    })

    test('no console errors on initial load', async ({ page }) => {
      const errors: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text())
      })
      await page.goto(`/landing/${variant}`)
      await page.waitForLoadState('networkidle')
      const ours = errors.filter(e => !/sentry|google|fb|twitter|hotjar/i.test(e))
      expect(ours).toEqual([])
    })
  })
}
