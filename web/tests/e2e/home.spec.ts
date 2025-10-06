import { test, expect } from '@playwright/test';

test('landing page prompts visitors to sign in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to H2Own' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'sign in' })).toHaveAttribute('href', '/auth/login');
});
