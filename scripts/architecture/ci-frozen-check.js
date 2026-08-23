#!/usr/bin/env node
/**
 * CI FROZEN FILE CHECK
 * 
 * Detects modifications to frozen kernel files in pull requests.
 * Part of Layer 4 (CI Architecture Gate).
 * 
 * Usage:
 *   node scripts/architecture/ci-frozen-check.js
 * 
 * Environment:
 *   - Runs in CI environment
 *   - Compares current branch against base branch
 * 
 * Exit codes:
 *   0 = No frozen files modified
 *   1 = Frozen files modified (blocks PR)
 */

const { execSync } = require('child_process');
const path = require('path');

// ============================================================================
// FROZEN FILES (E7.1, E7.2, E7.3)
// ============================================================================

const FROZEN_FILES = [
  // E7.1 Domain Kernel (12 artifacts)
  'src/platform/logistics/domain/inventory.types.ts',
  'src/platform/logistics/domain/inventory.domain.ts',
  'src/platform/logistics/domain/movement.types.ts',
  'src/platform/logistics/domain/movement.domain.ts',
  'src/platform/logistics/domain/traceability.types.ts',
  'src/platform/logistics/domain/traceability.domain.ts',
  'src/platform/logistics/domain/item.types.ts',
  'src/platform/logistics/domain/item.domain.ts',
  'src/platform/logistics/domain/location.types.ts',
  'src/platform/logistics/domain/location.domain.ts',
  'src/platform/logistics/domain/uom.types.ts',
  'src/platform/logistics/domain/uom.domain.ts',
  
  // E7.2 Operational Kernel (1 artifact)
  'src/platform/logistics/domain/inventory-operations.domain.ts',
  
  // E7.3 Rules & Traceability (9 artifacts)
  'src/platform/logistics/domain/rules/rule.types.ts',
  'src/platform/logistics/domain/rules/rule.helpers.ts',
  'src/platform/logistics/domain/rules/expiry.rule.ts',
  'src/platform/logistics/domain/rules/quantity.rule.ts',
  'src/platform/logistics/domain/rules/traceability.rule.ts',
  'src/platform/logistics/domain/rules/traceability.operations.ts',
  'src/platform/logistics/domain/rules/compliance.evaluation.ts',
  'src/platform/logistics/domain/rules/rule.composition.ts',
  'src/platform/logistics/domain/rules/index.ts',
  
  // Architecture Guard Scripts (5 artifacts) — Self-Protection
  'scripts/architecture/git-pre-commit-guard.js',
  'scripts/architecture/ci-frozen-check.js',
  'scripts/architecture/ci-guard-integrity.js',
  'scripts/architecture/ci-dependency-check.js',
  '.github/workflows/architecture-gate.yml',
];

const LAYER_MAP = {
  'inventory.types.ts': 'E7.1 Domain Kernel',
  'inventory.domain.ts': 'E7.1 Domain Kernel',
  'movement.types.ts': 'E7.1 Domain Kernel',
  'movement.domain.ts': 'E7.1 Domain Kernel',
  'traceability.types.ts': 'E7.1 Domain Kernel',
  'traceability.domain.ts': 'E7.1 Domain Kernel',
  'item.types.ts': 'E7.1 Domain Kernel',
  'item.domain.ts': 'E7.1 Domain Kernel',
  'location.types.ts': 'E7.1 Domain Kernel',
  'location.domain.ts': 'E7.1 Domain Kernel',
  'uom.types.ts': 'E7.1 Domain Kernel',
  'uom.domain.ts': 'E7.1 Domain Kernel',
  'inventory-operations.domain.ts': 'E7.2 Operational Kernel',
  'rule.types.ts': 'E7.3 Rules & Traceability',
  'rule.helpers.ts': 'E7.3 Rules & Traceability',
  'expiry.rule.ts': 'E7.3 Rules & Traceability',
  'quantity.rule.ts': 'E7.3 Rules & Traceability',
  'traceability.rule.ts': 'E7.3 Rules & Traceability',
  'traceability.operations.ts': 'E7.3 Rules & Traceability',
  'compliance.evaluation.ts': 'E7.3 Rules & Traceability',
  'rule.composition.ts': 'E7.3 Rules & Traceability',
  'rules/index.ts': 'E7.3 Rules & Traceability',
  'git-pre-commit-guard.js': 'Architecture Guard (Layer 3)',
  'ci-frozen-check.js': 'Architecture Guard (Layer 4)',
  'ci-guard-integrity.js': 'Architecture Guard (Layer 4)',
  'ci-dependency-check.js': 'Architecture Guard (Layer 4)',
  'architecture-gate.yml': 'Architecture Guard (Layer 4)',
};

// ============================================================================
// UTILITIES
// ============================================================================

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function getLayerForFile(filename) {
  for (const [pattern, layer] of Object.entries(LAYER_MAP)) {
    if (filename.includes(pattern)) {
      return layer;
    }
  }
  return 'Unknown Layer';
}

function isFrozenFile(filePath) {
  const normalized = normalizePath(filePath);
  return FROZEN_FILES.some(frozenPath => normalized.endsWith(frozenPath));
}

