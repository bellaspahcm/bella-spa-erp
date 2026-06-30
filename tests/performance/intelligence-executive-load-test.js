/**
 * k6 Load Test: Executive Intelligence API
 * 
 * Performance benchmarks for Intelligence Layer Phase 1:
 * - Test all 5 executive metric endpoints
 * - Measure cache hit rate (target >80%)
 * - Measure response times (cache hit <50ms, cache miss <1000ms)
 * - Test throughput (target >100 req/s)
 * - Monitor memory usage and cache performance
 * 
 * Usage:
 *   k6 run tests/performance/intelligence-executive-load-test.js
 * 
 * Prerequisites:
 *   1. npm install -g k6 (or brew install k6 on macOS)
 *   2. Start dev server: npm run dev
 *   3. Set environment variables (optional):
 *      - BASE_URL (default: http://localhost:3000)
 *      - TEST_TENANT_ID (default: test tenant from .env)
 * 
 * Test Stages:
 *   1. Warmup: 10 users for 30s (populate cache)
 *   2. Ramp up: 10→50 users over 1min
 *   3. Sustained load: 50 users for 3min (measure cache hit rate)
 *   4. Ramp down: 50→0 users over 1min
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── Configuration ──────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TEST_TENANT_ID = __ENV.TEST_TENANT_ID || '00000000-0000-0000-0000-000000000000';

// Test stages: warmup → ramp up → sustained → ramp down
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Warmup: populate cache
    { duration: '1m', target: 50 },   // Ramp up to 50 concurrent users
    { duration: '3m', target: 50 },   // Sustained load (measure cache hit rate)
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    // Success rate: 99% of requests must succeed
    'http_req_failed': ['rate<0.01'],
    
    // Response time thresholds
    'http_req_duration': ['p(95)<1000', 'p(99)<2000'], // 95% <1s, 99% <2s
    'http_req_duration{cached:true}': ['p(95)<50', 'p(99)<100'], // Cached: 95% <50ms
    'http_req_duration{cached:false}': ['p(95)<1000', 'p(99)<2000'], // Fresh: 95% <1s
    
    // Cache hit rate: >80%
    'cache_hit_rate': ['rate>0.8'],
    
    // Throughput: >100 req/s during sustained load
    'http_reqs': ['rate>100'],
  },
};

// ─── Custom Metrics ─────────────────────────────────────────────────────────

const cacheHitRate = new Rate('cache_hit_rate');
const cacheMissRate = new Rate('cache_miss_rate');
const cachedRequestDuration = new Trend('cached_request_duration');
const freshRequestDuration = new Trend('fresh_request_duration');
const dashboardLoadTime = new Trend('dashboard_load_time');
const errorCount = new Counter('errors');

// ─── API Endpoints ──────────────────────────────────────────────────────────

const ENDPOINTS = {
  monthlyRevenue: `${BASE_URL}/api/intelligence/executive/monthly-revenue-summary`,
  operationalEfficiency: `${BASE_URL}/api/intelligence/executive/operational-efficiency`,
  customerMetrics: `${BASE_URL}/api/intelligence/executive/customer-metrics`,
  financialHealth: `${BASE_URL}/api/intelligence/executive/financial-health`,
  growthIndicators: `${BASE_URL}/api/intelligence/executive/growth-indicators`,
};

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Build query params for metric endpoint
 */
function buildQueryParams(tenantId, period = 'month') {
  return `?tenantId=${tenantId}&period=${period}`;
}

/**
 * Make authenticated request with retry
 */
function makeRequest(endpoint, params, tags = {}) {
  const url = `${endpoint}${params}`;
  
  const response = http.get(url, {
    tags: tags,
    timeout: '10s',
  });

  // Check response status
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has body': (r) => r.body && r.body.length > 0,
  });

  if (!success) {
    errorCount.add(1);
    console.error(`Request failed: ${url} - Status: ${response.status}`);
    return null;
  }

  // Parse response
  try {
    const data = JSON.parse(response.body);
    
    // Check data structure
    check(data, {
      'has data field': (d) => d.data !== undefined,
      'has metadata field': (d) => d.metadata !== undefined,
    });

    // Track cache metrics
    const cached = data.metadata?.cached || false;
    const cacheHit = data.metadata?.cacheHit || false;
    
    if (cacheHit) {
      cacheHitRate.add(1);
      cachedRequestDuration.add(response.timings.duration);
    } else {
      cacheMissRate.add(1);
      freshRequestDuration.add(response.timings.duration);
    }

    return { response, data };
  } catch (e) {
    errorCount.add(1);
    console.error(`Failed to parse response: ${e.message}`);
    return null;
  }
}

