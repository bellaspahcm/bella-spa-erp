/**
 * Gate 3: 72-Hour Operational Stability Monitor
 * 
 * Polls Decision Engine health endpoint every 5 minutes for 72 hours
 * Logs metrics to console and checks against thresholds
 * 
 * Usage:
 *   node scripts/gate3-monitor.js > gate3-monitor.log 2>&1 &
 * 
 * Stop after 72 hours:
 *   pkill -f gate3-monitor.js
 */

const BASE_URL = process.env.BASE_URL || 'https://bella-spa-erp.vercel.app';
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DURATION_MS = 72 * 60 * 60 * 1000; // 72 hours

// Thresholds (from Gate 3 requirements)
const THRESHOLDS = {
  queueDepth: 100,
  retryRate: 5.0, // percent
  dlqRate: 1.0, // percent
  errorRate: 0.1, // percent
  p95Latency: 200, // ms
  p99Latency: 500, // ms
  circuitUptimeMin: 95.0, // percent
};

// State tracking
const state = {
  startTime: Date.now(),
  checkCount: 0,
  circuitStates: [],
  alerts: [],
};

/**
 * Fetch health endpoint
 */
async function fetchHealth() {
  const response = await fetch(`${BASE_URL}/api/decision-engine/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }
  return await response.json();
}

/**
 * Check metric against threshold
 */
function checkThreshold(metricName, value, threshold, operator = '<') {
  let pass;
  if (operator === '<') {
    pass = value < threshold;
  } else if (operator === '>') {
    pass = value > threshold;
  } else if (operator === '===') {
    pass = value === threshold;
  }
  
  return {
    metric: metricName,
    value,
    threshold,
    operator,
    pass,
    status: pass ? '✅' : '⚠️',
  };
}

/**
 * Process health data and check thresholds
 */
function processHealth(health) {
  const timestamp = new Date().toISOString();
  const elapsed = Date.now() - state.startTime;
  const elapsedHours = (elapsed / (60 * 60 * 1000)).toFixed(1);
  
  state.checkCount++;
  
  console.log('\n' + '='.repeat(80));
  console.log(`Gate 3 Health Check #${state.checkCount} - ${timestamp}`);
  console.log(`Elapsed: ${elapsedHours} hours / 72 hours`);
  console.log('='.repeat(80));
  
  // Extract metrics
  const queueDepth = health.auditQueue?.pending || 0;
  const queueFailed = health.auditQueue?.failed || 0;
  const dlqSize = health.auditQueue?.deadLetters || 0;
  const circuitState = health.auditQueue?.circuitBreaker || 'unknown';
  const status = health.status || 'unknown';
  
  // Note: Retry rate, error rate, and latency require SQL queries (not in health endpoint)
  // For now, log what's available and note what's missing
  
  console.log('\n📊 Metrics:');
  console.log(`  Status: ${status}`);
  console.log(`  Queue Depth: ${queueDepth}`);
  console.log(`  Queue Failed: ${queueFailed}`);
  console.log(`  DLQ Size: ${dlqSize}`);
  console.log(`  Circuit Breaker: ${circuitState}`);
  
  // Check thresholds
  console.log('\n🎯 Threshold Checks:');
  
  const checks = [
    checkThreshold('Queue Depth', queueDepth, THRESHOLDS.queueDepth, '<'),
    checkThreshold('DLQ Size', dlqSize, 10, '<'), // Alert at 10 items
  ];
  
  checks.forEach(check => {
    console.log(`  ${check.status} ${check.metric}: ${check.value} ${check.operator} ${check.threshold}`);
    if (!check.pass) {
      state.alerts.push({
        timestamp,
        check: check.metric,
        value: check.value,
        threshold: check.threshold,
      });
    }
  });
  
  // Track circuit state
  state.circuitStates.push(circuitState);
  const closedCount = state.circuitStates.filter(s => s === 'CLOSED').length;
  const uptimePercent = (closedCount / state.circuitStates.length) * 100;
  
  console.log(`\n🔌 Circuit Breaker Uptime: ${uptimePercent.toFixed(1)}% (${closedCount}/${state.circuitStates.length} checks CLOSED)`);
  if (uptimePercent < THRESHOLDS.circuitUptimeMin) {
    console.log(`  ⚠️  WARNING: Uptime below ${THRESHOLDS.circuitUptimeMin}% threshold`);
  }
  
  // Alert summary
  if (state.alerts.length > 0) {
    const recentAlerts = state.alerts.slice(-5);
    console.log(`\n⚠️  Recent Alerts (${state.alerts.length} total):`);
    recentAlerts.forEach(alert => {
      console.log(`  - ${alert.timestamp}: ${alert.check} = ${alert.value} (threshold: ${alert.threshold})`);
    });
  } else {
    console.log('\n✅ No alerts fired');
  }
  
  // Progress bar
  const progressPercent = (elapsed / DURATION_MS) * 100;
  const barLength = 40;
  const filledLength = Math.round((barLength * progressPercent) / 100);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  console.log(`\n⏱️  Progress: [${bar}] ${progressPercent.toFixed(1)}%`);
  
  // SQL queries reminder
  console.log('\n📝 Manual SQL Checks Required:');
  console.log('  - Retry Rate: SELECT COUNT(*) FILTER (WHERE retry_count > 0) ... FROM decision_audit_log');
  console.log('  - Error Rate: SELECT COUNT(*) FILTER (WHERE status = \'error\') ... FROM decision_audit_log');
  console.log('  - p95/p99 Latency: SELECT PERCENTILE_CONT(0.95) ... FROM decision_audit_log');
  console.log('  - See: docs/decision-engine/GATE3_MONITORING_GUIDE.md');
}

/**
 * Generate final report
 */
function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('GATE 3 - 72-HOUR MONITORING COMPLETE');
  console.log('='.repeat(80));
  
  console.log(`\nTotal Checks: ${state.checkCount}`);
  console.log(`Total Alerts: ${state.alerts.length}`);
  
  const closedCount = state.circuitStates.filter(s => s === 'CLOSED').length;
  const uptimePercent = (closedCount / state.circuitStates.length) * 100;
  console.log(`Circuit Breaker Uptime: ${uptimePercent.toFixed(1)}%`);
  
  const pass = uptimePercent >= THRESHOLDS.circuitUptimeMin;
  console.log(`\nGate 3 Status: ${pass ? '✅ PASSED (with warnings)' : '⚠️  INVESTIGATE'}`);
  
  console.log('\n📊 Next Steps:');
  console.log('  1. Review gate3-monitor.log for full details');
  console.log('  2. Run SQL queries for retry rate, error rate, latency');
  console.log('  3. Document findings in GATE3_COMPLETION_REPORT.md');
  console.log('  4. Proceed to Gate 4 (Data Quality) - observational');
  
  process.exit(0);
}

