#!/usr/bin/env tsx
/**
 * Contract-Schema Conformance Gate Test Suite
 * 
 * Validates MVP gate with Real-Estate as REVIEW_REQUIRED test case
 */

import { runGate, GateResult, Verdict } from './contract-schema-conformance';

interface TestCase {
  name: string;
  scope: string;
  table: string;
  expectedVerdict: Verdict;
  description: string;
}

const testCases: TestCase[] = [
  {
    name: 'Real-Estate (REVIEW_REQUIRED)',
    scope: 'real-estate',
    table: 're_products',
    expectedVerdict: 'REVIEW_REQUIRED',
    description: 'Domain vocabulary (held/completed) differs from DB (booked/handed_over)'
  }
];

function runTests(): void {
  console.log('\n' + '='.repeat(70));
  console.log('CONTRACT–SCHEMA CONFORMANCE GATE — TEST SUITE');
  console.log('='.repeat(70) + '\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    console.log(`  Scope: ${testCase.scope}`);
    console.log(`  Table: ${testCase.table}`);
    console.log(`  Expected: ${testCase.expectedVerdict}`);
    console.log(`  Description: ${testCase.description}`);
    console.log();
    
    try {
      const result = runGate(testCase.scope, testCase.table);
      
      if (result.verdict === testCase.expectedVerdict) {
        console.log(`  ✅ PASS — Got expected verdict: ${result.verdict}`);
        passed++;
      } else {
        console.log(`  ❌ FAIL — Expected ${testCase.expectedVerdict}, got ${result.verdict}`);
        failed++;
      }
      
      // Show check details
      console.log(`  Checks:`);
      for (const check of result.checks) {
        const icon = check.verdict === 'PASS' ? '✅' : check.verdict === 'FAIL' ? '❌' : '⚠️';
        console.log(`    ${icon} ${check.verdict.padEnd(16)} ${check.check}`);
      }
      
    } catch (error) {
      console.log(`  ❌ ERROR — ${error}`);
      failed++;
    }
    
    console.log('\n' + '-'.repeat(70) + '\n');
  }
  
  console.log('='.repeat(70));
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70) + '\n');
  
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}
