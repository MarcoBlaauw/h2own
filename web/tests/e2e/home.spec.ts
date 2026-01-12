import { test, expect } from '@playwright/test';

test('landing page prompts visitors to sign in', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      name: 'Modern pool insights that keep water crystal-clear in minutes.'
    })
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/auth/login');
});
