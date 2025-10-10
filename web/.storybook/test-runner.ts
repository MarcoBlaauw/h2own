import type { TestRunnerConfig } from '@storybook/test-runner';

const config: TestRunnerConfig = {
  async preRender(page, context) {
    const theme = ((context as unknown as { globals?: { theme?: string } }).globals?.theme ?? 'light');
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
};

export default config;
