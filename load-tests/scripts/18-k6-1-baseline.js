/**
 * K6-1: Baseline & SLA Verification
 *
 * Runs a sequential execution:
 *   - Scenario 1 (Baseline): 1 VU for 10 minutes to measure clean RTT/latency.
 *   - Scenario 2 (SLA Check): 10 VUs for 10 minutes to verify SLA limits.
 *
 * Usage:
 *   k6 run load-tests/scripts/18-k6-1-baseline.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
import { ENV, assertEnv } from "../config/env.js";
import { serviceHeaders } from "../helpers/auth.js";
import { randomVnPhone } from "../helpers/data.js";
import crypto from "k6/crypto";

// Latency trends
const appHealthTrend = new Trend("app_api_health");
const crudCycleTrend = new Trend("db_crud_cycle");

export const options = {
  cloud: {
    name: "Bella K6-1 Baseline (AWS Singapore)",
    distribution: {
      "singapore-zone": { loadZone: "amazon:sg:singapore", percent: 100 },
    },
  },
  scenarios: {
    baseline: {
      executor: "constant-vus",
      vus: 1,
      duration: "10m",
      startTime: "0s",
      tags: { test_type: "k6-1-baseline" },
      env: { K6_CLOUD_DISTRIBUTION: "singapore-zone" },
    },
    sla_check: {
      executor: "constant-vus",
      vus: 10,
      duration: "10m",
      startTime: "10m",
      tags: { test_type: "k6-1-sla" },
      env: { K6_CLOUD_DISTRIBUTION: "singapore-zone" },
    },
  },
  thresholds: {
    // Diagnostic target: P95 <= 50ms for baseline 1 VU
    "app_api_health{test_type:k6-1-baseline}": ["p(95)<=50"],
    // Hard SLA target: P95 <= 100ms for 10 VUs
    "app_api_health{test_type:k6-1-sla}": ["p(95)<=100"],
    "db_crud_cycle{test_type:k6-1-sla}": ["p(95)<=100"],
  },
};

export function setup() {
  assertEnv();
  console.log(`[K6-1] Starting Baseline & SLA Verification...`);
  console.log(`[K6-1] BASE_URL: ${ENV.BASE_URL}`);
  console.log(`[K6-1] SUPABASE_URL: ${ENV.SUPABASE_URL}`);
}

export default function () {
  const headers = serviceHeaders();
  const phone = randomVnPhone();
  const recordId = `K6-1-${phone}-${Math.floor(Math.random() * 1000000)}`;
  const payload = `K6-1 baseline payload - phone ${phone}`;
  const payloadHash = crypto.sha256(payload, "hex");

  // 1. Measure API Health
  const healthRes = http.get(`${ENV.BASE_URL}/api/health`, {
    tags: { name: "app.health_check" }
  });
  check(healthRes, { "app health status 200": (r) => r.status === 200 });
  appHealthTrend.add(healthRes.timings.duration);

  // 2. Measure CRUD
  const startTime = Date.now();
  
  // POST
  const postRes = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/dr_manifest`,
    JSON.stringify({
      id: recordId,
      tenant_id: "10000000-0000-0000-0000-000000000001",
      payload: payload,
      payload_hash: payloadHash,
      timestamp: Date.now(),
    }),
    { headers, tags: { name: "db.insert" } }
  );
  const postOk = check(postRes, { "insert status 201": (r) => r.status === 201 });

  if (postOk) {
    // GET
    const getRes = http.get(
      `${ENV.SUPABASE_URL}/rest/v1/dr_manifest?id=eq.${recordId}&limit=1`,
      { headers, tags: { name: "db.query" } }
    );
    check(getRes, { "query status 200": (r) => r.status === 200 });

    // DEL
    const delRes = http.del(
      `${ENV.SUPABASE_URL}/rest/v1/dr_manifest?id=eq.${recordId}`,
      null,
      { headers, tags: { name: "db.delete" } }
    );
    check(delRes, { "delete status 200/204": (r) => r.status === 200 || r.status === 204 });
    
    // Add cumulative CRUD time
    crudCycleTrend.add(Date.now() - startTime);
  }

  sleep(1); // 1s pacing
}

export function teardown() {
  console.log("[K6-1] Cleaning up residual manifest records...");
  const headers = serviceHeaders();
  http.del(
    `${ENV.SUPABASE_URL}/rest/v1/dr_manifest?id=like.K6-1-*`,
    null,
    { headers }
  );
  console.log("[K6-1] Completed Baseline & SLA Verification.");
}
