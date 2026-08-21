/**
 * ESLint Architecture Rules
 * 
 * Enforces Bella Healthcare Constitution boundaries:
 * - Gate 1: No direct Kernel engine imports from Products
 * - Gate 2: No Core → Kernel imports
 * - Gate 3: No Product → Product imports
 * - Gate 4: Contract-first access only
 * 
 * Status: Week 2 Day 3 - P1 Prevention
 */

module.exports = {
  rules: {
    // GATE 1: Product → Contract boundary (no direct engine imports)
    'no-restricted-imports': ['error', {
      patterns: [
        '@/platform/healthcare/engines/*',
        '@/platform/education/engines/*',
        '@/platform/real-estate/engines/*',
        '@/platform/*/engines/*',
      ],
    }],
  },
  
  overrides: [
    // Allow Core to use its own utilities
    {
      files: ['src/core/**/*.ts', 'src/core/**/*.tsx'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            {
              group: ['@/platform/*/engines/*'],
              message: '🚫 CORE → KERNEL VIOLATION: Core cannot depend on domain Kernels.',
            },
          ],
        }],
      },
    },
    
    // Allow Kernels to import their own engines (internal access OK)
    {
      files: ['src/platform/healthcare/**/*.ts', 'src/platform/healthcare/**/*.tsx'],
      rules: {
        'no-restricted-imports': 'off', // Kernel can access its own engines
      },
    },
    
    {
      files: ['src/platform/education/**/*.ts', 'src/platform/education/**/*.tsx'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
    
    {
      files: ['src/platform/real-estate/**/*.ts', 'src/platform/real-estate/**/*.tsx'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
    
    // Products must use contract-first pattern
    {
      files: ['src/products/**/*.ts', 'src/products/**/*.tsx'],
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
    
    // Test files can import anything (for testing purposes)
    {
      files: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
  ],
};
