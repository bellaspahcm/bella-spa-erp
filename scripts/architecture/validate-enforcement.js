#!/usr/bin/env node
/**
 * ARCHITECTURE GUARD ENFORCEMENT VALIDATION
 * 
 * Validates that branch protection correctly enforces Architecture Guard checks.
 * Run AFTER branch protection has been manually configured.
 * 
 * This script:
 * 1. Checks branch protection is configured
 * 2. Creates test PRs with violations
 * 3. Verifies they are blocked from merging
 * 4. Creates legitimate test PR
 * 5. Verifies it can be merged
 * 6. Generates evidence report
 * 
 * Usage:
 *   node scripts/architecture/validate-enforcement.js
 * 
 * Prerequisites:
 *   - Branch protection configured on main
 *   - GitHub CLI (gh) authenticated
 *   - Push access to repository
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const REPO = 'bellaspahcm/bella-spa-erp';
const BASE_BRANCH = 'main';
const REQUIRED_CHECKS = [
  'Frozen File Check',
  'Architecture Guard Verification',
  'Dependency Boundary Check',
  'Logistics Kernel Regression'
];

// ============================================================================
// UTILITIES
// ============================================================================

function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    }).trim();
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

function log(message, level = 'info') {
  const prefix = {
    info: '   ',
    success: '✅ ',
    error: '❌ ',
    warning: '⚠️  '
  }[level] || '   ';
  console.log(`${prefix}${message}`);
}

function header(message) {
  console.log('\n' + '='.repeat(70));
  console.log(message);
  console.log('='.repeat(70) + '\n');
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function checkBranchProtection() {
  header('STEP 1: Verify Branch Protection Configuration');
  
  log('Checking branch protection on main...');
  
  const result = exec(
    `gh api /repos/${REPO}/branches/${BASE_BRANCH}/protection`,
    { silent: true, ignoreError: true }
  );
  
  if (!result) {
    log('Branch protection NOT configured', 'error');
    log('Please configure branch protection manually first.', 'warning');
    log('See: docs/evidence/MANUAL_BRANCH_PROTECTION_STEPS.md', 'warning');
    return false;
  }
  
  const protection = JSON.parse(result);
  
  // Check required status checks
  if (!protection.required_status_checks) {
    log('Status checks NOT required', 'error');
    return false;
  }
  
  const requiredContexts = protection.required_status_checks.contexts || [];
  const requiredChecks = protection.required_status_checks.checks?.map(c => c.context) || [];
  const allRequired = [...requiredContexts, ...requiredChecks];
  
  log(`Found ${allRequired.length} required checks`);
  
  const missing = REQUIRED_CHECKS.filter(check => !allRequired.includes(check));
  
  if (missing.length > 0) {
    log(`Missing required checks: ${missing.join(', ')}`, 'error');
    return false;
  }
  
  log('All 4 Architecture Gate checks are required', 'success');
  log('Branch protection configured correctly', 'success');
  return true;
}

async function createTestPR(testName, branch, changes, expectBlocked) {
  header(`TEST: ${testName}`);
  
  // Ensure on main and up to date
  exec('git checkout main', { silent: true });
  exec('git pull origin main', { silent: true });
  
  // Create test branch
  exec(`git checkout -b ${branch}`, { silent: true, ignoreError: true });
  exec(`git checkout ${branch}`, { silent: true });
  
  // Apply changes
  log(`Applying changes...`);
  for (const change of changes) {
    log(`  ${change.action}: ${change.file}`);
    if (change.action === 'create') {
      const dir = path.dirname(change.file);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(change.file, change.content);
    } else if (change.action === 'modify') {
      fs.appendFileSync(change.file, change.content);
    }
  }
  
  // Commit (with --no-verify if violation expected)
  const commitFlags = expectBlocked ? '--no-verify' : '';
  exec(`git add .`);
  exec(`git commit ${commitFlags} -m "test: ${testName}"`, { silent: true });
  
  // Push
  log('Pushing to remote...');
  exec(`git push origin ${branch} --force`, { silent: true });
  
  // Create PR
  log('Creating pull request...');
  const prBody = expectBlocked 
    ? `**Expected:** CI should detect violations and BLOCK merge`
    : `**Expected:** All checks should PASS and PR should be mergeable`;
  
  const prUrl = exec(
    `gh pr create --title "${testName}" --body "${prBody}" --base ${BASE_BRANCH}`,
    { silent: true }
  );
  
  const prNumber = prUrl.match(/\/pull\/(\d+)/)[1];
  log(`Created PR #${prNumber}: ${prUrl}`);
  
  // Wait for CI
  log('Waiting for CI checks to complete (60 seconds)...');
  exec('sleep 60', { silent: true, shell: '/bin/bash', ignoreError: true });
  
  // Check PR status
  log('Checking PR merge status...');
  const prStatus = JSON.parse(
    exec(`gh pr view ${prNumber} --json mergeable,statusCheckRollup,number,headRefOid`, { silent: true })
  );
  
  const archChecks = prStatus.statusCheckRollup
    .filter(check => check.workflowName === 'Architecture Gate')
    .map(check => ({
      name: check.name,
      conclusion: check.conclusion,
      status: check.status
    }));
  
  log('Architecture Gate check results:');
  archChecks.forEach(check => {
    const icon = check.conclusion === 'SUCCESS' ? '✅' : 
                 check.conclusion === 'FAILURE' ? '❌' : '⏳';
    log(`  ${icon} ${check.name}: ${check.conclusion || check.status}`);
  });
  
  const mergeable = prStatus.mergeable === 'MERGEABLE';
  log(`PR mergeable status: ${mergeable ? 'MERGEABLE' : 'BLOCKED'}`);
  
  // Verify expectations
  let passed = false;
  if (expectBlocked) {
    // Should have at least one failed check AND be blocked
    const hasFailed = archChecks.some(c => c.conclusion === 'FAILURE');
    if (hasFailed && !mergeable) {
      log('Test PASSED: Violation detected and merge blocked', 'success');
      passed = true;
    } else if (hasFailed && mergeable) {
      log('Test FAILED: Violation detected but merge NOT blocked', 'error');
      log('Branch protection may not be configured correctly', 'warning');
    } else {
      log('Test FAILED: Expected violation not detected', 'error');
    }
  } else {
    // Should have all checks pass AND be mergeable
    const allPassed = archChecks.every(c => c.conclusion === 'SUCCESS');
    if (allPassed && mergeable) {
      log('Test PASSED: All checks passed and PR mergeable', 'success');
      passed = true;
    } else {
      log('Test FAILED: Expected all checks to pass', 'error');
    }
  }
  
  // Close PR
  exec(`gh pr close ${prNumber} --comment "Validation test complete"`, { silent: true });
  
  // Cleanup
  exec('git checkout main', { silent: true });
  exec(`git branch -D ${branch}`, { silent: true, ignoreError: true });
  
  return {
    testName,
    prNumber,
    prUrl,
    commit: prStatus.headRefOid,
    mergeable,
    checks: archChecks,
    passed,
    expectBlocked
  };
}

// ============================================================================
// TEST SCENARIOS
// ============================================================================

const TESTS = [
  {
    name: 'Test 3: Legitimate Change After Protection',
    branch: 'validate/legitimate',
    changes: [
      {
        action: 'create',
        file: 'src/products/validation-test.ts',
        content: 'export const validationTest = true;\n'
      }
    ],
    expectBlocked: false
  },
  {
    name: 'Test 4: Frozen File Violation (E7.1)',
    branch: 'validate/frozen-e7-1',
    changes: [
      {
        action: 'modify',
        file: 'src/platform/logistics/domain/inventory.types.ts',
        content: '\n// validation test violation\n'
      }
    ],
    expectBlocked: true
  },
  {
    name: 'Test 5: Guard Script Modification',
    branch: 'validate/guard-mod',
    changes: [
      {
        action: 'modify',
        file: 'scripts/architecture/ci-frozen-check.js',
        content: '\n// validation test violation\n'
      }
    ],
    expectBlocked: true
  }
];

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🔒 Architecture Guard Enforcement Validation\n');
  console.log('This script validates that branch protection enforces');
  console.log('Architecture Guard checks at the repository level.\n');
  
  // Step 1: Check branch protection
  const protectionConfigured = checkBranchProtection();
  if (!protectionConfigured) {
    log('Cannot proceed without branch protection', 'error');
    log('Configure branch protection first, then re-run this script', 'warning');
    process.exit(1);
  }
  
  // Step 2: Run test scenarios
  const results = [];
  for (const test of TESTS) {
    const result = await createTestPR(
      test.name,
      test.branch,
      test.changes,
      test.expectBlocked
    );
    results.push(result);
  }
  
  // Step 3: Generate report
  header('VALIDATION SUMMARY');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  log(`Tests passed: ${passed}/${total}`);
  log('');
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    log(`${icon} ${result.testName}`);
    log(`   PR #${result.prNumber}: ${result.prUrl}`);
    log(`   Commit: ${result.commit.substring(0, 8)}`);
    log(`   Mergeable: ${result.mergeable}`);
    log(`   Expected blocked: ${result.expectBlocked}`);
    log('');
  });
  
  // Write evidence file
  const evidence = {
    date: new Date().toISOString(),
    repository: REPO,
    baseBranch: BASE_BRANCH,
    branchProtectionVerified: true,
    results: results.map(r => ({
      test: r.testName,
      pr: r.prNumber,
      url: r.prUrl,
      commit: r.commit,
      mergeable: r.mergeable,
      expectBlocked: r.expectBlocked,
      passed: r.passed,
      checks: r.checks
    }))
  };
  
  const evidencePath = 'docs/evidence/ENFORCEMENT_VALIDATION_RESULTS.json';
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
  log(`Evidence written to: ${evidencePath}`);
  
  // Final verdict
  header('FINAL VERDICT');
  
  if (passed === total) {
    log('✅ ALL TESTS PASSED', 'success');
    log('');
    log('Architecture Guard enforcement is working correctly.');
    log('Branch protection successfully blocks PRs with violations.');
    log('');
    log('Step ① Architecture Guard: 100% COMPLETE ✅', 'success');
    log('');
    log('Next: Proceed to Step ② BDGF P1 Universal Boundary Audit');
    process.exit(0);
  } else {
    log('❌ SOME TESTS FAILED', 'error');
    log('');
    log('Branch protection may not be configured correctly.');
    log('Review the results above and check:');
    log('  1. All 4 checks are required in branch protection');
    log('  2. "Require status checks to pass" is enabled');
    log('  3. Check names match exactly (case-sensitive)');
    log('');
    log('See: docs/evidence/MANUAL_BRANCH_PROTECTION_STEPS.md');
    process.exit(1);
  }
}

// Run
main().catch(error => {
  console.error('\n❌ Validation failed with error:');
  console.error(error.message);
  console.error('\nStack trace:');
  console.error(error.stack);
  process.exit(1);
});
