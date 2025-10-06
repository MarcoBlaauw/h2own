import path from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));

const svelteConfigs = svelte.configs['flat/recommended'].map((config) => ({
  ...config,
  languageOptions: {
    ...config.languageOptions,
    parserOptions: {
      ...config.languageOptions?.parserOptions,
      parser: tseslint.parser,
      project: './tsconfig.json',
      tsconfigRootDir,
      extraFileExtensions: ['.svelte']
    }
  }
}));

export default tseslint.config(
  {
    ignores: [
      'build',
      '.svelte-kit',
      'dist',
      'node_modules',
      'postcss.config.cjs',
      'svelte.config.js',
      'tailwind.config.ts',
      'playwright.config.ts',
      'eslint.config.js'
    ]
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    ...js.configs.recommended
  },
  ...tseslint.configs.recommended,
  ...svelteConfigs,
  {
    files: ['**/*.svelte'],
    rules: {
      'svelte/no-target-blank': 'error'
    }
  },
  {
    files: ['**/*.{js,ts,svelte,cjs,mjs}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'svelte/no-navigation-without-resolve': 'off',
      'svelte/require-each-key': 'off'
    }
  }
);
