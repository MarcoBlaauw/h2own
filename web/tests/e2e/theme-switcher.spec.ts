import { expect, test } from '@playwright/test';

test('theme switcher keeps body theme attribute and dark mode in sync', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'light');
  });

  await page.goto('/');

  const html = page.locator('html');
  const body = page.locator('body');
  await expect(body).toHaveAttribute('data-theme', 'h2own');
  await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/);

  const toggleButton = page.getByRole('button', { name: /Activate (?:dark|light) theme/ });
  await toggleButton.click();

  await expect(html).toHaveClass(/(^|\s)dark(\s|$)/);
  await expect(body).toHaveAttribute('data-theme', 'h2own');
  await expect(page.getByRole('button', { name: 'Activate light theme' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');

  await page.getByRole('button', { name: /Activate (?:dark|light) theme/ }).click();

  await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/);
  await expect(body).toHaveAttribute('data-theme', 'h2own');
  await expect(page.getByRole('button', { name: 'Activate dark theme' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('theme'))).toBe('light');
});
