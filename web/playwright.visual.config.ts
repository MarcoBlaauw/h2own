import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

export default defineConfig({
  ...baseConfig,
  grep: /@visual/,
  use: {
    ...baseConfig.use,
    colorScheme: 'light'
  }
});
