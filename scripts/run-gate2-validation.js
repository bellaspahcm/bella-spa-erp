/**
 * Gate 2: Failure Injection Testing - Unified Validation Script
 * 
 * Runs all 5 failure injection scenarios sequentially and produces
 * a comprehensive validation report.
 * 
 * Scenarios:
 * 1. Audit Database Down (circuit breaker, queue, non-blocking)
 * 2. Audit Insert Timeout (retry with backoff, <1s latency)
 * 3. Memory Queue Full (flood test, DLQ overflow, no memory leak)
 * 4. Network Partition (30s outage, recovery)
 * 5. Policy Execution Exception (graceful error, no crash)
 * 
 * Critical Assertion:
 * "Business decisions NEVER block on audit failures."
 * 
 * Usage:
 *   node scripts/run-gate2-validation.js
 * 
 * Output:
 *   - Console report with pass/fail for each scenario
 *   - JSON report saved to docs/decision-engine/GATE2_VALIDATION_REPORT.json
 *   - Markdown report saved to docs/decision-engine/GATE2_COMPLETION_REPORT.md
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Scenarios to run
const scenarios = [
  {
    id: '2.1',
    name: 'Audit Database Down',
    script: 'scripts/gate2-scenario-2.1-audit-db-down.js',
    description: 'Decisions succeed when audit DB is unavailable, circuit breaker opens, queue holds pending audits',
    critical: true,
  },
  {
    id: '2.2',
    name: 'Audit Insert Timeout',
    script: 'scripts/gate2-scenario-2.2-audit-timeout.js',
    description: 'Decisions complete in <1s despite slow audit inserts, retry with exponential backoff',
    critical: true,
  },
  {
    id: '2.3',
    name: 'Memory Queue Full',
    script: 'scripts/gate2-scenario-2.3-queue-full.js',
    description: 'System handles 2000+ rapid decisions without memory leak, DLQ overflow protection',
    critical: true,
  },
  {
    id: '2.4',
    name: 'Network Partition',
    script: 'scripts/gate2-scenario-2.4-network-partition.js',
    description: '30s network outage, circuit breaker recovery, queue drains after restore',
    critical: true,
  },
  {
    id: '2.5',
    name: 'Policy Execution Exception',
    script: 'scripts/gate2-scenario-2.5-policy-exception.js',
    description: 'Graceful error handling (HTTP 200), audit error logged, service stable',
    critical: true,
  },
];

/**
 * Run single scenario
 */
function runScenario(scenario) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Running Scenario ${scenario.id}: ${scenario.name}`);
    console.log(`${'='.repeat(80)}\n`);

    const startTime = Date.now();
    const logs = [];

    const child = spawn('node', [scenario.script], {
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (data) => {
      const text = data.toString();
      process.stdout.write(text);
      logs.push(text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      process.stderr.write(text);
      logs.push(text);
    });

    child.on('close', (code) => {
      const elapsed = Date.now() - startTime;
      const passed = code === 0;

      const result = {
        id: scenario.id,
        name: scenario.name,
        description: scenario.description,
        critical: scenario.critical,
        passed,
        exitCode: code,
        elapsed,
        logs: logs.join(''),
      };

      console.log(`\n${'='.repeat(80)}`);
      console.log(`Scenario ${scenario.id}: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`Exit Code: ${code}`);
      console.log(`Duration: ${elapsed}ms`);
      console.log(`${'='.repeat(80)}\n`);

      resolve(result);
    });

    child.on('error', (error) => {
      console.error(`Failed to start scenario ${scenario.id}:`, error);
      resolve({
        id: scenario.id,
        name: scenario.name,
        description: scenario.description,
        critical: scenario.critical,
        passed: false,
        exitCode: -1,
        elapsed: Date.now() - startTime,
        error: error.message,
        logs: logs.join(''),
      });
    });
  });
}

/**
 * Generate JSON report
 */
