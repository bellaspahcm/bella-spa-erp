/**
 * Main ESLint Configuration
 * Extends architecture rules for Bella Platform enforcement
 */

module.exports = {
  extends: [
    'next/core-web-vitals',
    './.eslintrc.architecture.js',
  ],
  
  parser: '@typescript-eslint/parser',
  
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
};
