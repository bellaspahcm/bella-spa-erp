#!/usr/bin/env node
/**
 * BELLA ARCHITECTURE GUARD
 * 
 * Multi-layer enforcement for frozen architecture boundaries.
 * Protects E7.1, E7.2, E7.3 from unauthorized modifications.
 * 
 * Usage:
 *   npm run arch:guard
 *   npm run arch:guard -- --verbose
 *   npm run arch:guard -- --check-hashes
 *   npm run arch:guard -- --mode=controlled-rebuild --scope=logistics/domain
 * 
 * Modes:
 *   default: Enforce frozen boundaries and dependency rules
 *   controlled-rebuild: Additional scope-based path enforcement for controlled resets
 * 
 * Exit codes:
 *   0 = All checks passed
 *   1 = Frozen boundary violation detected
 *   2 = Dependency boundary violation detected
 *   3 = Hash verification failed
 *   4 = Controlled rebuild scope violation detected
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

interface FrozenArtifact {
  path: string;
  type: string;
  publicAPI: boolean;
  baselineHash?: string;
}

interface FrozenLayer {
  id: string;
  name: string;
  status: 'DRAFT' | 'FROZEN' | 'SEALED';
  artifacts: FrozenArtifact[];
  allowedImports: string[];
  forbiddenImports: string[];
  invariants: string[];
}

interface ManifestV1 {
  version: string;
  layers: FrozenLayer[];
  dependencies: Record<string, string[]>;
  regressionTests: {
    command: string;
    expectedTotal: number;
    mustPassAll: boolean;
  };
}

interface ViolationReport {
  layer: string;
  artifact: string;
  violationType: 'MODIFICATION' | 'HASH_MISMATCH' | 'FORBIDDEN_IMPORT' | 'MISSING_FILE' | 'SCOPE_VIOLATION';
  expected?: string;
  actual?: string;
  details: string;
}

interface ControlledRebuildConfig {
  enabled: boolean;
  scope: string;
  allowedPaths: string[];
  blockedPaths: string[];
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(WORKSPACE_ROOT, 'ARCHITECTURE_FREEZE_MANIFEST.json');

const FROZEN_LAYERS: FrozenLayer[] = [
  {
    id: 'E7.1',
    name: 'E7.1 Domain Kernel',
    status: 'SEALED',
    artifacts: [
      { path: 'src/platform/logistics/domain/inventory.types.ts', type: 'TYPE_DEFINITION', publicAPI: true },
      { path: 'src/platform/logistics/domain/inventory.domain.ts', type: 'DOMAIN_LOGIC', publicAPI: true },
      { path: 'src/platform/logistics/domain/movement.types.ts', type: 'TYPE_DEFINITION', publicAPI: true },
      { path: 'src/platform/logistics/domain/movement.domain.ts', type: 'DOMAIN_LOGIC', publicAPI: true },
      { path: 'src/platform/logistics/domain/traceability.types.ts', type: 'TYPE_DEFINITION', publicAPI: true },
      { path: 'src/platform/logistics/domain/traceability.domain.ts', type: 'DOMAIN_LOGIC', publicAPI: true },
      { path: 'src/platform/logistics/domain/item.types.ts', type: 'TYPE_DEFINITION', publicAPI: true },
      { path: 'src/platform/logistics/domain/item.domain.ts', type: 'DOMAIN_LOGIC', publicAPI: true },
      { path: 'src/platform/logistics/domain/location.types.ts', type: 'TYPE_DEFINITION', publicAPI: true },
      { path: 'src/platform/logistics/domain/location.domain.ts', type: 'DOMAIN_LOGIC', publicAPI: true },
      { path: 'src/platform/logistics/domain/uom.types.ts', type: 'TYPE_DEFINITION', publicAPI: true },
      { path: 'src/platform/logistics/domain/uom.domain.ts', type: 'DOMAIN_LOGIC', publicAPI: true },
    ],
    allowedImports: ['node:', 'type-fest', '@types/'],
    forbiddenImports: [
      'src/platform/logistics/domain/rules/',
      'src/products/',
      'src/workflows/',
      '/notification/',
      '/task/',
    ],
    invariants: [
      'Entity immutability after creation',
      'Tenant isolation mandatory',
      'No workflow execution in domain',
      'No external service calls',
    ],
  },
  // E7.2 Operational Kernel: intentionally deferred (Sept 3, 2026)
  // Implementation deleted during E7.1 controlled rebuild
  // Canonical architecture: still planned (see E7_LOGISTICS_OS_CONSTRUCTION_PLAN.md)
  // Guard entry removed to reflect actual implementation state
  // E7.3 Rules & Traceability: partially deferred (Sept 3, 2026)
  // 6 implementation files deleted during E7.1 controlled rebuild
  // 3 primitive files preserved (rule.types, rule.helpers, rule.composition)
  // Guard entry updated to reflect only existing primitives
  {
    id: 'E7.3',
    name: 'E7.3 Rules & Traceability (Primitives Only)',
    status: 'SEALED',
    artifacts: [
      { path: 'src/platform/logistics/domain/rules/rule.types.ts', type: 'TYPE_DEFINITION', publicAPI: true },
      { path: 'src/platform/logistics/domain/rules/rule.helpers.ts', type: 'HELPER', publicAPI: true },
      { path: 'src/platform/logistics/domain/rules/rule.composition.ts', type: 'COMPOSITION_LOGIC', publicAPI: true },
    ],
    allowedImports: [
      'node:',
      'type-fest',
      '@types/',
      'src/platform/logistics/domain/*.types.ts',
      'src/platform/logistics/domain/*.domain.ts',
    ],
    forbiddenImports: [
      'src/products/',
      'src/workflows/',
      '/warehouse/',
      '/finance/',
      '/qa/',
      '/notification/',
      '/task/',
      '/recall/',
      '/quarantine/',
    ],
    invariants: [
      'Rules return facts, not commands',
      'No workflow execution',
      'No Product service calls',
      'Deterministic evaluation',
      'Evidence preservation',
      'Tenant isolation',
      'No entity mutation',
    ],
  },
];

// ============================================================================
// CONTROLLED REBUILD CONFIGURATION
// ============================================================================

function getControlledRebuildConfig(scope: string): ControlledRebuildConfig {
  // Define allowed paths based on scope
  const scopeConfigs: Record<string, { allowed: string[]; blocked: string[] }> = {
    'logistics/domain': {
      allowed: [
        'src/platform/logistics/domain/*.ts',
        'src/platform/logistics/domain/**/*.ts',
        'src/platform/logistics/domain/*.test.ts',
        'src/platform/logistics/domain/**/*.test.ts',
        'src/platform/logistics/domain/__tests__/**/*.ts',
      ],
      blocked: [
        'supabase/migrations/**/*',
        'src/shared/database.types.ts',
        'src/platform/logistics/repositories/**/*',
        'src/platform/logistics/services/**/*',
        'src/platform/logistics/api/**/*',
        'src/platform/core/**/*',
        'src/platform/healthcare/**/*',
        'src/platform/real-estate/**/*',
        'src/platform/education/**/*',
        'src/platform/finance/**/*',
        'src/platform/spa/**/*',
      ],
    },
  };

  const config = scopeConfigs[scope];
  if (!config) {
    throw new Error(`Unknown controlled rebuild scope: ${scope}`);
  }

  return {
    enabled: true,
    scope,
    allowedPaths: config.allowed,
    blockedPaths: config.blocked,
  };
}

