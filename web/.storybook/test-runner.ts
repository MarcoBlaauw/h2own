import AxeBuilder from '@axe-core/playwright';
import type { TestRunnerConfig } from '@storybook/test-runner';
import type { Page } from '@playwright/test';

const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

async function applyTheme(page: Page, theme: Theme) {
  await page.evaluate((activeTheme) => {
    const root = document.documentElement;
    if (activeTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.dataset.theme = activeTheme;
  }, theme);
}

const config: TestRunnerConfig = {
  async preRender(page, context) {
    const theme = ((context as unknown as { globals?: { theme?: Theme } }).globals?.theme ?? 'light');
    await applyTheme(page, theme);
  },
  async postRender(page, context) {
    const violationsByTheme: string[] = [];
    for (const theme of THEMES) {
      await applyTheme(page, theme);
      await page.waitForTimeout(50);
      const results = await new AxeBuilder({ page })
        .include('#storybook-root')
        .withTags(['wcag2aa', 'wcag21aa'])
        .analyze();
      if (results.violations.length > 0) {
        const themeViolations = results.violations
          .map(violation => {
            const targets = violation.nodes
              .map(node => node.target.join(' '))
              .join(', ');
            return `[${theme} theme] ${violation.id}: ${violation.description}
Targets: ${targets || 'N/A'}
Help: ${violation.helpUrl}`;
          })
          .join('\n\n');
        violationsByTheme.push(themeViolations);
      }
    }
    const storyTheme = ((context as unknown as { globals?: { theme?: Theme } }).globals?.theme ?? 'light');
    await applyTheme(page, storyTheme);
    if (violationsByTheme.length > 0) {
      throw new Error(`Accessibility violations detected:\n\n${violationsByTheme.join('\n\n')}`);
    }
  }
};

export default config;
