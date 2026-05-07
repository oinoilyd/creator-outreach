import { test, expect } from '@playwright/test'

/**
 * Landing-page smoke tests — brutalist redesign (Swiss Industrial
 * Print mode). Targets structural elements, not copy nuance, so
 * future tone tweaks don't break tests as long as the dossier
 * skeleton remains.
 *
 * No auth required — /landing is public.
 */

test.describe('Landing page (brutalist)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/landing')
  })

  test('cover headline + primary CTA visible', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
    const text = await heading.textContent()
    // Cover headline: "RUN OUTREACH WITHOUT THE SPREADSHEET."
    expect(text || '').toMatch(/run outreach/i)
    expect(text || '').toMatch(/spreadsheet/i)

    // Primary CTA — "Try it free" or "Open the app" depending on auth state.
    await expect(
      page.getByRole('link', { name: /try it free|open the app/i }).first(),
    ).toBeVisible()
  })

  test('section 01 / what it replaces is present', async ({ page }) => {
    await expect(page.getByText(/what it replaces/i)).toBeVisible()
    await expect(page.getByText(/status quo/i).first()).toBeVisible()
    await expect(page.getByText(/replacement/i).first()).toBeVisible()
  })

  test('section 02 / methodology has 4 numbered steps', async ({ page }) => {
    await expect(page.getByText(/methodology/i).first()).toBeVisible()
    // Each step uses a "STEP NN" mono label.
    const stepLabels = page.locator('text=/STEP\\s+0[1-4]/i')
    expect(await stepLabels.count()).toBeGreaterThanOrEqual(4)
  })

  test('section 03 / interface screenshot tabs render', async ({ page }) => {
    await expect(page.getByText(/the interface/i)).toBeVisible()
    const tabStrip = page.getByRole('navigation', { name: /screenshot tabs/i })
    await expect(tabStrip).toBeVisible()
  })

  test('section 04 / pricing schedule shows $0 free tier', async ({ page }) => {
    const pricing = page.locator('#pricing')
    await expect(pricing).toBeVisible()
    await expect(pricing.getByText('$0')).toBeVisible()
    await expect(pricing.getByText(/beta/i).first()).toBeVisible()
  })

  test('section 06 / FAQ + 07 / contact present', async ({ page }) => {
    await expect(page.locator('#faq')).toBeVisible()
    await expect(page.locator('#contact')).toBeVisible()
  })

  test('footer with copyright + legal links', async ({ page }) => {
    const footer = page.locator('footer')
    await expect(footer).toBeVisible()
    await expect(footer.getByText(/©.*creator outreach/i)).toBeVisible()
    await expect(footer.getByRole('link', { name: /privacy/i })).toBeVisible()
    await expect(footer.getByRole('link', { name: /terms/i })).toBeVisible()
  })

  test('no console errors on initial load', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto('/landing')
    await page.waitForLoadState('networkidle')
    // Filter out third-party noise we can't control.
    const ours = errors.filter(e => !/sentry|google|fb|twitter|hotjar/i.test(e))
    expect(ours).toEqual([])
  })
})
