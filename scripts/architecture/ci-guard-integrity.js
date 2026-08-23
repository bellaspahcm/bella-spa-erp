#!/usr/bin/env node
/**
 * CI GUARD INTEGRITY CHECK
 * 
 * Verifies that Architecture Guard mechanisms are intact and not tampered with.
 * Part of Layer 4 (CI Architecture Gate).
 * 
 * Checks:
 *   - Architecture guard files exist
 *   - Guard configuration is valid
 *   - Protected file lists are consistent across layers
 *   - No unauthorized modifications to guard scripts
 * 
 * Exit codes:
 *   0 = Guard integrity verified
 *   1 = Guard integrity compromised (blocks PR)
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// REQUIRED FILES
// ============================================================================

const REQUIRED_FILES = [
  // Layer 1
  'scripts/architecture/architecture-guard.ts',
  
  // Layer 2
  '.kiro/hooks/architecture-guard.json',
  'scripts/architecture/pre-tool-guard.js',
  
  // Layer 3
  '.husky/pre-commit',
  'scripts/architecture/git-pre-commit-guard.js',
  
  // Layer 4
  '.github/workflows/architecture-gate.yml',
  'scripts/architecture/ci-frozen-check.js',
  'scripts/architecture/ci-guard-integrity.js',
  'scripts/architecture/ci-dependency-check.js',
  
  // Documentation
  'docs/architecture/FREEZE_POLICY.md',
  'docs/architecture/templates/ACR_TEMPLATE.md',
];

const FROZEN_FILES = [
  // E7.1
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
  // E7.2
  'src/platform/logistics/domain/inventory-operations.domain.ts',
  // E7.3
  'src/platform/logistics/domain/rules/rule.types.ts',
  'src/platform/logistics/domain/rules/rule.helpers.ts',
  'src/platform/logistics/domain/rules/expiry.rule.ts',
  'src/platform/logistics/domain/rules/quantity.rule.ts',
  'src/platform/logistics/domain/rules/traceability.rule.ts',
  'src/platform/logistics/domain/rules/traceability.operations.ts',
  'src/platform/logistics/domain/rules/compliance.evaluation.ts',
  'src/platform/logistics/domain/rules/rule.composition.ts',
  'src/platform/logistics/domain/rules/index.ts',
  // Architecture Guard Scripts (Self-Protection)
  'scripts/architecture/git-pre-commit-guard.js',
  'scripts/architecture/ci-frozen-check.js',
  'scripts/architecture/ci-guard-integrity.js',
  'scripts/architecture/ci-dependency-check.js',
  '.github/workflows/architecture-gate.yml',
];

// ============================================================================
// CHECKS
// ============================================================================

const checks = [];

function checkFileExists(filePath) {
  const fullPath = path.resolve(filePath);
  const exists = fs.existsSync(fullPath);
  
  checks.push({
    name: `File exists: ${filePath}`,
    passed: exists,
    severity: 'CRITICAL',
    message: exists ? 'File present' : 'File missing',
  });
  
  return exists;
}

function checkGuardFilesExist() {
  console.log('📋 Checking guard file existence...');
  
  let allExist = true;
  
  for (const file of REQUIRED_FILES) {
    const exists = checkFileExists(file);
    if (!exists) {
      allExist = false;
    }
  }
  
  return allExist;
}

function extractFrozenFilesFromScript(scriptPath) {
  try {
    const content = fs.readFileSync(scriptPath, 'utf-8');
    
    // Extract FROZEN_FILES array
    const match = content.match(/const FROZEN_FILES = \[([\s\S]*?)\];/);
    if (!match) {
      return null;
    }
    
    // Parse file paths from array
    const arrayContent = match[1];
    const files = arrayContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith("'") || line.startsWith('"'))
      .map(line => {
        const match = line.match(/['"](.+?)['"]/);
        return match ? match[1] : null;
      })
      .filter(Boolean);
    
    return files;
  } catch (error) {
    return null;
  }
}

function checkFrozenFileListConsistency() {
  console.log('📋 Checking frozen file list consistency...');
  
  const scripts = [
    'scripts/architecture/git-pre-commit-guard.js',
    'scripts/architecture/pre-tool-guard.js',
    'scripts/architecture/ci-frozen-check.js',
  ];
  
  const allLists = {};
  
  for (const script of scripts) {
    const files = extractFrozenFilesFromScript(script);
    if (files) {
      allLists[script] = files;
    }
  }
  
  // Compare all lists
  const scriptNames = Object.keys(allLists);
  if (scriptNames.length < 2) {
    checks.push({
      name: 'Frozen file list consistency',
      passed: false,
      severity: 'HIGH',
      message: 'Could not extract frozen file lists from guard scripts',
    });
    return false;
  }
  
  const reference = allLists[scriptNames[0]];
  let consistent = true;
  
  for (let i = 1; i < scriptNames.length; i++) {
    const current = allLists[scriptNames[i]];
    
    if (reference.length !== current.length) {
      checks.push({
        name: `Frozen file list consistency: ${scriptNames[i]}`,
        passed: false,
        severity: 'HIGH',
        message: `List length mismatch: ${reference.length} vs ${current.length}`,
      });
      consistent = false;
      continue;
    }
    
    const mismatches = reference.filter(file => !current.includes(file));
    if (mismatches.length > 0) {
      checks.push({
        name: `Frozen file list consistency: ${scriptNames[i]}`,
        passed: false,
        severity: 'HIGH',
        message: `Files missing: ${mismatches.join(', ')}`,
      });
      consistent = false;
    } else {
      checks.push({
        name: `Frozen file list consistency: ${scriptNames[i]}`,
        passed: true,
        severity: 'HIGH',
        message: 'Lists match',
      });
    }
  }
  
  return consistent;
}

function checkPreCommitHookActive() {
  console.log('📋 Checking pre-commit hook...');
  
  const hookPath = '.husky/pre-commit';
  
  if (!fs.existsSync(hookPath)) {
    checks.push({
      name: 'Pre-commit hook exists',
      passed: false,
      severity: 'HIGH',
      message: 'Hook file missing',
    });
    return false;
  }
  
  const content = fs.readFileSync(hookPath, 'utf-8');
  
  // Check if hook calls the guard script
  const callsGuard = content.includes('git-pre-commit-guard.js');
  
  checks.push({
    name: 'Pre-commit hook calls guard',
    passed: callsGuard,
    severity: 'HIGH',
    message: callsGuard ? 'Guard script referenced' : 'Guard script not called',
  });
  
  return callsGuard;
}

function checkWorkflowIntegrity() {
  console.log('📋 Checking CI workflow...');
  
  const workflowPath = '.github/workflows/architecture-gate.yml';
  
  if (!fs.existsSync(workflowPath)) {
    checks.push({
      name: 'CI workflow exists',
      passed: false,
      severity: 'CRITICAL',
      message: 'Workflow file missing',
    });
    return false;
  }
  
  const content = fs.readFileSync(workflowPath, 'utf-8');
  
  // Check for required jobs
  const requiredJobs = ['frozen-files', 'guard', 'dependency', 'regression'];
  const allJobsPresent = requiredJobs.every(job => content.includes(`${job}:`));
  
  checks.push({
    name: 'CI workflow has all required jobs',
    passed: allJobsPresent,
    severity: 'CRITICAL',
    message: allJobsPresent ? 'All 4 jobs present' : 'Missing required jobs',
  });
  
  return allJobsPresent;
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('🔒 CI Architecture Gate — Guard Integrity Check');
  console.log('   Verifying Architecture Guard is intact...\n');
  
  // Run all checks
  const results = {
    filesExist: checkGuardFilesExist(),
    listsConsistent: checkFrozenFileListConsistency(),
    hookActive: checkPreCommitHookActive(),
    workflowIntact: checkWorkflowIntegrity(),
  };
  
  console.log('\n📊 Check Results:\n');
  
  // Print results
  const criticalFailures = [];
  const highFailures = [];
  
  for (const check of checks) {
    const icon = check.passed ? '✅' : '❌';
    console.log(`${icon} ${check.name}`);
    console.log(`   ${check.message}\n`);
    
    if (!check.passed) {
      if (check.severity === 'CRITICAL') {
        criticalFailures.push(check);
      } else if (check.severity === 'HIGH') {
        highFailures.push(check);
      }
    }
  }
  
  // Summary
  const totalChecks = checks.length;
  const passedChecks = checks.filter(c => c.passed).length;
  const failedChecks = totalChecks - passedChecks;
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total Checks: ${totalChecks}`);
  console.log(`Passed: ${passedChecks}`);
  console.log(`Failed: ${failedChecks}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  if (criticalFailures.length > 0 || highFailures.length > 0) {
    console.error('╔════════════════════════════════════════════════════════════════╗');
    console.error('║  ❌ GUARD INTEGRITY COMPROMISED — PR BLOCKED                  ║');
    console.error('╚════════════════════════════════════════════════════════════════╝\n');
    
    if (criticalFailures.length > 0) {
      console.error(`Critical failures: ${criticalFailures.length}\n`);
      criticalFailures.forEach(check => {
        console.error(`  ❌ ${check.name}`);
        console.error(`     ${check.message}\n`);
      });
    }
    
    if (highFailures.length > 0) {
      console.error(`High-severity failures: ${highFailures.length}\n`);
      highFailures.forEach(check => {
        console.error(`  ❌ ${check.name}`);
        console.error(`     ${check.message}\n`);
      });
    }
    
    console.error('Architecture Guard mechanisms have been modified or removed.');
    console.error('This PR cannot be merged.\n');
    
    console.error('Possible causes:');
    console.error('  • Guard files were deleted');
    console.error('  • Frozen file lists are inconsistent');
    console.error('  • Pre-commit hook was disabled');
    console.error('  • CI workflow was modified\n');
    
    console.error('To fix:');
    console.error('  1. Revert changes to Architecture Guard files');
    console.error('  2. Ensure all guard files are present');
    console.error('  3. Verify frozen file lists match across all layers');
    console.error('  4. Contact Platform Architecture Team if you need to modify guards\n');
    
    process.exit(1);
  }
  
  console.log('✅ GUARD INTEGRITY VERIFIED\n');
  console.log('Architecture Guard is intact and operational:');
  console.log('  • All guard files present');
  console.log('  • Frozen file lists consistent');
  console.log('  • Pre-commit hook active');
  console.log('  • CI workflow complete\n');
  
  process.exit(0);
}

// Handle errors
try {
  main();
} catch (error) {
  console.error('❌ Guard Integrity Check failed with error:');
  console.error(error.message);
  console.error('\nThis check is critical for repository protection.');
  console.error('Contact Platform Architecture Team immediately.\n');
  process.exit(1);
}
