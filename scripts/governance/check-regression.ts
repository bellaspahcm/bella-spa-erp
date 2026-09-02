#!/usr/bin/env node
/**
 * Check Regression for Phase 1 Regression Protection Mode
 * 
 * Purpose: Compare current Platform TypeScript state against baseline
 * Block new regressions, allow baseline issues and improvements
 * 
 * Usage:
 *   npm run governance:check-regression
 *   npm run governance:check-regression -- --baseline custom-baseline.json
 *   npm run governance:check-regression -- --verbose
 * 
 * Exit codes:
 *   0 = ALLOW (no regressions detected)
 *   1 = BLOCK (new regressions detected)
 *   2 = Error (baseline missing or invalid)
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  BaselineManifest,
  ScopeBaseline,
  RegressionAnalysis,
  RegressionCheckResult,
  parseDiagnostic,
  fingerprintToString,
  determineVerdict,
} from './baseline-schema';

// ============================================================================
// CONFIGURATION
// ============================================================================

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_BASELINE = path.join(WORKSPACE_ROOT, 'baseline.json');

// ============================================================================
// BASELINE LOADING
// ============================================================================

function loadBaseline(baselinePath: string): BaselineManifest {
  if (!fs.existsSync(baselinePath)) {
    console.error(`❌ Error: Baseline not found at ${path.relative(WORKSPACE_ROOT, baselinePath)}`);
    console.error('\nCreate baseline first: npm run governance:baseline\n');
    process.exit(2);
  }
  
  try {
    const content = fs.readFileSync(baselinePath, 'utf-8');
    const baseline = JSON.parse(content) as BaselineManifest;
    
    // Validate schema version
    if (baseline.version !== '1.0.0') {
      console.error(`❌ Error: Unsupported baseline version ${baseline.version}`);
      process.exit(2);
    }
    
    return baseline;
  } catch (error) {
    console.error(`❌ Error: Failed to parse baseline: ${error}`);
    process.exit(2);
  }
}

// ============================================================================
// GATE B EXECUTION
// ============================================================================

function runGateB(): any[] {
  // Import Gate B dynamically
  const gateBModule = require('./scoped-typecheck');
  const { discoverPlatformConfigs, verifyScope } = gateBModule;
  
  const configs = discoverPlatformConfigs();
  const results: any[] = [];
  
  const DEFAULT_TIMEOUT_MS = 30000;
  
  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    const progress = `[${i + 1}/${configs.length}]`;
    
    process.stdout.write(`  ${progress} Verifying ${config}...\r`);
    
    const result = verifyScope(config, DEFAULT_TIMEOUT_MS, false);
    results.push(result);
  }
  
  console.log(''); // Clear progress line
  
  return results;
}

// ============================================================================
// REGRESSION ANALYSIS
// ============================================================================

function analyzeScope(
  scopeName: string,
  baselineScope: ScopeBaseline | undefined,
  currentResult: any
): RegressionAnalysis {
  // If scope not in baseline, treat as new scope (should not happen in steady state)
  if (!baselineScope) {
    const currentFingerprints = currentResult.diagnostics
      .map((diag: string) => parseDiagnostic(diag))
      .filter((fp: any) => fp !== null);
    
    if (currentResult.status === 'PASS') {
      return {
        scope: scopeName,
        currentStatus: 'PASS',
        baselineStatus: 'PASS',
        newDiagnostics: [],
        resolvedDiagnostics: [],
        unchangedDiagnostics: [],
        verdict: 'ALLOW',
        reason: 'New scope, PASS',
      };
    } else {
      return {
        scope: scopeName,
        currentStatus: currentResult.status,
        baselineStatus: 'PASS',
        newDiagnostics: currentFingerprints,
        resolvedDiagnostics: [],
        unchangedDiagnostics: [],
        verdict: 'BLOCK',
        reason: `New scope with ${currentFingerprints.length} diagnostic(s)`,
      };
    }
  }
  
  // Parse current diagnostics into fingerprints
  const currentFingerprints = currentResult.diagnostics
    .map((diag: string) => parseDiagnostic(diag))
    .filter((fp: any) => fp !== null);
  
  // Build fingerprint sets for comparison
  const baselineSet = new Set(baselineScope.diagnostics.map(fingerprintToString));
  const currentSet = new Set(currentFingerprints.map(fingerprintToString));
  
  // Compute diff
  const newDiagnostics = currentFingerprints.filter(
    fp => !baselineSet.has(fingerprintToString(fp))
  );
  
  const resolvedDiagnostics = baselineScope.diagnostics.filter(
    fp => !currentSet.has(fingerprintToString(fp))
  );
  
  const unchangedDiagnostics = currentFingerprints.filter(
    fp => baselineSet.has(fingerprintToString(fp))
  );
  
  // Determine verdict
  const { verdict, reason } = determineVerdict(
    baselineScope.status,
    currentResult.status,
    newDiagnostics,
    resolvedDiagnostics
  );
  
  return {
    scope: scopeName,
    currentStatus: currentResult.status,
    baselineStatus: baselineScope.status,
    newDiagnostics,
    resolvedDiagnostics,
    unchangedDiagnostics,
    verdict,
    reason,
  };
}

function performRegressionCheck(
  baseline: BaselineManifest,
  currentResults: any[]
): RegressionCheckResult {
  const analyses: RegressionAnalysis[] = [];
  
  // Build baseline lookup
  const baselineMap = new Map<string, ScopeBaseline>();
  for (const scope of baseline.scopes) {
    baselineMap.set(scope.scope, scope);
  }
  
  // Analyze each current scope
  for (const result of currentResults) {
    const baselineScope = baselineMap.get(result.scope);
    const analysis = analyzeScope(result.scope, baselineScope, result);
    analyses.push(analysis);
  }
  
  // Compute summary
  const summary = {
    allowed: analyses.filter(a => a.verdict === 'ALLOW').length,
    blocked: analyses.filter(a => a.verdict === 'BLOCK').length,
    total: analyses.length,
  };
  
  return {
    scopes: analyses,
    summary,
    verdict: summary.blocked > 0 ? 'BLOCK' : 'ALLOW',
    baseline: {
      capturedAt: baseline.capturedAt,
      gitCommit: baseline.gitCommit,
    },
    checkedAt: new Date().toISOString(),
  };
}

// ============================================================================
// REPORTING
// ============================================================================

function printRegressionReport(result: RegressionCheckResult, verbose: boolean): void {
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                   ║');
  console.log('║        Regression Check — Phase 1 Regression Protection          ║');
  console.log('║                                                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  console.log('Baseline:');
  if (result.baseline.gitCommit) {
    console.log(`  Commit:      ${result.baseline.gitCommit.substring(0, 8)}`);
  }
  console.log(`  Captured At: ${result.baseline.capturedAt}`);
  console.log(`  Checked At:  ${result.checkedAt}`);
  console.log('');
  
  // Group analyses by verdict
  const allowed = result.scopes.filter(a => a.verdict === 'ALLOW');
  const blocked = result.scopes.filter(a => a.verdict === 'BLOCK');
  
  // Print ALLOW
  if (allowed.length > 0) {
    console.log(`✅ ALLOW (${allowed.length}):\n`);
    
    for (const analysis of allowed) {
      const statusChange = analysis.baselineStatus !== analysis.currentStatus
        ? ` (${analysis.baselineStatus} → ${analysis.currentStatus})`
        : '';
      
      console.log(`   ✓ ${analysis.scope.padEnd(30)} ${analysis.reason}${statusChange}`);
      
      if (verbose && analysis.resolvedDiagnostics.length > 0) {
        console.log(`     Resolved: ${analysis.resolvedDiagnostics.length} diagnostic(s)`);
      }
      
      if (verbose && analysis.unchangedDiagnostics.length > 0) {
        console.log(`     Unchanged: ${analysis.unchangedDiagnostics.length} diagnostic(s) (baseline)`);
      }
    }
    console.log('');
  }
  
  // Print BLOCK
  if (blocked.length > 0) {
    console.log(`❌ BLOCK (${blocked.length}):\n`);
    
    for (const analysis of blocked) {
      const statusChange = analysis.baselineStatus !== analysis.currentStatus
        ? ` (${analysis.baselineStatus} → ${analysis.currentStatus})`
        : '';
      
      console.log(`   ✗ ${analysis.scope.padEnd(30)} ${analysis.reason}${statusChange}`);
      
      if (analysis.newDiagnostics.length > 0) {
        console.log(`     New diagnostics: ${analysis.newDiagnostics.length}`);
        
        if (verbose) {
          analysis.newDiagnostics.slice(0, 3).forEach(fp => {
            console.log(`       • ${fp.file}(${fp.line},${fp.column}): ${fp.code}`);
          });
          if (analysis.newDiagnostics.length > 3) {
            console.log(`       ... ${analysis.newDiagnostics.length - 3} more`);
          }
        }
      }
    }
    console.log('');
  }
  
  // Summary
  console.log('═══════════════════════════════════════════════════════════════════\n');
  console.log('Summary:');
  console.log(`  ALLOW:  ${result.summary.allowed}`);
  console.log(`  BLOCK:  ${result.summary.blocked}`);
  console.log(`  ────────────────`);
  console.log(`  TOTAL:  ${result.summary.total}`);
  console.log('');
  
  // Final verdict
  if (result.verdict === 'ALLOW') {
    console.log('✅ Regression Check: ALLOW\n');
    console.log('No new regressions detected. Changes are safe to proceed.\n');
  } else {
    console.log('❌ Regression Check: BLOCK\n');
    console.log('New regressions detected. Please review and fix before proceeding.\n');
    console.log('Action Required:');
    console.log('  1. Review blocked scopes above');
    console.log('  2. Fix new diagnostics');
    console.log('  3. Re-run: npm run governance:check-regression');
    console.log('  4. Or update baseline if changes are intentional: npm run governance:baseline');
    console.log('');
  }
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  
  // Parse baseline path
  const baselineIndex = args.indexOf('--baseline');
  const baselinePath = baselineIndex >= 0 && args[baselineIndex + 1]
    ? path.resolve(WORKSPACE_ROOT, args[baselineIndex + 1])
    : DEFAULT_BASELINE;
  
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                   ║');
  console.log('║       Check Regression — Phase 1 Regression Protection           ║');
  console.log('║                                                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  // Load baseline
  console.log(`📂 Loading baseline from ${path.relative(WORKSPACE_ROOT, baselinePath)}...\n`);
  const baseline = loadBaseline(baselinePath);
  
  console.log(`✅ Baseline loaded: ${baseline.scopes.length} scopes\n`);
  
  // Run Gate B
  console.log('🔍 Running Gate B to capture current state...\n');
  const currentResults = runGateB();
  
  console.log('✅ Gate B execution complete\n');
  
  // Perform regression analysis
  console.log('📊 Analyzing regressions...\n');
  const result = performRegressionCheck(baseline, currentResults);
  
  // Print report
  printRegressionReport(result, verbose);
  
  // Exit code
  if (result.verdict === 'ALLOW') {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
