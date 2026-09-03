#!/usr/bin/env tsx
/**
 * E10 Failure Boundary Tests
 * 
 * Verifies Factory pipeline STOPs correctly on failures.
 * 
 * Guardrail: Failure injection MUST be isolated & reversible.
 */

import { FactoryPipeline, type FactoryRunConfig } from './orchestrator';
import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

const TEST_TEMP_DIR = '.factory-test-temp';

interface FailureBoundaryTest {
  name: string;
  description: string;
  inject: () => void;
  cleanup: () => void;
  expectedFailureStep: string;
}

// Capture original state
function captureState(): string {
  return execSync('git status --porcelain', { encoding: 'utf-8' });
}

function verifyStateUnchanged(originalState: string, testName: string) {
  const currentState = captureState();
  if (currentState !== originalState) {
    console.log(`❌ ${testName}: Repository state changed!`);
    console.log(`   Original: ${originalState.substring(0, 100)}`);
    console.log(`   Current: ${currentState.substring(0, 100)}`);
    throw new Error(`${testName} modified repository state`);
  }
  console.log(`✅ ${testName}: Repository state unchanged`);
}

// ============================================================================
// Failure Boundary Test Cases
// ============================================================================

const failureBoundaryTests: FailureBoundaryTest[] = [
  // Test 1: Missing entity (evidence fails)
  {
    name: 'Missing Entity Evidence',
    description: 'Inject fake entity without migration',
    inject: () => {
      // This test doesn't inject - just verifies Student is DEFERRED (no evidence)
      console.log('   Student has no migration (expected behavior)');
    },
    cleanup: () => {
      // No cleanup needed
    },
    expectedFailureStep: 'none', // This should PASS but with DEFER
  },
  
  // Test 2: Build error (syntax error in domain)
  {
    name: 'Build Error Detection',
    description: 'Inject syntax error in domain entity',
    inject: () => {
      if (!existsSync(TEST_TEMP_DIR)) {
        mkdirSync(TEST_TEMP_DIR, { recursive: true });
      }
      const testFile = `${TEST_TEMP_DIR}/broken-entity.ts`;
      writeFileSync(testFile, 'export class Broken { invalid syntax }');
    },
    cleanup: () => {
      const testFile = `${TEST_TEMP_DIR}/broken-entity.ts`;
      if (existsSync(testFile)) {
        unlinkSync(testFile);
      }
    },
    expectedFailureStep: 'typecheck', // Should fail at typecheck
  },
  
  // Test 3: Test failure
  {
    name: 'Test Failure Detection',
    description: 'Inject failing test',
    inject: () => {
      if (!existsSync(TEST_TEMP_DIR)) {
        mkdirSync(TEST_TEMP_DIR, { recursive: true });
      }
      const testFile = `${TEST_TEMP_DIR}/failing.test.ts`;
      writeFileSync(testFile, `
        describe('Failure Boundary Test', () => {
          it('should fail', () => {
            expect(true).toBe(false);
          });
        });
      `);
    },
    cleanup: () => {
      const testFile = `${TEST_TEMP_DIR}/failing.test.ts`;
      if (existsSync(testFile)) {
        unlinkSync(testFile);
      }
    },
    expectedFailureStep: 'test', // Should fail at test execution
  },
];

// ============================================================================
// Test Runner
// ============================================================================

async function runFailureBoundaryTests() {
  console.log('\n🧪 Testing E10 Failure Boundaries\n');
  console.log('Guardrail: All tests MUST leave repository unchanged\n');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: [] as any[],
  };
  
  for (const test of failureBoundaryTests) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 Test: ${test.name}`);
    console.log(`   ${test.description}`);
    console.log('='.repeat(80));
    
    const originalState = captureState();
    
    try {
      // Inject failure
      test.inject();
      
      // Run pipeline (should stop at expected step)
      const config: FactoryRunConfig = {
        industry: 'education',
        mode: 'controlled-fixture',
      };
      
      const pipeline = new FactoryPipeline(config);
      const metrics = await pipeline.execute(config);
      
      // Verify it stopped
      if (test.expectedFailureStep === 'none') {
        if (metrics.outcome.status === 'pass') {
          console.log(`✅ ${test.name}: Pipeline passed as expected`);
          results.passed++;
        } else {
          console.log(`❌ ${test.name}: Expected PASS, got ${metrics.outcome.status}`);
          results.failed++;
        }
      } else {
        if (metrics.outcome.status === 'fail') {
          console.log(`✅ ${test.name}: Pipeline stopped correctly`);
          results.passed++;
        } else {
          console.log(`❌ ${test.name}: Expected FAIL, got ${metrics.outcome.status}`);
          results.failed++;
        }
      }
      
      results.tests.push({
        name: test.name,
        status: metrics.outcome.status,
        expectedStop: test.expectedFailureStep,
        passed: test.expectedFailureStep === 'none' 
          ? metrics.outcome.status === 'pass'
          : metrics.outcome.status === 'fail',
      });
      
    } catch (error) {
      console.log(`❌ ${test.name}: Unexpected error: ${error}`);
      results.failed++;
      results.tests.push({
        name: test.name,
        error: String(error),
        passed: false,
      });
    } finally {
      // Always cleanup
      try {
        test.cleanup();
        verifyStateUnchanged(originalState, test.name);
      } catch (cleanupError) {
        console.log(`❌ ${test.name}: Cleanup failed: ${cleanupError}`);
        results.failed++;
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 Failure Boundary Test Results');
  console.log('='.repeat(80));
  console.log(`Passed: ${results.passed}/${failureBoundaryTests.length}`);
  console.log(`Failed: ${results.failed}/${failureBoundaryTests.length}`);
  console.log('='.repeat(80) + '\n');
  
  // Save results
  const resultsPath = `logs/factory-failure-boundary-tests-${Date.now()}.json`;
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`📄 Results saved: ${resultsPath}\n`);
  
  process.exit(results.failed === 0 ? 0 : 1);
}

// ============================================================================
// Main
// ============================================================================

if (require.main === module) {
  runFailureBoundaryTests().catch((error) => {
    console.error('❌ Failure boundary tests failed:', error);
    process.exit(1);
  });
}
