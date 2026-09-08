#!/usr/bin/env tsx
/**
 * TG-2 — Production Coverage Integrity Gate
 * 
 * Enforces invariant: Every production TypeScript source must be governed
 * by at least one canonical typecheck scope.
 * 
 * Mechanism: Enumerate production files, resolve governed scopes, detect gaps.
 * Result: PASS if all covered, BLOCK if any uncovered.
 * 
 * Does NOT auto-fix. Gate detects + blocks only.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as ts from 'typescript';

interface GateResult {
  pass: boolean;
  message: string;
  uncoveredFiles?: string[];
  stats?: CoverageStats;
}

interface CoverageStats {
  totalProduction: number;
  covered: number;
  uncovered: number;
  exclusions: number;
}

interface CoverageRegistry {
  [file: string]: string[]; // file -> [scope names]
}

/**
 * Explicit exclusion policy for non-production files
 */
const EXCLUSION_PATTERNS = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/e2e/**',
  '**/scripts/**',
  '**/.next/**',
  '**/dist/**',
  '**/node_modules/**',
  '**/build/**',
  '**/.turbo/**',
  '**/coverage/**',
  '**/playwright-report/**',
];

/**
 * Production source patterns
 */
const PRODUCTION_PATTERNS = [
  'src/**/*.{ts,tsx}',
  'kernels/**/*.{ts,tsx}',
  'products/**/*.{ts,tsx}',
  'services/**/*.{ts,tsx}',
  'packages/*/src/**/*.{ts,tsx}',
];

/**
 * Governed tsconfig locations
 * 
 * CRITICAL: Only scopes that are part of enforced governance system.
 * A scope qualifies as GOVERNED only if it:
 * 1. Executes within reasonable time (<120s)
 * 2. Is part of automated governance gates
 * 3. Can successfully typecheck its intended scope
 * 
 * EXCLUDED from governance (reference-only):
 * - tsconfig.json (root) — timeout >300s, not executable governed scope
 * - tsconfig.investigation-*.json — temporary investigation configs
 * - tsconfig.test-*.json — test-only configs
 */
const GOVERNED_TSCONFIGS = [
  // Platform scoped tsconfigs (GOVERNED - part of Gate B)
  'tsconfig.platform-healthcare.json',
  'tsconfig.platform-core.json',
  'tsconfig.platform-finance.json',
  'tsconfig.platform-logistics.json',
  'tsconfig.platform-real-estate.json',
  'tsconfig.platform-retail.json',
  'tsconfig.platform-education.json',
  'tsconfig.platform-host.json',
  'tsconfig.platform-accounting.json',
  'tsconfig.platform-iam-matrix.json',
  'tsconfig.platform-party.json',
  'tsconfig.platform-asset.json',
  'tsconfig.platform-events.json',
  'tsconfig.platform-security.json',
  'tsconfig.platform-integration-hub.json',
  'tsconfig.platform-messaging.json',
  
  // Healthcare Service Layer Scopes (TG-2.2B - Owner-Based)
  'tsconfig.hospital-services.json',
  'tsconfig.medical-services.json',
  'tsconfig.healthcare-shared-services.json',
  
  // Add more GOVERNED scopes as qualified
  // DO NOT add reference-only or timeout-prone configs
  
  // App Routes Scopes (STEP 5 — Owner-based Scope Architecture)
  'tsconfig.app-routes-identity-auth.json',  // Identity/Auth (5 routes)
  'tsconfig.app-routes-automove.json',  // AutoMove (22 routes)
  'tsconfig.app-routes-preschool.json',  // Preschool (20 routes)
  'tsconfig.app-routes-admin.json',  // Admin (41 routes)
  'tsconfig.app-routes-platform-core.json',  // Platform Core (28 routes)
  'tsconfig.app-routes-booking-engine.json',  // Booking Engine (5 routes)
  'tsconfig.app-routes-customer-management.json',  // Customer Management (12 routes)
  'tsconfig.app-routes-test-debug.json',  // Test/Debug (4 routes)
  'tsconfig.app-routes-decision-engine.json',  // Decision Engine (5 routes)
  'tsconfig.app-routes-finance-core.json',  // Finance Core (1 routes)
  'tsconfig.app-routes-intelligence.json',  // Intelligence (46 routes)
  'tsconfig.app-routes-inventory.json',  // Inventory (2 routes)
  'tsconfig.app-routes-partner-management.json',  // Partner Management (22 routes)
  'tsconfig.app-routes-hr-payroll.json',  // HR/Payroll (13 routes)
  'tsconfig.app-routes-workflows.json',  // Workflows (5 routes)
  'tsconfig.app-routes-waitlist.json',  // Waitlist (10 routes)
  'tsconfig.app-routes-platform-finance-core.json',  // Platform Finance Core (22 routes)
  'tsconfig.app-routes-ai-copilot.json',  // AI Copilot (4 routes)
  'tsconfig.app-routes-dashboard-general.json',  // Dashboard General (22 routes)
  'tsconfig.app-routes-dental.json',  // Dental (7 routes)
  'tsconfig.app-routes-healthcare-shared.json',  // Healthcare Shared (24 routes)
  'tsconfig.app-routes-hospital.json',  // Hospital (19 routes)
  'tsconfig.app-routes-workforce-management.json',  // Workforce Management (18 routes)
  'tsconfig.app-routes-marketing.json',  // Marketing (1 routes)
  'tsconfig.app-routes-medical-clinic.json',  // Medical Clinic (20 routes)
  'tsconfig.app-routes-operations.json',  // Operations (4 routes)
  'tsconfig.app-routes-real-estate.json',  // Real Estate (17 routes)
  'tsconfig.app-routes-training.json',  // Training (5 routes)
  'tsconfig.app-routes-beauty-spa.json',  // Beauty/Spa (5 routes)
  ];

