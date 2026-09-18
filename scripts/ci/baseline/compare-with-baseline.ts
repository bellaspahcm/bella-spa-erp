/**
 * BASELINE COMPARATOR CLI
 * 
 * Compare current state against baseline and apply policy
 * 
 * Usage:
 *   node scripts/ci/baseline/compare-with-baseline.ts \
 *     --baseline .github/ci/baselines/main.json \
 *     --pr-base origin/main \
 *     --pr-head HEAD
 * 
 * Exit codes:
 *   0: All policies pass
 *   1: One or more policies block
 *   2: Error in execution
 */

import fs from 'fs';
import { execSync } from 'child_process';
import { Baseline, PRContext } from './schema';
import { adaptTypeScriptOutput } from './adapters/typescript-adapter';
import { adaptESLintOutput, getChangedFiles, filterChangedFiles } from './adapters/eslint-adapter';
import { adaptJestOutput } from './adapters/jest-adapter';
import { adaptMigrationOutput } from './adapters/migration-adapter';
import { compareBaseline, computeOverallVerdict, generateReport } from './comparator';

/**
 * Run current checks (same as generate-baseline but returns current state)
 */
async function runCurrentChecks(prContext: PRContext): Promise<Baseline> {
  console.log('Running current checks...');
  
  // TypeScript
  let tscOutput = '';
  try {
    execSync('npx tsc --noEmit', { encoding: 'utf-8', stdio: 'pipe' });
  } catch (error: any) {
    tscOutput = error.stderr || error.stdout || '';
  }
  const tsFindings = adaptTypeScriptOutput(tscOutput);
  
  // ESLint (changed files only for PR scope)
  let eslintOutput = '';
  try {
    eslintOutput = execSync('npx eslint . --format json', { encoding: 'utf-8', stdio: 'pipe' });
  } catch (error: any) {
    eslintOutput = error.stdout || '[]';
  }
  const allESLintFindings = adaptESLintOutput(eslintOutput);
  const changedFiles = await getChangedFiles(prContext.base, prContext.head);
  const eslintFindings = filterChangedFiles(allESLintFindings, changedFiles);
  
  // Jest
  let jestOutput = '';
  try {
    jestOutput = execSync('npx jest --json --testPathPattern="src/"', { encoding: 'utf-8', stdio: 'pipe' });
  } catch (error: any) {
    jestOutput = error.stdout || '{}';
  }
  const jestFindings = adaptJestOutput(jestOutput);
  
  // Migration (with PR context for grandfathering)
  let migrationOutput = '';
  try {
    migrationOutput = execSync('node scripts/migrations/zero-downtime-check.js', { encoding: 'utf-8', stdio: 'pipe' });
  } catch (error: any) {
    migrationOutput = error.stdout || '';
  }
  
  // Load baseline for migration adapter (needs baseline for grandfathering)
  const baselinePath = process.env.BASELINE_PATH || '.github/ci/baselines/main.json';
  const baseline: Baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
  const baselineMigrationFindings = baseline.scopes['migration-zero-downtime']?.findings || [];
  
  const migrationFindings = adaptMigrationOutput(migrationOutput, baselineMigrationFindings, prContext);
  
  console.log(`TypeScript: ${tsFindings.length} findings`);
  console.log(`ESLint: ${eslintFindings.length} findings (changed files only)`);
  console.log(`Jest: ${jestFindings.length} findings`);
  console.log(`Migration: ${migrationFindings.length} findings`);
  console.log('');
  
  // Build current state baseline
  const current: Baseline = {
    version: baseline.version,
    generated_at: new Date().toISOString(),
    commit: execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim(),
    scopes: {
      'typescript-full': {
        policy: baseline.scopes['typescript-full']?.policy || 'no-new-debt',
        findings: tsFindings,
        count: tsFindings.length
      },
      'eslint-changed': {
        policy: baseline.scopes['eslint-changed']?.policy || 'no-new-debt',
        findings: eslintFindings,
        count: eslintFindings.length
      },
      'jest-affected': {
        policy: baseline.scopes['jest-affected']?.policy || 'no-new-debt-with-reason',
        findings: jestFindings,
        count: jestFindings.length
      },
      'migration-zero-downtime': {
        policy: baseline.scopes['migration-zero-downtime']?.policy || 'conditional-grandfathering',
        findings: migrationFindings,
        count: migrationFindings.length
      }
    },
    policies: baseline.policies
  };
  
  return current;
}

/**
 * Main comparison logic
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const baselinePathIdx = args.indexOf('--baseline');
  const prBaseIdx = args.indexOf('--pr-base');
  const prHeadIdx = args.indexOf('--pr-head');
  
  const baselinePath = baselinePathIdx !== -1 ? args[baselinePathIdx + 1] : '.github/ci/baselines/main.json';
  const prBase = prBaseIdx !== -1 ? args[prBaseIdx + 1] : 'origin/main';
  const prHead = prHeadIdx !== -1 ? args[prHeadIdx + 1] : 'HEAD';
  
  // Load baseline
  if (!fs.existsSync(baselinePath)) {
    console.error(`ERROR: Baseline not found at ${baselinePath}`);
    console.error('Run generate-baseline.ts first to create baseline.');
    process.exit(2);
  }
  
  const baseline: Baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
  
  console.log('='.repeat(80));
  console.log('IDENTITY-AWARE NO-NEW-DEBT BASELINE CHECK');
  console.log('='.repeat(80));
  console.log('');
  console.log(`Baseline: ${baselinePath}`);
  console.log(`Commit:   ${baseline.commit}`);
  console.log(`PR Base:  ${prBase}`);
  console.log(`PR Head:  ${prHead}`);
  console.log('');
  
  // Get PR context
  const prContext: PRContext = {
    base: prBase,
    head: prHead,
    targetBranch: 'main'
  };
  
  // Run current checks
  const current = await runCurrentChecks(prContext);
  
  // Compare
  console.log('Comparing against baseline...');
  console.log('');
  const results = compareBaseline(current, baseline);
  const overall = computeOverallVerdict(results);
  
  // Generate report
  const report = generateReport(results, overall);
  console.log(report);
  
  // Exit with appropriate code
  if (overall.verdict === 'pass') {
    console.log('✅ All baseline checks PASSED');
    process.exit(0);
  } else {
    console.log('❌ Baseline checks FAILED');
    console.log('');
    console.log('Blocked scopes:');
    for (const scope of overall.blockedScopes) {
      console.log(`  - ${scope}`);
    }
    process.exit(1);
  }
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(2);
});
