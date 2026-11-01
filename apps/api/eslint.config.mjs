import base from '@repo/config/eslint/base';

export default [
  ...base,
  {
    rules: {
      // Nest resolves constructor injection via emitDecoratorMetadata at
      // RUNTIME: injected services must be VALUE imports, never type imports.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