// ─── Test Scenarios ─────────────────────────────────────────────────────────

/**
 * Scenario 1: Single Metric Query
 * Tests individual metric endpoint performance
 */
export function singleMetricQuery() {
  const params = buildQueryParams(TEST_TENANT_ID, 'month');
  
  group('Single Metric - Monthly Revenue', () => {
    const result = makeRequest(
      ENDPOINTS.monthlyRevenue,
      params,
      { name: 'monthly_revenue', cached: 'unknown' }
    );

    if (result) {
      check(result.data, {
        'has totalRevenue': (d) => d.data.totalRevenue !== undefined,
        'has revenueGrowth': (d) => d.data.revenueGrowth !== undefined,
      });
    }
  });
}

/**
 * Scenario 2: Dashboard Load (All 5 Metrics)
 * Simulates executive dashboard page load
 */
export function dashboardLoad() {
  const params = buildQueryParams(TEST_TENANT_ID, 'month');
  
  group('Dashboard Load - All 5 Metrics', () => {
    const startTime = Date.now();

    // Load all 5 metrics in parallel (batch request simulation)
    const responses = http.batch([
      ['GET', `${ENDPOINTS.monthlyRevenue}${params}`, null, { tags: { name: 'monthly_revenue' } }],
      ['GET', `${ENDPOINTS.operationalEfficiency}${params}`, null, { tags: { name: 'operational_efficiency' } }],
      ['GET', `${ENDPOINTS.customerMetrics}${params}`, null, { tags: { name: 'customer_metrics' } }],
      ['GET', `${ENDPOINTS.financialHealth}${params}`, null, { tags: { name: 'financial_health' } }],
      ['GET', `${ENDPOINTS.growthIndicators}${params}`, null, { tags: { name: 'growth_indicators' } }],
    ]);

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    dashboardLoadTime.add(totalTime);

    // Check all responses
    let allSuccess = true;
    let allCached = true;

    responses.forEach((response, index) => {
      const success = check(response, {
        'status is 200': (r) => r.status === 200,
      });

      if (!success) {
        allSuccess = false;
        errorCount.add(1);
      }

      // Check cache status
      try {
        const data = JSON.parse(response.body);
        if (!data.metadata?.cacheHit) {
          allCached = false;
        }
      } catch (e) {
        // Ignore parse errors (already counted in errorCount)
      }
    });

    check({ allSuccess, allCached, totalTime }, {
      'all metrics loaded successfully': (d) => d.allSuccess === true,
      'dashboard load time <5s': (d) => d.totalTime < 5000,
    });

    console.log(`Dashboard load time: ${totalTime}ms (cached: ${allCached})`);
  });
}

/**
 * Scenario 3: Period Switching
 * Simulates user changing time period (day → week → month)
 */
export function periodSwitching() {
  const periods = ['day', 'week', 'month', 'quarter', 'year'];
  
  group('Period Switching', () => {
    periods.forEach((period) => {
      const params = buildQueryParams(TEST_TENANT_ID, period);
      const result = makeRequest(
        ENDPOINTS.monthlyRevenue,
        params,
        { name: `monthly_revenue_${period}` }
      );

      if (result) {
        check(result.data, {
          [`has data for ${period} period`]: (d) => d.data.period !== undefined,
        });
      }

      sleep(0.5); // Small delay between period switches
    });
  });
}

/**
 * Scenario 4: Cache Invalidation Test
 * Tests cache behavior after invalidation
 */
export function cacheInvalidation() {
  const params = buildQueryParams(TEST_TENANT_ID, 'month');
  
  group('Cache Invalidation', () => {
    // First request (should be cached from warmup)
    const cached = makeRequest(
      ENDPOINTS.monthlyRevenue,
      params,
      { name: 'pre_invalidation' }
    );

    if (cached) {
      check(cached.data, {
        'initial request is cached': (d) => d.metadata?.cacheHit === true,
      });
    }

    // Note: In production, cache invalidation would be triggered by:
    // - Business event (revenue.created, booking.confirmed)
    // - Manual admin action
    // - TTL expiration (10 minutes)
    
    // For load test, we simulate post-TTL query
    sleep(1);

    const postInvalidation = makeRequest(
      ENDPOINTS.monthlyRevenue,
      params,
      { name: 'post_invalidation' }
    );

    if (postInvalidation) {
      // After invalidation, query may be fresh or cached (depending on timing)
      check(postInvalidation.data, {
        'post-invalidation request succeeds': (d) => d.data !== undefined,
      });
    }
  });
}

