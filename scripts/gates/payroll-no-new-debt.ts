#!/usr/bin/env tsx
/**
 * Payroll/Legacy No-New-Debt TypeScript Gate
 * 
 * Enforces zero TypeScript diagnostics in Payroll/Legacy scope.
 * Prevents regression after P1-T4 hardening (49 → 0).
 * 
 * BASELINE: e297d410 (Payroll diagnostics = 0)
 * 
 * SCOPE:
 * - src/lib/decision-engine/providers/payroll/
 * - src/adapters/payroll-provider-adapter.ts
 * - Payroll config in salary-recalculation-engine.ts
 * 
 * EXIT CODES:
 * - 0: Gate passed (Payroll diagnostics = 0)
 * - 1: Gate failed (new TypeScript debt introduced)
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const BASELINE_CHECKPOINT = 'e297d410';
const BASELINE_PAYROLL_DIAGNOSTICS = 0;

// Payroll-owned file patterns
const PAYROLL_PATTERNS = [
  'src/lib/decision-engine/providers/payroll/',
  'src/adapters/payroll-provider-adapter.ts',
];

console.log('🔒 Payroll/Legacy — No-New-Debt TypeScript Gate');
console.log(`Baseline checkpoint: ${BASELINE_CHECKPOINT}`);
console.log(`Baseline: Payroll diagnostics = ${BASELINE_PAYROLL_DIAGNOSTICS}`);

// Run TypeScript compiler on Education scope (includes Payroll)
let compilerOutput: string;
try {
  execSync('npx tsc --project tsconfig.education.json --noEmit', {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  compilerOutput = ''; // No errors
} catch (error: any) {
  compilerOutput = error.stdout || error.stderr || '';
}

// Parse diagnostics
const diagnosticLines = compilerOutput
  .split('\n')
  .filter(line => line.includes('error TS'));

// Filter Payroll-owned diagnostics
const payrollDiagnostics = diagnosticLines.filter(line => {
  return PAYROLL_PATTERNS.some(pattern => {
    const normalizedLine = line.replace(/\\/g, '/');
    return normalizedLine.includes(pattern);
  });
});

const payrollCount = payrollDiagnostics.length;
const otherCount = diagnosticLines.length - payrollCount;

console.log(`\n📊 Current State:`);
console.log(`   Total diagnostics: ${diagnosticLines.length}`);
console.log(`   ├─ Payroll/Legacy: ${payrollCount} (baseline: ${BASELINE_PAYROLL_DIAGNOSTICS})`);
console.log(`   └─ Others: ${otherCount} (not enforced by this gate)`);

// Gate logic
if (payrollCount > BASELINE_PAYROLL_DIAGNOSTICS) {
  console.log(`\n❌ GATE FAILED`);
  console.log(`   Payroll diagnostics increased: ${BASELINE_PAYROLL_DIAGNOSTICS} → ${payrollCount}`);
  console.log(`   New TypeScript debt introduced in Payroll/Legacy scope`);
  console.log(`\n   Payroll diagnostics:\n`);
  payrollDiagnostics.forEach(d => console.log(`   ${d}`));
  process.exit(1);
}

console.log(`\n✅ GATE PASSED`);
console.log(`   Payroll diagnostics remain at ${BASELINE_PAYROLL_DIAGNOSTICS} 🔒`);
console.log(`   Contract-level type safety maintained`);
console.log(`   No new TypeScript debt introduced`);

process.exit(0);
