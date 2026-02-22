import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

const kitPlugins = (await sveltekit()) as unknown as any;
const plugins = Array.isArray(kitPlugins) ? kitPlugins : [kitPlugins];

export default defineConfig({
  envDir: '..',
  envPrefix: ['VITE_', 'PUBLIC_'],
  plugins: [...plugins, svelteTesting()],
  server: {
    allowedHosts: ['water.blaauw.rocks', 'localhost'],
    proxy: {
      '/api': {
        target: process.env.INTERNAL_API_URL || 'http://api:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    globals: true,
    setupFiles: ['src/vitest.setup.ts'],
  },
});
