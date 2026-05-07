import { test, expect } from '@playwright/test'

/**
 * Landing-page smoke tests — three-variant redesign.
 *
 *   V1 — Linear × Clay hybrid
 *   V2 — Current production landing (lava-lamp / Aurora baseline)
 *   V3 — Multi-page split of V2 (Home / Product / Pricing / About)
 *
 * Per-variant invariants (kept structural, not copy-bound): h1
 * present, primary CTA present, footer present, no console errors.
 *
 * V3 has additional sub-page coverage: /landing/v3/product,
 * /landing/v3/pricing, /landing/v3/about each load and link back to
 * the home page via the V3Nav.
 */

const VARIANTS = ['v1', 'v2', 'v3'] as const

test.describe('Landing — version switcher', () => {
  test('/landing redirects to /landing/v1', async ({ page }) => {
    await page.goto('/landing')
    await expect(page).toHaveURL(/\/landing\/v1/)
  })

  test('switcher bar exposes all 3 variants', async ({ page }) => {
    await page.goto('/landing/v1')
    for (const v of VARIANTS) {
      await expect(
        page.getByRole('link', { name: new RegExp(`^${v.toUpperCase()}\\s*·`, 'i') }),
      ).toBeVisible()
    }
  })

  test('clicking V2 navigates to /landing/v2', async ({ page }) => {
    await page.goto('/landing/v1')
    await page.getByRole('link', { name: /^V2\s*·/i }).click()
    await expect(page).toHaveURL(/\/landing\/v2/)
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

test.describe('V3 multi-page navigation', () => {
  const SUBPAGES = ['/landing/v3/product', '/landing/v3/pricing', '/landing/v3/about'] as const

  for (const path of SUBPAGES) {
    test(`${path} loads with h1 + footer + no console errors`, async ({ page }) => {
      const errors: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text())
      })
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.locator('footer')).toBeVisible()

      const ours = errors.filter(e => !/sentry|google|fb|twitter|hotjar/i.test(e))
      expect(ours).toEqual([])
    })
  }

  test('V3Nav links route between pages', async ({ page }) => {
    await page.goto('/landing/v3')
    await page.getByRole('link', { name: /^pricing$/i }).first().click()
    await expect(page).toHaveURL(/\/landing\/v3\/pricing/)
    await page.getByRole('link', { name: /^about$/i }).first().click()
    await expect(page).toHaveURL(/\/landing\/v3\/about/)
  })
})
