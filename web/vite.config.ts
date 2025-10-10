import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

const kitPlugins = (await sveltekit()) as unknown as any;
const plugins = Array.isArray(kitPlugins) ? kitPlugins : [kitPlugins];

export default defineConfig({
  plugins: [...plugins, svelteTesting()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    globals: true,
  },
});
