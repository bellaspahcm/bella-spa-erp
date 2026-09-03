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
  // Test 1: Test failure  
  {
    name: 'Test Failure Detection',
    description: 'Failing test → pipeline stops at test step',
    inject: () => {
      const testDir = `src/platform/education/domain/__tests__`;
      const testFile = `${testDir}/z-failure-boundary.test.ts`;
      writeFileSync(testFile, `
describe('Failure Boundary Test', () => {
  it('should fail deliberately', () => {
    expect(true).toBe(false);
  });
});
`);
    },
    cleanup: () => {
      const testFile = `src/platform/education/domain/__tests__/z-failure-boundary.test.ts`;
      if (existsSync(testFile)) {
        unlinkSync(testFile);
      }
    },
    expectedFailureStep: 'test',
  },
  
  // Test 2: Typecheck error
  {
    name: 'Typecheck Error Detection',
    description: 'Type error → pipeline stops at typecheck',
    inject: () => {
      const domainFile = `src/platform/education/domain/z-broken.entity.ts`;
      writeFileSync(domainFile, `
// Deliberate type error for failure boundary test
export class BrokenEntity {
  constructor(public id: number) {}
  
  // Type error
  brokenMethod() {
    return this.nonExistentProperty;
  }
}
`);
    },
    cleanup: () => {
      const domainFile = `src/platform/education/domain/z-broken.entity.ts`;
      if (existsSync(domainFile)) {
        unlinkSync(domainFile);
      }
    },
    expectedFailureStep: 'typecheck',
  },
  
  // Test 3: Pipeline completes with correct evidence
  {
    name: 'Baseline Success Path',
    description: 'Clean evidence → pipeline completes successfully',
    inject: () => {
      console.log('   No injection - baseline run');
    },
    cleanup: () => {},
    expectedFailureStep: 'none',
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
      
      // Verify it stopped correctly
      if (test.expectedFailureStep === 'none') {
        // Baseline success test
        if (metrics.outcome.status === 'pass') {
          console.log(`✅ ${test.name}: Pipeline completed successfully`);
          results.passed++;
        } else {
          console.log(`❌ ${test.name}: Expected PASS, got ${metrics.outcome.status.toUpperCase()}`);
          results.failed++;
        }
      } else {
        // Failure test
        const expectedStatus = test.expectedFailureStep === 'scope' ? 'blocked' : 'fail';
        
        if (metrics.outcome.status === expectedStatus) {
          console.log(`✅ ${test.name}: Pipeline stopped with ${expectedStatus.toUpperCase()}`);
          
          // Verify later gates were NOT executed
          const failedStepIndex = metrics.pipeline.steps.findIndex(s => s.status === 'fail' || s.status === 'blocked');
          const allStepsAfterFailed = metrics.pipeline.steps.slice(failedStepIndex + 1);
          
          if (allStepsAfterFailed.length === 0 || allStepsAfterFailed.every(s => s.status === 'skip')) {
            console.log(`✅ ${test.name}: Later gates not executed (correct)`);
            results.passed++;
          } else {
            console.log(`❌ ${test.name}: Later gates executed after failure!`);
            results.failed++;
          }
        } else {
          console.log(`❌ ${test.name}: Expected ${expectedStatus.toUpperCase()}, got ${metrics.outcome.status.toUpperCase()}`);
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
