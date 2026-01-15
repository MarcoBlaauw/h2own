import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const baseUrl = process.env.BASELINE_BASE_URL ?? 'http://127.0.0.1:4173';
const outputPath = path.resolve(
  dirname,
  '../web/tests/e2e/fixtures/theme-visual-baselines.ts',
);

const waitForLayoutStability = async (page) => {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(250);
};

const chunkBase64 = (buffer, chunkSize = 120) => {
  const base64 = buffer.toString('base64');
  const chunks = [];
  for (let i = 0; i < base64.length; i += chunkSize) {
    chunks.push(base64.slice(i, i + chunkSize));
  }
  return chunks;
};

const formatChunks = (chunks) =>
  chunks.map((chunk) => `    '${chunk}'`).join(',\n');

const capture = async (page, theme) => {
  await page.goto(baseUrl);
  await page.addStyleTag({
    content:
      '* { transition-duration: 0s !important; animation-duration: 0s !important; animation-iteration-count: 1 !important; }',
  });
  await waitForLayoutStability(page);

  if (theme === 'dark') {
    const toggleButton = page.getByRole('button', { name: /Activate dark theme/ });
    await toggleButton.click();
    await waitForLayoutStability(page);
  }

  return page.screenshot({ fullPage: true, caret: 'hide' });
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage();

  const light = await capture(page, 'light');
  const dark = await capture(page, 'dark');

  const lightChunks = formatChunks(chunkBase64(light));
  const darkChunks = formatChunks(chunkBase64(dark));

  const output = `// Auto-generated from Playwright baseline screenshots encoded as base64 strings.
// Avoids committing binary assets while retaining deterministic visual expectations.

export const themeVisualBaselines = {
  'home-light': [
${lightChunks}
  ],
  'home-dark': [
${darkChunks}
  ]
} as const;
`;

  await writeFile(outputPath, output, 'utf8');
} finally {
  await browser.close();
}
