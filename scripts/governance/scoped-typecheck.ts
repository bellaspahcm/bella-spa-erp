#!/usr/bin/env node
/**
 * GATE B: Scoped Type Verification
 * 
 * Orchestrates scoped TypeScript verification across Platform units.
 * Reuses existing tsconfig.platform-*.json files.
 * 
 * Classification:
 *   PASS    = tsc exit 0 within timeout
 *   FAIL    = tsc exit non-zero with diagnostics
 *   HOTSPOT = timeout exceeded (no actionable verdict)
 * 
 * Critical Principle: HOTSPOT ≠ FAIL
 * Timeout does not mean code is wrong, means compiler cannot provide verdict.
 * 
 * Usage:
 *   npm run governance:typecheck
 *   npm run governance:typecheck -- --verbose
 *   npm run governance:typecheck -- --timeout 60000
 *   npm run governance:typecheck -- --matrix-timeout 900000
 * 
 * Exit codes:
 *   0 = All scopes PASS
 *   1 = One or more scopes FAIL (actionable diagnostics)
 *   2 = One or more scopes HOTSPOT (no diagnostics, need investigation)
 *   3 = Matrix INCOMPLETE (matrix timeout before all scopes verified)
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

// ============================================================================
// TYPES
// ============================================================================

type VerificationStatus = 'PASS' | 'FAIL' | 'HOTSPOT';

interface VerificationResult {
  scope: string;
  status: VerificationStatus;
  duration: number;
  diagnostics: string[];
  timedOut: boolean;
}

interface GateResult {
  results: VerificationResult[];
  summary: {
    pass: number;
    fail: number;
    hotspot: number;
    total: number;
    incomplete: boolean;
  };
  passed: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds per scope
const DEFAULT_MATRIX_TIMEOUT_MS = 600000; // 10 minutes for full matrix
const TSCONFIG_PATTERN = /^tsconfig\.platform-(.+)\.json$/;

// Exclude non-verification configs
const EXCLUDED_PATTERNS = [
  /^tsconfig\.test-/,                    // Test-specific configs
  /^tsconfig\.c1-/,                      // Temporary Healthcare configs
  /^tsconfig\.bella-auto-only/,          // Product-specific
  /^tsconfig\.minimal/,                  // Utility configs
  /^tsconfig\.tiny/,
  /^tsconfig\.working/,
  /^tsconfig\.platform-scoped\.json$/,   // Aggregate config (all platform/*), not a unit
];

// ============================================================================
// UTILITIES
// ============================================================================

function discoverPlatformConfigs(): string[] {
  const files = fs.readdirSync(WORKSPACE_ROOT);
  
  return files
    .filter(file => {
      // Must match tsconfig.platform-*.json pattern
      if (!TSCONFIG_PATTERN.test(file)) return false;
      
      // Must not match excluded patterns
      if (EXCLUDED_PATTERNS.some(pattern => pattern.test(file))) return false;
      
      return true;
    })
    .sort();
}

function extractScopeName(configFile: string): string {
  const match = configFile.match(TSCONFIG_PATTERN);
  return match ? match[1] : configFile;
}

function parseDiagnostics(stderr: string): string[] {
  if (!stderr) return [];
  
  // Extract TypeScript error lines
  const lines = stderr.split('\n');
  const diagnostics: string[] = [];
  
  for (const line of lines) {
    // Match TypeScript diagnostic format: file.ts(line,col): error TS####:
    if (line.match(/\.tsx?\(\d+,\d+\): error TS\d+:/)) {
      diagnostics.push(line.trim());
    }
  }
  
  return diagnostics;
}

// ============================================================================
// VERIFICATION
// ============================================================================

function verifyScope(configFile: string, timeoutMs: number, verbose: boolean): VerificationResult {
  const scopeName = extractScopeName(configFile);
  const configPath = path.join(WORKSPACE_ROOT, configFile);
  
  if (verbose) {
    console.log(`  Verifying ${scopeName}...`);
  }
  
  const startTime = Date.now();
  
  // Run tsc directly via npx
  // Use shell to ensure npx resolution works on all platforms
  const tscCommand = `npx tsc -p "${configPath}" --noEmit`;
  
  const result = spawnSync(
    tscCommand,
    [],
    {
      cwd: WORKSPACE_ROOT,
      timeout: timeoutMs,
      encoding: 'utf-8',
      shell: true,
    }
  );
  
  const duration = Date.now() - startTime;
  
  // Check for timeout
  if (result.error && (result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
    return {
      scope: scopeName,
      status: 'HOTSPOT',
      duration: timeoutMs,
      diagnostics: [],
      timedOut: true,
    };
  }
  
  // Parse diagnostics from both stdout and stderr
  const allOutput = (result.stdout || '') + '\n' + (result.stderr || '');
  const diagnostics = parseDiagnostics(allOutput);
  
  // Classify result
  let status: VerificationStatus;
  
  if (result.status === 0) {
    status = 'PASS';
  } else if (diagnostics.length > 0) {
    status = 'FAIL';
  } else {
    // Exit non-zero but no parseable diagnostics
    // Could be infrastructure issue, treat as HOTSPOT
    status = 'HOTSPOT';
  }
  
  return {
    scope: scopeName,
    status,
    duration,
    diagnostics,
    timedOut: false,
  };
}

// ============================================================================
// REPORTING
// ============================================================================

function printResults(gateResult: GateResult, verbose: boolean): void {
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                   ║');
  console.log('║             GATE B: Scoped Type Verification                      ║');
  console.log('║                                                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  // Group by status
  const passed = gateResult.results.filter(r => r.status === 'PASS');
  const failed = gateResult.results.filter(r => r.status === 'FAIL');
  const hotspots = gateResult.results.filter(r => r.status === 'HOTSPOT');
  
  // Print PASS
  if (passed.length > 0) {
    console.log(`✅ PASS (${passed.length}):\n`);
    for (const result of passed) {
      console.log(`   ✓ ${result.scope.padEnd(30)} ${(result.duration / 1000).toFixed(1)}s`);
    }
    console.log('');
  }
  
  // Print FAIL
  if (failed.length > 0) {
    console.log(`❌ FAIL (${failed.length}):\n`);
    for (const result of failed) {
      const diagnosticCount = result.diagnostics.length;
      console.log(`   ✗ ${result.scope.padEnd(30)} ${(result.duration / 1000).toFixed(1)}s   ${diagnosticCount} diagnostic${diagnosticCount !== 1 ? 's' : ''}`);
      
      if (verbose && result.diagnostics.length > 0) {
        result.diagnostics.slice(0, 5).forEach(diag => {
          console.log(`     ${diag}`);
        });
        if (result.diagnostics.length > 5) {
          console.log(`     ... ${result.diagnostics.length - 5} more diagnostic(s)`);
        }
      }
    }
    console.log('');
  }
  
  // Print HOTSPOT
  if (hotspots.length > 0) {
    console.log(`🔥 HOTSPOT (${hotspots.length}):\n`);
    for (const result of hotspots) {
      const reason = result.timedOut ? `>${(result.duration / 1000).toFixed(0)}s (timeout)` : 'no actionable diagnostics';
      console.log(`   ⚠ ${result.scope.padEnd(30)} ${reason}`);
    }
    console.log('');
  }
  
  // Summary
  console.log('═══════════════════════════════════════════════════════════════════\n');
  console.log('Summary:');
  console.log(`  PASS:    ${gateResult.summary.pass}`);
  console.log(`  FAIL:    ${gateResult.summary.fail}`);
  console.log(`  HOTSPOT: ${gateResult.summary.hotspot}`);
  console.log(`  ────────────────`);
  console.log(`  TOTAL:   ${gateResult.summary.total}`);
  if (gateResult.summary.incomplete) {
    console.log(`  ⚠️  INCOMPLETE: Matrix timeout before all scopes verified`);
  }
  console.log('');
  
  // Final verdict
  if (gateResult.summary.incomplete) {
    console.log('⚠️  Gate B: INCOMPLETE (matrix timeout)\n');
  } else if (gateResult.passed) {
    console.log('✅ Gate B: PASS\n');
  } else if (failed.length > 0) {
    console.log('❌ Gate B: FAIL\n');
    console.log('Action Required: Fix TypeScript diagnostics in failed scopes.\n');
  } else {
    console.log('⚠️  Gate B: HOTSPOT\n');
    console.log('Action Required: Investigate timeout/infrastructure issues.\n');
  }
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  
  // Parse timeout
  const timeoutIndex = args.indexOf('--timeout');
  const timeout = timeoutIndex >= 0 && args[timeoutIndex + 1]
    ? parseInt(args[timeoutIndex + 1], 10)
    : DEFAULT_TIMEOUT_MS;
  
  // Parse matrix timeout
  const matrixTimeoutIndex = args.indexOf('--matrix-timeout');
  const matrixTimeout = matrixTimeoutIndex >= 0 && args[matrixTimeoutIndex + 1]
    ? parseInt(args[matrixTimeoutIndex + 1], 10)
    : DEFAULT_MATRIX_TIMEOUT_MS;
  
  if (isNaN(timeout) || timeout <= 0) {
    console.error('Error: Invalid timeout value. Must be positive integer (milliseconds).');
    process.exit(1);
  }
  
  console.log('🔍 Discovering Platform scoped configs...\n');
  
  const configs = discoverPlatformConfigs();
  
  if (configs.length === 0) {
    console.error('Error: No Platform scoped configs found matching tsconfig.platform-*.json pattern.');
    process.exit(1);
  }
  
  console.log(`Found ${configs.length} Platform unit configs.`);
  console.log(`Per-scope timeout: ${timeout}ms`);
  console.log(`Matrix timeout: ${matrixTimeout}ms\n`);
  
  // Verify each scope with matrix timeout
  const results: VerificationResult[] = [];
  let completed = 0;
  const matrixStartTime = Date.now();
  let matrixTimedOut = false;
  
  for (const config of configs) {
    // Check matrix timeout
    const elapsed = Date.now() - matrixStartTime;
    if (elapsed >= matrixTimeout) {
      console.log(`\n⚠️  Matrix timeout exceeded (${(elapsed / 1000).toFixed(1)}s)`);
      console.log(`   Completed: ${completed}/${configs.length} scopes`);
      matrixTimedOut = true;
      break;
    }
    
    const result = verifyScope(config, timeout, verbose);
    results.push(result);
    completed++;
    
    // Progress indicator
    if (!verbose && completed % 5 === 0) {
      const elapsedSec = ((Date.now() - matrixStartTime) / 1000).toFixed(0);
      process.stdout.write(`  Progress: ${completed}/${configs.length} (${elapsedSec}s elapsed)\r`);
    }
  }
  
  if (!verbose) {
    console.log(''); // Clear progress line
  }
  
  // Compute summary
  const summary = {
    pass: results.filter(r => r.status === 'PASS').length,
    fail: results.filter(r => r.status === 'FAIL').length,
    hotspot: results.filter(r => r.status === 'HOTSPOT').length,
    total: results.length,
    incomplete: matrixTimedOut,
  };
  
  const gateResult: GateResult = {
    results,
    summary,
    passed: summary.fail === 0 && summary.hotspot === 0 && !matrixTimedOut,
  };
  
  // Print results
  printResults(gateResult, verbose);
  
  // Exit code
  if (matrixTimedOut) {
    console.log('\n⚠️  Gate B: INCOMPLETE (matrix timeout)');
    console.log('   Increase --matrix-timeout or investigate slow scopes.\n');
    process.exit(3); // INCOMPLETE
  } else if (gateResult.passed) {
    process.exit(0);
  } else if (summary.fail > 0) {
    process.exit(1);
  } else {
    process.exit(2); // HOTSPOT only
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { verifyScope, discoverPlatformConfigs, extractScopeName, parseDiagnostics };