function generateJsonReport(results) {
  const report = {
    gate: 'Gate 2: Failure Injection Testing',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    summary: {
      totalScenarios: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      criticalPassed: results.filter(r => r.critical && r.passed).length,
      criticalFailed: results.filter(r => r.critical && !r.passed).length,
      overallPass: results.every(r => r.passed),
      totalDuration: results.reduce((sum, r) => sum + r.elapsed, 0),
    },
    scenarios: results.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      critical: r.critical,
      passed: r.passed,
      exitCode: r.exitCode,
      duration: r.elapsed,
      error: r.error || null,
    })),
    assertion: 'Business decisions NEVER block on audit failures',
    assertionVerified: results.every(r => r.passed),
  };

  const reportPath = path.join(__dirname, '..', 'docs', 'decision-engine', 'GATE2_VALIDATION_REPORT.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n📄 JSON report saved: ${reportPath}`);
  return report;
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(results, jsonReport) {
  const overallStatus = jsonReport.summary.overallPass ? '✅ PASSED' : '❌ FAILED';
  const timestamp = new Date().toLocaleString();

  const markdown = `# Gate 2: Failure Injection Testing - Validation Report

**Status:** ${overallStatus}  
**Date:** ${timestamp}  
**Environment:** ${jsonReport.environment}  
**Total Duration:** ${(jsonReport.summary.totalDuration / 1000).toFixed(1)}s

---

## Executive Summary

Gate 2 validates Decision Engine resilience under failure conditions. The critical assertion is:

> **"Business decisions NEVER block on audit failures."**

**Assertion Verified:** ${jsonReport.assertionVerified ? '✅ YES' : '❌ NO'}

### Results Overview

| Metric | Count |
|--------|-------|
| Total Scenarios | ${jsonReport.summary.totalScenarios} |
| Passed | ${jsonReport.summary.passed} |
| Failed | ${jsonReport.summary.failed} |
| Critical Passed | ${jsonReport.summary.criticalPassed} |
| Critical Failed | ${jsonReport.summary.criticalFailed} |

---

## Scenario Results

${results.map(r => `### Scenario ${r.id}: ${r.name}

**Status:** ${r.passed ? '✅ PASSED' : '❌ FAILED'}  
**Critical:** ${r.critical ? 'Yes' : 'No'}  
**Duration:** ${(r.elapsed / 1000).toFixed(1)}s  
**Exit Code:** ${r.exitCode}

**Description:**  
${r.description}

${r.error ? `**Error:**  
\`\`\`
${r.error}
\`\`\`
` : ''}

---
`).join('\n')}

## Resilience Features Validated

| Feature | Scenario | Status |
|---------|----------|--------|
| Circuit Breaker | 2.1, 2.4 | ${results.find(r => r.id === '2.1')?.passed && results.find(r => r.id === '2.4')?.passed ? '✅' : '❌'} |
| Retry Queue | 2.1, 2.2 | ${results.find(r => r.id === '2.1')?.passed && results.find(r => r.id === '2.2')?.passed ? '✅' : '❌'} |
| Exponential Backoff | 2.2 | ${results.find(r => r.id === '2.2')?.passed ? '✅' : '❌'} |
| Dead Letter Queue | 2.3 | ${results.find(r => r.id === '2.3')?.passed ? '✅' : '❌'} |
| Non-Blocking Decisions | All | ${results.every(r => r.passed) ? '✅' : '❌'} |
| Graceful Error Handling | 2.5 | ${results.find(r => r.id === '2.5')?.passed ? '✅' : '❌'} |
| Memory Stability | 2.3 | ${results.find(r => r.id === '2.3')?.passed ? '✅' : '❌'} |
| Service Recovery | 2.4, 2.5 | ${results.find(r => r.id === '2.4')?.passed && results.find(r => r.id === '2.5')?.passed ? '✅' : '❌'} |

---

## Recommendations

${jsonReport.summary.overallPass ? `
✅ **Gate 2 PASSED** - Decision Engine is production-ready for Phase C (Data Collection).

### Next Steps:
1. Deploy to production
2. Monitor health endpoint for 24-48 hours
3. Collect 500-1000 real decisions
4. Proceed to Gate 3 (Operational Stability)
5. Proceed to Gate 4 (Data Quality)
` : `
❌ **Gate 2 FAILED** - Decision Engine requires fixes before production deployment.

### Action Items:
${results.filter(r => !r.passed).map(r => `- Fix Scenario ${r.id}: ${r.name}`).join('\n')}

### Resolution Process:
1. Analyze failure logs
2. Implement fixes
3. Re-run Gate 2 validation
4. Only proceed to production after all scenarios pass
`}

---

## Appendix: Technical Details

### Circuit Breaker Configuration
- Failure Threshold: 5 consecutive failures
- Timeout: 10 seconds (before attempting recovery)
- Success Threshold: 2 consecutive successes (to close circuit)

### Retry Queue Configuration
- Max Attempts: 3 per item
- Base Delay: 100ms
- Max Delay: 5000ms
- Backoff Strategy: Exponential (2x multiplier)

### Dead Letter Queue Configuration
- Max Size: 1000 items
- Eviction Policy: FIFO (oldest items dropped first)

### Performance Targets
- Decision Latency: <1s (even during audit failures)
- Throughput: >100 decisions/sec
- Memory Stability: <100MB heap growth under load

---

**Generated:** ${new Date().toISOString()}  
**Report Version:** 1.0.0  
**Decision Engine Version:** 1.0.0
`;

  const reportPath = path.join(__dirname, '..', 'docs', 'decision-engine', 'GATE2_COMPLETION_REPORT.md');
  fs.writeFileSync(reportPath, markdown);

  console.log(`📄 Markdown report saved: ${reportPath}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                   Gate 2: Failure Injection Testing                        ║');
  console.log('║                         Validation Suite                                   ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Critical Assertion: "Business decisions NEVER block on audit failures."');
  console.log('');
  console.log(`Running ${scenarios.length} scenarios...`);
  console.log('');

  const startTime = Date.now();
  const results = [];

  // Run scenarios sequentially
  for (const scenario of scenarios) {
    const result = await runScenario(scenario);
    results.push(result);

    // If critical scenario fails, stop
    if (scenario.critical && !result.passed) {
      console.error(`\n❌ CRITICAL SCENARIO FAILED: ${scenario.name}`);
      console.error('Stopping validation. Fix critical failures before continuing.\n');
      break;
    }
  }

  const totalElapsed = Date.now() - startTime;

  // Generate reports
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                         Validation Complete                                ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  const jsonReport = generateJsonReport(results);
  generateMarkdownReport(results, jsonReport);

  // Print summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                            GATE 2 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Status:           ${jsonReport.summary.overallPass ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Total Scenarios:  ${jsonReport.summary.totalScenarios}`);
  console.log(`Passed:           ${jsonReport.summary.passed}`);
  console.log(`Failed:           ${jsonReport.summary.failed}`);
  console.log(`Critical Passed:  ${jsonReport.summary.criticalPassed}`);
  console.log(`Critical Failed:  ${jsonReport.summary.criticalFailed}`);
  console.log(`Total Duration:   ${(totalElapsed / 1000).toFixed(1)}s`);
  console.log(`Assertion:        ${jsonReport.assertionVerified ? '✅ VERIFIED' : '❌ NOT VERIFIED'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (jsonReport.summary.overallPass) {
    console.log('🎉 Gate 2 PASSED - Decision Engine is production-ready!');
    console.log('');
    console.log('Next Steps:');
    console.log('1. Deploy to production');
    console.log('2. Monitor health endpoint for 24-48 hours');
    console.log('3. Collect 500-1000 real decisions (Phase C)');
    console.log('4. Proceed to Gate 3 (Operational Stability)');
    console.log('');
    process.exit(0);
  } else {
    console.error('❌ Gate 2 FAILED - Fix issues before production deployment');
    console.error('');
    console.error('Failed Scenarios:');
    results.filter(r => !r.passed).forEach(r => {
      console.error(`  - Scenario ${r.id}: ${r.name}`);
    });
    console.error('');
    console.error('See GATE2_COMPLETION_REPORT.md for detailed analysis.');
    console.error('');
    process.exit(1);
  }
}

// Run
main().catch(error => {
  console.error('Fatal error during Gate 2 validation:', error);
  process.exit(1);
});
