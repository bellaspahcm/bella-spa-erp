#!/usr/bin/env tsx
/**
 * STEP 6 — Diagnostic Baseline & Root-Cause Classification
 * 
 * Phase 6A: Run all 29 app routes scopes
 * Phase 6B: Freeze raw diagnostic inventory
 * Phase 6C: Deduplicate diagnostics
 * Phase 6D: Group by TS code / file / dependency boundary
 * Phase 6E: Identify root-cause clusters
 * Phase 6F: Map clusters to owning scope
 * Phase 6G: Establish remediation order
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as glob from 'glob';

interface ScopeResult {
  scope_id: string;
  scope_file: string;
  owner: string;
  route_count: number;
  status: 'PASS' | 'HAS_DIAGNOSTICS' | 'ERROR';
  diagnostic_count: number;
  error_count: number;
  warning_count: number;
  raw_output: string;
  execution_time_ms: number;
}

interface Diagnostic {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  severity: 'error' | 'warning';
  scope_id: string;
}

function extractOwnerFromTsconfig(tsconfigPath: string): { owner: string; routeCount: number } {
  // Read from TG-2 registration comments
  const tg2Script = fs.readFileSync('scripts/governance/tg2-production-coverage.ts', 'utf-8');
  const configName = path.basename(tsconfigPath);
  
  // Find the line with this config
  const regex = new RegExp(`'${configName}'[^\\n]*//\\s*([^(]+)\\((\\d+)\\s*routes\\)`);
  const match = tg2Script.match(regex);
  
  if (match) {
    return {
      owner: match[1].trim(),
      routeCount: parseInt(match[2])
    };
  }
  
  return { owner: 'Unknown', routeCount: 0 };
}

function runScopeTypecheck(tsconfigPath: string): ScopeResult {
  const scopeId = path.basename(tsconfigPath, '.json');
  const { owner, routeCount } = extractOwnerFromTsconfig(tsconfigPath);
  
  console.log(`   Checking ${scopeId} (${owner}, ${routeCount} routes)...`);
  
  const startTime = Date.now();
  
  try {
    // Run tsc with --noEmit
    const output = execSync(
      `npx tsc --project ${tsconfigPath} --noEmit`,
      {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 120000 // 2 min timeout per scope
      }
    );
    
    const executionTime = Date.now() - startTime;
    
    // CRITICAL FIX: Verify output captured correctly
    // TypeScript may write to stdout even on success
    // Must parse output to verify true PASS
    const diagnostics = parseTscOutput(output, scopeId);
    
    if (diagnostics.length > 0) {
      // Diagnostics found despite exit 0 → report them
      const errors = diagnostics.filter(d => d.severity === 'error').length;
      const warnings = diagnostics.filter(d => d.severity === 'warning').length;
      
      return {
        scope_id: scopeId,
        scope_file: tsconfigPath,
        owner,
        route_count: routeCount,
        status: errors > 0 ? 'HAS_DIAGNOSTICS' : 'PASS',
        diagnostic_count: diagnostics.length,
        error_count: errors,
        warning_count: warnings,
        raw_output: output,
        execution_time_ms: executionTime
      };
    }
    
    // True PASS: exit 0 AND no diagnostics in output
    return {
      scope_id: scopeId,
      scope_file: tsconfigPath,
      owner,
      route_count: routeCount,
      status: 'PASS',
      diagnostic_count: 0,
      error_count: 0,
      warning_count: 0,
      raw_output: output,
      execution_time_ms: executionTime
    };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    
    // CRITICAL FIX: Detect timeout/killed processes
    if (error.killed || error.signal) {
      return {
        scope_id: scopeId,
        scope_file: tsconfigPath,
        owner,
        route_count: routeCount,
        status: 'TIMEOUT',
        diagnostic_count: -1,
        error_count: -1,
        warning_count: -1,
        raw_output: `Process killed (signal: ${error.signal}, timeout: ${error.killed})`,
        execution_time_ms: executionTime
      };
    }
    
    const output = error.stdout || error.stderr || '';
    
    // Parse diagnostics from output
    const diagnostics = parseTscOutput(output, scopeId);
    const errors = diagnostics.filter(d => d.severity === 'error').length;
    const warnings = diagnostics.filter(d => d.severity === 'warning').length;
    
    return {
      scope_id: scopeId,
      scope_file: tsconfigPath,
      owner,
      route_count: routeCount,
      status: errors > 0 ? 'HAS_DIAGNOSTICS' : 'PASS',
      diagnostic_count: diagnostics.length,
      error_count: errors,
      warning_count: warnings,
      raw_output: output,
      execution_time_ms: executionTime
    };
  }
}

function parseTscOutput(output: string, scopeId: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    // Match TypeScript diagnostic format: file(line,col): error TS1234: message
    const match = line.match(/^(.+)\((\d+),(\d+)\):\s+(error|warning)\s+TS(\d+):\s*(.+)$/);
    
    if (match) {
      diagnostics.push({
        file: match[1].trim(),
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        code: `TS${match[5]}`,
        message: match[6].trim(),
        severity: match[4] as 'error' | 'warning',
        scope_id: scopeId
      });
    }
  }
  
  return diagnostics;
}

function phase6A_RunAllScopes(): ScopeResult[] {
  console.log('═══════════════════════════════════════════════');
  console.log('PHASE 6A — Run All 29 Scopes');
  console.log('═══════════════════════════════════════════════\n');
  
  // Find all app routes tsconfig files
  const tsconfigFiles = glob.sync('tsconfig.app-routes-*.json', { cwd: process.cwd() });
  
  console.log(`📋 Found ${tsconfigFiles.length} app routes scopes\n`);
  
  const results: ScopeResult[] = [];
  
  for (const tsconfigFile of tsconfigFiles) {
    const result = runScopeTypecheck(tsconfigFile);
    results.push(result);
    
    if (result.status === 'PASS') {
      console.log(`      ✅ PASS (${result.execution_time_ms}ms)`);
    } else {
      console.log(`      ⚠️  ${result.diagnostic_count} diagnostics (${result.error_count} errors, ${result.warning_count} warnings, ${result.execution_time_ms}ms)`);
    }
  }
  
  console.log();
  return results;
}

function phase6B_FreezeInventory(results: ScopeResult[]): { 
  allDiagnostics: Diagnostic[];
  summary: any;
} {
  console.log('═══════════════════════════════════════════════');
  console.log('PHASE 6B — Freeze Raw Diagnostic Inventory');
  console.log('═══════════════════════════════════════════════\n');
  
  const allDiagnostics: Diagnostic[] = [];
  
  for (const result of results) {
    if (result.status === 'HAS_DIAGNOSTICS') {
      const scopeDiagnostics = parseTscOutput(result.raw_output, result.scope_id);
      allDiagnostics.push(...scopeDiagnostics);
    }
  }
  
  const passCount = results.filter(r => r.status === 'PASS').length;
  const hasDiagnosticsCount = results.filter(r => r.status === 'HAS_DIAGNOSTICS').length;
  const totalDiagnostics = results.reduce((sum, r) => sum + r.diagnostic_count, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.error_count, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warning_count, 0);
  
  console.log(`📊 Inventory Summary:\n`);
  console.log(`   Scopes evaluated:          ${results.length}`);
  console.log(`   PASS (0 diagnostics):      ${passCount}`);
  console.log(`   HAS_DIAGNOSTICS:           ${hasDiagnosticsCount}`);
  console.log();
  console.log(`   Total raw diagnostics:     ${totalDiagnostics}`);
  console.log(`   Errors:                    ${totalErrors}`);
  console.log(`   Warnings:                  ${totalWarnings}`);
  console.log();
  
  return {
    allDiagnostics,
    summary: {
      scopes_evaluated: results.length,
      pass_count: passCount,
      has_diagnostics_count: hasDiagnosticsCount,
      total_diagnostics: totalDiagnostics,
      total_errors: totalErrors,
      total_warnings: totalWarnings
    }
  };
}

function phase6C_Deduplicate(diagnostics: Diagnostic[]): Diagnostic[] {
  console.log('═══════════════════════════════════════════════');
  console.log('PHASE 6C — Deduplicate Diagnostics');
  console.log('═══════════════════════════════════════════════\n');
  
  // Create unique key: file + line + code + message
  const uniqueMap = new Map<string, Diagnostic>();
  
  for (const diag of diagnostics) {
    const key = `${diag.file}:${diag.line}:${diag.code}:${diag.message}`;
    
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, diag);
    }
  }
  
  const unique = Array.from(uniqueMap.values());
  
  console.log(`   Raw diagnostics:           ${diagnostics.length}`);
  console.log(`   Unique diagnostics:        ${unique.length}`);
  console.log(`   Duplicates removed:        ${diagnostics.length - unique.length}\n`);
  
  return unique;
}

function phase6D_GroupByCode(diagnostics: Diagnostic[]): Map<string, Diagnostic[]> {
  console.log('═══════════════════════════════════════════════');
  console.log('PHASE 6D — Group by TS Code');
  console.log('═══════════════════════════════════════════════\n');
  
  const codeGroups = new Map<string, Diagnostic[]>();
  
  for (const diag of diagnostics) {
    if (!codeGroups.has(diag.code)) {
      codeGroups.set(diag.code, []);
    }
    codeGroups.get(diag.code)!.push(diag);
  }
  
  // Sort by frequency
  const sorted = Array.from(codeGroups.entries())
    .sort((a, b) => b[1].length - a[1].length);
  
  console.log(`   Unique TS codes:           ${codeGroups.size}\n`);
  console.log('   Top 10 diagnostic codes:\n');
  
  for (const [code, diags] of sorted.slice(0, 10)) {
    console.log(`   ${code.padEnd(10)} ${diags.length.toString().padStart(4)} occurrences`);
  }
  
  console.log();
  
  return codeGroups;
}

function writeResults(
  results: ScopeResult[],
  allDiagnostics: Diagnostic[],
  uniqueDiagnostics: Diagnostic[],
  codeGroups: Map<string, Diagnostic[]>
): void {
  console.log('═══════════════════════════════════════════════');
  console.log('Writing Results');
  console.log('═══════════════════════════════════════════════\n');
  
  const outputDir = 'docs/architecture/gate3';
  
  // Write scope results CSV
  const scopeResultsPath = path.join(outputDir, 'TG2_STEP6_SCOPE_RESULTS.csv');
  const scopeHeader = 'scope_id,owner,route_count,status,diagnostic_count,error_count,warning_count,execution_time_ms\n';
  const scopeRows = results.map(r =>
    `"${r.scope_id}","${r.owner}",${r.route_count},"${r.status}",${r.diagnostic_count},${r.error_count},${r.warning_count},${r.execution_time_ms}`
  );
  fs.writeFileSync(scopeResultsPath, scopeHeader + scopeRows.join('\n'));
  console.log(`   ✅ Scope results: ${scopeResultsPath}`);
  
  // Write unique diagnostics CSV
  const diagPath = path.join(outputDir, 'TG2_STEP6_UNIQUE_DIAGNOSTICS.csv');
  const diagHeader = 'file,line,column,code,severity,message,scope_id\n';
  const diagRows = uniqueDiagnostics.map(d =>
    `"${d.file}",${d.line},${d.column},"${d.code}","${d.severity}","${d.message}","${d.scope_id}"`
  );
  fs.writeFileSync(diagPath, diagHeader + diagRows.join('\n'));
  console.log(`   ✅ Unique diagnostics: ${diagPath}`);
  
  // Write code group summary
  const codeGroupPath = path.join(outputDir, 'TG2_STEP6_CODE_GROUPS.csv');
  const codeHeader = 'ts_code,occurrence_count,severity\n';
  const codeRows = Array.from(codeGroups.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([code, diags]) => {
      const severity = diags[0].severity;
      return `"${code}",${diags.length},"${severity}"`;
    });
  fs.writeFileSync(codeGroupPath, codeHeader + codeRows.join('\n'));
  console.log(`   ✅ Code groups: ${codeGroupPath}`);
  
  console.log();
}

function main() {
  console.log('📂 STEP 6 — Diagnostic Baseline & Root-Cause Classification');
  console.log('═══════════════════════════════════════════════\n');
  
  try {
    // Phase 6A: Run all scopes
    const results = phase6A_RunAllScopes();
    
    // Phase 6B: Freeze inventory
    const { allDiagnostics, summary } = phase6B_FreezeInventory(results);
    
    // Phase 6C: Deduplicate
    const uniqueDiagnostics = phase6C_Deduplicate(allDiagnostics);
    
    // Phase 6D: Group by code
    const codeGroups = phase6D_GroupByCode(uniqueDiagnostics);
    
    // Write results
    writeResults(results, allDiagnostics, uniqueDiagnostics, codeGroups);
    
    // Summary
    console.log('═══════════════════════════════════════════════');
    console.log('STEP 6A-6D Summary');
    console.log('═══════════════════════════════════════════════\n');
    
    console.log(`✅ Phase 6A: ${results.length} scopes evaluated`);
    console.log(`✅ Phase 6B: ${allDiagnostics.length} raw diagnostics frozen`);
    console.log(`✅ Phase 6C: ${uniqueDiagnostics.length} unique diagnostics`);
    console.log(`✅ Phase 6D: ${codeGroups.size} TS code groups identified\n`);
    
    const passCount = results.filter(r => r.status === 'PASS').length;
    const hasDiagnostics = results.filter(r => r.status === 'HAS_DIAGNOSTICS').length;
    
    console.log('📊 Final Baseline:\n');
    console.log(`   ${passCount}/${results.length} scopes PASS (0 diagnostics)`);
    console.log(`   ${hasDiagnostics}/${results.length} scopes HAS_DIAGNOSTICS`);
    console.log(`   ${uniqueDiagnostics.length} unique diagnostics to address\n`);
    
    console.log('📋 Next: Phase 6E-6G (Root-cause clustering + remediation order)');
    
  } catch (error) {
    console.error('❌ STEP 6 execution failed:', error);
    process.exit(1);
  }
}

main();
