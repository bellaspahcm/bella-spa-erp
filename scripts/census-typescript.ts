#!/usr/bin/env node
/**
 * P1-T1 TypeScript Census — Layer 1: Compiler Diagnostics
 * 
 * Measures actual TypeScript compiler errors across scopes.
 * DOES NOT FIX ANYTHING — READ ONLY.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface ScopeResult {
  scope: string;
  diagnostics: number;
  verified: boolean;
  notes: string;
  errorSample?: string[];
}

const results: ScopeResult[] = [];

function runTscCheck(
  scope: string,
  command: string,
  notes: string = ''
): ScopeResult {
  console.log(`\n=== Checking ${scope} ===`);
  
  try {
    // Run tsc and capture output
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: 'pipe',
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
    });
    
    // No errors if it doesn't throw
    console.log(`✅ ${scope}: 0 diagnostics`);
    return {
      scope,
      diagnostics: 0,
      verified: true,
      notes: notes || 'Clean',
    };
  } catch (error: any) {
    // Parse error output
    const output = error.stdout || error.stderr || '';
    const lines = output.split('\n');
    
    // Count error lines
    const errorLines = lines.filter((line: string) => 
      line.includes('error TS')
    );
    
    const diagnostics = errorLines.length;
    
    // Get error code distribution
    const errorCodes = new Map<string, number>();
    errorLines.forEach((line: string) => {
      const match = line.match(/error (TS\d+):/);
      if (match) {
        const code = match[1];
        errorCodes.set(code, (errorCodes.get(code) || 0) + 1);
      }
    });
    
    // Top 5 error codes
    const topErrors = Array.from(errorCodes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => `${code}: ${count}`);
    
    console.log(`⚠️  ${scope}: ${diagnostics} diagnostics`);
    if (topErrors.length > 0) {
      console.log(`   Top errors: ${topErrors.join(', ')}`);
    }
    
    return {
      scope,
      diagnostics,
      verified: true,
      notes: notes || 'Has diagnostics',
      errorSample: topErrors,
    };
  }
}

// Census execution
console.log('P1-T1 TypeScript Census — Layer 1: Compiler Diagnostics');
console.log('========================================================');
console.log('READ ONLY — No fixes applied');
console.log('');

// Scoped configs
results.push(runTscCheck(
  'Beauty OS',
  'npx tsc --project tsconfig.beauty.json --noEmit',
  'Active product (Nail RC + contracts)'
));

results.push(runTscCheck(
  'Education OS',
  'npx tsc --project tsconfig.education.json --noEmit',
  'Active OS'
));

results.push(runTscCheck(
  'English Center',
  'npx tsc --project tsconfig.english-center.json --noEmit',
  'Paused product'
));

// Check if other scoped configs exist
const scopedConfigs = [
  { name: 'Healthcare OS', file: 'tsconfig.healthcare.json' },
  { name: 'Logistics OS', file: 'tsconfig.logistics.json' },
  { name: 'Real Estate OS', file: 'tsconfig.real-estate.json' },
];

scopedConfigs.forEach(({ name, file }) => {
  if (fs.existsSync(file)) {
    results.push(runTscCheck(
      name,
      `npx tsc --project ${file} --noEmit`,
      'Scoped config'
    ));
  } else {
    console.log(`⏭️  ${name}: No scoped config found (${file})`);
  }
});

// Generate report
console.log('\n\n========================================================');
console.log('P1-T1 CENSUS RESULTS');
console.log('========================================================\n');

const totalDiagnostics = results.reduce((sum, r) => sum + r.diagnostics, 0);
const verifiedScopes = results.filter(r => r.verified).length;

console.log(`Scopes verified: ${verifiedScopes}`);
console.log(`Total diagnostics: ${totalDiagnostics}`);
console.log('');

console.log('Scope Breakdown:');
console.log('----------------');

results.forEach(r => {
  const status = r.diagnostics === 0 ? '✅ CLEAN' : `⚠️  ${r.diagnostics} diagnostics`;
  console.log(`${r.scope.padEnd(20)} ${status.padEnd(25)} ${r.notes}`);
  if (r.errorSample && r.errorSample.length > 0) {
    console.log(`${''.padEnd(20)} Top errors: ${r.errorSample.join(', ')}`);
  }
});

console.log('');

// Classification
const clean = results.filter(r => r.diagnostics === 0);
const dirty = results.filter(r => r.diagnostics > 0);

console.log('Classification:');
console.log('---------------');
console.log(`CLEAN (0 diagnostics): ${clean.length} scopes`);
clean.forEach(r => console.log(`  - ${r.scope}`));
console.log('');
console.log(`DIRTY (has diagnostics): ${dirty.length} scopes`);
dirty.forEach(r => console.log(`  - ${r.scope}: ${r.diagnostics} diagnostics`));

// Write CSV
const csvPath = 'docs/platform/P1_T1_SCOPE_DIAGNOSTICS.csv';
const csvLines = [
  'Scope,Diagnostics,Status,Notes,Top Error Codes',
  ...results.map(r => {
    const status = r.diagnostics === 0 ? 'CLEAN' : 'DIRTY';
    const errorCodes = r.errorSample ? r.errorSample.join('; ') : '';
    return `"${r.scope}",${r.diagnostics},${status},"${r.notes}","${errorCodes}"`;
  }),
];

fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');
console.log(`\n✅ CSV report written to: ${csvPath}`);

// Summary
console.log('\n========================================================');
console.log('SUMMARY');
console.log('========================================================');
console.log(`Verified: ${verifiedScopes} scopes`);
console.log(`Total diagnostics: ${totalDiagnostics}`);
console.log(`Clean scopes: ${clean.length}`);
console.log(`Dirty scopes: ${dirty.length}`);
console.log('\nNext: Complete Layer 2 (scope distribution) and Layer 3 (debt markers)');
console.log('');
