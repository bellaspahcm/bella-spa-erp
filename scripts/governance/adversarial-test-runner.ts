#!/usr/bin/env tsx
/**
 * Phase 3: Adversarial Testing
 * 
 * Tests 4 automated Factory Rules against BLOCK+ALLOW fixtures
 * Success criteria: <5% false positive, 0% false negative per rule
 */

import { execSync } from 'child_process';
import { resolve, relative, basename } from 'path';
import { readdirSync, existsSync, unlinkSync, writeFileSync } from 'fs';

interface TestCase {
  rule: string;
  fixture: string;
  path: string;
  expectedVerdict: 'BLOCK' | 'ALLOW';
}

interface TestResult {
  rule: string;
  fixture: string;
  expected: 'BLOCK' | 'ALLOW';
  actual: 'BLOCK' | 'ALLOW' | 'ERROR';
  exitCode: number;
  passed: boolean;
  runtime: number;
}

const RULES = [
  { id: 'rule2-schema-drift', name: 'Rule 2: Schema-Type Drift' },
  { id: 'rule4-mapper-contract', name: 'Rule 4: Mapper Contract' },
  { id: 'rule7-diagnostic-inventory', name: 'Rule 7: Diagnostic Inventory' },
  { id: 'rule10-repeated-pattern', name: 'Rule 10: Repeated Pattern' },
];

const fixturesDir = resolve(__dirname, 'fixtures');

function discoverTestCases(): TestCase[] {
  const testCases: TestCase[] = [];

  for (const rule of RULES) {
    const ruleDir = resolve(fixturesDir, rule.id);
    const fixtures = readdirSync(ruleDir).filter(f => f.endsWith('.ts'));

    for (const fixture of fixtures) {
      const expectedVerdict = fixture.startsWith('block') ? 'BLOCK' : 'ALLOW';
      testCases.push({
        rule: rule.id,
        fixture,
        path: resolve(ruleDir, fixture),
        expectedVerdict,
      });
    }
  }

  return testCases;
}

function runTest(testCase: TestCase): TestResult {
  const startTime = Date.now();
  
  // Create isolated tsconfig per fixture  
  const runId = Date.now();
  const tsconfigName = `temp-${testCase.rule}-${basename(testCase.fixture, '.ts')}-${runId}.json`;
  const tsconfigPath = resolve(__dirname, tsconfigName);
  
  try {
    // Path must be relative to tsconfig directory (scripts/governance/)
    const fixtureRelPath = relative(__dirname, testCase.path).replace(/\\/g, '/');
    
    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        lib: ['ES2020'],
        strict: true,
        esModuleInterop: true,
        skipLibCheck: false,
        noEmit: true,
        baseUrl: '.',
        paths: {
          '@/*': ['./src/*'],
        },
      },
      include: [fixtureRelPath],
    };

    // Write isolated tsconfig
    writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));

    // Diagnostic output
    if (process.env.DEBUG_HARNESS) {
      console.error(`\n[HARNESS] ${testCase.fixture}`);
      console.error(`  tsconfig: ${tsconfigPath}`);
      console.error(`  fixture (rel to tsconfig): ${fixtureRelPath}`);
      console.error(`  fixture (abs): ${testCase.path}`);
    }

    // Test Harness Integrity Check: Verify tsconfig was written
    if (!existsSync(tsconfigPath)) {
      throw new Error(`TEST HARNESS: Failed to create tsconfig at ${tsconfigPath}`);
    }

    // Get scope path (relative to workspace root for Rule 7)
    const scopePath = relative(resolve(__dirname, '../..'), testCase.path).replace(/\\/g, '/');

    // Run orchestrator with isolated config
    const result = execSync(
      `npm run governance:factory-rules -- --config=${tsconfigPath} --scope=${scopePath}`,
      {
        cwd: resolve(__dirname, '../..'),
        stdio: 'pipe',
        encoding: 'utf-8',
      }
    );

    if (process.env.DEBUG_HARNESS) {
      console.error(`  stdout: ${result.substring(0, 200)}...`);
    }

    // Cleanup isolated tsconfig
    try {
      unlinkSync(tsconfigPath);
    } catch (e) {
      // Cleanup failed, not critical
    }

    // exit 0 = ALLOW
    const runtime = Date.now() - startTime;
    return {
      rule: testCase.rule,
      fixture: testCase.fixture,
      expected: testCase.expectedVerdict,
      actual: 'ALLOW',
      exitCode: 0,
      passed: testCase.expectedVerdict === 'ALLOW',
      runtime,
    };
  } catch (error: any) {
    const runtime = Date.now() - startTime;
    const exitCode = error.status || -1;

    // Cleanup isolated tsconfig on error
    try {
      if (existsSync(tsconfigPath)) {
        unlinkSync(tsconfigPath);
      }
    } catch (e) {
      // Cleanup failed, not critical
    }

    // Log error details for non-BLOCK exits
    if (exitCode !== 2 && process.env.DEBUG_HARNESS) {
      console.error(`\n[HARNESS ERROR] ${testCase.fixture}`);
      console.error(`  Exit code: ${exitCode}`);
      console.error(`  Error message: ${error.message}`);
      if (error.stderr) console.error(`  Stderr: ${error.stderr.toString().substring(0, 300)}`);
      if (error.stdout) console.error(`  Stdout: ${error.stdout.toString().substring(0, 300)}`);
    }

    // exit 2 = BLOCK, exit 1 = ERROR
    const actual = exitCode === 2 ? 'BLOCK' : 'ERROR';

    return {
      rule: testCase.rule,
      fixture: testCase.fixture,
      expected: testCase.expectedVerdict,
      actual,
      exitCode,
      passed: testCase.expectedVerdict === actual,
      runtime,
    };
  }
}