/**
 * Enumerate all production TypeScript source files
 */
function enumerateProductionSource(): string[] {
  const cwd = process.cwd();
  const allFiles = new Set<string>();

  for (const pattern of PRODUCTION_PATTERNS) {
    const matches = glob.sync(pattern, {
      cwd,
      absolute: false,
      ignore: EXCLUSION_PATTERNS,
      nodir: true,
    });
    
    matches.forEach(file => allFiles.add(file.replace(/\\/g, '/')));
  }

  return Array.from(allFiles).sort();
}

/**
 * Resolve effective files for a TypeScript program from tsconfig
 */
function resolveEffectiveFiles(tsconfigPath: string): string[] {
  const absolutePath = path.resolve(process.cwd(), tsconfigPath);
  
  if (!fs.existsSync(absolutePath)) {
    console.warn(`⚠️  tsconfig not found: ${tsconfigPath}`);
    return [];
  }

  try {
    // Read and parse tsconfig
    const configFile = ts.readConfigFile(absolutePath, ts.sys.readFile);
    
    if (configFile.error) {
      console.warn(`⚠️  Error reading ${tsconfigPath}:`, configFile.error.messageText);
      return [];
    }

    const basePath = path.dirname(absolutePath);
    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      basePath
    );

    if (parsedConfig.errors.length > 0) {
      console.warn(`⚠️  Error parsing ${tsconfigPath}:`, parsedConfig.errors[0].messageText);
      return [];
    }

    // Get file names from parsed config
    const fileNames = parsedConfig.fileNames.map(fileName => 
      path.relative(process.cwd(), fileName).replace(/\\/g, '/')
    );

    return fileNames;
  } catch (error) {
    console.warn(`⚠️  Exception resolving ${tsconfigPath}:`, error);
    return [];
  }
}

/**
 * Build coverage registry mapping files to governing scopes
 */
function buildCoverageRegistry(): CoverageRegistry {
  const registry: CoverageRegistry = {};

  console.log('📋 Resolving governed scopes...');
  
  for (const tsconfigPath of GOVERNED_TSCONFIGS) {
    const scopeName = path.dirname(tsconfigPath) || 'root';
    console.log(`   Resolving ${scopeName}...`);
    
    const effectiveFiles = resolveEffectiveFiles(tsconfigPath);
    
    for (const file of effectiveFiles) {
      // Only track production TypeScript files
      if (file.match(/\.tsx?$/) && !isExcluded(file)) {
        if (!registry[file]) {
          registry[file] = [];
        }
        registry[file].push(scopeName);
      }
    }
  }

  return registry;
}

