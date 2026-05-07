import { test, expect } from '@playwright/test'

/**
 * Landing-page smoke tests. Catch the kind of "shipped, broken,
 * reverted" regressions we kept hitting during the redesign sessions
 * (invisible headline, missing bento cards, theme-flip breaking
 * everything).
 *
 * No auth required for any of these — they target /landing directly.
 */

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/landing')
  })

  test('hero renders with headline + subline + CTA', async ({ page }) => {
    // Headline is the bug-magnet — earlier the gradient + bg-clip-text
    // combo rendered transparent text. Asserting it has visible text
    // catches that regression.
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
    const text = await heading.textContent()
    expect(text?.length ?? 0).toBeGreaterThan(10)

    // Subline mentions the actual product flow. Use a specific phrase
    // that ONLY appears in the subline (not the headline) to avoid
    // strict-mode multi-match.
    await expect(page.getByText(/spreadsheet circus/i)).toBeVisible()

    // Primary CTA exists. The page has 3 such links (nav + hero +
    // bottom CTA strip) — match the hero one specifically by its
    // "Get started — free" label (em-dash distinguishes it).
    await expect(
      page.getByRole('link', { name: /get started — free|open app/i }).first()
    ).toBeVisible()
  })

  test('eyebrow badge is visible', async ({ page }) => {
    await expect(page.getByText(/creator outreach, end to end/i)).toBeVisible()
  })

  test('bento has at least 5 feature cards', async ({ page }) => {
    // Cards have h3 titles per BentoCard component — count those.
    const titles = page.locator('section h3')
    const count = await titles.count()
    expect(count).toBeGreaterThanOrEqual(5)
  })

  test('how-it-works section present with 2 steps', async ({ page }) => {
    await expect(page.getByText(/how it works/i)).toBeVisible()
    // Match the section heading specifically (not the pill label) to
    // avoid strict-mode multi-match when "Search & Score" exists in
    // both the h2 and a step pill.
    await expect(page.getByRole('heading', { name: /two steps/i })).toBeVisible()
  })

  test('pricing section shows free tier', async ({ page }) => {
    const pricing = page.locator('#pricing')
    await expect(pricing).toBeVisible()
    await expect(pricing.getByText('$0')).toBeVisible()
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
    // Filter out third-party noise we can't control
    const ours = errors.filter(e => !/sentry|google|fb|twitter|hotjar/i.test(e))
    expect(ours).toEqual([])
  })
})
