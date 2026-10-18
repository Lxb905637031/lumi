import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import typescriptEslint from 'typescript-eslint';

export default typescriptEslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.taro/**',
      '**/.swc/**',
      '**/.playwright-cli/**',
      '**/output/**',
      '**/.codex/**',
    ],
  },
  eslint.configs.recommended,
  ...typescriptEslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    rules: {
      // Nest uses emitted constructor metadata to resolve providers and DTO classes at runtime.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  prettier,
);
