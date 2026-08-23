#!/usr/bin/env node
/**
 * GIT PRE-COMMIT ARCHITECTURE GUARD
 * 
 * Blocks commits that modify frozen kernel files.
 * Part of Layer 3 (5-layer architecture protection).
 * 
 * Exit codes:
 *   0 = Commit allowed
 *   1 = Commit blocked (frozen file modification detected)
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

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    return output
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
  } catch (error) {
    // If git command fails, allow commit (fail open for non-git operations)
    console.error('Warning: Could not get staged files. Allowing commit.');
    return [];
  }
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('🔒 Architecture Guard — Git Pre-Commit Hook');
  console.log('   Checking staged files for frozen kernel modifications...\n');
  
  // Get staged files
  const stagedFiles = getStagedFiles();
  
  if (stagedFiles.length === 0) {
    console.log('   No files staged. Commit allowed.\n');
    process.exit(0);
  }
  
  // Check for frozen file violations
  const violations = stagedFiles.filter(isFrozenFile);
  
  if (violations.length === 0) {
    console.log(`   ✅ Checked ${stagedFiles.length} staged file(s)`);
    console.log('   ✅ No frozen files modified');
    console.log('   ✅ Commit allowed\n');
    process.exit(0);
  }
  
  // Violations detected — block commit
  console.error('╔════════════════════════════════════════════════════════════════╗');
  console.error('║  ❌ FROZEN BOUNDARY VIOLATION — COMMIT BLOCKED                ║');
  console.error('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.error(`Found ${violations.length} frozen file(s) in staged changes:\n`);
  
  violations.forEach(file => {
    const layer = getLayerForFile(file);
    console.error(`  ❌ ${file}`);
    console.error(`     Layer: ${layer}`);
    console.error(`     Status: SEALED\n`);
  });
  
  console.error('╔════════════════════════════════════════════════════════════════╗');
  console.error('║  FROZEN FILES CANNOT BE COMMITTED                             ║');
  console.error('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.error('Frozen kernel layers are protected:');
  console.error('  • E7.1 Domain Kernel (12 artifacts)');
  console.error('  • E7.2 Operational Kernel (1 artifact)');
  console.error('  • E7.3 Rules & Traceability (9 artifacts)');
  console.error('  • Architecture Guard (5 enforcement scripts)\n');
  
  console.error('To modify frozen files, you must:');
  console.error('  1. Create Architecture Change Request (ACR)');
  console.error('     Template: docs/architecture/templates/ACR_TEMPLATE.md');
  console.error('  2. Submit for Human Architect Review');
  console.error('  3. Document Architecture Decision Record (ADR)');
  console.error('  4. Unlock layer in manifest');
  console.error('  5. Implement changes');
  console.error('  6. Run full regression (547/547 must PASS)');
  console.error('  7. Update baseline and re-seal\n');
  
  console.error('Reference: docs/architecture/FREEZE_POLICY.md\n');
  
  console.error('╔════════════════════════════════════════════════════════════════╗');
  console.error('║  COMMIT BLOCKED                                                ║');
  console.error('╚════════════════════════════════════════════════════════════════╝\n');
  
  process.exit(1);
}

// Handle errors gracefully
try {
  main();
} catch (error) {
  console.error('Error in pre-commit guard:', error.message);
  // Fail open: allow commit if guard itself has an error
  console.error('Warning: Guard error occurred. Allowing commit.');
  console.error('Note: CI architecture gate will still verify frozen boundaries.\n');
  process.exit(0);
}
