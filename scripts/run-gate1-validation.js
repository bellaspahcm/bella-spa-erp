#!/usr/bin/env node
/**
 * Gate 1 Validation Script
 * Tests 6 scenarios for Decision Engine functional validation
 */

const baseUrl = process.env.PRODUCTION_URL || 'https://bella-spa-erp.vercel.app';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const scenarios = [
  {
    id: '1.1',
    name: 'Leave Approval - Success Path',
    requestId: 'req-gate1-success',
    expectedApproved: true,
    expectedConfidence: 0.8,
    checks: [
      'HTTP 200 response',
      'approved: true',
      'decisionId returned',
      'confidence > 0.8',
      'executionTimeMs < 500ms'
    ]
  },
  {
    id: '1.2',
    name: 'Leave Rejection - Business Rule',
    requestId: 'req-gate1-reject',
    expectedApproved: false,
    expectedReason: 'balance',
    checks: [
      'HTTP 200 response',
      'approved: false',
      'Rejection reason mentions balance',
      'confidence >= 0.8'
    ]
  }
];

async function runScenario(scenario) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 Scenario ${scenario.id}: ${scenario.name}`);
  console.log(`${'='.repeat(80)}`);

  try {
    const url = `${baseUrl}/api/leave-requests/${scenario.requestId}/decide-test`;
    console.log(`📡 POST ${url}`);

    const body = {
      approverId: '23a9da64-a8c6-4250-8268-37c965e70fd7', // Gate1 Test Manager
      approverRole: 'manager',
      tenantId: '26c2d467-7c12-4e77-bb67-0e9e43fd7594' // Bella Test
    };

    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify(body)
    });
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    console.log(`⏱️  Response time: ${responseTime}ms`);

    if (!response.ok) {
      console.error(`❌ HTTP ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Response: ${errorText.substring(0, 500)}`);
      return { passed: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    console.log(`\n📋 Response:`);
    console.log(JSON.stringify(data, null, 2));

    // Validate checks
    const results = [];
    
    // Check 1: HTTP 200
    results.push({
      check: 'HTTP 200 response',
      passed: response.status === 200,
      value: response.status
    });

    // Check 2: approved field
    results.push({
      check: `approved: ${scenario.expectedApproved}`,
      passed: data.approved === scenario.expectedApproved,
      value: data.approved
    });

    // Check 3: decisionId returned
    results.push({
      check: 'decisionId returned',
      passed: !!data.decisionId,
      value: data.decisionId || 'MISSING'
    });

    // Check 4: confidence
    if (scenario.expectedConfidence) {
      results.push({
        check: `confidence >= ${scenario.expectedConfidence}`,
        passed: (data.metadata?.confidence || 0) >= scenario.expectedConfidence,
        value: data.metadata?.confidence || 'MISSING'
      });
    }

    // Check 5: execution time
    if (data.metadata?.executionTimeMs) {
      results.push({
        check: 'executionTimeMs < 500ms',
        passed: data.metadata.executionTimeMs < 500,
        value: `${data.metadata.executionTimeMs}ms`
      });
    }

    // Check 6: rejection reason (for rejection scenarios)
    if (scenario.expectedReason) {
      const reasonLower = (data.reason || '').toLowerCase();
      results.push({
        check: `Rejection reason mentions "${scenario.expectedReason}"`,
        passed: reasonLower.includes(scenario.expectedReason),
        value: data.reason || 'MISSING'
      });
    }

    console.log(`\n✅ Validation Results:`);
    results.forEach(r => {
      const icon = r.passed ? '✅' : '❌';
      console.log(`${icon} ${r.check}: ${r.value}`);
    });

    const allPassed = results.every(r => r.passed);
    console.log(`\n${allPassed ? '✅ PASSED' : '❌ FAILED'}`);

    return { 
      passed: allPassed, 
      results,
      decisionId: data.decisionId,
      responseTime
    };

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return { passed: false, error: error.message };
  }
}

async function runGate1() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║                    🚀 Gate 1 Functional Validation                        ║
║                    Decision Engine - Sprint 1                             ║
╚═══════════════════════════════════════════════════════════════════════════╝
  `);

  console.log(`🌐 Base URL: ${baseUrl}`);
  console.log(`📅 Started: ${new Date().toISOString()}`);

  const results = [];

  // Run scenarios sequentially
  for (const scenario of scenarios) {
    const result = await runScenario(scenario);
    results.push({ scenario, result });
    
    // Wait 1 second between scenarios
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 Gate 1 Summary`);
  console.log(`${'='.repeat(80)}`);

  const passed = results.filter(r => r.result.passed).length;
  const total = results.length;

  results.forEach(({ scenario, result }) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} Scenario ${scenario.id}: ${scenario.name}`);
  });

  console.log(`\n${passed}/${total} scenarios passed`);

  if (passed === total) {
    console.log(`\n✅ GATE 1 PASSED - Ready for Gate 2 (Failure Injection)`);
    process.exit(0);
  } else {
    console.log(`\n❌ GATE 1 FAILED - Fix issues and re-run`);
    process.exit(1);
  }
}

// Run
runGate1().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
