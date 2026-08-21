#!/usr/bin/env node
/**
 * BDGF E0 Gate Runner - Amendment 12 v3
 * 
 * Thin adapter for E0 Artifact Integrity gate execution.
 * 
 * Purpose: Execute E0 gate using BDGF infrastructure
 * Amendment: Amendment 12 v3
 * Migration: 05-A/B/C Identity Reconciliation
 * 
 * Exit Codes:
 *   0 = PASS (all checks pass)
 *   1 = FAIL (critical issue detected)
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GateRunner } from '../bdgf/gate-runner.mjs';
import { readFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../..');

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║ BDGF E0 GATE: ARTIFACT + ENVIRONMENT + PRECONDITION INTEGRITY               ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('║ Framework: BDGF v1.0                                                         ║');
  console.log('║ Amendment: Amendment 12 v3                                                   ║');
  console.log('║ Migration: 05-A/B/C Identity Reconciliation                                  ║');
  console.log('║ Purpose:   Verify package/database state before E1 execution                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  try {
    // Load BDGF gate configuration
    const configPath = join(rootDir, '.bdgf/gates/amendment-12/e0-artifact-integrity.json');
    const configContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    // Execute gate using BDGF infrastructure
    const runner = new GateRunner({
      gateName: config.gateName,
      gateVersion: config.gateVersion,
      deployment: config.deployment,
      config: config
    });

    const result = await runner.run();

    // Display results
    console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║ E0 GATE VERIFICATION RESULTS                                                 ║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ Total Checks:  ${result.checks.total}`.padEnd(79) + '║');
    console.log(`║ ✅ PASS:        ${result.checks.pass}`.padEnd(79) + '║');
    console.log(`║ ❌ FAIL:         ${result.checks.fail}`.padEnd(79) + '║');
    console.log(`║ ⚠️  WARNING:     ${result.checks.warn}`.padEnd(79) + '║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');

    if (result.status === 'FAIL') {
      console.log('║ STATUS: ❌ FAIL                                                               ║');
      console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');
      console.log('❌ E0 GATE: FAIL\n');
      console.log('RESOLUTION REQUIRED:');
      console.log('- Review failed checks in evidence output');
      console.log('- Fix precondition violations or package issues');
      console.log('- Re-run E0 verification after fixes\n');
      console.log('🔴 DO NOT proceed to E1 until E0 passes');
      console.log('🔴 DO NOT execute migrations\n');
      process.exit(1);
    } else if (result.checks.warn > 0) {
      console.log('║ STATUS: ⚠️  PASS WITH WARNINGS                                                ║');
      console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');
      console.log('⚠️  E0 GATE: PASS WITH WARNINGS\n');
      console.log('Review warnings in evidence output before proceeding to E1.\n');
      console.log('NEXT STEP: E1 gate execution');
      console.log('  node scripts/run-e1-verification.mjs\n');
      console.log('⚠️  E1 execution authorized, but review warnings first\n');
      process.exit(0);
    } else {
      console.log('║ STATUS: ✅ PASS                                                               ║');
      console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');
      console.log('✅ E0 GATE: PASS\n');
      console.log('All artifact, dependency, precondition, and gate integrity checks passed.\n');
      console.log('NEXT STEP: E1 gate execution');
      console.log('  node scripts/run-e1-verification.mjs\n');
      console.log('🟢 E1 execution authorized\n');
      console.log('⚠️  REMINDER: E1 PASS + Human GO required before migration execution\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ E0 GATE: EXCEPTION\n');
    console.error('Error during BDGF gate execution:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    console.error('\n🔴 STOP. Gate execution failed.\n');
    process.exit(1);
  }
}

main();
