/**
 * k6 Load Test Script
 * Test Bella Auto API endpoints under production scale
 * 
 * Usage:
 *   k6 run --vus 1000 --duration 5m scripts/load-test-k6.js
 * 
 * Scenarios:
 * 1. Journey timeline query (most common)
 * 2. VIN search (admin operation)
 * 3. Journey events fetch
 * 4. Touchpoint aggregation
 * 5. Active journeys by stage
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const journeyTimelineDuration = new Trend('journey_timeline_duration');
const vinSearchDuration = new Trend('vin_search_duration');
const eventsQueryDuration = new Trend('events_query_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 1000 },  // Ramp up to 1000 users
    { duration: '10m', target: 1000 }, // Stay at 1000 users
    { duration: '2m', target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(50)<50', 'p(95)<200', 'p(99)<500'], // Success criteria
    errors: ['rate<0.01'], // Error rate < 1%
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TENANT_ID = __ENV.TENANT_ID || 'test-tenant-id';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

// Headers
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
};

// Generate random IDs for testing
function randomVIN() {
  const num = Math.floor(Math.random() * 1000000);
  return 'VIN' + num.toString().padStart(12, '0');
}

function randomCustomerId() {
  return Math.floor(Math.random() * 100000) + 1;
}

function randomJourneyId() {
  return Math.floor(Math.random() * 100000) + 1;
}

export default function () {
  // Scenario weights (what % of traffic goes to each endpoint)
  const scenario = Math.random();

  if (scenario < 0.4) {
    // 40% - Journey timeline query (most common)
    testJourneyTimeline();
  } else if (scenario < 0.6) {
    // 20% - VIN search
    testVINSearch();
  } else if (scenario < 0.8) {
    // 20% - Journey events fetch
    testJourneyEvents();
  } else if (scenario < 0.95) {
    // 15% - Active journeys by stage
    testActiveJourneysByStage();
  } else {
    // 5% - Touchpoint aggregation (heavy query)
    testTouchpointAggregation();
  }

  sleep(Math.random() * 2 + 0.5); // 0.5-2.5s between requests
}

function testJourneyTimeline() {
  const customerId = randomCustomerId();
  const url = `${BASE_URL}/api/bella-auto/customers/${customerId}/timeline?tenant_id=${TENANT_ID}`;
  
  const startTime = Date.now();
  const res = http.get(url, { headers });
  const duration = Date.now() - startTime;

  journeyTimelineDuration.add(duration);

  const success = check(res, {
    'journey_timeline: status 200': (r) => r.status === 200,
    'journey_timeline: response time < 200ms': () => duration < 200,
    'journey_timeline: has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.journey !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (!success) {
    errorRate.add(1);
    console.error(`Journey timeline failed: ${res.status} - ${res.body.substring(0, 100)}`);
  } else {
    errorRate.add(0);
  }
}

function testVINSearch() {
  const vin = randomVIN();
  const url = `${BASE_URL}/api/bella-auto/vehicles?vin=${vin}&tenant_id=${TENANT_ID}`;
  
  const startTime = Date.now();
  const res = http.get(url, { headers });
  const duration = Date.now() - startTime;

  vinSearchDuration.add(duration);

  const success = check(res, {
    'vin_search: status 200 or 404': (r) => r.status === 200 || r.status === 404,
    'vin_search: response time < 100ms': () => duration < 100,
  });

  if (!success) {
    errorRate.add(1);
    console.error(`VIN search failed: ${res.status}`);
  } else {
    errorRate.add(0);
  }
}

function testJourneyEvents() {
  const journeyId = randomJourneyId();
  const url = `${BASE_URL}/api/bella-auto/journeys/${journeyId}/events?tenant_id=${TENANT_ID}`;
  
  const startTime = Date.now();
  const res = http.get(url, { headers });
  const duration = Date.now() - startTime;

  eventsQueryDuration.add(duration);

  const success = check(res, {
    'journey_events: status 200 or 404': (r) => r.status === 200 || r.status === 404,
    'journey_events: response time < 200ms': () => duration < 200,
  });

  if (!success) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }
}

function testActiveJourneysByStage() {
  const url = `${BASE_URL}/api/bella-auto/journeys/stats?tenant_id=${TENANT_ID}&status=active`;
  
  const res = http.get(url, { headers });

  const success = check(res, {
    'active_journeys: status 200': (r) => r.status === 200,
    'active_journeys: has stats': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.byStage !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (!success) errorRate.add(1);
  else errorRate.add(0);
}

function testTouchpointAggregation() {
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = new Date().toISOString();
  const url = `${BASE_URL}/api/bella-auto/touchpoints/aggregated?tenant_id=${TENANT_ID}&start=${startDate}&end=${endDate}`;
  
  const res = http.get(url, { headers });

  const success = check(res, {
    'touchpoints: status 200': (r) => r.status === 200,
    'touchpoints: response time < 1s': (r) => r.timings.duration < 1000,
  });

  if (!success) errorRate.add(1);
  else errorRate.add(0);
}

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, opts) {
  const indent = opts.indent || '';
  const lines = [
    '',
    indent + '█████████████████████████████████████',
    indent + '█   Bella Auto Load Test Results   █',
    indent + '█████████████████████████████████████',
    '',
    indent + `Total Requests: ${data.metrics.http_reqs.values.count}`,
    indent + `Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%`,
    '',
    indent + 'Response Times:',
    indent + `  P50: ${data.metrics.http_req_duration.values['p(50)']}ms`,
    indent + `  P95: ${data.metrics.http_req_duration.values['p(95)']}ms`,
    indent + `  P99: ${data.metrics.http_req_duration.values['p(99)']}ms`,
    '',
    indent + 'Journey Timeline:',
    indent + `  Avg: ${data.metrics.journey_timeline_duration.values.avg.toFixed(2)}ms`,
    indent + `  Max: ${data.metrics.journey_timeline_duration.values.max.toFixed(2)}ms`,
    '',
    indent + 'VIN Search:',
    indent + `  Avg: ${data.metrics.vin_search_duration.values.avg.toFixed(2)}ms`,
    indent + `  Max: ${data.metrics.vin_search_duration.values.max.toFixed(2)}ms`,
    '',
    indent + `✅ PASS: ${data.metrics.checks.values.passes}`,
    indent + `❌ FAIL: ${data.metrics.checks.values.fails}`,
    '',
  ];
  
  return lines.join('\n');
}