/**
 * Check if a file matches exclusion patterns
 */
function isExcluded(file: string): boolean {
  for (const pattern of EXCLUSION_PATTERNS) {
    // Simple glob matching for exclusions
    const regex = new RegExp(
      pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\./g, '\\.')
    );
    
    if (regex.test(file)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Analyze coverage
 */
function analyzeCoverage(
  productionFiles: string[],
  registry: CoverageRegistry
): { uncovered: string[]; stats: CoverageStats } {
  const uncovered: string[] = [];
  
  for (const file of productionFiles) {
    const scopes = registry[file] || [];
    
    if (scopes.length === 0) {
      uncovered.push(file);
    }
  }

  const stats: CoverageStats = {
    totalProduction: productionFiles.length,
    covered: productionFiles.length - uncovered.length,
    uncovered: uncovered.length,
    exclusions: 0, // Could enumerate if needed
  };

  return { uncovered, stats };
}

/**
 * Format BLOCK message
 */
function formatBlockMessage(uncovered: string[], stats: CoverageStats): string {
  // Group uncovered files by directory for cleaner output
  const grouped: { [dir: string]: string[] } = {};
  
  for (const file of uncovered) {
    const dir = path.dirname(file);
    if (!grouped[dir]) {
      grouped[dir] = [];
    }
    grouped[dir].push(path.basename(file));
  }

  let message = `
═══════════════════════════════════════════════════
TG-2 PRODUCTION COVERAGE INTEGRITY GATE: BLOCK
═══════════════════════════════════════════════════

Production source files exist outside typecheck governance.

Coverage Summary:
  Total production files: ${stats.totalProduction}
  Covered: ${stats.covered} (${Math.round(stats.covered / stats.totalProduction * 100)}%)
  Uncovered: ${stats.uncovered}

Uncovered files by directory:
`;

  for (const [dir, files] of Object.entries(grouped)) {
    message += `\n  ${dir}/\n`;
    for (const file of files.slice(0, 10)) { // Limit to 10 per dir
      message += `    - ${file}\n`;
    }
    if (files.length > 10) {
      message += `    ... and ${files.length - 10} more\n`;
    }
  }

  message += `
Required action:
1. Review uncovered files and determine correct ownership scope
2. Add files to appropriate governed tsconfig
3. Rerun this gate

Do NOT blindly add files to nearest scope — respect architecture boundaries.

See: docs/architecture/TG2_PRODUCTION_COVERAGE_INTEGRITY.md
═══════════════════════════════════════════════════
`;

  return message;
}

/**
 * Run TG-2 Gate
 */
async function runTG2Gate(): Promise<GateResult> {
  console.log('🔒 TG-2 — Production Coverage Integrity Gate');
  console.log('');

  try {
    // Step 1: Enumerate production source
    console.log('📁 Enumerating production source...');
    const productionFiles = enumerateProductionSource();
    console.log(`   Found ${productionFiles.length} production files`);

    // Step 2: Build coverage registry
    const registry = buildCoverageRegistry();
    console.log(`   Registry built with ${Object.keys(registry).length} covered files`);

    // Step 3: Analyze coverage
    console.log('');
    console.log('🔍 Analyzing coverage...');
    const { uncovered, stats } = analyzeCoverage(productionFiles, registry);

    // Step 4: Gate decision
    if (uncovered.length === 0) {
      const message = `✅ PASS: All production source governed (${stats.covered}/${stats.totalProduction} files)`;
      console.log('');
      console.log(message);
      return { pass: true, message, stats };
    } else {
      const message = formatBlockMessage(uncovered, stats);
      console.log('');
      console.error(message);
      return {
        pass: false,
        message,
        uncoveredFiles: uncovered,
        stats,
      };
    }
  } catch (error) {
    const message = `❌ GATE ERROR: ${error instanceof Error ? error.message : String(error)}`;
    console.error(message);
    return { pass: false, message };
  }
}

// Execute gate
runTG2Gate()
  .then(result => {
    process.exit(result.pass ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

// Export for testing
export { runTG2Gate, enumerateProductionSource, buildCoverageRegistry, analyzeCoverage };
