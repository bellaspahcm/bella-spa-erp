/**
 * K6-2: Progressive Load (Platform Capacity Curve)
 *
 * Runs a stepped ramp up sequence:
 *   - 1 VU (2 minutes)
 *   - 10 VUs (5 minutes)
 *   - 50 VUs (5 minutes)
 *   - 100 VUs (5 minutes)
 *   - 200 VUs (5 minutes)
 *   - 500 VUs (5 minutes)
 *   - 1,000 VUs (5 minutes)
 *
 * Total duration: ~32 minutes.
 *
 * Usage:
 *   k6 run load-tests/scripts/19-k6-2-progressive.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
import { ENV, assertEnv } from "../config/env.js";
import { serviceHeaders } from "../helpers/auth.js";
import { randomVnPhone } from "../helpers/data.js";
import crypto from "k6/crypto";

// Metrics trends
const appHealthTrend = new Trend("app_api_health");
const crudCycleTrend = new Trend("db_crud_cycle");

export const options = {
  ext: {
    loadimpact: {
      name: "Bella K6-2 Progressive Load (AWS Singapore)",
      distribution: {
        "singapore-zone": { loadZone: "amazon:sg:singapore", percent: 100 },
      },
    },
  },
  stages: [
    { duration: "2m", target: 1 },    // Baseline step
    { duration: "5m", target: 10 },   // Low load step
    { duration: "5m", target: 50 },   // Normal load step
    { duration: "5m", target: 100 },  // Medium load step
    { duration: "5m", target: 200 },  // High load step
    { duration: "5m", target: 500 },  // Stress load step
    { duration: "5m", target: 1000 }, // Extreme load step
  ],
  thresholds: {
    // SLA Capacity Threshold (P95 <= 100ms)
    // Stable Capacity Threshold (P95 <= 500ms, Error Rate = 0.00%)
    "app_api_health": ["p(95)<=500"],
    "db_crud_cycle": ["p(95)<=500"],
    "http_req_failed": ["rate==0.0"], // Hard requirement: 0% error rate
  },
};

export function setup() {
  assertEnv();
  console.log(`[K6-2] Starting Progressive Load test sequence...`);
  console.log(`[K6-2] BASE_URL: ${ENV.BASE_URL}`);
  console.log(`[K6-2] SUPABASE_URL: ${ENV.SUPABASE_URL}`);
}

export default function () {
  const headers = serviceHeaders();
  const phone = randomVnPhone();
  const recordId = `K6-2-${phone}-${Math.floor(Math.random() * 1000000)}`;
  const payload = `K6-2 progressive load payload - phone ${phone}`;
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
  console.log("[K6-2] Cleaning up residual manifest records...");
  const headers = serviceHeaders();
  http.del(
    `${ENV.SUPABASE_URL}/rest/v1/dr_manifest?id=like.K6-2-*`,
    null,
    { headers }
  );
  console.log("[K6-2] Completed Progressive Load test sequence.");
}
