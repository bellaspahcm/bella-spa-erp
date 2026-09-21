#!/usr/bin/env ts-node
/**
 * Education OS — No-New-Debt TypeScript Gate
 * 
 * Enforces Education-owned TypeScript diagnostics remain at 0.
 * Baseline exceptions (Payroll/Legacy + Platform Host) are allowed but monitored.
 * 
 * Baseline @ d6561a9b:
 * - Payroll/Legacy (payroll-provider.ts): 49 diagnostics
 * - Platform Host (person + rule-engine): 12 diagnostics
 * - Education-owned: 0 diagnostics 🔒
 * 
 * PASS: Education-owned = 0, baseline exceptions ≤ 61
 * FAIL: Any new diagnostics in Education-owned files
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface Diagnostic {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

interface ClassifiedDiagnostics {
  payrollLegacy: Diagnostic[];
  platformHost: Diagnostic[];
  educationOwned: Diagnostic[];
}

const BASELINE_EXCEPTIONS = {
  payrollLegacy: [
    'src/lib/decision-engine/providers/payroll/payroll-provider.ts'
  ],
  platformHost: [
    'src/platform/host/person/person.repository.ts',
    'src/platform/host/rule-engine/rule-engine.service.ts'
  ]
};

const BASELINE_COUNTS = {
  payrollLegacy: 49,
  platformHost: 12,
  educationOwned: 0,
  total: 61
};

function parseDiagnostics(output: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  // Replace Windows line endings and collapse wrapped lines
  const normalized = output.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match: file(line,col): error TSxxxx: message
    const match = line.match(/^([^(]+)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/);
    if (match) {
      let message = match[5];
      // Collect continuation lines that don't start with a file path
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

function classifyDiagnostics(diagnostics: Diagnostic[]): ClassifiedDiagnostics {
  const classified: ClassifiedDiagnostics = {
    payrollLegacy: [],
    platformHost: [],
    educationOwned: []
  };
  
  for (const diagnostic of diagnostics) {
    const normalizedPath = diagnostic.file.replace(/\\/g, '/');
    
    if (BASELINE_EXCEPTIONS.payrollLegacy.some(p => normalizedPath.includes(p))) {
      classified.payrollLegacy.push(diagnostic);
    } else if (BASELINE_EXCEPTIONS.platformHost.some(p => normalizedPath.includes(p))) {
      classified.platformHost.push(diagnostic);
    } else {
      classified.educationOwned.push(diagnostic);
    }
  }
  
  return classified;
}

function formatDiagnostic(d: Diagnostic): string {
  return `  ${d.file}(${d.line},${d.column}): ${d.code} - ${d.message}`;
}

function main() {
  console.log('🔒 Education OS — No-New-Debt TypeScript Gate\n');
  console.log(`Baseline checkpoint: d6561a9b`);
  console.log(`Baseline: Payroll ${BASELINE_COUNTS.payrollLegacy} + Platform Host ${BASELINE_COUNTS.platformHost} + Education-owned ${BASELINE_COUNTS.educationOwned} = ${BASELINE_COUNTS.total}\n`);
  
  // Run TypeScript compiler
  let output: string;
  try {
    output = execSync('npx tsc --project tsconfig.education.json --noEmit 2>&1', {
      encoding: 'utf-8'
    });
  } catch (error: any) {
    // TypeScript compiler exits with code 1 when there are errors
    // Combined stdout+stderr (via 2>&1) contains the diagnostic output
    output = error.stdout || '';
  }
  
  const diagnostics = parseDiagnostics(output);
  const classified = classifyDiagnostics(diagnostics);
  
  const total = diagnostics.length;
  const payrollCount = classified.payrollLegacy.length;
  const platformCount = classified.platformHost.length;
  const educationCount = classified.educationOwned.length;
  
  console.log('📊 Current State:');
  console.log(`   Total diagnostics: ${total}`);
  console.log(`   ├─ Payroll/Legacy: ${payrollCount} (baseline: ${BASELINE_COUNTS.payrollLegacy})`);
  console.log(`   ├─ Platform Host: ${platformCount} (baseline: ${BASELINE_COUNTS.platformHost})`);
  console.log(`   └─ Education-owned: ${educationCount} (baseline: ${BASELINE_COUNTS.educationOwned})\n`);
  
  // Check for violations
  let hasViolation = false;
  const violations: string[] = [];
  
  // Critical: Education-owned must be 0
  if (educationCount > BASELINE_COUNTS.educationOwned) {
    hasViolation = true;
    violations.push(`❌ CRITICAL: Education-owned diagnostics increased from ${BASELINE_COUNTS.educationOwned} to ${educationCount}`);
    violations.push('\n   New diagnostics in Education-owned files:');
    classified.educationOwned.forEach(d => {
      violations.push(formatDiagnostic(d));
    });
  }
  
  // Warning: Baseline exceptions increased
  if (payrollCount > BASELINE_COUNTS.payrollLegacy) {
    violations.push(`⚠️  WARNING: Payroll/Legacy diagnostics increased from ${BASELINE_COUNTS.payrollLegacy} to ${payrollCount}`);
  }
  
  if (platformCount > BASELINE_COUNTS.platformHost) {
    violations.push(`⚠️  WARNING: Platform Host diagnostics increased from ${BASELINE_COUNTS.platformHost} to ${platformCount}`);
  }
  
  // Report results
  if (hasViolation) {
    console.log('❌ GATE FAILED\n');
    violations.forEach(v => console.log(v));
    console.log('\n💡 Action Required:');
    console.log('   - Fix new Education-owned diagnostics');
    console.log('   - Do NOT commit code that increases Education debt');
    console.log('   - Review ownership if diagnostics appear in unexpected files\n');
    process.exit(1);
  } else if (violations.length > 0) {
    console.log('⚠️  GATE PASSED WITH WARNINGS\n');
    violations.forEach(v => console.log(v));
    console.log('\n💡 Note:');
    console.log('   - Baseline exception counts increased');
    console.log('   - This may indicate work needed in Payroll or Platform Host workstreams\n');
    process.exit(0);
  } else {
    console.log('✅ GATE PASSED\n');
    console.log('   Education-owned diagnostics remain at 0 🔒');
    console.log('   Baseline exceptions within limits');
    console.log('   No new TypeScript debt introduced\n');
    process.exit(0);
  }
}

main();
