import base from '@repo/config/eslint/base';

export default [
  ...base,
  {
    files: ['**/*.tsx'],
    rules: {
      // Components are typed by their props; React import is implicit (react-jsx).
      'no-unused-vars': 'off',
    },
  },
];