function getChangedFiles() {
  try {
    // Detect base branch
    const baseBranch = process.env.GITHUB_BASE_REF || 'origin/main';
    
    // Get all changed files (modified, added, renamed, deleted)
    const output = execSync(
      `git diff --name-only --diff-filter=AMRD ${baseBranch}...HEAD`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    
    return output
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
  } catch (error) {
    console.error('Error getting changed files:', error.message);
    // In CI, this should fail loudly
    throw error;
  }
}

function getChangeType(filePath, baseBranch) {
  try {
    // Check if file was deleted
    const statusOutput = execSync(
      `git diff --name-status ${baseBranch}...HEAD -- "${filePath}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    
    const status = statusOutput.trim().split('\t')[0];
    
    if (status === 'D') return 'DELETED';
    if (status === 'A') return 'ADDED';
    if (status.startsWith('R')) return 'RENAMED';
    return 'MODIFIED';
  } catch (error) {
    return 'MODIFIED';
  }
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('🔒 CI Architecture Gate — Frozen File Check');
  console.log('   Layer 4: Repository-Level Enforcement\n');
  
  // Detect CI environment
  const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  console.log(`   Environment: ${isCi ? 'CI (GitHub Actions)' : 'Local'}`);
  
  const baseBranch = process.env.GITHUB_BASE_REF || 'origin/main';
  console.log(`   Base branch: ${baseBranch}`);
  console.log(`   Checking for frozen file modifications...\n`);
  
  // Get changed files
  const changedFiles = getChangedFiles();
  
  if (changedFiles.length === 0) {
    console.log('   ℹ️  No files changed in this PR');
    console.log('   ✅ Check passed\n');
    process.exit(0);
  }
  
  console.log(`   📋 Total files changed: ${changedFiles.length}\n`);
  
  // Check for frozen file violations
  const violations = changedFiles
    .filter(isFrozenFile)
    .map(file => ({
      file,
      layer: getLayerForFile(file),
      changeType: getChangeType(file, baseBranch),
    }));
  
  if (violations.length === 0) {
    console.log('   ✅ No frozen files modified');
    console.log('   ✅ Architecture boundaries preserved');
    console.log('   ✅ Check passed\n');
    process.exit(0);
  }
  
  // Violations detected — block PR
  console.error('╔════════════════════════════════════════════════════════════════╗');
  console.error('║  ❌ FROZEN BOUNDARY VIOLATION — PR BLOCKED                    ║');
  console.error('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.error(`Found ${violations.length} frozen file(s) modified in this PR:\n`);
  
  violations.forEach(({ file, layer, changeType }) => {
    console.error(`  ❌ ${file}`);
    console.error(`     Layer: ${layer}`);
    console.error(`     Status: SEALED`);
    console.error(`     Change: ${changeType}\n`);
  });
  
  console.error('╔════════════════════════════════════════════════════════════════╗');
  console.error('║  FROZEN KERNEL LAYERS ARE PROTECTED                           ║');
  console.error('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.error('Protected layers:');
  console.error('  • E7.1 Domain Kernel (12 artifacts, 366 tests)');
  console.error('  • E7.2 Operational Kernel (1 artifact, 73 tests)');
  console.error('  • E7.3 Rules & Traceability (9 artifacts, 108 tests)');
  console.error('  • Architecture Guard (5 enforcement scripts)\n');
  
  console.error('These layers are frozen and cannot be modified without:');
  console.error('  1. Architecture Change Request (ACR)');
  console.error('     Template: docs/architecture/templates/ACR_TEMPLATE.md');
  console.error('  2. Human Architect Review and Approval');
  console.error('  3. Architecture Decision Record (ADR)');
  console.error('  4. Temporary unlock in manifest');
  console.error('  5. Full regression tests (547/547 must PASS)');
  console.error('  6. Baseline update and re-seal\n');
  
  console.error('Reference Documentation:');
  console.error('  • Freeze Policy: docs/architecture/FREEZE_POLICY.md');
  console.error('  • ACR Template: docs/architecture/templates/ACR_TEMPLATE.md');
  console.error('  • Architecture Guard: docs/implementation/ARCHITECTURE_GUARD_IMPLEMENTATION.md\n');
  
  console.error('╔════════════════════════════════════════════════════════════════╗');
  console.error('║  PR CANNOT BE MERGED                                           ║');
  console.error('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.error('This PR modifies frozen kernel files. To proceed:');
  console.error('  1. Revert changes to frozen files');
  console.error('  2. Implement your feature using kernel APIs (consume, don\'t modify)');
  console.error('  3. If kernel modification is truly needed, create ACR\n');
  
  process.exit(1);
}

// Handle errors
try {
  main();
} catch (error) {
  console.error('❌ CI Frozen File Check failed with error:');
  console.error(error.message);
  console.error('\nThis check is critical for repository protection.');
  console.error('Contact Platform Architecture Team if you believe this is an error.\n');
  process.exit(1);
}
/ /   t e s t   m o d i f i c a t i o n  
 