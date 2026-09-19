#!/usr/bin/env node
/**
 * P1-T1 TypeScript Census — Remaining Scopes
 * 
 * Check scopes without dedicated tsconfig files by directory.
 * READ ONLY — No fixes applied.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';

interface ScopeResult {
  scope: string;
  path: string;
  diagnostics: number;
  verified: boolean;
  notes: string;
  errorSample?: string[];
}

const results: ScopeResult[] = [];

function checkDirectory(
  scope: string,
  dirPath: string,
  notes: string = ''
): ScopeResult {
  console.log(`\n=== Checking ${scope} (${dirPath}) ===`);
  
  // Check if directory exists
  if (!fs.existsSync(dirPath)) {
    console.log(`⏭️  ${scope}: Directory not found`);
    return {
      scope,
      path: dirPath,
      diagnostics: 0,
      verified: false,
      notes: 'Directory not found',
    };
  }
  
  // Count TypeScript files
  try {
    const fileCount = execSync(
      `powershell -Command "(Get-ChildItem -Path '${dirPath}' -Recurse -Include *.ts,*.tsx | Measure-Object).Count"`,
      { encoding: 'utf-8' }
    ).trim();
    
    if (fileCount === '0') {
      console.log(`⏭️  ${scope}: No TypeScript files`);
      return {
        scope,
        path: dirPath,
        diagnostics: 0,
        verified: false,
        notes: 'No TypeScript files',
      };
    }
    
    console.log(`   Found ${fileCount} TypeScript files`);
  } catch (error) {
    console.log(`⚠️  Could not count files`);
  }
  
  try {
    // Run tsc on directory
    const command = `npx tsc --noEmit --skipLibCheck ${dirPath}/**/*.ts ${dirPath}/**/*.tsx`;
    
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: 'pipe',
      maxBuffer: 50 * 1024 * 1024,
    });
    
    console.log(`✅ ${scope}: 0 diagnostics`);
    return {
      scope,
      path: dirPath,
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
      path: dirPath,
      diagnostics,
      verified: true,
      notes: notes || 'Has diagnostics',
      errorSample: topErrors,
    };
  }
}

console.log('P1-T1 TypeScript Census — Remaining Scopes');
console.log('==========================================');
console.log('READ ONLY — No fixes applied\n');

// Platform scopes
results.push(checkDirectory(
  'Healthcare Platform',
  'src/platform/healthcare',
  'H1-H12 Kernel (frozen)'
));

results.push(checkDirectory(
  'Logistics Platform',
  'src/platform/logistics',
  'E7.1-E7.3 Kernel (sealed)'
));

results.push(checkDirectory(
  'Real Estate Platform',
  'src/platform/real-estate',
  'Real Estate OS'
));

results.push(checkDirectory(
  'Platform Core',
  'src/platform/core',
  'Core platform infrastructure'
));

// Product scopes
results.push(checkDirectory(
  'BabyCare Product',
  'src/services/booking',
  'BabyCare (P2 regression STABLE)'
));

// Legacy areas
results.push(checkDirectory(
  'Decision Engine (Legacy)',
  'src/lib/decision-engine',
  'Legacy decision engine'
));

results.push(checkDirectory(
  'Services (Legacy)',
  'src/services',
  'Legacy services layer'
));

// Generate report
console.log('\n\n========================================');
console.log('REMAINING SCOPES CENSUS RESULTS');
console.log('========================================\n');

const verified = results.filter(r => r.verified);
const totalDiagnostics = verified.reduce((sum, r) => sum + r.diagnostics, 0);

console.log(`Scopes checked: ${results.length}`);
console.log(`Scopes verified: ${verified.length}`);
console.log(`Total diagnostics: ${totalDiagnostics}`);
console.log('');

console.log('Scope Breakdown:');
console.log('----------------');

results.forEach(r => {
  if (!r.verified) {
    console.log(`${r.scope.padEnd(30)} ⏭️ ${r.notes}`);
  } else {
    const status = r.diagnostics === 0 ? '✅ CLEAN' : `⚠️  ${r.diagnostics} diagnostics`;
    console.log(`${r.scope.padEnd(30)} ${status.padEnd(25)} ${r.notes}`);
    if (r.errorSample && r.errorSample.length > 0) {
      console.log(`${''.padEnd(30)} Top errors: ${r.errorSample.join(', ')}`);
    }
  }
});

// Write results
const csvPath = 'docs/platform/P1_T1_REMAINING_SCOPES.csv';
const csvLines = [
  'Scope,Path,Diagnostics,Verified,Notes,Top Error Codes',
  ...results.map(r => {
    const errorCodes = r.errorSample ? r.errorSample.join('; ') : '';
    return `"${r.scope}","${r.path}",${r.diagnostics},${r.verified},"${r.notes}","${errorCodes}"`;
  }),
];

fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');
console.log(`\n✅ CSV report written to: ${csvPath}`);

console.log('\n========================================');
console.log('SUMMARY');
console.log('========================================');
console.log(`Total diagnostics from remaining scopes: ${totalDiagnostics}`);
console.log(`Clean scopes: ${verified.filter(r => r.diagnostics === 0).length}`);
console.log(`Dirty scopes: ${verified.filter(r => r.diagnostics > 0).length}`);
console.log('');
