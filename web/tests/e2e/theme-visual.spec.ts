import { test } from '@playwright/test';
import { expectPageToMatchBaseline } from './utils/visual-assertions';

const waitForLayoutStability = async (page: import('@playwright/test').Page) => {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(250);
};

test('home dashboard matches visual baseline in light and dark mode @visual', async ({ page }) => {
  await page.goto('/');
  await page.addStyleTag({
    content:
      '* { transition-duration: 0s !important; animation-duration: 0s !important; animation-iteration-count: 1 !important; }'
  });
  await waitForLayoutStability(page);

  await expectPageToMatchBaseline(page, 'home-light');

  const toggleButton = page.getByRole('button', { name: /Activate dark theme/ });
  await toggleButton.click();
  await waitForLayoutStability(page);

  await expectPageToMatchBaseline(page, 'home-dark');
});
