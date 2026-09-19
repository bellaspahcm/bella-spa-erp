#!/usr/bin/env node
/**
 * P1-T1 TypeScript Census — Scoped Verification for Remaining Scopes
 * 
 * Verifies Healthcare, Logistics, Real Estate, Platform Core with scoped tsconfigs.
 * READ ONLY — No fixes applied.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';

interface ScopeResult {
  scope: string;
  config: string;
  diagnostics: number;
  verified: boolean;
  notes: string;
  errorSample?: string[];
}

const results: ScopeResult[] = [];

function runTscCheck(
  scope: string,
  config: string,
  notes: string = ''
): ScopeResult {
  console.log(`\n=== Checking ${scope} (${config}) ===`);
  
  // Check if config exists
  if (!fs.existsSync(config)) {
    console.log(`⏭️  ${scope}: Config not found (${config})`);
    return {
      scope,
      config,
      diagnostics: 0,
      verified: false,
      notes: 'Config not found',
    };
  }
  
  try {
    // Run tsc with scoped config
    const output = execSync(`npx tsc --project ${config} --noEmit`, {
      encoding: 'utf-8',
      stdio: 'pipe',
      maxBuffer: 50 * 1024 * 1024,
    });
    
    console.log(`✅ ${scope}: 0 diagnostics`);
    return {
      scope,
      config,
      diagnostics: 0,
      verified: true,
      notes: notes || 'Clean',
    };
  } catch (error: any) {
    const output = error.stdout || error.stderr || '';
    const lines = output.split('\n');
    
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
      config,
      diagnostics,
      verified: true,
      notes: notes || 'Has diagnostics',
      errorSample: topErrors,
    };
  }
}

console.log('P1-T1 TypeScript Census — Scoped Verification');
console.log('==============================================');
console.log('READ ONLY — No fixes applied\n');

// Verify scoped configs
results.push(runTscCheck(
  'Healthcare Platform',
  'tsconfig.healthcare.json',
  'H1-H12 Kernel (frozen)'
));

results.push(runTscCheck(
  'Logistics Platform',
  'tsconfig.logistics.json',
  'E7.1-E7.3 Kernel (sealed)'
));

results.push(runTscCheck(
  'Real Estate Platform',
  'tsconfig.real-estate.json',
  'Real Estate OS'
));

results.push(runTscCheck(
  'Platform Core',
  'tsconfig.platform-core.json',
  'Core infrastructure'
));

// Generate report
console.log('\n\n==============================================');
console.log('SCOPED VERIFICATION RESULTS');
console.log('==============================================\n');

const verified = results.filter(r => r.verified);
const totalDiagnostics = verified.reduce((sum, r) => sum + r.diagnostics, 0);

console.log(`Scopes verified: ${verified.length}/${results.length}`);
console.log(`Total diagnostics: ${totalDiagnostics}`);
console.log('');

console.log('Scope Breakdown:');
console.log('----------------');

results.forEach(r => {
  if (!r.verified) {
    console.log(`${r.scope.padEnd(25)} ⏭️ ${r.notes}`);
  } else {
    const status = r.diagnostics === 0 ? '✅ CLEAN' : `⚠️  ${r.diagnostics} diagnostics`;
    console.log(`${r.scope.padEnd(25)} ${status.padEnd(25)} ${r.notes}`);
    if (r.errorSample && r.errorSample.length > 0) {
      console.log(`${''.padEnd(25)} Top errors: ${r.errorSample.join(', ')}`);
    }
  }
});

// Classification
const clean = verified.filter(r => r.diagnostics === 0);
const dirty = verified.filter(r => r.diagnostics > 0);

console.log('\nClassification:');
console.log('---------------');
console.log(`CLEAN (0 diagnostics): ${clean.length} scopes`);
clean.forEach(r => console.log(`  - ${r.scope}`));
console.log('');
console.log(`DIRTY (has diagnostics): ${dirty.length} scopes`);
dirty.forEach(r => console.log(`  - ${r.scope}: ${r.diagnostics} diagnostics`));

// Write CSV
const csvPath = 'docs/platform/P1_T1_SCOPED_VERIFICATION.csv';
const csvLines = [
  'Scope,Config,Diagnostics,Verified,Notes,Top Error Codes',
  ...results.map(r => {
    const errorCodes = r.errorSample ? r.errorSample.join('; ') : '';
    return `"${r.scope}","${r.config}",${r.diagnostics},${r.verified},"${r.notes}","${errorCodes}"`;
  }),
];

fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');
console.log(`\n✅ CSV report written to: ${csvPath}`);

console.log('\n==============================================');
console.log('SUMMARY');
console.log('==============================================');
console.log(`Verified: ${verified.length}/${results.length} scopes`);
console.log(`Total diagnostics: ${totalDiagnostics}`);
console.log(`Clean scopes: ${clean.length}`);
console.log(`Dirty scopes: ${dirty.length}`);
console.log('');
