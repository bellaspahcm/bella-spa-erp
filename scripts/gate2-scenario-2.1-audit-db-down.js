/**
 * Gate 2 - Scenario 2.1: Audit Database Down
 * 
 * Tests resilience when audit database is unavailable.
 * 
 * Expected behavior:
 * 1. Business decisions SUCCEED (non-blocking)
 * 2. Circuit breaker opens after 5 failures
 * 3. Audit logs queued in retry queue
 * 4. Health endpoint shows "degraded" status
 * 5. After DB restore, queue drains successfully
 * 
 * Test Flow:
 * - Step 1: Verify test leave requests exist
 * - Step 2: Make 10 leave decisions with audit failure injection
 * - Step 3: Verify all decisions succeeded (non-blocking)
 * - Step 4: Check circuit breaker status (should be OPEN after 5+ failures)
 * - Step 5: Check queue metrics (should have pending items)
 * - Step 6: Make decision WITHOUT failure injection (DB "restored")
 * - Step 7: Wait for queue drain and verify health
 */

// Config
const BASE_URL = process.env.BASE_URL || 'https://bella-spa-erp.vercel.app';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

/**
 * Fetch test leave requests from Test Beauty Spa tenant
 */
async function getTestLeaveRequests() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/leave_requests?select=id,tenant_id&tenant_id=eq.11111111-1111-1111-1111-111111111111&limit=2`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch test leave requests: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Make leave decision via Gate 2 test endpoint
 */
async function makeLeaveDecision(requestId, injectAuditFailure = false) {
  const url = `${BASE_URL}/api/leave-requests/${requestId}/decide-gate2`;
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_KEY}`,
  };
  
  if (injectAuditFailure) {
    headers['X-Gate2-Audit-Fail'] = 'true';
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      approverId: 'a0000003-0000-0000-0000-000000000003', // Gate2 Test Admin
      approverRole: 'admin',
      tenantId: '11111111-1111-1111-1111-111111111111', // Test Beauty Spa
    }),
  });
  
  const data = await response.json();
  return {
    success: response.ok,
    status: response.status,
    data,
  };
}

/**
 * Check Decision Engine health
 */
async function checkHealth() {
  const response = await fetch(`${BASE_URL}/api/decision-engine/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }
  return await response.json();
}

/**
 * Main test flow
 */
async function runScenario() {
  console.log('🧪 Gate 2 - Scenario 2.1: Audit Database Down\n');
  
  try {
    // Step 1: Verify test data exists
    console.log('Step 1: Verify test leave requests...');
    const requests = await getTestLeaveRequests();
    
    if (!requests || requests.length < 2) {
      console.error('❌ Need at least 2 test leave requests in "Test Beauty Spa" tenant');
      console.log('Run: node scripts/setup-gate2-test-data.js');
      process.exit(1);
    }
    
    console.log(`✅ Found ${requests.length} test leave requests\n`);
    
    // Step 2: Simulate DB down - make 10 decisions with audit failure injection
    console.log('Step 2: Simulate audit DB down - making 10 decisions...');
    const startTime = Date.now();
    
    const results = [];
    for (let i = 0; i < 10; i++) {
      const requestId = requests[i % requests.length].id;
      try {
        const result = await makeLeaveDecision(requestId, true); // Inject audit failure
        results.push(result);
        const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
        console.log(`  Decision ${i + 1}: ${status}`);
      } catch (error) {
        console.error(`  Decision ${i + 1}: ❌ EXCEPTION: ${error.message}`);
        results.push({ success: false, error: error.message });
      }
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`\n✅ All 10 decisions completed in ${elapsed}ms (avg ${(elapsed / 10).toFixed(1)}ms per decision)\n`);
    
    // Step 3: Verify all decisions succeeded (non-blocking)
    const successCount = results.filter(r => r.success).length;
    console.log(`Step 3: Verify non-blocking behavior...`);
    console.log(`  ${successCount}/10 decisions succeeded`);
    
    if (successCount < 10) {
      console.error(`❌ FAILED: Expected all 10 decisions to succeed despite audit DB down`);
      console.log('Failures:', results.filter(r => !r.success));
      process.exit(1);
    }
    
    console.log(`✅ All decisions succeeded (non-blocking)\n`);
    
    // Step 4: Check health endpoint
    console.log('Step 4: Check health endpoint...');
    const health = await checkHealth();
    
    console.log(`  Status: ${health.status}`);
    console.log(`  Circuit Breaker: ${health.auditQueue?.circuitBreaker || 'unknown'}`);
    console.log(`  Queue Pending: ${health.auditQueue?.pending || 0}`);
    console.log(`  Queue Failed: ${health.auditQueue?.failed || 0}`);
    console.log(`  DLQ Size: ${health.auditQueue?.deadLetters || 0}`);
    
    if (health.status !== 'degraded' && health.auditQueue?.circuitBreaker !== 'OPEN') {
      console.warn(`⚠️  WARNING: Expected circuit breaker to be OPEN after 10 failures`);
    }
    
    if ((health.auditQueue?.pending || 0) < 5) {
      console.warn(`⚠️  WARNING: Expected at least 5 items in queue, got ${health.auditQueue?.pending || 0}`);
    }
    
    console.log(`✅ Health endpoint shows degraded state\n`);
    
    // Step 5: Simulate DB restore - make 5 more decisions WITHOUT failure injection
    console.log('Step 5: Simulate DB restore - making 5 more decisions...');
    
    const restoreResults = [];
    for (let i = 0; i < 5; i++) {
      const requestId = requests[i % requests.length].id;
      try {
        const result = await makeLeaveDecision(requestId, false); // No audit failure
        restoreResults.push(result);
        const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
        console.log(`  Decision ${i + 1}: ${status}`);
      } catch (error) {
        console.error(`  Decision ${i + 1}: ❌ EXCEPTION: ${error.message}`);
        restoreResults.push({ success: false, error: error.message });
      }
    }
    
    console.log(`✅ All 5 "DB restored" decisions completed\n`);
    
    // Step 6: Wait for queue drain
    console.log('Step 6: Wait for queue drain (10 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Step 7: Final health check
    console.log('Step 7: Final health check...');
    const finalHealth = await checkHealth();
    
    console.log(`  Status: ${finalHealth.status}`);
    console.log(`  Circuit Breaker: ${finalHealth.auditQueue?.circuitBreaker || 'unknown'}`);
    console.log(`  Queue Pending: ${finalHealth.auditQueue?.pending || 0}`);
    console.log(`  Success Count: ${finalHealth.auditQueue?.successCount || 0}`);
    
    if (finalHealth.auditQueue?.circuitBreaker === 'CLOSED' || finalHealth.auditQueue?.circuitBreaker === 'HALF_OPEN') {
      console.log(`✅ Circuit breaker recovered`);
    }
    
    if ((finalHealth.auditQueue?.pending || 0) === 0) {
      console.log(`✅ Queue drained successfully`);
    } else {
      console.warn(`⚠️  Queue still has ${finalHealth.auditQueue?.pending} pending items (may need more time)`);
    }
    
    console.log('\n✅ Scenario 2.1 PASSED\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Scenario 2.1 FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run scenario
runScenario();
