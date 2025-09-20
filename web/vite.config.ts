import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

const kitPlugins = (await sveltekit()) as unknown as any;

export default defineConfig({
  plugins: kitPlugins,
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    globals: true,
  },
});
