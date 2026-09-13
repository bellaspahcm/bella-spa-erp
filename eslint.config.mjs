import nextVitals from 'eslint-config-next/core-web-vitals';

/**
 * ESLint Flat Config (v9+)
 * Bella Architecture Enforcement
 */

export default [
  ...nextVitals,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
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
