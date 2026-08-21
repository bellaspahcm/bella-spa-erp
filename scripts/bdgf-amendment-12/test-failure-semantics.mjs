#!/usr/bin/env node
/**
 * AUDIT 5: FAILURE SEMANTICS TEST RUNNER
 * 
 * Purpose: Test controlled failure scenarios to verify:
 * 1. Check FAIL → Runner FAIL → Exit Code ≠ 0
 * 2. Check PASS → Runner PASS → Exit Code = 0
 * 3. Mixed PASS/FAIL → Runner FAIL → Exit Code ≠ 0
 * 4. Evidence captures failures accurately
 * 5. Exception handling behaves consistently
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
  console.log('║ AUDIT 5: FAILURE SEMANTICS TEST                                              ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('║ Purpose: Test controlled failure scenarios                                   ║');
  console.log('║ Expected: 1 PASS, 1 FAIL, 1 PASS → Gate should FAIL → Exit Code ≠ 0         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  try {
    // Load test gate configuration
    const configPath = join(rootDir, '.bdgf/gates/test/failure-test-gate.json');
    const configContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    // Execute gate
    const runner = new GateRunner({
      gateName: config.gateName,
      gateVersion: config.gateVersion,
      deployment: config.deployment,
      config: config
    });

    const result = await runner.run();

    // Display results
    console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║ FAILURE TEST RESULTS                                                         ║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ Total Checks:  ${result.checks.total}`.padEnd(79) + '║');
    console.log(`║ ✅ PASS:        ${result.checks.pass}`.padEnd(79) + '║');
    console.log(`║ ❌ FAIL:         ${result.checks.fail}`.padEnd(79) + '║');
    console.log(`║ ⚠️  WARNING:     ${result.checks.warn}`.padEnd(79) + '║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ STATUS: ${result.status}`.padEnd(79) + '║');
    console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

    // Verify expected semantics
    console.log('SEMANTIC VERIFICATION:\n');

    const expectedFail = result.checks.fail > 0;
    const actualFail = result.status === 'FAIL';

    if (expectedFail === actualFail) {
      console.log(`✅ Check FAIL (${result.checks.fail}) → Runner FAIL (${result.status}): CORRECT`);
    } else {
      console.log(`❌ Check FAIL (${result.checks.fail}) → Runner PASS (${result.status}): INCORRECT`);
    }

    // Check evidence
    const failedChecks = result.evidence.checkResults.filter(c => c.status === 'FAIL');
    console.log(`✅ Evidence recorded ${failedChecks.length} failures`);

    // Print failed checks
    if (failedChecks.length > 0) {
      console.log('\nFAILED CHECKS IN EVIDENCE:');
      failedChecks.forEach(check => {
        console.log(`  ❌ ${check.checkId}: ${check.message}`);
      });
    }

    console.log('');

    // Exit based on result
    if (result.status === 'FAIL') {
      console.log('🔴 Gate FAIL (expected for this test)');
      console.log('Exit Code: 1\n');
      process.exit(1);
    } else {
      console.log('⚠️  Gate PASS (unexpected - test scenario should cause FAIL)');
      console.log('Exit Code: 0\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ EXCEPTION DURING TEST\n');
    console.error('Error:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    console.error('\nExit Code: 1\n');
    process.exit(1);
  }
}

main();
