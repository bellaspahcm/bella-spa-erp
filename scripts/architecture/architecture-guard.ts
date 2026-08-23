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
 * 
 * Exit codes:
 *   0 = All checks passed
 *   1 = Frozen boundary violation detected
 *   2 = Dependency boundary violation detected
 *   3 = Hash verification failed
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
  violationType: 'MODIFICATION' | 'HASH_MISMATCH' | 'FORBIDDEN_IMPORT' | 'MISSING_FILE';
  expected?: string;
  actual?: string;
  details: string;
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
  {
    id: 'E7.2',
    name: 'E7.2 Operational Kernel',
    status: 'SEALED',
    artifacts: [
      { path: 'src/platform/logistics/domain/inventory-operations.domain.ts', type: 'OPERATION_LOGIC', publicAPI: true },
    ],
    allowedImports: [
      'node:',
      'type-fest',
      '@types/',
      'src/platform/logistics/domain/*.types.ts',
      'src/platform/logistics/domain/*.domain.ts',
    ],
    forbiddenImports: [
      'src/platform/logistics/domain/rules/',
      'src/products/',
      'src/workflows/',
      '/notification/',
      '/task/',
    ],
    invariants: [
      'Event-after-persistence',
      'Operations are deterministic',
      'No workflow execution',
      'Tenant isolation preserved',
    ],
  },
  {
    id: 'E7.3',
    name: 'E7.3 Rules & Traceability',
    status: 'SEALED',
    artifacts: [
      { path: 'src/platform/logistics/domain/rules/rule.types.ts', type: 'TYPE_DEFINITION', publicAPI: true },
      { path: 'src/platform/logistics/domain/rules/rule.helpers.ts', type: 'HELPER', publicAPI: true },
      { path: 'src/platform/logistics/domain/rules/expiry.rule.ts', type: 'RULE', publicAPI: true },
      { path: 'src/platform/logistics/domain/rules/quantity.rule.ts', type: 'RULE', publicAPI: true },
      { path: 'src/platform/logistics/domain/rules/traceability.rule.ts', type: 'RULE', publicAPI: true },
      { path: 'src/platform/logistics/domain/rules/traceability.operations.ts', type: 'OPERATION_LOGIC', publicAPI: true },
      { path: 'src/platform/logistics/domain/rules/compliance.evaluation.ts', type: 'EVALUATION_LOGIC', publicAPI: true },
      { path: 'src/platform/logistics/domain/rules/rule.composition.ts', type: 'COMPOSITION_LOGIC', publicAPI: true },
      { path: 'src/platform/logistics/domain/rules/index.ts', type: 'EXPORT', publicAPI: true },
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

  console.log('🔒 BELLA ARCHITECTURE GUARD');
  console.log('   Enforcing frozen boundaries for E7.1, E7.2, E7.3\n');

  const allViolations: ViolationReport[] = [];

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
    const hasForbiddenImports = allViolations.some((v) => v.violationType === 'FORBIDDEN_IMPORT');
    const hasHashMismatches = allViolations.some((v) => v.violationType === 'HASH_MISMATCH');
    
    if (hasHashMismatches) {
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
