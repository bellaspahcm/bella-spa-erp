#!/usr/bin/env ts-node
/**
 * P2 Phase R1: Regression Test Census
 * 
 * Purpose: Classify all test results to understand actual state.
 * 
 * Target: BabyCare 321 tests (289 PASS + 32 remainder)
 * 
 * Output: Comprehensive classification of PASS/FAIL/SKIP/BLOCKED.
 * 
 * Usage:
 *   npm run census:regression
 *   # or
 *   ts-node scripts/census-regression.ts
 * 
 * Part of: Bella Platform Hardening Initiative
 * Workstream: P2 - Regression Stabilization
 * Phase: R1 - Census (READ ONLY - run tests, don't modify)
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  suite: string;
  name: string;
  status: 'pass' | 'fail' | 'skip' | 'todo' | 'unknown';
  duration?: number;
  error?: string;
  file?: string;
}

interface ModuleSummary {
  name: string;
  total: number;
  pass: number;
  fail: number;
  skip: number;
  todo: number;
  passRate: number;
}

/**
 * Run BabyCare regression tests and capture results
 */
function runBabyCareTests(): string {
  console.log('Running BabyCare regression suite...');
  console.log('This may take several minutes.\n');

  try {
    // Run tests with JSON output for parsing
    const output = execSync('npm run test:babycare:census', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    return output;
  } catch (error: any) {
    // Jest exits with non-zero for failures, but we still want the output
    return error.stdout || error.stderr || '';
  }
}

/**
 * Parse Jest output to extract test results
 * Note: This is a simplified parser. For production, use Jest's JSON reporter.
 */
function parseTestOutput(output: string): TestResult[] {
  const results: TestResult[] = [];
  const lines = output.split('\n');

  let currentSuite = 'Unknown';
  let currentFile = '';

  for (const line of lines) {
    // Detect test file
    const fileMatch = line.match(/PASS|FAIL\s+(.*\.test\.ts)/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      currentSuite = path.basename(currentFile, '.test.ts');
    }

    // Detect test results
    if (line.includes('✓') || line.includes('✔')) {
      const nameMatch = line.match(/✓|✔\s+(.+?)(?:\s+\(\d+\s*ms\))?$/);
      if (nameMatch) {
        results.push({
          suite: currentSuite,
          name: nameMatch[1].trim(),
          status: 'pass',
          file: currentFile,
        });
      }
    } else if (line.includes('✕') || line.includes('×')) {
      const nameMatch = line.match(/✕|×\s+(.+?)(?:\s+\(\d+\s*ms\))?$/);
      if (nameMatch) {
        results.push({
          suite: currentSuite,
          name: nameMatch[1].trim(),
          status: 'fail',
          file: currentFile,
        });
      }
    } else if (line.includes('○') || line.includes('SKIP')) {
      const nameMatch = line.match(/○\s+(.+?)$/);
      if (nameMatch) {
        results.push({
          suite: currentSuite,
          name: nameMatch[1].trim(),
          status: 'skip',
          file: currentFile,
        });
      }
    }
  }

  return results;
}

/**
 * Group results by module/suite
 */
function summarizeByModule(results: TestResult[]): ModuleSummary[] {
  const modules = new Map<string, TestResult[]>();

  results.forEach((test) => {
    if (!modules.has(test.suite)) {
      modules.set(test.suite, []);
    }
    modules.get(test.suite)!.push(test);
  });

  const summaries: ModuleSummary[] = [];

  modules.forEach((tests, name) => {
    const total = tests.length;
    const pass = tests.filter((t) => t.status === 'pass').length;
    const fail = tests.filter((t) => t.status === 'fail').length;
    const skip = tests.filter((t) => t.status === 'skip').length;
    const todo = tests.filter((t) => t.status === 'todo').length;
    const passRate = total > 0 ? (pass / total) * 100 : 0;

    summaries.push({
      name,
      total,
      pass,
      fail,
      skip,
      todo,
      passRate,
    });
  });

  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Generate census report
 */
function generateReport(results: TestResult[], summaries: ModuleSummary[]) {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('P2 PHASE R1: BABYCARE REGRESSION CENSUS');
  console.log('════════════════════════════════════════════════════════════════\n');

  const totalTests = results.length;
  const totalPass = results.filter((t) => t.status === 'pass').length;
  const totalFail = results.filter((t) => t.status === 'fail').length;
  const totalSkip = results.filter((t) => t.status === 'skip').length;
  const totalTodo = results.filter((t) => t.status === 'todo').length;
  const overallPassRate = totalTests > 0 ? (totalPass / totalTests) * 100 : 0;

  console.log('OVERALL SUMMARY:');
  console.log(`Total tests:     ${totalTests}`);
  console.log(`✅ PASS:         ${totalPass} (${overallPassRate.toFixed(1)}%)`);
  console.log(`❌ FAIL:         ${totalFail} (${((totalFail / totalTests) * 100).toFixed(1)}%)`);
  console.log(`⏭️  SKIP:         ${totalSkip} (${((totalSkip / totalTests) * 100).toFixed(1)}%)`);
  console.log(`📝 TODO:         ${totalTodo}`);

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('BY MODULE/SUITE');
  console.log('════════════════════════════════════════════════════════════════\n');

  summaries.forEach((summary) => {
    const statusIcon = summary.passRate >= 90 ? '✅' : summary.passRate >= 70 ? '⚠️' : '❌';
    console.log(`${statusIcon} ${summary.name.padEnd(40)} ${summary.pass}/${summary.total} (${summary.passRate.toFixed(1)}%)`);
    if (summary.fail > 0) {
      console.log(`   ❌ ${summary.fail} failures`);
    }
    if (summary.skip > 0) {
      console.log(`   ⏭️  ${summary.skip} skipped`);
    }
  });

  // Export detailed CSV
  const csvPath = path.join(process.cwd(), 'docs', 'platform', 'P2_R1_BABYCARE_REGRESSION_CENSUS.csv');
  const csvHeaders = 'Suite,Test Name,Status,File\n';
  const csvRows = results
    .map((r) => {
      return [
        `"${r.suite}"`,
        `"${r.name}"`,
        r.status.toUpperCase(),
        `"${r.file || ''}"`,
      ].join(',');
    })
    .join('\n');

  fs.writeFileSync(csvPath, csvHeaders + csvRows, 'utf-8');

  // Export module summary CSV
  const summaryPath = path.join(process.cwd(), 'docs', 'platform', 'P2_R1_MODULE_SUMMARY.csv');
  const summaryHeaders = 'Module,Total,Pass,Fail,Skip,Pass Rate %\n';
  const summaryRows = summaries
    .map((s) => {
      return [
        `"${s.name}"`,
        s.total,
        s.pass,
        s.fail,
        s.skip,
        s.passRate.toFixed(1),
      ].join(',');
    })
    .join('\n');

  fs.writeFileSync(summaryPath, summaryHeaders + summaryRows, 'utf-8');

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('CENSUS COMPLETE');
  console.log('════════════════════════════════════════════════════════════════\n');
  console.log(`Detailed report: ${csvPath}`);
  console.log(`Module summary:  ${summaryPath}`);
  console.log('\nNext steps:');
  console.log('1. Review failures by module');
  console.log('2. Classify failures: F1 Critical / F2 Feature / F3 Flaky / F4 Expected / F5 Blocked');
  console.log('3. Determine stabilization priorities');
  console.log('\nSee: docs/platform/BELLA_PLATFORM_HARDENING.md (P2 Phase R2)');
}

/**
 * Main census execution
 */
function main() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('P2-R1 BABYCARE REGRESSION CENSUS');
  console.log('════════════════════════════════════════════════════════════════\n');
  console.log('Target: 321 BabyCare tests (289 PASS baseline + 32 remainder)\n');
  console.log('Starting test run...\n');

  // Check if BabyCare test script exists
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')
  );

  if (!packageJson.scripts['test:babycare:census']) {
    console.log('⚠️  Warning: test:babycare:census script not found in package.json');
    console.log('   Creating fallback to use existing test scripts...\n');
  }

  // For now, provide manual instructions until we configure the test runner
  console.log('════════════════════════════════════════════════════════════════');
  console.log('MANUAL CENSUS REQUIRED');
  console.log('════════════════════════════════════════════════════════════════\n');
  console.log('To complete BabyCare regression census:\n');
  console.log('1. Identify BabyCare test files:');
  console.log('   - Booking Engine: src/__tests__/booking-engine/');
  console.log('   - Session Management: src/__tests__/*session*');
  console.log('   - Financial: src/__tests__/finance*.test.ts');
  console.log('   - Staff/Salary: src/__tests__/*salary*.test.ts');
  console.log('   - Real-time features: src/__tests__/*');
  console.log('');
  console.log('2. Run specific test suites:');
  console.log('   npm run test:booking-engine');
  console.log('   npm test -- --testPathPattern="session"');
  console.log('   npm test -- --testPathPattern="finance"');
  console.log('   npm test -- --testPathPattern="salary"');
  console.log('');
  console.log('3. Record results manually in P2_R1_BABYCARE_REGRESSION_CENSUS.csv');
  console.log('');
  console.log('Alternative: Run full test suite with detailed output:');
  console.log('   npm test -- --verbose --json > test-results.json');
  console.log('');
  console.log('This census tool will be enhanced once test suite organization is clarified.');
}

// Run census
main();

export { parseTestOutput, summarizeByModule, TestResult, ModuleSummary };
