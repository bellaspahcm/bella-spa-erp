/**
 * ESLint Flat Config (v9+)
 * Bella Architecture Enforcement
 */

export default [
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