function calculateMetrics(results: TestResult[]) {
  const byRule = new Map<string, TestResult[]>();
  
  for (const result of results) {
    if (!byRule.has(result.rule)) {
      byRule.set(result.rule, []);
    }
    byRule.get(result.rule)!.push(result);
  }

  console.log('\n' + '='.repeat(80));
  console.log('ADVERSARIAL TEST RESULTS');
  console.log('='.repeat(80) + '\n');

  let overallPass = true;

  for (const [ruleId, ruleResults] of byRule) {
    const ruleName = RULES.find(r => r.id === ruleId)?.name || ruleId;
    
    const total = ruleResults.length;
    const passed = ruleResults.filter(r => r.passed).length;
    const failed = total - passed;

    const blockCases = ruleResults.filter(r => r.expected === 'BLOCK');
    const allowCases = ruleResults.filter(r => r.expected === 'ALLOW');

    const falseNegatives = blockCases.filter(r => r.actual !== 'BLOCK').length;
    const falsePositives = allowCases.filter(r => r.actual !== 'ALLOW').length;

    const fnRate = blockCases.length > 0 ? (falseNegatives / blockCases.length) * 100 : 0;
    const fpRate = allowCases.length > 0 ? (falsePositives / allowCases.length) * 100 : 0;

    const rulePass = fnRate === 0 && fpRate < 5;
    overallPass = overallPass && rulePass;

    console.log(`${ruleName}`);
    console.log(`  Total: ${total}, Passed: ${passed}, Failed: ${failed}`);
    console.log(`  False Negatives: ${falseNegatives}/${blockCases.length} (${fnRate.toFixed(1)}%)`);
    console.log(`  False Positives: ${falsePositives}/${allowCases.length} (${fpRate.toFixed(1)}%)`);
    console.log(`  Status: ${rulePass ? '✅ PASS' : '❌ FAIL'}`);
    
    if (failed > 0) {
      console.log(`  Failed cases:`);
      for (const result of ruleResults.filter(r => !r.passed)) {
        console.log(`    - ${result.fixture}: expected ${result.expected}, got ${result.actual}`);
      }
    }
    console.log();
  }

  console.log('='.repeat(80));
  console.log(`OVERALL: ${overallPass ? '✅ ALL RULES PASS' : '❌ SOME RULES FAIL'}`);
  console.log('='.repeat(80) + '\n');

  return overallPass;
}

// Main execution
const testCases = discoverTestCases();
console.log(`Discovered ${testCases.length} test cases\n`);

const results: TestResult[] = [];

for (const testCase of testCases) {
  process.stdout.write(`Testing ${testCase.fixture}... `);
  const result = runTest(testCase);
  results.push(result);
  console.log(result.passed ? '✅' : '❌');
}

const allPass = calculateMetrics(results);
process.exit(allPass ? 0 : 1);