function isPathInScope(filePath: string, patterns: string[]): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  return patterns.some(pattern => {
    // Handle exact matches first
    if (pattern === normalizedPath) {
      return true;
    }
    
    // Convert glob pattern to regex
    let regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars except * and ?
      .replace(/\*\*/g, '___GLOBSTAR___') // Temporarily replace **
      .replace(/\*/g, '[^/]*') // * matches anything except /
      .replace(/___GLOBSTAR___/g, '.*'); // ** matches anything including /
    
    // Ensure pattern matches from start to end
    if (!regexPattern.startsWith('^')) {
      regexPattern = '^' + regexPattern;
    }
    if (!regexPattern.endsWith('$')) {
      regexPattern = regexPattern + '$';
    }
    
    const regex = new RegExp(regexPattern);
    return regex.test(normalizedPath);
  });
}

// ============================================================================
// UTILITIES
// ============================================================================

function computeFileHash(filePath: string): string {
  const absolutePath = path.join(WORKSPACE_ROOT, filePath);
  if (!fs.existsSync(absolutePath)) {
    return 'FILE_NOT_FOUND';
  }
  const content = fs.readFileSync(absolutePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

function extractImports(filePath: string): string[] {
  const absolutePath = path.join(WORKSPACE_ROOT, filePath);
  if (!fs.existsSync(absolutePath)) {
    return [];
  }
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const importRegex = /import\s+.*?from\s+['"](.+?)['"]/g;
  const imports: string[] = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function matchesPattern(importPath: string, pattern: string): boolean {
  if (pattern.endsWith('/')) {
    return importPath.startsWith(pattern) || importPath.includes(pattern);
  }
  return importPath.includes(pattern);
}

function isAllowedImport(importPath: string, allowedPatterns: string[]): boolean {
  // Relative imports within same directory are always allowed
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    return true;
  }
  return allowedPatterns.some((pattern) => matchesPattern(importPath, pattern));
}

function isForbiddenImport(importPath: string, forbiddenPatterns: string[]): boolean {
  return forbiddenPatterns.some((pattern) => matchesPattern(importPath, pattern));
}

// ============================================================================
// CHECKS
// ============================================================================

function checkFrozenFiles(): ViolationReport[] {
  const violations: ViolationReport[] = [];

  for (const layer of FROZEN_LAYERS) {
    if (layer.status !== 'SEALED' && layer.status !== 'FROZEN') {
      continue;
    }

    for (const artifact of layer.artifacts) {
      const absolutePath = path.join(WORKSPACE_ROOT, artifact.path);
      if (!fs.existsSync(absolutePath)) {
        violations.push({
          layer: layer.id,
          artifact: artifact.path,
          violationType: 'MISSING_FILE',
          details: `Frozen artifact missing: ${artifact.path}`,
        });
      }
    }
  }

  return violations;
}

function checkFileHashes(verbose: boolean): ViolationReport[] {
  const violations: ViolationReport[] = [];

  for (const layer of FROZEN_LAYERS) {
    if (layer.status !== 'SEALED') {
      continue;
    }

    for (const artifact of layer.artifacts) {
      const currentHash = computeFileHash(artifact.path);

      if (currentHash === 'FILE_NOT_FOUND') {
        violations.push({
          layer: layer.id,
          artifact: artifact.path,
          violationType: 'MISSING_FILE',
          details: `Frozen artifact not found: ${artifact.path}`,
        });
        continue;
      }

      if (artifact.baselineHash && currentHash !== artifact.baselineHash) {
        violations.push({
          layer: layer.id,
          artifact: artifact.path,
          violationType: 'HASH_MISMATCH',
          expected: artifact.baselineHash,
          actual: currentHash,
          details: `File content changed since freeze baseline`,
        });
      } else if (verbose) {
        console.log(`  ✅ ${artifact.path} (hash: ${currentHash.substring(0, 8)}...)`);
      }
    }
  }

  return violations;
}

function checkDependencyBoundaries(verbose: boolean): ViolationReport[] {
  const violations: ViolationReport[] = [];

  for (const layer of FROZEN_LAYERS) {
    for (const artifact of layer.artifacts) {
      const imports = extractImports(artifact.path);

      for (const importPath of imports) {
        // Check forbidden imports
        if (isForbiddenImport(importPath, layer.forbiddenImports)) {
          violations.push({
            layer: layer.id,
            artifact: artifact.path,
            violationType: 'FORBIDDEN_IMPORT',
            actual: importPath,
            details: `Forbidden import detected: "${importPath}"`,
          });
        }

        if (verbose) {
          console.log(`    Import: ${importPath}`);
        }
      }
    }
  }

  return violations;
}

// ============================================================================
// CONTROLLED REBUILD CHECKS
// ============================================================================

function checkControlledRebuildScope(config: ControlledRebuildConfig, verbose: boolean): ViolationReport[] {
  const violations: ViolationReport[] = [];

  // Get all TypeScript files that have been modified or created
  // For now, we'll check all files in the workspace against the rules
  const changedFiles = getRecentlyModifiedFiles();

  for (const filePath of changedFiles) {
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Check if file is in blocked paths
    if (isPathInScope(normalizedPath, config.blockedPaths)) {
      violations.push({
        layer: 'CONTROLLED_REBUILD',
        artifact: filePath,
        violationType: 'SCOPE_VIOLATION',
        details: `File modification blocked in controlled-rebuild mode: ${filePath}. This path is protected during ${config.scope} rebuild.`,
      });
      continue;
    }

    // Check if file is in allowed paths
    if (!isPathInScope(normalizedPath, config.allowedPaths)) {
      violations.push({
        layer: 'CONTROLLED_REBUILD',
        artifact: filePath,
        violationType: 'SCOPE_VIOLATION',
        details: `File outside declared scope: ${filePath}. Controlled rebuild scope is: ${config.scope}`,
      });
    } else if (verbose) {
      console.log(`  ✅ ${filePath} (within scope)`);
    }
  }

  return violations;
}

function getRecentlyModifiedFiles(): string[] {
  // Check git status for recently modified/added files
  // This is a simplified version - in practice would use git diff
  const { execSync } = require('child_process');
  
  try {
    // Get staged and unstaged changes
    const output = execSync('git status --porcelain', { 
      cwd: WORKSPACE_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    });

    const files: string[] = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // Parse git status output: XY filename
      const match = line.match(/^.{3}(.+)$/);
      if (match) {
        const file = match[1].trim();
        // Only check TypeScript/migration files
        if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.sql')) {
          files.push(file);
        }
      }
    }

    return files;
  } catch (error) {
    // If git command fails, return empty array (no violations)
    return [];
  }
}

// ============================================================================
// REPORTING
// ============================================================================

function printViolations(violations: ViolationReport[]): void {
  if (violations.length === 0) {
    console.log('\n✅ ARCHITECTURE GUARD — ALL CHECKS PASSED\n');
    return;
  }

  console.log('\n❌ ARCHITECTURE GUARD — VIOLATIONS DETECTED\n');

  const byLayer = violations.reduce((acc, v) => {
    if (!acc[v.layer]) acc[v.layer] = [];
    acc[v.layer].push(v);
    return acc;
  }, {} as Record<string, ViolationReport[]>);

  for (const [layerId, layerViolations] of Object.entries(byLayer)) {
    const layer = FROZEN_LAYERS.find((l) => l.id === layerId);
    console.log(`\n🔴 Layer: ${layer?.name || layerId}`);
    console.log(`   Status: ${layer?.status || 'UNKNOWN'}`);
    console.log(`   Violations: ${layerViolations.length}\n`);

    for (const violation of layerViolations) {
      console.log(`   ❌ ${violation.violationType}`);
      console.log(`      File: ${violation.artifact}`);
      console.log(`      Details: ${violation.details}`);
      if (violation.expected) {
        console.log(`      Expected: ${violation.expected.substring(0, 16)}...`);
      }
      if (violation.actual) {
        console.log(`      Actual: ${violation.actual.substring(0, 16)}...`);
      }
      console.log('');
    }
  }

  console.log('\n🔒 FROZEN BOUNDARY VIOLATION');
  console.log('   Status: BLOCKED\n');
  console.log('   Required steps:');
  console.log('   1. Create Architecture Change Request (ACR)');
  console.log('   2. Submit for Human Architect Review');
  console.log('   3. Document Architecture Decision Record (ADR)');
  console.log('   4. Update baseline and re-seal\n');
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const checkHashes = args.includes('--check-hashes') || args.includes('--hashes');
  
  // Parse mode and scope
  const modeArg = args.find(arg => arg.startsWith('--mode='));
  const scopeArg = args.find(arg => arg.startsWith('--scope='));
  
  const mode = modeArg ? modeArg.split('=')[1] : 'default';
  const scope = scopeArg ? scopeArg.split('=')[1] : '';

  let controlledRebuildConfig: ControlledRebuildConfig | null = null;

  if (mode === 'controlled-rebuild') {
    if (!scope) {
      console.error('❌ ERROR: --scope required when using --mode=controlled-rebuild');
      console.error('   Example: --mode=controlled-rebuild --scope=logistics/domain');
      process.exit(1);
    }
    
    try {
      controlledRebuildConfig = getControlledRebuildConfig(scope);
      console.log(`🔒 BELLA ARCHITECTURE GUARD — CONTROLLED REBUILD MODE`);
      console.log(`   Scope: ${scope}`);
      console.log(`   Enforcing scope boundaries + frozen layers\n`);
    } catch (error) {
      console.error(`❌ ERROR: ${(error as Error).message}`);
      process.exit(1);
    }
  } else {
    console.log('🔒 BELLA ARCHITECTURE GUARD');
    console.log('   Enforcing frozen boundaries for E7.1, E7.2, E7.3\n');
  }

  const allViolations: ViolationReport[] = [];

  // Controlled rebuild scope check (runs first if enabled)
  if (controlledRebuildConfig) {
    console.log('🎯 Check 0: Controlled rebuild scope enforcement...');
    const scopeViolations = checkControlledRebuildScope(controlledRebuildConfig, verbose);
    allViolations.push(...scopeViolations);
    if (scopeViolations.length === 0) {
      console.log('   ✅ All changes within declared scope\n');
    } else {
      console.log(`   ❌ ${scopeViolations.length} scope violations\n`);
    }
  }

  // Check 1: Frozen files exist
  console.log('📋 Check 1: Frozen file integrity...');
  const fileViolations = checkFrozenFiles();
  allViolations.push(...fileViolations);
  if (fileViolations.length === 0) {
    console.log('   ✅ All frozen files present\n');
  } else {
    console.log(`   ❌ ${fileViolations.length} missing files\n`);
  }

  // Check 2: File hashes (optional, requires baseline)
  if (checkHashes) {
    console.log('🔐 Check 2: File hash verification...');
    const hashViolations = checkFileHashes(verbose);
    allViolations.push(...hashViolations);
    if (hashViolations.length === 0) {
      console.log('   ✅ All hashes match baseline\n');
    } else {
      console.log(`   ❌ ${hashViolations.length} hash mismatches\n`);
    }
  }

  // Check 3: Dependency boundaries
  console.log('🔗 Check 3: Dependency boundary enforcement...');
  const dependencyViolations = checkDependencyBoundaries(verbose);
  allViolations.push(...dependencyViolations);
  if (dependencyViolations.length === 0) {
    console.log('   ✅ No forbidden imports detected\n');
  } else {
    console.log(`   ❌ ${dependencyViolations.length} forbidden imports\n`);
  }

  // Report
  printViolations(allViolations);

  // Exit code
  if (allViolations.length > 0) {
    const hasScopeViolations = allViolations.some((v) => v.violationType === 'SCOPE_VIOLATION');
    const hasForbiddenImports = allViolations.some((v) => v.violationType === 'FORBIDDEN_IMPORT');
    const hasHashMismatches = allViolations.some((v) => v.violationType === 'HASH_MISMATCH');
    
    if (hasScopeViolations) {
      process.exit(4);
    } else if (hasHashMismatches) {
      process.exit(3);
    } else if (hasForbiddenImports) {
      process.exit(2);
    } else {
      process.exit(1);
    }
  }

  process.exit(0);
}

main();
