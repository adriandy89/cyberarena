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
];
