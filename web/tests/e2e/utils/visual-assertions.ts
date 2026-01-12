import { expect, test, type Page } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

import { themeVisualBaselines, type ThemeVisualBaselineName } from '../fixtures/theme-visual-baselines';

const DEFAULT_OPTIONS = {
  /** Allow up to 0.01% of pixels to differ before failing. */
  maxDiffRatio: 0.0001,
  /** Pixelmatch threshold tuned for Playwright screenshots. */
  pixelmatchThreshold: 0.1
} as const;

type VisualAssertionOptions = Partial<typeof DEFAULT_OPTIONS>;

export const expectPageToMatchBaseline = async (
  page: Page,
  baselineName: ThemeVisualBaselineName,
  options: VisualAssertionOptions = {}
) => {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const screenshotBuffer = await page.screenshot({ fullPage: true, caret: 'hide' });
  const baselineBuffer = decodeBaseline(baselineName);

  const actual = PNG.sync.read(screenshotBuffer);
  const expected = PNG.sync.read(baselineBuffer);

  expect(actual.width, `${baselineName} screenshot width`).toBe(expected.width);
  expect(actual.height, `${baselineName} screenshot height`).toBe(expected.height);

  const diff = new PNG({ width: actual.width, height: actual.height });
  const diffPixels = pixelmatch(actual.data, expected.data, diff.data, actual.width, actual.height, {
    threshold: settings.pixelmatchThreshold,
    includeAA: true
  });

  const maxDiffPixels = Math.floor(actual.width * actual.height * settings.maxDiffRatio);

  if (diffPixels > maxDiffPixels) {
    const testInfo = test.info();
    await Promise.all([
      testInfo.attach(`${baselineName}-actual.png`, { body: screenshotBuffer, contentType: 'image/png' }),
      testInfo.attach(`${baselineName}-expected.png`, { body: baselineBuffer, contentType: 'image/png' }),
      testInfo.attach(`${baselineName}-diff.png`, { body: PNG.sync.write(diff), contentType: 'image/png' })
    ]);
  }

  expect(diffPixels, `${baselineName} diff pixel count`).toBeLessThanOrEqual(maxDiffPixels);
};

const decodeBaseline = (name: ThemeVisualBaselineName) => {
  const base64 = themeVisualBaselines[name];
  if (!base64) {
    throw new Error(`Unknown visual baseline: ${name}`);
  }

  const serialized = base64.join('');
  return Buffer.from(serialized, 'base64');
};
