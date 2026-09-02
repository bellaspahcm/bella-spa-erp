#!/usr/bin/env node
/**
 * Test Regression Protection Mode
 * 
 * Verifies that baseline-aware enforcement correctly:
 * 1. ALLOWS baseline-preserved state
 * 2. BLOCKS new regressions (PASS → FAIL)
 * 3. ALLOWS improvements (FAIL → less diagnostics)
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  BaselineManifest,
  ScopeBaseline,
  DiagnosticFingerprint,
  determineVerdict,
} from './baseline-schema';

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const BASELINE_PATH = path.join(WORKSPACE_ROOT, 'baseline.json');

// ============================================================================
// TEST SCENARIOS
// ============================================================================

interface TestScenario {
  name: string;
  baselineStatus: 'PASS' | 'FAIL' | 'HOTSPOT';
  currentStatus: 'PASS' | 'FAIL' | 'HOTSPOT';
  baselineDiagnostics: number;
  newDiagnostics: number;
  resolvedDiagnostics: number;
  expectedVerdict: 'ALLOW' | 'BLOCK';
  expectedReason: string;
}

const scenarios: TestScenario[] = [
  {
    name: 'Scenario 1: PASS → PASS (no change)',
    baselineStatus: 'PASS',
    currentStatus: 'PASS',
    baselineDiagnostics: 0,
    newDiagnostics: 0,
    resolvedDiagnostics: 0,
    expectedVerdict: 'ALLOW',
    expectedReason: 'No change: PASS maintained',
  },
  {
    name: 'Scenario 2: PASS → FAIL (new regression)',
    baselineStatus: 'PASS',
    currentStatus: 'FAIL',
    baselineDiagnostics: 0,
    newDiagnostics: 3,
    resolvedDiagnostics: 0,
    expectedVerdict: 'BLOCK',
    expectedReason: 'Regression: PASS → FAIL',
  },
  {
    name: 'Scenario 3: PASS → HOTSPOT (degradation)',
    baselineStatus: 'PASS',
    currentStatus: 'HOTSPOT',
    baselineDiagnostics: 0,
    newDiagnostics: 0,
    resolvedDiagnostics: 0,
    expectedVerdict: 'BLOCK',
    expectedReason: 'Regression: PASS → HOTSPOT',
  },
  {
    name: 'Scenario 4: FAIL → PASS (improvement)',
    baselineStatus: 'FAIL',
    currentStatus: 'PASS',
    baselineDiagnostics: 10,
    newDiagnostics: 0,
    resolvedDiagnostics: 10,
    expectedVerdict: 'ALLOW',
    expectedReason: '10 diagnostics resolved',
  },
  {
    name: 'Scenario 5: FAIL → FAIL with new diagnostics (regression)',
    baselineStatus: 'FAIL',
    currentStatus: 'FAIL',
    baselineDiagnostics: 10,
    newDiagnostics: 3,
    resolvedDiagnostics: 0,
    expectedVerdict: 'BLOCK',
    expectedReason: '3 new diagnostic(s) introduced',
  },
  {
    name: 'Scenario 6: FAIL → FAIL with resolved diagnostics (improvement)',
    baselineStatus: 'FAIL',
    currentStatus: 'FAIL',
    baselineDiagnostics: 10,
    newDiagnostics: 0,
    resolvedDiagnostics: 5,
    expectedVerdict: 'ALLOW',
    expectedReason: '5 diagnostic(s) resolved, no new regressions',
  },
  {
    name: 'Scenario 7: FAIL → FAIL no change (baseline preserved)',
    baselineStatus: 'FAIL',
    currentStatus: 'FAIL',
    baselineDiagnostics: 10,
    newDiagnostics: 0,
    resolvedDiagnostics: 0,
    expectedVerdict: 'ALLOW',
    expectedReason: 'Baseline preserved: no new regressions',
  },
  {
    name: 'Scenario 8: FAIL → HOTSPOT (degradation)',
    baselineStatus: 'FAIL',
    currentStatus: 'HOTSPOT',
    baselineDiagnostics: 10,
    newDiagnostics: 0,
    resolvedDiagnostics: 0,
    expectedVerdict: 'BLOCK',
    expectedReason: 'Degradation: FAIL → HOTSPOT (timeout introduced)',
  },
  {
    name: 'Scenario 9: HOTSPOT → PASS (improvement)',
    baselineStatus: 'HOTSPOT',
    currentStatus: 'PASS',
    baselineDiagnostics: 0,
    newDiagnostics: 0,
    resolvedDiagnostics: 0,
    expectedVerdict: 'ALLOW',
    expectedReason: 'Improvement: HOTSPOT → PASS',
  },
  {
    name: 'Scenario 10: HOTSPOT → FAIL (need review)',
    baselineStatus: 'HOTSPOT',
    currentStatus: 'FAIL',
    baselineDiagnostics: 0,
    newDiagnostics: 5,
    resolvedDiagnostics: 0,
    expectedVerdict: 'BLOCK',
    expectedReason: 'HOTSPOT → FAIL: diagnostics now visible, requires review',
  },
  {
    name: 'Scenario 11: HOTSPOT → HOTSPOT (baseline preserved)',
    baselineStatus: 'HOTSPOT',
    currentStatus: 'HOTSPOT',
    baselineDiagnostics: 0,
    newDiagnostics: 0,
    resolvedDiagnostics: 0,
    expectedVerdict: 'ALLOW',
    expectedReason: 'Baseline preserved: HOTSPOT remains',
  },
  {
    name: 'Scenario 12: FAIL → FAIL (trade: 5 resolved, 3 new)',
    baselineStatus: 'FAIL',
    currentStatus: 'FAIL',
    baselineDiagnostics: 10,
    newDiagnostics: 3,
    resolvedDiagnostics: 5,
    expectedVerdict: 'BLOCK',
    expectedReason: '3 new diagnostic(s) introduced',
  },
];

// ============================================================================
// TEST EXECUTION
// ============================================================================

function createMockFingerprints(count: number, prefix: string): DiagnosticFingerprint[] {
  return Array.from({ length: count }, (_, i) => ({
    file: `src/test/${prefix}-file-${i}.ts`,
    line: 10 + i,
    column: 5,
    code: 'TS2322',
    messagePattern: `Mock diagnostic ${i}`,
  }));
}

function runScenario(scenario: TestScenario): boolean {
  // Create mock diagnostics
  const newDiagnostics = createMockFingerprints(scenario.newDiagnostics, 'new');
  const resolvedDiagnostics = createMockFingerprints(scenario.resolvedDiagnostics, 'resolved');
  
  // Run verdict logic
  const result = determineVerdict(
    scenario.baselineStatus,
    scenario.currentStatus,
    newDiagnostics,
    resolvedDiagnostics
  );
  
  // Check verdict
  const verdictMatch = result.verdict === scenario.expectedVerdict;
  const reasonMatch = result.reason.includes(scenario.expectedReason.split(':')[0]);
  
  const pass = verdictMatch && reasonMatch;
  
  // Print result
  const statusIcon = pass ? '✅' : '❌';
  console.log(`\n${statusIcon} ${scenario.name}`);
  console.log(`   Transition: ${scenario.baselineStatus} → ${scenario.currentStatus}`);
  console.log(`   New: ${scenario.newDiagnostics}, Resolved: ${scenario.resolvedDiagnostics}`);
  console.log(`   Expected: ${scenario.expectedVerdict} (${scenario.expectedReason})`);
  console.log(`   Actual:   ${result.verdict} (${result.reason})`);
  
  if (!pass) {
    if (!verdictMatch) {
      console.log(`   ❌ Verdict mismatch: expected ${scenario.expectedVerdict}, got ${result.verdict}`);
    }
    if (!reasonMatch) {
      console.log(`   ⚠️  Reason mismatch: expected "${scenario.expectedReason}", got "${result.reason}"`);
    }
  }
  
  return pass;
}

function verifyBaselineExists(): boolean {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error('\n❌ Error: Baseline not found at baseline.json');
    console.error('   Run: npm run governance:baseline\n');
    return false;
  }
  
  try {
    const content = fs.readFileSync(BASELINE_PATH, 'utf-8');
    const baseline = JSON.parse(content) as BaselineManifest;
    
    console.log('\n✅ Baseline loaded successfully');
    console.log(`   Version: ${baseline.version}`);
    console.log(`   Scopes: ${baseline.scopes.length}`);
    console.log(`   Captured: ${baseline.capturedAt}`);
    if (baseline.gitCommit) {
      console.log(`   Commit: ${baseline.gitCommit.substring(0, 8)}`);
    }
    console.log(`   Summary: ${baseline.summary.pass} PASS / ${baseline.summary.fail} FAIL / ${baseline.summary.hotspot} HOTSPOT`);
    
    return true;
  } catch (error) {
    console.error(`\n❌ Error: Failed to parse baseline: ${error}\n`);
    return false;
  }
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                   ║');
  console.log('║        Test Regression Protection — Phase 1 Verification         ║');
  console.log('║                                                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  
  // Verify baseline exists
  if (!verifyBaselineExists()) {
    process.exit(1);
  }
  
  console.log('\n' + '═'.repeat(71));
  console.log('Running Verdict Logic Tests');
  console.log('═'.repeat(71));
  
  // Run all scenarios
  const results = scenarios.map(runScenario);
  const passed = results.filter(r => r).length;
  const failed = results.length - passed;
  
  // Summary
  console.log('\n' + '═'.repeat(71));
  console.log('Test Summary');
  console.log('═'.repeat(71));
  console.log(`\n  Total:  ${results.length}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n✅ All regression protection tests PASSED\n');
    console.log('Verdict Logic Verified:');
    console.log('  1. PASS → PASS = ALLOW (no change)');
    console.log('  2. PASS → FAIL = BLOCK (new regression)');
    console.log('  3. PASS → HOTSPOT = BLOCK (degradation)');
    console.log('  4. FAIL → PASS = ALLOW (improvement)');
    console.log('  5. FAIL → FAIL + new diagnostics = BLOCK (regression)');
    console.log('  6. FAIL → FAIL + resolved diagnostics = ALLOW (improvement)');
    console.log('  7. FAIL → FAIL + no change = ALLOW (baseline preserved)');
    console.log('  8. FAIL → HOTSPOT = BLOCK (degradation)');
    console.log('  9. HOTSPOT → PASS = ALLOW (improvement)');
    console.log('  10. HOTSPOT → FAIL = BLOCK (need review)');
    console.log('  11. HOTSPOT → HOTSPOT = ALLOW (baseline preserved)');
    console.log('  12. Trade scenario = BLOCK if ANY new diagnostics\n');
    
    console.log('Next Steps:');
    console.log('  1. Commit baseline: git add baseline.json');
    console.log('  2. Enable regression protection in CI/pre-commit');
    console.log('  3. Start remediation: Fix FAIL/HOTSPOT scopes');
    console.log('  4. After 44 PASS: Remove baseline, enable enforced mode\n');
    
    process.exit(0);
  } else {
    console.log(`\n❌ ${failed} test(s) FAILED\n`);
    console.log('Review verdict logic in baseline-schema.ts\n');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
