import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, mergeConfig } from 'vitest/config';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

import baseConfig from './vite.config';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const basePlugins = 'plugins' in baseConfig ? baseConfig.plugins : [];

const unitTestConfig = defineConfig({
  plugins: basePlugins,
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{js,ts}'],
    setupFiles: [path.join(dirname, 'src/vitest.setup.ts')],
  },
});

const baseForStorybook = {
  ...unitTestConfig,
  test: unitTestConfig.test ? { ...unitTestConfig.test } : undefined,
};

if (baseForStorybook?.test && 'include' in baseForStorybook.test) {
  delete baseForStorybook.test.include;
}

const storybookConfig = mergeConfig(
  baseForStorybook,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          plugins: [storybookTest({ configDir: path.join(dirname, '.storybook') })],
          test: {
            browser: {
              enabled: true,
              headless: true,
              provider: playwright({}),
              instances: [{ browser: 'chromium' }],
            },
            setupFiles: [path.join(dirname, '.storybook/vitest.setup.ts')],
          },
        },
      ],
    },
  }),
);

export default process.env.VITEST_STORYBOOK === 'true' ? storybookConfig : unitTestConfig;
