#!/usr/bin/env tsx
/**
 * STEP 6D — Product Scope Expansion
 * 
 * Discovers all Products in /products/ directory and generates
 * Layer 2 compilation scopes following the proven pattern from 6C.
 * 
 * Input: src/products/* directories
 * Output: tsconfig.compile-{product}.json files
 * Pattern: Standalone config, Product-Isolated (routes + product impl only)
 */

import * as fs from 'fs';
import * as path from 'path';

interface ProductInfo {
  name: string;
  directory: string;
  routePattern: string;
  tsconfigName: string;
}

const PRODUCTS_DIR = 'src/products';
const TSCONFIG_TEMPLATE = {
  compilerOptions: {
    target: 'ES2017',
    lib: ['dom', 'dom.iterable', 'esnext'],
    allowJs: true,
    skipLibCheck: false,
    strict: true,
    noEmit: true,
    esModuleInterop: true,
    module: 'esnext',
    moduleResolution: 'bundler',
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: 'react-jsx',
    paths: {
      '@/*': ['./src/*'],
      '@bella/shared': ['./packages/shared/src'],
    },
  },
  exclude: [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
    '**/__tests__/**',
  ],
};

/**
 * Discover all product directories
 */
function discoverProducts(): ProductInfo[] {
  const productsPath = path.resolve(process.cwd(), PRODUCTS_DIR);
  
  if (!fs.existsSync(productsPath)) {
    console.error(`❌ Products directory not found: ${productsPath}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(productsPath, { withFileTypes: true });
  const products: ProductInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '__tests__') {
      continue;
    }

    // Extract product name (bella-automove → automove)
    const productName = entry.name.replace(/^bella-/, '');
    
    products.push({
      name: productName,
      directory: entry.name,
      routePattern: `src/app/**/${productName}/**/*.{ts,tsx}`,
      tsconfigName: `tsconfig.compile-${productName}.json`,
    });
  }

  return products.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Check if tsconfig already exists
 */
function tsconfigExists(filename: string): boolean {
  return fs.existsSync(path.resolve(process.cwd(), filename));
}

/**
 * Generate tsconfig for a product
 */
function generateTsconfig(product: ProductInfo): object {
  return {
    ...TSCONFIG_TEMPLATE,
    include: [
      product.routePattern,
      `src/products/${product.directory}/**/*.{ts,tsx}`,
      'src/types/database.types.ts',
    ],
  };
}

/**
 * Write tsconfig file
 */
function writeTsconfig(product: ProductInfo, content: object): void {
  const filename = path.resolve(process.cwd(), product.tsconfigName);
  fs.writeFileSync(filename, JSON.stringify(content, null, 2) + '\n');
  console.log(`   ✅ Created: ${product.tsconfigName}`);
}

/**
 * Main execution
 */
function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('STEP 6D — Product Scope Expansion');
  console.log('═══════════════════════════════════════════════\n');

  const products = discoverProducts();
  console.log(`📦 Discovered ${products.length} products:\n`);

  let created = 0;
  let skipped = 0;

  for (const product of products) {
    const exists = tsconfigExists(product.tsconfigName);
    
    if (exists) {
      console.log(`   ⏭️  Skip: ${product.tsconfigName} (already exists)`);
      skipped++;
    } else {
      const config = generateTsconfig(product);
      writeTsconfig(product, config);
      created++;
    }
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('Summary');
  console.log('═══════════════════════════════════════════════');
  console.log(`Total products: ${products.length}`);
  console.log(`Created: ${created}`);
  console.log(`Skipped (existing): ${skipped}`);
  console.log('\n✅ Product scope expansion complete\n');
  console.log('Next: Run diagnostic census on all scopes');
  console.log('      npx tsx scripts/governance/step6d-diagnostic-census.ts\n');
}

main();
