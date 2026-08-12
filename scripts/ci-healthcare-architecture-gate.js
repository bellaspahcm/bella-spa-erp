#!/usr/bin/env node
/**
 * Healthcare OS — Self-Defending Architecture CI Gate
 *
 * Runs 4-Layer Architecture Enforcement:
 * - Layer 1: Static Architecture Gate (Law 1 Boundary Isolation & Law 11 Zero `any` Types)
 * - Layer 2: Structural Compliance Gate (11-Step Pattern with Exemption Declarations)
 * - Layer 3: Behavioral Invariants Gate (Concurrency & Event-After-Persistence execution)
 * - Layer 4: 384 H1 Guardian Regression Test Suite
 *
 * Usage:
 *   node scripts/ci-healthcare-architecture-gate.js
 *   node scripts/ci-healthcare-architecture-gate.js --test-self-defending
 *
 * @module scripts/ci-healthcare-architecture-gate
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const IS_SELF_DEFENDING_TEST = process.argv.includes('--test-self-defending');
const TEMP_VIOLATION_FILE = path.resolve(__dirname, '../src/platform/healthcare/engines/admission-engine/temp-violation.ts');

function logHeader(text) {
  console.log('\n' + '═'.repeat(80));
  console.log(` 🛡️  ${text}`);
  console.log('═'.repeat(80));
}

function logStep(stepNum, title) {
  console.log(`\n▶ [TẦNG ${stepNum}] ${title}`);
  console.log('─'.repeat(80));
}

function runCommand(command, description) {
  try {
    console.log(`  🚀 Executing: ${command}`);
    execSync(command, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    console.log(`  ✅ ${description}: PASS`);
    return true;
  } catch (error) {
    console.error(`  ❌ ${description}: FAILED (Exit Code ${error.status || 1})`);
    return false;
  }
}

function runGatePipeline() {
  logHeader('HEALTHCARE OS ARCHITECTURE CI GATE PIPELINE');

  // Layer 1 & 2: Static & Structural Compliance
  logStep('1 & 2', 'Static Architecture (Law 1 & Law 11) & Structural Compliance');
  const staticPass = runCommand(
    'npx jest src/platform/healthcare/__tests__/engine-architecture-compliance.test.ts --silent',
    'Static & Structural Architecture Gate'
  );
  if (!staticPass) return false;

  // Layer 1b: Meta-Platform Boundary Protection
  logStep('1b', 'Meta-Platform Boundary & Decoupled Domain Isolation');
  const boundaryPass = runCommand(
    'npx jest src/platform/__tests__/architecture-boundary.test.ts --silent',
    'Meta-Platform Boundary Gate'
  );
  if (!boundaryPass) return false;

  // Layer 3: Behavioral Invariants Execution
  logStep('3', 'Behavioral Invariants Execution (Concurrency & Event-After-Persistence)');
  const behaviorPass = runCommand(
    'npx jest src/platform/healthcare/engines/bed-engine/__tests__/bed-concurrency.integration.test.ts src/platform/healthcare/engines/pharmacy-engine/events/__tests__/order-approved-subscriber.integration.test.ts --silent',
    'Behavioral Invariants Execution Gate'
  );
  if (!behaviorPass) return false;

  // Layer 4: 384 H1 Guardian Regression Test Suite
  logStep('4', '384 H1 Guardian Full Platform Regression Test Suite');
  const guardianPass = runCommand(
    'npx jest src/platform/healthcare/ src/platform/education/domain/__tests__/ src/platform/education/__tests__/ --runInBand --silent',
    '384 H1 Guardian Regression Gate'
  );
  if (!guardianPass) return false;

  logHeader('ALL 4 ARCHITECTURE GATE LAYERS PASSED — MERGE APPROVED (EXIT 0)');
  return true;
}

function runSelfDefendingTest() {
  logHeader('SELF-DEFENDING CI GATE AUTOMATED VERIFICATION PROCEDURE');

  console.log('Phase 1: Baseline Architecture Check...');
  const baselineResult = runGatePipeline();
  if (!baselineResult) {
    console.error('❌ Baseline gate run failed! Fix current violations before testing self-defending mode.');
    process.exit(1);
  }
  console.log('✅ Baseline Check: PASS (Exit 0)');

  console.log('\nPhase 2: Injecting Simulated `: any` Violation (Law 11)...');
  try {
    fs.writeFileSync(TEMP_VIOLATION_FILE, 'export const badVariable: any = "violation";\n');
    console.log(`  Created temporary violation file: ${TEMP_VIOLATION_FILE}`);

    const anyPass = runCommand(
      'npx jest src/platform/healthcare/__tests__/engine-architecture-compliance.test.ts --silent',
      'Simulated Law 11 Violation Gate Check'
    );

    if (anyPass) {
      console.error('❌ CRITICAL SECURITY FAILURE: Gate ALLOWED simulated `: any` violation!');
      fs.unlinkSync(TEMP_VIOLATION_FILE);
      process.exit(1);
    }
    console.log('✅ Simulated `: any` Injection: SUCCESSFULLY BLOCKED (Exit 1)');
  } finally {
    if (fs.existsSync(TEMP_VIOLATION_FILE)) fs.unlinkSync(TEMP_VIOLATION_FILE);
  }

  console.log('\nPhase 3: Injecting Simulated Cross-Domain Import Violation (Law 1)...');
  try {
    fs.writeFileSync(
      TEMP_VIOLATION_FILE,
      'import { Bed } from "../bed-engine/domain/bed.entity";\nexport const x = 1;\n'
    );
    console.log(`  Created temporary cross-domain import violation file: ${TEMP_VIOLATION_FILE}`);

    const importPass = runCommand(
      'npx jest src/platform/healthcare/__tests__/engine-architecture-compliance.test.ts --silent',
      'Simulated Law 1 Violation Gate Check'
    );

    if (importPass) {
      console.error('❌ CRITICAL SECURITY FAILURE: Gate ALLOWED simulated cross-domain import violation!');
      fs.unlinkSync(TEMP_VIOLATION_FILE);
      process.exit(1);
    }
    console.log('✅ Simulated Cross-Domain Import Injection: SUCCESSFULLY BLOCKED (Exit 1)');
  } finally {
    if (fs.existsSync(TEMP_VIOLATION_FILE)) fs.unlinkSync(TEMP_VIOLATION_FILE);
  }

  console.log('\nPhase 4: Restoring Baseline & Final Verification...');
  const finalResult = runGatePipeline();
  if (!finalResult) {
    console.error('❌ Final restoration check failed!');
    process.exit(1);
  }

  logHeader('SELF-DEFENDING CI GATE VERIFICATION SUCCESSFUL (100% SELF-DEFENDING CONFIRMED)');
  process.exit(0);
}

// Execution Entry Point
if (IS_SELF_DEFENDING_TEST) {
  runSelfDefendingTest();
} else {
  const success = runGatePipeline();
  process.exit(success ? 0 : 1);
}
