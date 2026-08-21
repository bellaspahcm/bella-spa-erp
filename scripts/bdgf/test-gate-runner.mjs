/**
 * BDGF Gate Runner Test
 * 
 * Simple test to verify Gate Runner + Check Registry + Evidence Collector integration.
 * This is NOT a complete test suite, just a smoke test to verify foundation works.
 */

import { GateRunner, printGateSummary } from './gate-runner.mjs';

// Test gate configuration
const testGateConfig = {
  gateName: 'test-gate',
  gateVersion: '1.0',
  deployment: 'test-deployment',
  minChecks: 3,
  checks: [
    {
      id: 'check-001',
      name: 'Test File Existence',
      type: 'file-existence',
      config: {
        files: [
          'scripts/bdgf/gate-runner.mjs',
          'scripts/bdgf/check-registry.mjs',
          'scripts/bdgf/evidence-collector.mjs'
        ]
      }
    },
    {
      id: 'check-002',
      name: 'Test Regex Match',
      type: 'regex-match',
      config: {
        target: 'scripts/bdgf/gate-*.mjs',
        pattern: 'export class',
        failOn: 'not-found'
      }
    },
    {
      id: 'check-003',
      name: 'Test Negative Match',
      type: 'negative-match',
      config: {
        target: 'scripts/bdgf/*.mjs',
        antipattern: 'eval\\(',
        failOn: 'found'
      }
    }
  ]
};

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║ BDGF GATE RUNNER TEST                                    ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

console.log('Testing Gate Runner foundation...\n');

try {
  // Create gate runner
  const gate = new GateRunner({
    gateName: testGateConfig.gateName,
    gateVersion: testGateConfig.gateVersion,
    deployment: testGateConfig.deployment,
    config: testGateConfig
  });

  console.log('✓ Gate Runner instantiated');

  // Validate configuration
  const validation = gate.validate();
  if (!validation.valid) {
    console.error('✗ Validation failed:', validation.errors);
    process.exit(1);
  }
  console.log('✓ Configuration validated');
  console.log('');

  // Run gate
  const result = await gate.run();

  // Print summary
  printGateSummary(result);

  // Check result
  if (result.status === 'PASS') {
    console.log('✅ Gate Runner Test: PASS');
    console.log('');
    console.log('Foundation Components Verified:');
    console.log('  ✓ Gate Contract');
    console.log('  ✓ Evidence Collector');
    console.log('  ✓ Check Registry');
    console.log('  ✓ Gate Runner');
    console.log('');
    console.log(`Evidence archived to: ${result.evidence.artifacts.evidenceFile}`);
    process.exit(0);
  } else {
    console.log('❌ Gate Runner Test: FAIL');
    console.log('');
    console.log('Check the evidence file for details:');
    console.log(`  ${result.evidence.artifacts.evidenceFile}`);
    process.exit(1);
  }

} catch (error) {
  console.error('❌ Gate Runner Test: ERROR');
  console.error('');
  console.error(error.message);
  console.error(error.stack);
  process.exit(1);
}
