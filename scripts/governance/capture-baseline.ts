#!/usr/bin/env node
/**
 * Capture Baseline for Phase 1 Regression Protection Mode
 * 
 * Purpose: Capture current Platform TypeScript state as baseline for regression detection
 * 
 * Usage:
 *   npm run governance:baseline
 *   npm run governance:baseline -- --output custom-baseline.json
 * 
 * Output: baseline.json with diagnostic fingerprints per scope
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import {
  BaselineManifest,
  ScopeBaseline,
  parseDiagnostic,
  fingerprintToString,
} from './baseline-schema';

// ============================================================================
// CONFIGURATION
// ============================================================================

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_OUTPUT = path.join(WORKSPACE_ROOT, 'baseline.json');

// ============================================================================
// GIT UTILITIES
// ============================================================================

function getGitCommit(): string | undefined {
  try {
    const result = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: WORKSPACE_ROOT,
      encoding: 'utf-8',
    });
    
    if (result.status === 0 && result.stdout) {
      return result.stdout.trim();
    }
  } catch (error) {
    // Git not available or not a git repo
  }
  
  return undefined;
}

// ============================================================================
// BASELINE CAPTURE
// ============================================================================

/**
 * Run Gate B and capture results
 */
function runGateB(): any {
  console.log('🔍 Running Gate B to capture current state...\n');
  
  // Import Gate B dynamically to get GateResult type
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

/**
 * Convert Gate B results to baseline manifest
 */
function convertToBaseline(gateResults: any[]): BaselineManifest {
  const capturedAt = new Date().toISOString();
  const gitCommit = getGitCommit();
  
  const scopes: ScopeBaseline[] = gateResults.map(result => {
    // Parse diagnostics into fingerprints
    const fingerprints = result.diagnostics
      .map((diag: string) => parseDiagnostic(diag))
      .filter((fp: any) => fp !== null);
    
    return {
      scope: result.scope,
      status: result.status,
      diagnostics: fingerprints,
      capturedAt: capturedAt,
      duration: result.duration,
    };
  });
  
  // Compute summary
  const summary = {
    pass: scopes.filter(s => s.status === 'PASS').length,
    fail: scopes.filter(s => s.status === 'FAIL').length,
    hotspot: scopes.filter(s => s.status === 'HOTSPOT').length,
    total: scopes.length,
    totalDiagnostics: scopes.reduce((sum, s) => sum + s.diagnostics.length, 0),
  };
  
  return {
    version: '1.0.0',
    capturedAt,
    gitCommit,
    scopes,
    summary,
  };
}

/**
 * Print baseline summary
 */
function printBaselineSummary(baseline: BaselineManifest): void {
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                   ║');
  console.log('║            Baseline Captured — Phase 1 Regression Protection     ║');
  console.log('║                                                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  console.log('Summary:');
  console.log(`  PASS:        ${baseline.summary.pass}`);
  console.log(`  FAIL:        ${baseline.summary.fail}`);
  console.log(`  HOTSPOT:     ${baseline.summary.hotspot}`);
  console.log(`  ────────────────────────`);
  console.log(`  TOTAL:       ${baseline.summary.total}`);
  console.log(`  Diagnostics: ${baseline.summary.totalDiagnostics}`);
  console.log('');
  
  if (baseline.gitCommit) {
    console.log(`Git Commit:  ${baseline.gitCommit.substring(0, 8)}`);
  }
  console.log(`Captured At: ${baseline.capturedAt}`);
  console.log('');
  
  // List FAIL scopes with diagnostic counts
  const failScopes = baseline.scopes.filter(s => s.status === 'FAIL');
  if (failScopes.length > 0) {
    console.log('FAIL Scopes (baseline exceptions allowed):');
    for (const scope of failScopes) {
      console.log(`  • ${scope.scope.padEnd(30)} ${scope.diagnostics.length} diagnostic(s)`);
    }
    console.log('');
  }
  
  // List HOTSPOT scopes
  const hotspotScopes = baseline.scopes.filter(s => s.status === 'HOTSPOT');
  if (hotspotScopes.length > 0) {
    console.log('HOTSPOT Scopes (requires investigation):');
    for (const scope of hotspotScopes) {
      console.log(`  • ${scope.scope}`);
    }
    console.log('');
  }
  
  console.log('Baseline Mode: Regression Protection');
  console.log('  - PASS scopes: NEW failures → BLOCK');
  console.log('  - FAIL scopes: NEW diagnostics → BLOCK');
  console.log('  - FAIL scopes: Resolved diagnostics → ALLOW');
  console.log('  - FAIL scopes: Unchanged → ALLOW (baseline preserved)');
  console.log('');
}

/**
 * Validate baseline integrity
 */
function validateBaseline(baseline: BaselineManifest): boolean {
  let valid = true;
  
  // Check for duplicate scopes
  const scopeNames = baseline.scopes.map(s => s.scope);
  const uniqueScopes = new Set(scopeNames);
  if (scopeNames.length !== uniqueScopes.size) {
    console.error('❌ Error: Duplicate scopes detected in baseline');
    valid = false;
  }
  
  // Check fingerprint uniqueness per scope
  for (const scope of baseline.scopes) {
    const fingerprints = scope.diagnostics.map(fingerprintToString);
    const uniqueFingerprints = new Set(fingerprints);
    
    if (fingerprints.length !== uniqueFingerprints.size) {
      console.error(`❌ Error: Duplicate fingerprints in scope ${scope.scope}`);
      valid = false;
    }
  }
  
  // Check status consistency
  for (const scope of baseline.scopes) {
    if (scope.status === 'PASS' && scope.diagnostics.length > 0) {
      console.error(`❌ Error: Scope ${scope.scope} is PASS but has diagnostics`);
      valid = false;
    }
    
    if (scope.status === 'FAIL' && scope.diagnostics.length === 0) {
      console.error(`❌ Error: Scope ${scope.scope} is FAIL but has no diagnostics`);
      valid = false;
    }
    
    if (scope.status === 'HOTSPOT' && scope.diagnostics.length > 0) {
      console.error(`❌ Error: Scope ${scope.scope} is HOTSPOT but has diagnostics`);
      valid = false;
    }
  }
  
  return valid;
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
  const args = process.argv.slice(2);
  
  // Parse output path
  const outputIndex = args.indexOf('--output');
  const outputPath = outputIndex >= 0 && args[outputIndex + 1]
    ? path.resolve(WORKSPACE_ROOT, args[outputIndex + 1])
    : DEFAULT_OUTPUT;
  
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                   ║');
  console.log('║         Capture Baseline — Phase 1 Regression Protection         ║');
  console.log('║                                                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  // Check if baseline already exists
  if (fs.existsSync(outputPath)) {
    console.log(`⚠️  Warning: Baseline already exists at ${path.relative(WORKSPACE_ROOT, outputPath)}`);
    console.log('   Existing baseline will be overwritten.\n');
  }
  
  // Run Gate B
  const gateResults = runGateB();
  
  console.log('✅ Gate B execution complete\n');
  
  // Convert to baseline
  console.log('📊 Generating baseline manifest...\n');
  const baseline = convertToBaseline(gateResults);
  
  // Validate
  console.log('🔍 Validating baseline integrity...\n');
  const valid = validateBaseline(baseline);
  
  if (!valid) {
    console.error('\n❌ Baseline validation failed. Please review errors above.\n');
    process.exit(1);
  }
  
  console.log('✅ Baseline validation passed\n');
  
  // Write to disk
  console.log(`💾 Writing baseline to ${path.relative(WORKSPACE_ROOT, outputPath)}...\n`);
  fs.writeFileSync(outputPath, JSON.stringify(baseline, null, 2), 'utf-8');
  
  console.log('✅ Baseline written successfully\n');
  
  // Print summary
  printBaselineSummary(baseline);
  
  console.log(`Next Steps:`);
  console.log(`  1. Commit baseline to repository: git add ${path.relative(WORKSPACE_ROOT, outputPath)}`);
  console.log(`  2. Enable regression protection: npm run governance:check-regression`);
  console.log(`  3. During remediation: check-regression will BLOCK new regressions`);
  console.log(`  4. After Platform GREEN: remove baseline, enable enforced mode`);
  console.log('');
}

// Run if executed directly
if (require.main === module) {
  main();
}
