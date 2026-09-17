#!/usr/bin/env ts-node
/**
 * Platform Host — No-New-Debt TypeScript Gate
 * 
 * Enforces Platform Host-owned TypeScript diagnostics remain at 0.
 * 
 * Platform Host files:
 * - src/platform/host/person/person.repository.ts
 * - src/platform/host/rule-engine/rule-engine.service.ts
 * 
 * Baseline @ 72cdb007:
 * - Platform Host: 0 diagnostics 🔒
 * - Other diagnostics: tracked but not enforced by this gate
 * 
 * PASS: Platform Host-owned = 0
 * FAIL: Any new diagnostics in Platform Host files
 */

import { execSync } from 'child_process';

interface Diagnostic {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

const PLATFORM_HOST_FILES = [
  'src/platform/host/person/person.repository.ts',
  'src/platform/host/rule-engine/rule-engine.service.ts'
];

const BASELINE_COUNT = 0;

function parseDiagnostics(output: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const normalized = output.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^([^(]+)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/);
    if (match) {
      let message = match[5];
      while (i + 1 < lines.length && lines[i + 1] && !lines[i + 1].match(/^\S+\(\d+,\d+\):/)) {
        i++;
        message += ' ' + lines[i].trim();
      }
      
      diagnostics.push({
        file: match[1].trim(),
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        code: match[4],
        message: message.trim()
      });
    }
  }
  
  return diagnostics;
}

function isPlatformHostFile(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return PLATFORM_HOST_FILES.some(f => normalizedPath.includes(f));
}

function formatDiagnostic(d: Diagnostic): string {
  return `  ${d.file}(${d.line},${d.column}): ${d.code} - ${d.message}`;
}

function main() {
  console.log('🔒 Platform Host — No-New-Debt TypeScript Gate\n');
  console.log(`Baseline checkpoint: 72cdb007`);
  console.log(`Baseline: Platform Host = ${BASELINE_COUNT}\n`);
  
  // Run TypeScript compiler
  let output: string;
  try {
    output = execSync('npx tsc --project tsconfig.education.json --noEmit 2>&1', {
      encoding: 'utf-8'
    });
  } catch (error: any) {
    output = error.stdout || '';
  }
  
  const allDiagnostics = parseDiagnostics(output);
  const platformHostDiagnostics = allDiagnostics.filter(d => isPlatformHostFile(d.file));
  const otherDiagnostics = allDiagnostics.filter(d => !isPlatformHostFile(d.file));
  
  const platformHostCount = platformHostDiagnostics.length;
  const totalCount = allDiagnostics.length;
  
  console.log('📊 Current State:');
  console.log(`   Total diagnostics: ${totalCount}`);
  console.log(`   ├─ Platform Host: ${platformHostCount} (baseline: ${BASELINE_COUNT})`);
  console.log(`   └─ Others: ${otherDiagnostics.length} (not enforced by this gate)\n`);
  
  // Check for violations
  if (platformHostCount > BASELINE_COUNT) {
    console.log('❌ GATE FAILED\n');
    console.log(`   Platform Host diagnostics increased from ${BASELINE_COUNT} to ${platformHostCount}\n`);
    console.log('   New diagnostics in Platform Host files:');
    platformHostDiagnostics.forEach(d => console.log(formatDiagnostic(d)));
    console.log('\n💡 Action Required:');
    console.log('   - Fix new Platform Host diagnostics');
    console.log('   - Do NOT commit code that increases Platform Host debt');
    console.log('   - Platform Host is shared infrastructure used by all products\n');
    process.exit(1);
  } else {
    console.log('✅ GATE PASSED\n');
    console.log('   Platform Host diagnostics remain at 0 🔒');
    console.log('   Shared infrastructure remains type-safe');
    console.log('   No new TypeScript debt introduced\n');
    
    if (otherDiagnostics.length > 0) {
      console.log(`💡 Note: ${otherDiagnostics.length} diagnostics exist in other scopes (tracked separately)\n`);
    }
    
    process.exit(0);
  }
}

main();
