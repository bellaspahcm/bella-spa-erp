#!/usr/bin/env tsx
/**
 * STEP 6D — Diagnostic Census
 * 
 * Runs TypeScript compilation on all Layer 2 scopes and collects:
 * - Compilation time
 * - Exit code
 * - Diagnostic count
 * - Sample diagnostics
 * 
 * Output: CSV with complete census for remediation planning
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

interface CensusResult {
  scope: string;
  tsconfig: string;
  compilationTime: number;
  exitCode: number;
  diagnosticCount: number;
  status: 'CLEAN' | 'HAS_DIAGNOSTICS' | 'ERROR' | 'TIMEOUT';
  sampleDiagnostics: string[];
}

const TIMEOUT_MS = 60000; // 60s per scope

/**
 * Discover all compile-*.json tsconfigs
 */
function discoverCompileScopes(): string[] {
  const configs = glob.sync('tsconfig.compile-*.json', {
    cwd: process.cwd(),
    absolute: false,
  });
  return configs.sort();
}

/**
 * Run TypeScript compilation on a scope
 */
function runCompilation(tsconfig: string): CensusResult {
  const scopeName = tsconfig
    .replace('tsconfig.compile-', '')
    .replace('.json', '');

  const startTime = Date.now();
  let exitCode = -1;
  let output = '';
  let status: CensusResult['status'] = 'ERROR';

  try {
    output = execSync(
      `npm exec tsc -- --project ${tsconfig} --noEmit`,
      {
        encoding: 'utf-8',
        timeout: TIMEOUT_MS,
        stdio: 'pipe',
      }
    );
    exitCode = 0;
    status = 'CLEAN';
  } catch (error: any) {
    if (error.killed) {
      status = 'TIMEOUT';
      exitCode = -1;
    } else {
      exitCode = error.status ?? -1;
      output = error.stdout || error.message || '';
      
      if (output.includes('error TS')) {
        status = 'HAS_DIAGNOSTICS';
      } else {
        status = 'ERROR';
      }
    }
  }

  const compilationTime = (Date.now() - startTime) / 1000;

  // Extract diagnostics
  const diagnosticLines = output
    .split('\n')
    .filter(line => line.includes('error TS'))
    .slice(0, 10); // First 10 diagnostics as sample

  const diagnosticCount = output
    .split('\n')
    .filter(line => line.includes('error TS')).length;

  return {
    scope: scopeName,
    tsconfig,
    compilationTime,
    exitCode,
    diagnosticCount,
    status,
    sampleDiagnostics: diagnosticLines,
  };
}

/**
 * Write census results to CSV
 */
function writeCensusCSV(results: CensusResult[], outputPath: string): void {
  const header = 'scope,tsconfig,compilation_time_seconds,exit_code,diagnostic_count,status,sample_diagnostics\n';
  
  const rows = results.map(r => {
    const sample = r.sampleDiagnostics
      .slice(0, 3)
      .join(' | ')
      .replace(/"/g, '""'); // Escape quotes
    
    return `"${r.scope}","${r.tsconfig}",${r.compilationTime.toFixed(2)},${r.exitCode},${r.diagnosticCount},"${r.status}","${sample}"`;
  });

  const csv = header + rows.join('\n') + '\n';
  fs.writeFileSync(outputPath, csv);
}

/**
 * Main execution
 */
function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('STEP 6D — Diagnostic Census');
  console.log('═══════════════════════════════════════════════\n');

  const scopes = discoverCompileScopes();
  console.log(`📊 Found ${scopes.length} Layer 2 scopes\n`);

  if (scopes.length === 0) {
    console.log('❌ No tsconfig.compile-*.json files found');
    console.log('   Run: npx tsx scripts/governance/step6d-expand-product-scopes.ts\n');
    process.exit(1);
  }

  const results: CensusResult[] = [];

  for (const tsconfig of scopes) {
    const scopeName = tsconfig.replace('tsconfig.compile-', '').replace('.json', '');
    process.stdout.write(`   🔍 ${scopeName.padEnd(20)} `);
    
    const result = runCompilation(tsconfig);
    results.push(result);

    const statusIcon = result.status === 'CLEAN' ? '✅' : 
                      result.status === 'HAS_DIAGNOSTICS' ? '⚠️' : 
                      result.status === 'TIMEOUT' ? '⏱️' : '❌';
    
    console.log(`${statusIcon} ${result.status} (${result.compilationTime.toFixed(1)}s, ${result.diagnosticCount} diagnostics)`);
  }

  // Write results
  const outputPath = 'docs/architecture/gate3/TG2_STEP6D_DIAGNOSTIC_CENSUS.csv';
  writeCensusCSV(results, outputPath);

  // Summary
  console.log('\n═══════════════════════════════════════════════');
  console.log('Census Summary');
  console.log('═══════════════════════════════════════════════');
  
  const clean = results.filter(r => r.status === 'CLEAN').length;
  const hasDiagnostics = results.filter(r => r.status === 'HAS_DIAGNOSTICS').length;
  const errors = results.filter(r => r.status === 'ERROR').length;
  const timeouts = results.filter(r => r.status === 'TIMEOUT').length;
  const totalDiagnostics = results.reduce((sum, r) => sum + r.diagnosticCount, 0);

  console.log(`Total scopes:        ${results.length}`);
  console.log(`Clean (0 diag):      ${clean} ✅`);
  console.log(`Has diagnostics:     ${hasDiagnostics} ⚠️`);
  console.log(`Errors:              ${errors} ❌`);
  console.log(`Timeouts:            ${timeouts} ⏱️`);
  console.log(`Total diagnostics:   ${totalDiagnostics}`);
  console.log(`\nResults: ${outputPath}\n`);

  if (hasDiagnostics === 0 && errors === 0 && timeouts === 0) {
    console.log('🎉 ALL SCOPES CLEAN — TypeScript hardening target achieved\n');
  } else {
    console.log(`⚠️  ${hasDiagnostics + errors + timeouts} scopes need attention\n`);
    console.log('Next: Analyze diagnostics → Cluster → Remediate\n');
  }
}

main();
