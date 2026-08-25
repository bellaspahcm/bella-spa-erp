#!/usr/bin/env node

/**
 * P0.3 PHASE 4B.2 — NODE.JS TEST RUNNER
 * 
 * Purpose: Verify contract v1.2.0 implementation compliance
 * Contract: docs/architecture/P0_3_PHASE4B_2_CONTRACT.md
 * 
 * Test Matrix:
 *   T1: Valid approval + 1 migration → SUCCESS
 *   T2: Missing approval_id → FAIL
 *   T3: Multiple migrations → FAIL
 *   T4: No migrations → FAIL
 *   T5: BDGF wrapper error → FAIL
 *   T6: Provenance binding → SUCCESS (P0 CRITICAL)
 *   T7: Merge commit → FAIL
 * 
 * Completion Gate: 7/7 PASS
 * 
 * Safety:
 *   - Aborts if production credentials detected
 *   - Creates isolated Git repositories for tests
 *   - Uses mock BDGF wrapper only
 *   - No production database access
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  testDir: __dirname,
  evidenceDir: path.join(__dirname, 'evidence'),
  mockBdgfWrapper: path.join(__dirname, 'mock-bdgf-wrapper.mjs'),
  fixturesDir: path.join(__dirname, 'fixtures'),
};

// Test results
const results = {
  total: 7,
  passed: 0,
  failed: 0,
  tests: [],
};

// ============================================================================
// UTILITIES
// ============================================================================

function log(message, color = '') {
  const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
  };
  const c = colors[color] || '';
  console.log(`${c}${message}${colors.reset}`);
}

function logHeader(text) {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log(text, 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');
}

async function execCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    // Debug log
    const debugInfo = {
      command,
      args,
      cwd: options.cwd || process.cwd(),
    };
    
    if (process.env.DEBUG_GIT === 'true') {
      console.log('\n[DEBUG] Git command:', JSON.stringify(debugInfo, null, 2));
    }
    
    const proc = spawn(command, args, {
      ...options,
      stdio: ['pipe', 'pipe', 'pipe'],
      // Remove shell: true - causes issues with argument passing
      windowsHide: true,
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      const result = { 
        code, 
        stdout: stdout.trim(),  // Always trim
        stderr: stderr.trim(),
      };
      
      if (process.env.DEBUG_GIT === 'true') {
        console.log('[DEBUG] Result:', JSON.stringify({
          exitCode: code,
          stdout: result.stdout.substring(0, 100),
          stderr: result.stderr.substring(0, 100),
        }, null, 2));
      }
      
      resolve(result);
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

function validateSHA(sha, context = '') {
  const shaPattern = /^[0-9a-f]{40}$/;
  if (!shaPattern.test(sha)) {
    throw new Error(`Invalid SHA-1 hash${context ? ` (${context})` : ''}: "${sha}"`);
  }
  return sha;
}

function computeSHA256(filePath) {
  return new Promise((resolve, reject) => {
    import('fs').then((fs) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    }).catch(reject);
  });
}

// ============================================================================
// PRODUCTION SAFETY GUARD
// ============================================================================

async function checkProductionSafety() {
  logHeader('🛡️  PRODUCTION SAFETY CHECK');
  
  const dbUrl = process.env.DATABASE_EXECUTOR_URL || '';
  const targetEnv = process.env.TARGET_ENVIRONMENT || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  const productionPatterns = [
    /supabase\.co/,
    /production/i,
    /prod\./,
    /@db-production/,
  ];
  
  const hasProductionUrl = productionPatterns.some(p => p.test(dbUrl));
  const isProductionEnv = targetEnv.toLowerCase() === 'production';
  const hasServiceKey = serviceKey.length > 0;
  
  if (hasProductionUrl || isProductionEnv || hasServiceKey) {
    log('❌ ABORT: Production credentials detected', 'red');
    log('');
    log('Test harness policy: PRODUCTION_ACCESS = FORBIDDEN', 'red');
    log('');
    process.exit(99);
  }
  
  log('✅ No production credentials detected\n', 'green');
}

// ============================================================================
// TEST EXECUTION FRAMEWORK
// ============================================================================

async function runTest(name, testFn) {
  log(`\n▶ Running: ${name}`, 'yellow');
  log('');
  
  const testResult = {
    name,
    status: 'PENDING',
    assertions: { passed: 0, failed: 0 },
    error: null,
    evidence: null,
  };
  
  try {
    const result = await testFn();
    
    testResult.status = result.success ? 'PASS' : 'FAIL';
    testResult.assertions = result.assertions;
    testResult.evidence = result.evidence;
    
    if (result.success) {
      log(`✅ PASS: ${name}`, 'green');
      results.passed++;
    } else {
      log(`❌ FAIL: ${name}`, 'red');
      if (result.error) {
        log(`   Error: ${result.error}`, 'red');
      }
      results.failed++;
    }
  } catch (error) {
    testResult.status = 'ERROR';
    testResult.error = error.message;
    log(`❌ ERROR: ${name}`, 'red');
    log(`   ${error.message}`, 'red');
    results.failed++;
  }
  
  results.tests.push(testResult);
  
  log('');
}

// ============================================================================
// MIGRATION JOB EXECUTOR (Contract Steps 0-7 Implementation)
// ============================================================================

async function executeMigrationJob(inputs) {
  const {
    approvalId,
    commitSha,
    targetEnv = 'test',
    mockBehavior = 'success',
    repoPath = process.cwd(),
  } = inputs;
  
  // Set environment
  process.env.APPROVAL_ID = approvalId || '';
  process.env.COMMIT_SHA = commitSha || '';
  process.env.TARGET_ENVIRONMENT = targetEnv;
  process.env.DATABASE_EXECUTOR_URL = 'mock://test-database';
  process.env.GATE_SIGNING_KEY = 'mock-test-key';
  process.env.MOCK_BDGF_BEHAVIOR = mockBehavior;
  
  const steps = [];
  
  try {
    // STEP 0: Normalize commit provenance
    if (!commitSha) {
      throw new Error('commit_sha required for provenance binding');
    }
    
    const checkoutResult = await execCommand('git', ['checkout', '--detach', commitSha], {
      cwd: repoPath,
    });
    
    if (checkoutResult.code !== 0) {
      throw new Error(`Failed to checkout commit ${commitSha}`);
    }
    
    steps.push({ step: 0, status: 'PASS', message: 'Commit provenance normalized' });
    
    // Verify non-merge commit
    const parentsResult = await execCommand('git', ['rev-list', '--parents', '-n', '1', commitSha], {
      cwd: repoPath,
    });
    
    const parentCount = parentsResult.stdout.trim().split(/\s+/).length;
    if (parentCount !== 2) {
      throw new Error(`Merge commit detected (${parentCount - 1} parents)`);
    }
    
    // Get parent
    const parentResult = await execCommand('git', ['rev-parse', `${commitSha}^`], {
      cwd: repoPath,
    });
    const parentSha = parentResult.stdout.trim();
    
    // STEP 2: Discover migrations
    const diffResult = await execCommand('git', [
      'diff',
      '--name-only',
      `${parentSha}..${commitSha}`,
    ], { cwd: repoPath });
    
    const changedFiles = diffResult.stdout.split('\n').filter(f => f.trim());
    const migrations = changedFiles.filter(f => f.match(/^supabase\/migrations\/.*\.sql$/));
    
    if (migrations.length === 0) {
      throw new Error('No migration files detected');
    }
    
    steps.push({ step: 2, status: 'PASS', message: `Discovered ${migrations.length} migration(s)` });
    
    // STEP 3: Validate single migration
    if (migrations.length > 1) {
      throw new Error(`Multiple migrations detected (${migrations.length})`);
    }
    
    steps.push({ step: 3, status: 'PASS', message: 'Single migration validated' });
    
    const migrationFile = migrations[0];
    const migrationId = path.basename(migrationFile, '.sql');
    
    // STEP 5: Verify file exists
    const migrationPath = path.join(repoPath, migrationFile);
    try {
      await fs.access(migrationPath);
    } catch {
      throw new Error(`Migration file not found: ${migrationFile}`);
    }
    
    steps.push({ step: 5, status: 'PASS', message: 'Migration file verified' });
    
    // Compute hash
    const migrationHash = await computeSHA256(migrationPath);
    
    // STEP 6: Invoke BDGF wrapper
    if (!approvalId) {
      throw new Error('approval_id required');
    }
    
    const bdgfResult = await execCommand('node', [
      CONFIG.mockBdgfWrapper,
      approvalId,
      migrationFile,
    ], {
      cwd: repoPath,
      env: { ...process.env },
    });
    
    if (bdgfResult.code !== 0) {
      throw new Error(`BDGF execution failed (exit code: ${bdgfResult.code})`);
    }
    
    steps.push({ step: 6, status: 'PASS', message: 'BDGF execution SUCCESS' });
    
    // STEP 7: Generate evidence artifact
    const evidence = {
      approval_id: approvalId,
      migration_id: migrationId,
      migration_file: migrationFile,
      migration_hash: migrationHash,
      commit_sha: commitSha,
      parent_sha: parentSha,
      triggered_by: 'test-user',
      workflow_run_id: `test-run-${Date.now()}`,
      execution_time: new Date().toISOString(),
      environment: targetEnv,
      result: 'SUCCESS',
    };
    
    await fs.writeFile(
      path.join(repoPath, 'bdgf-execution.json'),
      JSON.stringify(evidence, null, 2)
    );
    
    steps.push({ step: 7, status: 'PASS', message: 'Evidence artifact generated' });
    
    return {
      success: true,
      exitCode: 0,
      evidence,
      steps,
    };
    
  } catch (error) {
    return {
      success: false,
      exitCode: 1,
      error: error.message,
      evidence: null,
      steps,
    };
  }
}

// ============================================================================
// T1: VALID APPROVAL + 1 MIGRATION → SUCCESS
// ============================================================================

async function testT1ValidApproval() {
  const testName = 'T1-valid-approval';
  const testRepo = path.join(CONFIG.testDir, 'temp-repo-t1');
  
  // Setup: Create test Git repository
  await fs.rm(testRepo, { recursive: true, force: true });
  await fs.mkdir(testRepo, { recursive: true });
  
  // Initialize Git repo
  let result = await execCommand('git', ['init'], { cwd: testRepo });
  if (result.code !== 0) {
    throw new Error(`git init failed: ${result.stderr}`);
  }
  
  result = await execCommand('git', ['config', 'user.email', 'test@test.com'], { cwd: testRepo });
  if (result.code !== 0) {
    throw new Error(`git config user.email failed: ${result.stderr}`);
  }
  
  result = await execCommand('git', ['config', 'user.name', 'Test User'], { cwd: testRepo });
  if (result.code !== 0) {
    throw new Error(`git config user.name failed: ${result.stderr}`);
  }
  
  // Create initial commit
  await fs.writeFile(path.join(testRepo, 'README.md'), '# Test Repo T1');
  
  result = await execCommand('git', ['add', '.'], { cwd: testRepo });
  if (result.code !== 0) {
    throw new Error(`git add failed: ${result.stderr}`);
  }
  
  result = await execCommand('git', ['commit', '-m', 'Initial commit'], { cwd: testRepo });
  if (result.code !== 0) {
    throw new Error(`git commit failed: ${result.stderr}`);
  }
  
  // Create migration directory and file
  const migrationsDir = path.join(testRepo, 'supabase', 'migrations');
  await fs.mkdir(migrationsDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').replace(/\..+/, '').slice(0, 14);
  const migrationFile = `${timestamp}_t1_test_migration.sql`;
  const migrationPath = path.join(migrationsDir, migrationFile);
  
  await fs.writeFile(migrationPath, `-- Test Migration T1
-- Phase 4B.2 Test Harness

BEGIN;
CREATE TABLE test_t1 (id SERIAL PRIMARY KEY);
COMMIT;`);
  
  result = await execCommand('git', ['add', '.'], { cwd: testRepo });
  if (result.code !== 0) {
    throw new Error(`git add migration failed: ${result.stderr}`);
  }
  
  result = await execCommand('git', ['commit', '-m', 'test: Add T1 migration'], { cwd: testRepo });
  if (result.code !== 0) {
    throw new Error(`git commit migration failed: ${result.stderr}`);
  }
  
  // Get commit SHA - THIS IS CRITICAL
  result = await execCommand('git', ['rev-parse', 'HEAD'], { cwd: testRepo });
  if (result.code !== 0) {
    throw new Error(`git rev-parse HEAD failed: ${result.stderr}`);
  }
  
  const commitSha = validateSHA(result.stdout, 'T1 commit');
  
  log(`  Created test commit: ${commitSha.substring(0, 8)}...`, 'yellow');
  
  // Execute migration job
  const jobResult = await executeMigrationJob({
    approvalId: 'test-approval-t1-' + Date.now(),
    commitSha,
    repoPath: testRepo,
    mockBehavior: 'success',
  });
  
  // Assertions
  const assertions = { passed: 0, failed: 0 };
  
  // Assert: Success
  if (jobResult.success) {
    assertions.passed++;
  } else {
    assertions.failed++;
    log(`  Job execution failed: ${jobResult.error}`, 'red');
  }
  
  // Assert: Evidence exists
  const evidencePath = path.join(testRepo, 'bdgf-execution.json');
  try {
    await fs.access(evidencePath);
    assertions.passed++;
    
    // Assert: Evidence fields
    if (jobResult.evidence) {
      if (jobResult.evidence.commit_sha === commitSha) {
        log(`  ✅ Evidence commit_sha matches: ${commitSha.substring(0, 8)}...`, 'green');
        assertions.passed++;
      } else {
        log(`  ❌ Evidence commit_sha mismatch`, 'red');
        log(`     Expected: ${commitSha}`, 'red');
        log(`     Got: ${jobResult.evidence.commit_sha}`, 'red');
        assertions.failed++;
      }
      
      if (jobResult.evidence.result === 'SUCCESS') {
        assertions.passed++;
      } else {
        assertions.failed++;
      }
      
      if (jobResult.evidence.migration_file.includes(migrationFile)) {
        assertions.passed++;
      } else {
        log(`  ❌ Migration file mismatch: ${jobResult.evidence.migration_file}`, 'red');
        assertions.failed++;
      }
      
      // Verify hash
      const actualHash = await computeSHA256(migrationPath);
      if (jobResult.evidence.migration_hash === actualHash) {
        assertions.passed++;
      } else {
        log(`  ❌ Hash mismatch`, 'red');
        assertions.failed++;
      }
    }
  } catch (err) {
    log(`  ❌ Evidence access failed: ${err.message}`, 'red');
    assertions.failed++;
  }
  
  // Assert: Mock invocation
  const mockInvocationPath = path.join(CONFIG.testDir, 'mock-invocation.json');
  try {
    const mockData = JSON.parse(await fs.readFile(mockInvocationPath, 'utf8'));
    if (mockData.approval_id.includes('t1')) assertions.passed++;
    else assertions.failed++;
  } catch {
    assertions.failed++;
  }
  
  // Save evidence
  const evidenceDir = path.join(CONFIG.evidenceDir, 't1');
  await fs.mkdir(evidenceDir, { recursive: true });
  try {
    await fs.copyFile(evidencePath, path.join(evidenceDir, 'bdgf-execution.json'));
    await fs.copyFile(mockInvocationPath, path.join(evidenceDir, 'mock-invocation.json'));
    await fs.writeFile(path.join(evidenceDir, 'commit-sha.txt'), commitSha);
  } catch (err) {
    // Evidence copy optional
  }
  
  // Cleanup
  await fs.rm(testRepo, { recursive: true, force: true });
  
  return {
    success: jobResult.success && assertions.failed === 0,
    assertions,
    evidence: jobResult.evidence,
    error: jobResult.error,
  };
}

// ============================================================================
// T6: PROVENANCE BINDING (P0 CRITICAL)
// ============================================================================

async function testT6Provenance() {
  const testName = 'T6-provenance';
  const testRepo = path.join(CONFIG.testDir, 'temp-repo-t6');
  
  // Setup: Create test Git repository
  await fs.rm(testRepo, { recursive: true, force: true });
  await fs.mkdir(testRepo, { recursive: true });
  
  let result = await execCommand('git', ['init'], { cwd: testRepo });
  if (result.code !== 0) throw new Error(`git init failed: ${result.stderr}`);
  
  result = await execCommand('git', ['config', 'user.email', 'test@test.com'], { cwd: testRepo });
  if (result.code !== 0) throw new Error(`git config email failed`);
  
  result = await execCommand('git', ['config', 'user.name', 'Test User'], { cwd: testRepo });
  if (result.code !== 0) throw new Error(`git config name failed`);
  
  // Initial commit
  await fs.writeFile(path.join(testRepo, 'README.md'), '# Test Repo T6');
  result = await execCommand('git', ['add', '.'], { cwd: testRepo });
  if (result.code !== 0) throw new Error(`git add README failed`);
  
  result = await execCommand('git', ['commit', '-m', 'Initial commit'], { cwd: testRepo });
  if (result.code !== 0) throw new Error(`git commit initial failed`);
  
  // Commit A: With migration
  const migrationsDir = path.join(testRepo, 'supabase', 'migrations');
  await fs.mkdir(migrationsDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').replace(/\..+/, '').slice(0, 14);
  const migrationFile = `${timestamp}_t6_provenance_test.sql`;
  const migrationPath = path.join(migrationsDir, migrationFile);
  
  await fs.writeFile(migrationPath, `-- Test Migration T6 - Provenance Test
BEGIN;
CREATE TABLE test_t6_provenance (id SERIAL PRIMARY KEY, commit_sha TEXT);
COMMIT;`);
  
  result = await execCommand('git', ['add', '.'], { cwd: testRepo });
  if (result.code !== 0) throw new Error(`git add migration failed`);
  
  result = await execCommand('git', ['commit', '-m', 'test(t6): Commit A with migration'], { cwd: testRepo });
  if (result.code !== 0) throw new Error(`git commit A failed: ${result.stderr}`);
  
  // Get Commit A SHA
  result = await execCommand('git', ['rev-parse', 'HEAD'], { cwd: testRepo });
  if (result.code !== 0) throw new Error(`git rev-parse A failed`);
  const commitA = validateSHA(result.stdout, 'Commit A');
  
  result = await execCommand('git', ['rev-parse', 'HEAD^'], { cwd: testRepo });
  if (result.code !== 0) throw new Error(`git rev-parse A^ failed`);
  const parentA = validateSHA(result.stdout, 'Parent A');
  
  // Commit B: Without migration (simulate workflow context drift)
  await fs.mkdir(path.join(testRepo, 'temp'), { recursive: true });
  await fs.writeFile(path.join(testRepo, 'temp', 'marker.txt'), 'Commit B - no migration');
  
  result = await execCommand('git', ['add', '.'], { cwd: testRepo });
  if (result.code !== 0) throw new Error(`git add B failed`);
  
  result = await execCommand('git', ['commit', '-m', 'test(t6): Commit B without migration'], { cwd: testRepo });
  if (result.code !== 0) throw new Error(`git commit B failed`);
  
  result = await execCommand('git', ['rev-parse', 'HEAD'], { cwd: testRepo });
  if (result.code !== 0) throw new Error(`git rev-parse B failed`);
  const commitB = validateSHA(result.stdout, 'Commit B');
  
  log('  Provenance test setup:', 'yellow');
  log(`    Commit A (approved): ${commitA.substring(0, 8)}... ← Has migration`);
  log(`    Commit B (workflow): ${commitB.substring(0, 8)}... ← No migration`);
  log(`    Expected: Execute A, evidence records A\n`);
  
  // Execute migration job with Commit A (while HEAD is at B)
  const jobResult = await executeMigrationJob({
    approvalId: 'test-t6-approval-' + Date.now(),
    commitSha: commitA,  // Approved commit
    repoPath: testRepo,
    mockBehavior: 'success',
  });
  
  // CRITICAL PROVENANCE ASSERTIONS
  const assertions = { passed: 0, failed: 0 };
  
  // Assert: Success
  if (jobResult.success) {
    assertions.passed++;
  } else {
    assertions.failed++;
    log(`  Job execution failed: ${jobResult.error}`, 'red');
  }
  
  // Assert: Evidence commit_sha = Commit A (approved)
  if (jobResult.evidence && jobResult.evidence.commit_sha === commitA) {
    log('  ✅ Evidence commit_sha = Commit A (approved)', 'green');
    assertions.passed++;
  } else {
    log(`  ❌ Evidence commit_sha ≠ Commit A`, 'red');
    log(`     Expected: ${commitA}`, 'red');
    log(`     Got: ${jobResult.evidence?.commit_sha}`, 'red');
    assertions.failed++;
  }
  
  // Assert: Evidence commit_sha ≠ Commit B (workflow context)
  if (jobResult.evidence && jobResult.evidence.commit_sha !== commitB) {
    log('  ✅ Evidence commit_sha ≠ Commit B (no drift)', 'green');
    assertions.passed++;
  } else {
    log(`  ❌ CRITICAL: Evidence used workflow context instead of approved commit`, 'red');
    log(`     Evidence: ${jobResult.evidence?.commit_sha}`, 'red');
    log(`     Workflow: ${commitB}`, 'red');
    assertions.failed++;
  }
  
  // Assert: Evidence parent_sha = Parent of A
  if (jobResult.evidence && jobResult.evidence.parent_sha === parentA) {
    log('  ✅ Evidence parent_sha = A^ (correct parent)', 'green');
    assertions.passed++;
  } else {
    log(`  ❌ Evidence parent_sha incorrect`, 'red');
    assertions.failed++;
  }
  
  // Assert: Migration discovered from Commit A
  if (jobResult.evidence && jobResult.evidence.migration_file.includes(migrationFile)) {
    log('  ✅ Migration discovered from Commit A', 'green');
    assertions.passed++;
  } else {
    log(`  ❌ Migration file incorrect`, 'red');
    assertions.failed++;
  }
  
  log('');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('PROVENANCE CHAIN VERIFICATION', 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log(`Input COMMIT_SHA (approved): ${commitA}`);
  log(`Workflow context (drift):    ${commitB}`);
  log(`Evidence commit_sha:         ${jobResult.evidence?.commit_sha}`);
  log(`Evidence parent_sha:         ${jobResult.evidence?.parent_sha}`);
  
  if (jobResult.evidence?.commit_sha === commitA && jobResult.evidence?.commit_sha !== commitB) {
    log('\n✅ PROVENANCE BINDING: VERIFIED', 'green');
    log('Contract v1.2.0 P0.1/P0.2 compliance: PASS', 'green');
  } else {
    log('\n❌ PROVENANCE BINDING: FAILED', 'red');
    log('Contract v1.2.0 P0.1/P0.2 compliance: FAIL', 'red');
  }
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');
  
  // Save evidence
  const evidenceDir = path.join(CONFIG.evidenceDir, 't6');
  await fs.mkdir(evidenceDir, { recursive: true });
  
  const evidencePath = path.join(testRepo, 'bdgf-execution.json');
  try {
    await fs.copyFile(evidencePath, path.join(evidenceDir, 'bdgf-execution.json'));
    
    await fs.writeFile(path.join(evidenceDir, 'commits.json'), JSON.stringify({
      commit_a: commitA,
      commit_b: commitB,
      parent_a: parentA,
      evidence_commit_sha: jobResult.evidence?.commit_sha,
      evidence_parent_sha: jobResult.evidence?.parent_sha,
    }, null, 2));
  } catch (err) {
    // Evidence copy optional
  }
  
  // Cleanup
  await fs.rm(testRepo, { recursive: true, force: true });
  
  return {
    success: jobResult.success && assertions.failed === 0,
    assertions,
    evidence: jobResult.evidence,
    error: jobResult.error,
  };
}

// ============================================================================
// T2: MISSING APPROVAL_ID → FAIL (Fail-closed)
// ============================================================================

async function testT2MissingApproval() {
  const testRepo = path.join(CONFIG.testDir, 'temp-repo-t2');
  
  // Setup: Create test repo with migration
  await fs.rm(testRepo, { recursive: true, force: true });
  await fs.mkdir(testRepo, { recursive: true });
  
  let result = await execCommand('git', ['init'], { cwd: testRepo });
  await execCommand('git', ['config', 'user.email', 'test@test.com'], { cwd: testRepo });
  await execCommand('git', ['config', 'user.name', 'Test User'], { cwd: testRepo });
  
  await fs.writeFile(path.join(testRepo, 'README.md'), '# Test T2');
  await execCommand('git', ['add', '.'], { cwd: testRepo });
  await execCommand('git', ['commit', '-m', 'Initial'], { cwd: testRepo });
  
  // Create migration
  const migrationsDir = path.join(testRepo, 'supabase', 'migrations');
  await fs.mkdir(migrationsDir, { recursive: true });
  await fs.writeFile(
    path.join(migrationsDir, '20260825000001_t2.sql'),
    'BEGIN; CREATE TABLE t2 (id INT); COMMIT;'
  );
  
  await execCommand('git', ['add', '.'], { cwd: testRepo });
  await execCommand('git', ['commit', '-m', 'Add migration'], { cwd: testRepo });
  
  result = await execCommand('git', ['rev-parse', 'HEAD'], { cwd: testRepo });
  const commitSha = validateSHA(result.stdout, 'T2');
  
  // Execute WITHOUT approval_id
  const jobResult = await executeMigrationJob({
    approvalId: '', // MISSING
    commitSha,
    repoPath: testRepo,
  });
  
  // Assertions
  const assertions = { passed: 0, failed: 0 };
  
  // Assert: FAIL
  if (!jobResult.success) {
    assertions.passed++;
  } else {
    assertions.failed++;
  }
  
  // Assert: Error mentions approval_id
  if (jobResult.error && jobResult.error.includes('approval_id')) {
    assertions.passed++;
  } else {
    assertions.failed++;
  }
  
  // Assert: Exit code non-zero
  if (jobResult.exitCode !== 0) {
    assertions.passed++;
  } else {
    assertions.failed++;
  }
  
  // Save evidence
  const evidenceDir = path.join(CONFIG.evidenceDir, 't2');
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.writeFile(path.join(evidenceDir, 'error.txt'), jobResult.error || 'no error');
  await fs.writeFile(path.join(evidenceDir, 'exit-code.txt'), String(jobResult.exitCode));
  
  await fs.rm(testRepo, { recursive: true, force: true });
  
  return {
    success: !jobResult.success && assertions.failed === 0,
    assertions,
    error: null,
  };
}

// ============================================================================
// T3: MULTIPLE MIGRATIONS → FAIL (One per commit)
// ============================================================================

async function testT3MultipleMigrations() {
  const testRepo = path.join(CONFIG.testDir, 'temp-repo-t3');
  
  await fs.rm(testRepo, { recursive: true, force: true });
  await fs.mkdir(testRepo, { recursive: true });
  
  await execCommand('git', ['init'], { cwd: testRepo });
  await execCommand('git', ['config', 'user.email', 'test@test.com'], { cwd: testRepo });
  await execCommand('git', ['config', 'user.name', 'Test User'], { cwd: testRepo });
  
  await fs.writeFile(path.join(testRepo, 'README.md'), '# Test T3');
  await execCommand('git', ['add', '.'], { cwd: testRepo });
  await execCommand('git', ['commit', '-m', 'Initial'], { cwd: testRepo });
  
  // Create TWO migrations
  const migrationsDir = path.join(testRepo, 'supabase', 'migrations');
  await fs.mkdir(migrationsDir, { recursive: true });
  await fs.writeFile(
    path.join(migrationsDir, '20260825000001_t3_migration1.sql'),
    'BEGIN; CREATE TABLE t3_a (id INT); COMMIT;'
  );
  await fs.writeFile(
    path.join(migrationsDir, '20260825000002_t3_migration2.sql'),
    'BEGIN; CREATE TABLE t3_b (id INT); COMMIT;'
  );
  
  await execCommand('git', ['add', '.'], { cwd: testRepo });
  await execCommand('git', ['commit', '-m', 'Add 2 migrations'], { cwd: testRepo });
  
  const result = await execCommand('git', ['rev-parse', 'HEAD'], { cwd: testRepo });
  const commitSha = validateSHA(result.stdout, 'T3');
  
  // Execute with approval
  const jobResult = await executeMigrationJob({
    approvalId: 'test-t3-' + Date.now(),
    commitSha,
    repoPath: testRepo,
  });
  
  // Assertions
  const assertions = { passed: 0, failed: 0 };
  
  // Assert: FAIL
  if (!jobResult.success) assertions.passed++;
  else assertions.failed++;
  
  // Assert: Error mentions multiple
  if (jobResult.error && (jobResult.error.includes('Multiple') || jobResult.error.includes('2'))) {
    assertions.passed++;
  } else {
    assertions.failed++;
  }
  
  // Save evidence
  const evidenceDir = path.join(CONFIG.evidenceDir, 't3');
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.writeFile(path.join(evidenceDir, 'error.txt'), jobResult.error || 'no error');
  
  await fs.rm(testRepo, { recursive: true, force: true });
  
  return {
    success: !jobResult.success && assertions.failed === 0,
    assertions,
    error: null,
  };
}

// ============================================================================
// T4: NO MIGRATIONS → FAIL (Detection error)
// ============================================================================

async function testT4NoMigrations() {
  const testRepo = path.join(CONFIG.testDir, 'temp-repo-t4');
  
  await fs.rm(testRepo, { recursive: true, force: true });
  await fs.mkdir(testRepo, { recursive: true });
  
  await execCommand('git', ['init'], { cwd: testRepo });
  await execCommand('git', ['config', 'user.email', 'test@test.com'], { cwd: testRepo });
  await execCommand('git', ['config', 'user.name', 'Test User'], { cwd: testRepo });
  
  await fs.writeFile(path.join(testRepo, 'README.md'), '# Test T4');
  await execCommand('git', ['add', '.'], { cwd: testRepo });
  await execCommand('git', ['commit', '-m', 'Initial'], { cwd: testRepo });
  
  // Create commit with NO migration (just app file)
  await fs.mkdir(path.join(testRepo, 'app'), { recursive: true });
  await fs.writeFile(path.join(testRepo, 'app', 'index.js'), 'console.log("app");');
  
  await execCommand('git', ['add', '.'], { cwd: testRepo });
  await execCommand('git', ['commit', '-m', 'Add app file'], { cwd: testRepo });
  
  const result = await execCommand('git', ['rev-parse', 'HEAD'], { cwd: testRepo });
  const commitSha = validateSHA(result.stdout, 'T4');
  
  // Execute
  const jobResult = await executeMigrationJob({
    approvalId: 'test-t4-' + Date.now(),
    commitSha,
    repoPath: testRepo,
  });
  
  // Assertions
  const assertions = { passed: 0, failed: 0 };
  
  // Assert: FAIL
  if (!jobResult.success) assertions.passed++;
  else assertions.failed++;
  
  // Assert: Error mentions no migration
  if (jobResult.error && (jobResult.error.includes('No migration') || jobResult.error.includes('detected'))) {
    assertions.passed++;
  } else {
    assertions.failed++;
  }
  
  // Save evidence
  const evidenceDir = path.join(CONFIG.evidenceDir, 't4');
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.writeFile(path.join(evidenceDir, 'error.txt'), jobResult.error || 'no error');
  
  await fs.rm(testRepo, { recursive: true, force: true });
  
  return {
    success: !jobResult.success && assertions.failed === 0,
    assertions,
    error: null,
  };
}

// ============================================================================
// T5: BDGF FAILURE → FAIL (Error propagation)
// ============================================================================

async function testT5BdgfFailure() {
  const testRepo = path.join(CONFIG.testDir, 'temp-repo-t5');
  
  await fs.rm(testRepo, { recursive: true, force: true });
  await fs.mkdir(testRepo, { recursive: true });
  
  await execCommand('git', ['init'], { cwd: testRepo });
  await execCommand('git', ['config', 'user.email', 'test@test.com'], { cwd: testRepo });
  await execCommand('git', ['config', 'user.name', 'Test User'], { cwd: testRepo });
  
  await fs.writeFile(path.join(testRepo, 'README.md'), '# Test T5');
  await execCommand('git', ['add', '.'], { cwd: testRepo });
  await execCommand('git', ['commit', '-m', 'Initial'], { cwd: testRepo });
  
  // Create migration
  const migrationsDir = path.join(testRepo, 'supabase', 'migrations');
  await fs.mkdir(migrationsDir, { recursive: true });
  await fs.writeFile(
    path.join(migrationsDir, '20260825000001_t5.sql'),
    'BEGIN; CREATE TABLE t5 (id INT); COMMIT;'
  );
  
  await execCommand('git', ['add', '.'], { cwd: testRepo });
  await execCommand('git', ['commit', '-m', 'Add migration'], { cwd: testRepo });
  
  const result = await execCommand('git', ['rev-parse', 'HEAD'], { cwd: testRepo });
  const commitSha = validateSHA(result.stdout, 'T5');
  
  // Execute with FAILURE mock behavior
  const jobResult = await executeMigrationJob({
    approvalId: 'test-t5-' + Date.now(),
    commitSha,
    repoPath: testRepo,
    mockBehavior: 'failure', // ← BDGF returns non-zero
  });
  
  // Assertions
  const assertions = { passed: 0, failed: 0 };
  
  // Assert: FAIL
  if (!jobResult.success) assertions.passed++;
  else assertions.failed++;
  
  // Assert: Error mentions BDGF
  if (jobResult.error && jobResult.error.includes('BDGF')) {
    assertions.passed++;
  } else {
    assertions.failed++;
  }
  
  // Assert: Exit code non-zero
  if (jobResult.exitCode === 1) assertions.passed++;
  else assertions.failed++;
  
  // Save evidence
  const evidenceDir = path.join(CONFIG.evidenceDir, 't5');
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.writeFile(path.join(evidenceDir, 'error.txt'), jobResult.error || 'no error');
  await fs.writeFile(path.join(evidenceDir, 'exit-code.txt'), String(jobResult.exitCode));
  
  await fs.rm(testRepo, { recursive: true, force: true });
  
  return {
    success: !jobResult.success && assertions.failed === 0,
    assertions,
    error: null,
  };
}

// ============================================================================
// T7: MERGE COMMIT → FAIL (Single-parent policy)
// ============================================================================

async function testT7MergeCommit() {
  const testRepo = path.join(CONFIG.testDir, 'temp-repo-t7');
  
  await fs.rm(testRepo, { recursive: true, force: true });
  await fs.mkdir(testRepo, { recursive: true });
  
  await execCommand('git', ['init'], { cwd: testRepo });
  await execCommand('git', ['config', 'user.email', 'test@test.com'], { cwd: testRepo });
  await execCommand('git', ['config', 'user.name', 'Test User'], { cwd: testRepo });
  
  // Initial commit
  await fs.writeFile(path.join(testRepo, 'README.md'), '# Test T7');
  await execCommand('git', ['add', '.'], { cwd: testRepo });
  await execCommand('git', ['commit', '-m', 'Initial'], { cwd: testRepo });
  
  // Create branch with migration
  await execCommand('git', ['checkout', '-b', 'feature'], { cwd: testRepo });
  
  const migrationsDir = path.join(testRepo, 'supabase', 'migrations');
  await fs.mkdir(migrationsDir, { recursive: true });
  await fs.writeFile(
    path.join(migrationsDir, '20260825000001_t7_merge_test.sql'),
    'BEGIN; CREATE TABLE t7 (id INT); COMMIT;'
  );
  
  await execCommand('git', ['add', '.'], { cwd: testRepo });
  await execCommand('git', ['commit', '-m', 'Add migration on feature'], { cwd: testRepo });
  
  // Create divergent main branch
  await execCommand('git', ['checkout', 'master'], { cwd: testRepo });
  await fs.writeFile(path.join(testRepo, 'other.txt'), 'other change');
  await execCommand('git', ['add', '.'], { cwd: testRepo });
  await execCommand('git', ['commit', '-m', 'Main branch change'], { cwd: testRepo });
  
  // Create merge commit
  await execCommand('git', ['merge', 'feature', '--no-ff', '-m', 'Merge feature'], { cwd: testRepo });
  
  const result = await execCommand('git', ['rev-parse', 'HEAD'], { cwd: testRepo });
  const mergeSha = validateSHA(result.stdout, 'T7 merge');
  
  // Verify it's a merge commit (2 parents)
  const parentsResult = await execCommand('git', ['rev-list', '--parents', '-n', '1', mergeSha], { cwd: testRepo });
  const parentCount = parentsResult.stdout.split(/\s+/).length - 1;
  
  log(`  Created merge commit: ${mergeSha.substring(0, 8)}... (${parentCount} parents)`, 'yellow');
  
  // Execute - should FAIL on merge commit check
  const jobResult = await executeMigrationJob({
    approvalId: 'test-t7-' + Date.now(),
    commitSha: mergeSha,
    repoPath: testRepo,
  });
  
  // Assertions
  const assertions = { passed: 0, failed: 0 };
  
  // Assert: FAIL
  if (!jobResult.success) {
    log(`  ✅ Execution failed as expected`, 'green');
    assertions.passed++;
  } else {
    log(`  ❌ Execution should have failed on merge commit`, 'red');
    assertions.failed++;
  }
  
  // Assert: Error mentions merge
  if (jobResult.error && (jobResult.error.includes('Merge') || jobResult.error.includes('parent'))) {
    log(`  ✅ Error mentions merge/parent`, 'green');
    assertions.passed++;
  } else {
    log(`  ❌ Error should mention merge commit`, 'red');
    assertions.failed++;
  }
  
  // Assert: Parent count was 2
  if (parentCount === 2) {
    log(`  ✅ Merge commit has 2 parents (verified)`, 'green');
    assertions.passed++;
  } else {
    log(`  ❌ Expected 2 parents, got ${parentCount}`, 'red');
    assertions.failed++;
  }
  
  // Save evidence
  const evidenceDir = path.join(CONFIG.evidenceDir, 't7');
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.writeFile(path.join(evidenceDir, 'error.txt'), jobResult.error || 'no error');
  await fs.writeFile(path.join(evidenceDir, 'merge-sha.txt'), mergeSha);
  await fs.writeFile(path.join(evidenceDir, 'parent-count.txt'), String(parentCount));
  
  await fs.rm(testRepo, { recursive: true, force: true });
  
  return {
    success: !jobResult.success && assertions.failed === 0,
    assertions,
    error: null,
  };
}

// ============================================================================
// MAIN TEST EXECUTION
// ============================================================================

async function main() {
  logHeader('🧪 PHASE 4B.2 TEST HARNESS (Node.js)');
  log('Contract: P0_3_PHASE4B_2_CONTRACT.md v1.2.0');
  log(`Timestamp: ${new Date().toISOString()}`);
  log('Test Matrix: 7 scenarios (T1-T7)\n');
  
  // Production safety check
  await checkProductionSafety();
  
  // Setup environment
  process.env.TARGET_ENVIRONMENT = 'test';
  process.env.DATABASE_EXECUTOR_URL = 'mock://test-database';
  process.env.GATE_SIGNING_KEY = 'mock-test-key';
  
  // Create evidence directory
  await fs.mkdir(CONFIG.evidenceDir, { recursive: true });
  
  // Run tests
  logHeader('📋 EXECUTING TEST SCENARIOS');
  
  await runTest('T1: Valid approval + 1 migration', testT1ValidApproval);
  await runTest('T2: Missing approval_id', testT2MissingApproval);
  await runTest('T3: Multiple migrations', testT3MultipleMigrations);
  await runTest('T4: No migrations', testT4NoMigrations);
  await runTest('T5: BDGF failure', testT5BdgfFailure);
  await runTest('T6: Provenance binding (P0 CRITICAL)', testT6Provenance);
  await runTest('T7: Merge commit rejection', testT7MergeCommit);
  
  // Summary
  logHeader('📊 TEST SUMMARY');
  log('');
  log(`Total Tests Run: 7`);
  log(`Passed: ${results.passed}`, results.passed > 0 ? 'green' : 'red');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log('');
  
  // Write evidence summary
  await fs.writeFile(
    path.join(CONFIG.evidenceDir, 'test-summary.json'),
    JSON.stringify({
      timestamp: new Date().toISOString(),
      contract_version: '1.2.0',
      tests_run: 7,
      tests_passed: results.passed,
      tests_failed: results.failed,
      results: results.tests,
    }, null, 2)
  );
  
  if (results.passed === 7 && results.failed === 0) {
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'green');
    log('✅ ALL TESTS PASSED (7/7)', 'green');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'green');
    log('');
    log('Contract v1.2.0 implementation: VERIFIED');
    log(`Evidence: ${CONFIG.evidenceDir}/`);
    log('');
    log('Next: Generate comprehensive evidence package → Implementation');
    process.exit(0);
  } else {
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'red');
    log(`❌ TESTS FAILED (${results.passed}/7)`, 'red');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'red');
    log('');
    log('Contract implementation: NOT VERIFIED');
    log(`Review logs in: ${CONFIG.evidenceDir}/`);
    log('');
    log('Implementation BLOCKED until tests pass');
    process.exit(1);
  }
}

// Run tests
main().catch((error) => {
  log('\n❌ Test harness error:', 'red');
  log(error.message, 'red');
  log(error.stack, 'red');
  process.exit(1);
});
