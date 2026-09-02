#!/usr/bin/env node
/**
 * Gate B Verification Test
 * Tests known PASS/FAIL states with proper classification
 */

import { spawnSync } from 'child_process';
import * as path from 'path';

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');

interface TestCase {
  name: string;
  config: string;
  expectedStatus: 'PASS' | 'FAIL';
  expectedDiagnostics?: number;
}

const testCases: TestCase[] = [
  {
    name: 'core',
    config: 'tsconfig.platform-core.json',
    expectedStatus: 'PASS',
  },
  {
    name: 'finance',
    config: 'tsconfig.platform-finance.json',
    expectedStatus: 'PASS',
  },
  {
    name: 'real-estate',
    config: 'tsconfig.platform-real-estate.json',
    expectedStatus: 'FAIL',
    expectedDiagnostics: 3,
  },
];

function runTest(testCase: TestCase): boolean {
  console.log(`\n📋 Testing: ${testCase.name}`);
  console.log(`   Config: ${testCase.config}`);
  console.log(`   Expected: ${testCase.expectedStatus}`);
  
  const configPath = path.join(WORKSPACE_ROOT, testCase.config);
  const tscCommand = `npx tsc -p "${configPath}" --noEmit`;
  
  const startTime = Date.now();
  const result = spawnSync(tscCommand, [], {
    cwd: WORKSPACE_ROOT,
    timeout: 30000,
    encoding: 'utf-8',
    shell: true,
  });
  const duration = Date.now() - startTime;
  
  // Parse diagnostics
  const allOutput = (result.stdout || '') + '\n' + (result.stderr || '');
  const diagnostics = allOutput.split('\n').filter(line => 
    line.match(/\.tsx?\(\d+,\d+\): error TS\d+:/)
  );
  
  // Classify
  let actualStatus: 'PASS' | 'FAIL' | 'HOTSPOT';
  if (result.status === 0) {
    actualStatus = 'PASS';
  } else if (diagnostics.length > 0) {
    actualStatus = 'FAIL';
  } else {
    actualStatus = 'HOTSPOT';
  }
  
  console.log(`   Duration: ${(duration / 1000).toFixed(1)}s`);
  console.log(`   Exit code: ${result.status}`);
  console.log(`   Diagnostics: ${diagnostics.length}`);
  console.log(`   Actual: ${actualStatus}`);
  
  // Verify
  const statusMatch = actualStatus === testCase.expectedStatus;
  const diagnosticsMatch = testCase.expectedDiagnostics === undefined || 
                          diagnostics.length === testCase.expectedDiagnostics;
  
  if (statusMatch && diagnosticsMatch) {
    console.log(`   ✅ PASS`);
    return true;
  } else {
    console.log(`   ❌ FAIL`);
    if (!statusMatch) {
      console.log(`      Expected status: ${testCase.expectedStatus}, got: ${actualStatus}`);
    }
    if (!diagnosticsMatch) {
      console.log(`      Expected diagnostics: ${testCase.expectedDiagnostics}, got: ${diagnostics.length}`);
    }
    return false;
  }
}

// Run all tests
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║                                                               ║');
console.log('║             Gate B Classification Verification                ║');
console.log('║                                                               ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');

let allPassed = true;
for (const testCase of testCases) {
  const passed = runTest(testCase);
  if (!passed) allPassed = false;
}

console.log('\n═══════════════════════════════════════════════════════════════');
if (allPassed) {
  console.log('✅ All verification tests PASSED');
  console.log('   Gate B classification logic verified on known states.\n');
  process.exit(0);
} else {
  console.log('❌ Some verification tests FAILED');
  console.log('   Gate B classification logic needs correction.\n');
  process.exit(1);
}
