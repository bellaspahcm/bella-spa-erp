/**
 * ESLint Flat Config (v9+)
 * Bella Architecture Enforcement
 */

import { globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default [
  globalIgnores([
    '.next/**',
    'coverage/**',
    'node_modules/**',
    'out/**',
    'dist/**',
    'build/**',
  ]),
  ...nextVitals,
  ...nextTypescript,
  {
    files: ['src/products/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          '@/platform/healthcare/engines/*',
          '@/platform/education/engines/*',
          '@/platform/real-estate/engines/*',
          '@/platform/*/engines/*',
        ],
      }],
    },
  },
];