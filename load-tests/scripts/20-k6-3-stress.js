/**
 * K6-3: Stress & Saturation Breakpoint
 *
 * Runs a high-load ramp up sequence:
 *   - 500 VUs (5 minutes)
 *   - 1,000 VUs (5 minutes)
 *   - 1,500 VUs (5 minutes)
 *   - 2,000 VUs (5 minutes)
 *   - 2,500 VUs (5 minutes)
 *
 * Goal: Drive the system to its saturation breakpoint to identify the Saturation Inflection Point.
 *
 * Usage:
 *   k6 run load-tests/scripts/20-k6-3-stress.js
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
      name: "Bella K6-3 Stress & Saturation (AWS Singapore)",
      distribution: {
        "singapore-zone": { loadZone: "amazon:sg:singapore", percent: 100 },
      },
    },
  },
  stages: [
    { duration: "5m", target: 500 },  // Step 1: 500 VUs
    { duration: "5m", target: 1000 }, // Step 2: 1,000 VUs
    { duration: "5m", target: 1500 }, // Step 3: 1,500 VUs
    { duration: "5m", target: 2000 }, // Step 4: 2,000 VUs
    { duration: "5m", target: 2500 }, // Step 5: 2,500 VUs
  ],
  thresholds: {
    // Monitor degradation (no strict failure thresholds on duration, but trace stability)
    "http_req_failed": ["rate<=0.05"], // Allow up to 5% failure rate under extreme stress bounds
  },
};

export function setup() {
  assertEnv();
  console.log(`[K6-3] Starting Stress & Saturation test sequence...`);
  console.log(`[K6-3] BASE_URL: ${ENV.BASE_URL}`);
  console.log(`[K6-3] SUPABASE_URL: ${ENV.SUPABASE_URL}`);
}

export default function () {
  const headers = serviceHeaders();
  const phone = randomVnPhone();
  const recordId = `K6-3-${phone}-${Math.floor(Math.random() * 1000000)}`;
  const payload = `K6-3 stress payload - phone ${phone}`;
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
  console.log("[K6-3] Cleaning up residual manifest records...");
  const headers = serviceHeaders();
  http.del(
    `${ENV.SUPABASE_URL}/rest/v1/dr_manifest?id=like.K6-3-*`,
    null,
    { headers }
  );
  console.log("[K6-3] Completed Stress & Saturation test sequence.");
}
