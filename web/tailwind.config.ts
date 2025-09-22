import { skeleton } from '@skeletonlabs/tw-plugin';
import type { Config } from 'tailwindcss';

import h2ownTheme from './src/lib/themes/h2own';

const config = {
  darkMode: 'class',
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.08), 0 12px 24px rgba(15, 23, 42, 0.04)'
      }
    }
  },
  plugins: [
    skeleton({
      themes: {
        custom: [h2ownTheme]
      }
    })
  ]
} satisfies Config;

export default config;
