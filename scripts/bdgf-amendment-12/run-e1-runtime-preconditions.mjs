#!/usr/bin/env node
/**
 * BDGF E1 Gate Runner - Amendment 12 v3
 * 
 * Thin adapter for E1 Runtime Preconditions gate execution.
 * 
 * Purpose: Execute E1 gate using BDGF infrastructure
 * Amendment: Amendment 12 v3
 * Migration: 05-A/B/C Identity Reconciliation
 * Mode: READ-ONLY (0 mutations)
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
  console.log('║ BDGF E1 GATE: DATABASE STATE VERIFICATION (Runtime Preconditions)           ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('║ Framework: BDGF v1.0                                                         ║');
  console.log('║ Amendment: Amendment 12 v3                                                   ║');
  console.log('║ Migration: 05-A/B/C Identity Reconciliation                                  ║');
  console.log('║ Purpose:   Verify runtime preconditions before 05-A execution                ║');
  console.log('║ Mode:      READ-ONLY (0 mutations)                                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  try {
    // Load BDGF gate configuration
    const configPath = join(rootDir, '.bdgf/gates/amendment-12/e1-runtime-preconditions.json');
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
    console.log('║ E1 GATE VERIFICATION RESULTS                                                 ║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ Total Checks:  ${result.checks.total}`.padEnd(79) + '║');
    console.log(`║ ✅ PASS:        ${result.checks.pass}`.padEnd(79) + '║');
    console.log(`║ ❌ FAIL:         ${result.checks.fail}`.padEnd(79) + '║');
    console.log(`║ ⚠️  WARNING:     ${result.checks.warn}`.padEnd(79) + '║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');

    if (result.status === 'FAIL') {
      console.log('║ STATUS: ❌ FAIL                                                               ║');
      console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');
      console.log('❌ E1 GATE: FAIL\n');
      console.log('RESOLUTION REQUIRED:');
      console.log('- Review failed checks in evidence output');
      console.log('- Fix runtime precondition violations');
      console.log('- Re-run E1 verification after fixes\n');
      console.log('🔴 DO NOT proceed to Human GO until E1 passes\n');
      process.exit(1);
    } else if (result.checks.warn > 0) {
      console.log('║ STATUS: ⚠️  PASS WITH WARNINGS                                                ║');
      console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');
      console.log('⚠️  E1 GATE: PASS WITH WARNINGS\n');
      console.log('Review warnings in evidence output before Human GO decision.\n');
      console.log('NEXT STEP: Human GO decision for Migration 05-A execution\n');
      console.log('⚠️  Warnings do not block execution, but review recommended\n');
      process.exit(0);
    } else {
      console.log('║ STATUS: ✅ PASS                                                               ║');
      console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');
      console.log('✅ E1 GATE: PASS\n');
      console.log('All runtime preconditions verified:');
      console.log('  ✅ 5/5 fixtures present');
      console.log('  ✅ RLS state acceptable');
      console.log('  ✅ No previous migration execution');
      console.log('  ✅ 2/2 orphans detected');
      console.log('  ✅ tenant_id = TEXT (pre-05-C state)');
      console.log('  ✅ No FK constraints');
      console.log('  ✅ public.tenants exists (canonical authority)');
      console.log('  ✅ Database privileges sufficient\n');
      console.log('NEXT STEP: Human GO decision for Migration 05-A execution\n');
      console.log('⚠️  REMINDER: Human approval required before executing 05-A\n');
      console.log('Database mutations: 0 (E1 is READ-ONLY verification)\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ E1 GATE: EXCEPTION\n');
    console.error('Error during BDGF gate execution:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    console.error('\n🔴 STOP. Gate execution failed.\n');
    process.exit(1);
  }
}

main();
