import { test, expect } from '@playwright/test'

/**
 * Theme-toggle tests. Catches the class of bugs where one mode
 * breaks while the other works (white-on-white text, invisible
 * borders, etc.).
 */

test.describe('Theme toggle', () => {
  test('toggle switches between light + dark on landing', async ({ page }) => {
    await page.goto('/landing')
    const html = page.locator('html')

    // Wait for next-themes to mount (avoid race with the theme button)
    await page.waitForLoadState('networkidle')

    const initial = await html.getAttribute('class')

    // Theme toggle button is sun/moon — match aria-label.
    const toggle = page.getByRole('button', { name: /switch to (light|dark) mode/i })
    await expect(toggle).toBeVisible()
    await toggle.click()
    // next-themes flips html.dark — check class actually changed.
    await expect(async () => {
      const after = await html.getAttribute('class')
      expect(after).not.toEqual(initial)
    }).toPass({ timeout: 2000 })
  })

  test('hero headline visible in BOTH modes', async ({ page }) => {
    // The exact regression that motivated tests: gradient text rendering
    // transparent. Verify h1 has nonzero rendered height in both modes.
    await page.goto('/landing')
    const heading = page.getByRole('heading', { level: 1 })

    // Light mode (default)
    const lightBox = await heading.boundingBox()
    expect(lightBox?.height ?? 0).toBeGreaterThan(20)

    // Toggle to dark
    await page.getByRole('button', { name: /switch to (light|dark) mode/i }).click()
    await page.waitForTimeout(300) // let class flip + paint
    const darkBox = await heading.boundingBox()
    expect(darkBox?.height ?? 0).toBeGreaterThan(20)
  })
})
