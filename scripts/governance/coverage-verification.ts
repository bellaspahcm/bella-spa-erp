#!/usr/bin/env tsx
/**
 * TypeScript Hardening — Coverage Verification
 * 
 * Proves all production TypeScript files are covered by Layer 2 scopes.
 * 
 * Method:
 * 1. Enumerate all production TS/TSX files
 * 2. Resolve files covered by each Layer 2 scope
 * 3. Identify uncovered files (if any)
 * 4. Report coverage percentage
 * 
 * Success: 100% coverage = ready for final census
 * Gap: <100% coverage = create additional scopes for uncovered areas
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as ts from 'typescript';

interface CoverageResult {
  totalFiles: number;
  coveredFiles: number;
  uncoveredFiles: string[];
  coveragePercentage: number;
  scopeCoverage: Map<string, number>;
}

const PRODUCTION_PATTERNS = [
  'src/**/*.{ts,tsx}',
  'packages/*/src/**/*.{ts,tsx}',
];

const EXCLUSION_PATTERNS = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/__tests__/**',
  '**/e2e/**',
  '**/scripts/**',
  '**/.next/**',
  '**/dist/**',
  '**/node_modules/**',
  '**/build/**',
];

/**
 * Enumerate all production TypeScript files
 */
function enumerateProductionFiles(): Set<string> {
  const cwd = process.cwd();
  const files = new Set<string>();

  for (const pattern of PRODUCTION_PATTERNS) {
    const matches = glob.sync(pattern, {
      cwd,
      absolute: false,
      ignore: EXCLUSION_PATTERNS,
      nodir: true,
    });
    
    matches.forEach(file => files.add(file.replace(/\\/g, '/')));
  }

  return files;
}

/**
 * Resolve files covered by a tsconfig
 */
function resolveScopeFiles(tsconfigPath: string): Set<string> {
  const absolutePath = path.resolve(process.cwd(), tsconfigPath);
  
  if (!fs.existsSync(absolutePath)) {
    return new Set();
  }

  try {
    const configFile = ts.readConfigFile(absolutePath, ts.sys.readFile);
    if (configFile.error) return new Set();

    const basePath = path.dirname(absolutePath);
    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      basePath
    );

    if (parsedConfig.errors.length > 0) return new Set();

    const files = new Set<string>();
    parsedConfig.fileNames.forEach(fileName => {
      const relativePath = path.relative(process.cwd(), fileName).replace(/\\/g, '/');
      files.add(relativePath);
    });

    return files;
  } catch {
    return new Set();
  }
}

/**
 * Discover all Layer 2 tsconfigs
 */
function discoverLayer2Scopes(): string[] {
  return glob.sync('tsconfig.compile-*.json', {
    cwd: process.cwd(),
    absolute: false,
  }).sort();
}

/**
 * Analyze coverage
 */
function analyzeCoverage(): CoverageResult {
  console.log('Enumerating production TypeScript files...');
  const productionFiles = enumerateProductionFiles();
  console.log(`   Found ${productionFiles.size} production files\n`);

  console.log('Discovering Layer 2 scopes...');
  const scopes = discoverLayer2Scopes();
  console.log(`   Found ${scopes.length} Layer 2 scopes\n`);

  console.log('Resolving scope coverage...');
  const covered = new Set<string>();
  const scopeCoverage = new Map<string, number>();

  for (const tsconfig of scopes) {
    const scopeName = tsconfig.replace('tsconfig.compile-', '').replace('.json', '');
    process.stdout.write(`   ${scopeName.padEnd(20)}`);
    
    const scopeFiles = resolveScopeFiles(tsconfig);
    scopeCoverage.set(scopeName, scopeFiles.size);
    
    scopeFiles.forEach(file => {
      if (productionFiles.has(file)) {
        covered.add(file);
      }
    });
    
    console.log(`${scopeFiles.size.toString().padStart(4)} files`);
  }

  const uncovered = Array.from(productionFiles).filter(f => !covered.has(f)).sort();

  return {
    totalFiles: productionFiles.size,
    coveredFiles: covered.size,
    uncoveredFiles: uncovered,
    coveragePercentage: (covered.size / productionFiles.size) * 100,
    scopeCoverage,
  };
}

/**
 * Group uncovered files by directory
 */
function groupUncoveredByDirectory(files: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  
  for (const file of files) {
    const dir = path.dirname(file);
    const topLevel = dir.split('/')[0] || 'root';
    
    if (!groups.has(topLevel)) {
      groups.set(topLevel, []);
    }
    groups.get(topLevel)!.push(file);
  }
  
  return groups;
}

/**
 * Main execution
 */
function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('TypeScript Hardening — Coverage Verification');
  console.log('═══════════════════════════════════════════════\n');

  const result = analyzeCoverage();

  console.log('\n═══════════════════════════════════════════════');
  console.log('Coverage Summary');
  console.log('═══════════════════════════════════════════════');
  console.log(`Total production files:  ${result.totalFiles}`);
  console.log(`Covered by Layer 2:      ${result.coveredFiles}`);
  console.log(`Uncovered:               ${result.uncoveredFiles.length}`);
  console.log(`Coverage:                ${result.coveragePercentage.toFixed(1)}%\n`);

  if (result.uncoveredFiles.length === 0) {
    console.log('🎉 100% COVERAGE — All production files in Layer 2 scopes\n');
    console.log('✅ Ready for final census verification\n');
    console.log('Next: Run final census to confirm 0 diagnostics');
    console.log('      npx tsx scripts/governance/step6d-diagnostic-census.ts\n');
    process.exit(0);
  }

  console.log(`⚠️  ${result.uncoveredFiles.length} files not covered by any Layer 2 scope\n`);
  
  const grouped = groupUncoveredByDirectory(result.uncoveredFiles);
  console.log('Uncovered files by directory:\n');
  
  for (const [dir, files] of Array.from(grouped.entries()).sort()) {
    console.log(`   ${dir}/ (${files.length} files)`);
    files.slice(0, 5).forEach(f => console.log(`      ${f}`));
    if (files.length > 5) {
      console.log(`      ... and ${files.length - 5} more`);
    }
    console.log();
  }

  console.log('Action required: Create additional scopes to cover uncovered areas\n');
  process.exit(1);
}

main();
