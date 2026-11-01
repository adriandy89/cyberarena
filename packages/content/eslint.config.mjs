import base from '@repo/config/eslint/base';

export default [
  // MDX/JSON sources are data, not lintable code.
  { ignores: ['content/**', 'dist/**'] },
  ...base,
];
