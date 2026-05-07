import { test, expect } from '@playwright/test'

/**
 * Landing-page smoke tests. Updated for the "Founder's letter"
 * editorial redesign — the previous tests targeted the AI-bento
 * layout (gradient hero, "spreadsheet circus" subline, "Four
 * steps" heading, $0 pricing copy). The redesign restructures
 * everything; these tests now check structural elements that are
 * stable across copy changes.
 */

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/landing')
  })

  test('hero renders with headline + subline + CTA', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
    const text = await heading.textContent()
    expect(text?.length ?? 0).toBeGreaterThan(10)

    // Hero copy mentions the actual product. "Creator" or "outreach"
    // should always appear in the hero somewhere.
    await expect(page.getByText(/creator|outreach/i).first()).toBeVisible()

    // Primary CTA exists (label depends on auth state).
    await expect(
      page.getByRole('link', { name: /try it free|open the app/i }).first()
    ).toBeVisible()
  })

  test('eyebrow line is visible above hero', async ({ page }) => {
    // New eyebrow: "Beta · Built by one person".
    await expect(page.getByText(/beta.*built by/i)).toBeVisible()
  })

  test('product preview + how-it-works + features all present', async ({ page }) => {
    // Editorial layout uses h2/h3 headings with stable section labels.
    // Don't rely on specific h2 copy — count by structural markers.
    await expect(page.getByText(/how it works/i)).toBeVisible()
    await expect(page.getByText(/what.s inside|why i built|five platforms/i).first()).toBeVisible()
  })

  test('pricing section is present', async ({ page }) => {
    const pricing = page.locator('#pricing')
    await expect(pricing).toBeVisible()
    // "Free while in beta" is the new pricing copy.
    await expect(pricing.getByText(/free while in beta|free/i).first()).toBeVisible()
  })

  test('footer present', async ({ page }) => {
    await expect(page.locator('footer')).toBeVisible()
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

  test('founder note is present (editorial human-voice section)', async ({ page }) => {
    // The "Why I built this" section is the soul of the redesign.
    // If it goes missing, the page lost its voice.
    await expect(page.getByText(/why i built this/i)).toBeVisible()
    await expect(page.getByText(/i was running outreach/i)).toBeVisible()
  })
})