/**
 * Main monitoring loop
 */
async function monitor() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║              Gate 3: 72-Hour Operational Stability Monitor                 ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log(`\nStart Time: ${new Date(state.startTime).toISOString()}`);
  console.log(`End Time: ${new Date(state.startTime + DURATION_MS).toISOString()}`);
  console.log(`Poll Interval: ${POLL_INTERVAL_MS / 1000 / 60} minutes`);
  console.log(`Expected Checks: ${Math.floor(DURATION_MS / POLL_INTERVAL_MS)}`);
  console.log('\n' + '='.repeat(80));
  
  while (Date.now() - state.startTime < DURATION_MS) {
    try {
      const health = await fetchHealth();
      processHealth(health);
    } catch (error) {
      console.error(`\n❌ Health check failed: ${error.message}`);
      state.alerts.push({
        timestamp: new Date().toISOString(),
        check: 'Health Endpoint',
        value: 'FAILED',
        threshold: 'AVAILABLE',
      });
    }
    
    // Wait for next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  
  // Monitoring complete
  generateReport();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Monitoring interrupted by user');
  generateReport();
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Monitoring terminated');
  generateReport();
});

// Start monitoring
monitor().catch(error => {
  console.error('\n❌ Monitor crashed:', error);
  process.exit(1);
});
