/**
 * lint-staged configuration
 * 
 * Runs on git-staged files before commit.
 * Enforces architecture boundaries at commit time.
 * 
 * Week 2 Day 3 - P1 Prevention
 */

module.exports = {
  // TypeScript/TSX files: ESLint architecture rules
  '*.{ts,tsx}': [
    'eslint --max-warnings 0',
  ],
  
  // Product files: Extra strict boundary checks
  'src/products/**/*.{ts,tsx}': [
    'eslint --max-warnings 0',
    () => 'npm run healthcare:guard',
  ],
  
  // Kernel files: Verify no Core imports
  'src/platform/**/*.{ts,tsx}': [
    'eslint --max-warnings 0',
  ],
};
