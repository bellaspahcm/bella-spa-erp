import baseConfig from './eslint.config.mjs';
import { globalIgnores } from 'eslint/config';

export default [
  globalIgnores(['src/__tests__/**']),
  ...baseConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];
