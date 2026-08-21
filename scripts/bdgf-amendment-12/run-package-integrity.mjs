#!/usr/bin/env node
/**
 * BDGF AMENDMENT 12 V3 — PACKAGE INTEGRITY VERIFICATION
 * 
 * Purpose: Execute Amendment 12 Package Integrity gate using BDGF infrastructure
 * 
 * This is a config-driven implementation that replaces the legacy 420-line gate script.
 * All 52 checks are defined in .bdgf/gates/amendment-12/package-integrity.json
 * 
 * G3a Layer 2.1: Migration from legacy to BDGF
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GateRunner } from '../bdgf/gate-runner.mjs';
import { readFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../..');

async function main() {
  try {
    // Load BDGF gate configuration
    const configPath = join(rootDir, '.bdgf/gates/amendment-12/package-integrity.json');
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

    // Print formatted results (match legacy output style)
    console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║ AMENDMENT 12 V3 — PACKAGE INTEGRITY VERIFICATION (BDGF)                     ║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
    console.log('║ Purpose: Verify 5 mandatory conditions implemented before Package Review     ║');
    console.log('║ Status:  Approval 3 GRANTED (2026-08-19)                                     ║');
    console.log('║ Mode:    BDGF Config-Driven Execution                                        ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Print check results (already printed during execution by recordCheck)
    // Just print a separator
    
    // Print summary
    console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║ VERIFICATION RESULTS                                                         ║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ Total Checks: ${result.checks.total.toString().padStart(3)}                                                            ║`);
    console.log(`║ ✅ PASS:      ${result.checks.pass.toString().padStart(3)}                                                            ║`);
    console.log(`║ ❌ FAIL:      ${result.checks.fail.toString().padStart(3)}                                                            ║`);
    console.log(`║ ⏭️  SKIP:      ${(result.checks.warn || 0).toString().padStart(3)}                                                            ║`);
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');

    if (result.status === 'FAIL') {
      console.log('║ STATUS: ❌ FAIL                                                               ║');
      console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
      console.log('');
      console.log('FAILED CHECKS:');
      console.log('');
      
      const failedChecks = result.evidence.checkResults.filter(c => c.status === 'FAIL');
      for (const check of failedChecks) {
        console.log(`❌ ${check.evidence?.name || check.checkId}`);
        if (check.message) {
          console.log(`   ${check.message}`);
        }
        console.log('');
      }
      
      console.log('RESOLUTION REQUIRED:');
      console.log('- Review failed checks above');
      console.log('- Ensure all 5 mandatory conditions are implemented');
      console.log('- Re-run verification after fixes');
      console.log('');
      console.log('❌ DO NOT proceed to Package Review until all checks PASS');
      process.exit(1);
    } else {
      console.log('║ STATUS: ✅ PASS                                                               ║');
      console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
      console.log('');
      console.log('✅ PACKAGE INTEGRITY VERIFIED (BDGF)');
      console.log('');
      console.log('All 5 mandatory conditions implemented:');
      console.log('  ✅ #1: P4 metadata validation (created_at + provisioned_by)');
      console.log('  ✅ #2: Advisory lock explicit acquisition');
      console.log('  ✅ #3: Mapping immutability trigger');
      console.log('  ✅ #4: Transaction + lock + PK/UNIQUE + verification gates');
      console.log('  ✅ #5: Deletion audit columns');
      console.log('');
      console.log('Amendment 12 v3 design faithfully implemented.');
      console.log('');
      console.log('NEXT STEP: Package Review documentation');
      console.log('');
      console.log('⚠️  REMINDER: DO NOT execute migrations until:');
      console.log('   1. Package Review complete');
      console.log('   2. E0 gate execution');
      console.log('   3. E1 gate PASS');
      console.log('   4. Human approval for execution');
      process.exit(0);
    }
  } catch (error) {
    console.error('ERROR: Gate execution failed');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
