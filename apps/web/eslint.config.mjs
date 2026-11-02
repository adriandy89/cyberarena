import base from '@repo/config/eslint/base';
import coreWebVitals from 'eslint-config-next/core-web-vitals';

export default [
  ...base,
  ...coreWebVitals,
  {
    // Next.js owns the build for this workspace.
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Plain Node scripts (pnpm icons): no type information for type-aware rules.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { Buffer: 'readonly', URL: 'readonly' } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