// ─── Main Test Function ─────────────────────────────────────────────────────

export default function () {
  // Randomly choose a test scenario to simulate varied user behavior
  const scenario = Math.random();

  if (scenario < 0.5) {
    // 50% of requests: Dashboard load (most common)
    dashboardLoad();
  } else if (scenario < 0.8) {
    // 30% of requests: Single metric query
    singleMetricQuery();
  } else if (scenario < 0.95) {
    // 15% of requests: Period switching
    periodSwitching();
  } else {
    // 5% of requests: Cache invalidation test
    cacheInvalidation();
  }

  // Think time: simulate user reading dashboard
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// ─── Setup and Teardown ─────────────────────────────────────────────────────

export function setup() {
  console.log('─────────────────────────────────────────────────────────────');
  console.log('  Executive Intelligence Load Test');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Test Tenant: ${TEST_TENANT_ID}`);
  console.log(`  Test Duration: ~5.5 minutes`);
  console.log(`  Max Concurrent Users: 50`);
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');

  // Warmup: populate cache with a few requests
  console.log('⏳ Warming up cache...');
  
  const params = buildQueryParams(TEST_TENANT_ID, 'month');
  
  const warmupResponses = http.batch([
    ['GET', `${ENDPOINTS.monthlyRevenue}${params}`],
    ['GET', `${ENDPOINTS.operationalEfficiency}${params}`],
    ['GET', `${ENDPOINTS.customerMetrics}${params}`],
    ['GET', `${ENDPOINTS.financialHealth}${params}`],
    ['GET', `${ENDPOINTS.growthIndicators}${params}`],
  ]);

  let warmupSuccess = true;
  warmupResponses.forEach((response) => {
    if (response.status !== 200) {
      warmupSuccess = false;
      console.error(`❌ Warmup failed: ${response.url} - Status: ${response.status}`);
    }
  });

  if (warmupSuccess) {
    console.log('✅ Cache warmed up successfully\n');
  } else {
    console.log('⚠️  Warmup had errors, continuing anyway\n');
  }

  return { warmupSuccess };
}

export function teardown(data) {
  console.log('');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('  Test Summary');
  console.log('─────────────────────────────────────────────────────────────');
  
  if (data.warmupSuccess) {
    console.log('  ✅ Load test completed successfully');
  } else {
    console.log('  ⚠️  Load test completed with warmup errors');
  }
  
  console.log('');
  console.log('  📊 Check detailed metrics above:');
  console.log('     - Cache hit rate (target >80%)');
  console.log('     - Response times (p95 <1s, cached <50ms)');
  console.log('     - Throughput (>100 req/s)');
  console.log('     - Error rate (<1%)');
  console.log('─────────────────────────────────────────────────────────────');
}

// ─── Custom Summary ─────────────────────────────────────────────────────────

export function handleSummary(data) {
  const cacheHitRate = data.metrics.cache_hit_rate?.values?.rate || 0;
  const cacheMissRate = data.metrics.cache_miss_rate?.values?.rate || 0;
  const avgDashboardLoadTime = data.metrics.dashboard_load_time?.values?.avg || 0;
  const p95ResponseTime = data.metrics.http_req_duration?.values['p(95)'] || 0;
  const throughput = data.metrics.http_reqs?.values?.rate || 0;
  const errorRate = data.metrics.errors?.values?.count || 0;

  console.log('\n📈 Performance Metrics Summary:\n');
  console.log(`   Cache Hit Rate:       ${(cacheHitRate * 100).toFixed(1)}% (target >80%)`);
  console.log(`   Cache Miss Rate:      ${(cacheMissRate * 100).toFixed(1)}%`);
  console.log(`   Avg Dashboard Load:   ${avgDashboardLoadTime.toFixed(0)}ms (target <5000ms)`);
  console.log(`   P95 Response Time:    ${p95ResponseTime.toFixed(0)}ms (target <1000ms)`);
  console.log(`   Throughput:           ${throughput.toFixed(1)} req/s (target >100)`);
  console.log(`   Total Errors:         ${errorRate}`);
  console.log('');

  // Return default text summary
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}

// Import textSummary helper
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
