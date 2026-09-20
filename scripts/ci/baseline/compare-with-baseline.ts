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
import path from 'path';
import { Baseline, PRContext } from './schema';
import { generateFromArtifacts } from './generate-from-artifacts';
import { compareBaseline, computeOverallVerdict, generateReport } from './comparator';

/**
 * Pure Baseline Comparator main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const baselinePathIdx = args.indexOf('--baseline');
  const artifactsDirIdx = args.indexOf('--artifacts-dir');
  const currentPathIdx = args.indexOf('--current');
  const prBaseIdx = args.indexOf('--pr-base');
  const prHeadIdx = args.indexOf('--pr-head');
  
  const baselinePath = baselinePathIdx !== -1 ? args[baselinePathIdx + 1] : '.github/ci/baselines/main.json';
  const artifactsDir = artifactsDirIdx !== -1 ? args[artifactsDirIdx + 1] : undefined;
  const currentPath = currentPathIdx !== -1 ? args[currentPathIdx + 1] : undefined;
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
  console.log('PURE BASELINE COMPARATOR (SINGLE PRODUCER + FAIL-CLOSED)');
  console.log('='.repeat(80));
  console.log('');
  console.log(`Baseline: ${baselinePath}`);
  console.log(`Commit:   ${baseline.commit}`);
  console.log(`PR Base:  ${prBase}`);
  console.log(`PR Head:  ${prHead}`);
  console.log('');
  
  let current: Baseline;

  if (currentPath && fs.existsSync(currentPath)) {
    console.log(`Loading pre-generated current baseline from: ${currentPath}`);
    try {
      current = JSON.parse(fs.readFileSync(currentPath, 'utf-8'));
    } catch (err: any) {
      console.error(`FAIL-CLOSED: Current baseline JSON is invalid (${err.message}).`);
      process.exit(1);
    }
  } else {
    const targetArtifactsDir = artifactsDir || './artifacts';
    if (!fs.existsSync(targetArtifactsDir)) {
      console.error(`FAIL-CLOSED: No diagnostic artifacts found at '${targetArtifactsDir}'.`);
      console.error('ACCEPTANCE CRITERIA #1: Baseline comparator will NOT re-spawn tsc or eslint.');
      console.error('Please run single producer artifact collector first:');
      console.error('  npx tsx scripts/ci/baseline/collect-artifacts.ts --out-dir ./artifacts');
      process.exit(1);
    }

    console.log(`Loading current findings from artifacts directory: ${targetArtifactsDir}`);
    try {
      current = await generateFromArtifacts(targetArtifactsDir);
    } catch (err: any) {
      console.error(`FAIL-CLOSED: Failed to load artifacts from '${targetArtifactsDir}':`, err.message);
      process.exit(1);
    }
  }
  
  // Compare
  console.log('Comparing current findings against baseline in memory...');
  console.log('');
  const startTime = Date.now();
  const results = compareBaseline(current, baseline);
  const overall = computeOverallVerdict(results);
  const elapsedMs = Date.now() - startTime;
  
  // Generate report
  const report = generateReport(results, overall);
  console.log(report);
  console.log(`Comparison execution time: ${elapsedMs}ms`);
  // Write comparison report file for CI artifact upload
  fs.writeFileSync('baseline-comparison-report.txt', report, 'utf-8');
  
  // Exit with appropriate code (FAIL-CLOSED: Verdict MUST be PASS for exit 0)
  if (overall.verdict === 'pass') {
    console.log('✅ All baseline checks PASSED (NEW identity-aware findings == 0)');
    process.exit(0);
  } else {
    console.log('❌ Baseline checks FAILED (NEW identity-aware findings detected)');
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
  console.error('Fatal error in comparator execution:', error);
  process.exit(2);
});
