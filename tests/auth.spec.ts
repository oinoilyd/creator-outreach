import { test, expect } from '@playwright/test'

/**
 * Auth form RENDERING tests. Doesn't actually submit (would need a
 * real Supabase test user — deferred to v2). Ensures the forms,
 * inputs, and labels render correctly so a regression like "input
 * field disappeared" gets caught.
 */

test.describe('Auth pages', () => {
  test('sign in page renders form', async ({ page }) => {
    await page.goto('/auth/signin')
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
    await expect(page.getByPlaceholder(/email/i).or(page.locator('input[type="email"]'))).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('sign up page renders form', async ({ page }) => {
    await page.goto('/auth/signup')
    // Actual heading on signup is "Create your account"
    await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('forgot password page renders', async ({ page }) => {
    await page.goto('/auth/forgot-password')
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })

  test('sign in link from sign up navigates back', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.getByRole('link', { name: /sign in/i }).first().click()
    await expect(page).toHaveURL(/\/auth\/signin/)
  })
})
