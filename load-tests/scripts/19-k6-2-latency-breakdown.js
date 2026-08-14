/**
 * K6-2: Per-Segment Latency Breakdown (Controlled Experiment)
 *
 * OBJECTIVE:
 *   K6-1 reported: app_api_health P95 = 113 ms, db_crud_cycle P95 = 100 ms.
 *   This script breaks down WHERE latency sits within each workload by:
 *     1. Splitting db_crud_cycle into 3 independent Trend metrics (post/get/delete).
 *     2. Splitting app_api_health into k6-visible timing segments:
 *        - http_req_connecting  (TCP connect)
 *        - http_req_tls_handshaking (TLS)
 *        - http_req_sending     (request bytes)
 *        - http_req_waiting     (TTFB = server processing time)
 *        - http_req_receiving   (response bytes)
 *
 * IDENTICAL CONDITIONS TO K6-1 (controlled variables):
 *   - Same load zone: AWS Singapore
 *   - Same VU levels: 1 VU baseline → 10 VUs SLA check
 *   - Same duration: 10m + 10m
 *   - Same table: dr_manifest
 *   - Same 1s pacing
 *
 * DIFFERENCES FROM K6-1 (treatment variables):
 *   - Granular per-operation Trends (db_post, db_get, db_delete)
 *   - Granular timing segment Trends for app_api_health
 *   - NO changes to application code or database connection
 *
 * HYPOTHESIS:
 *   If http_req_waiting (TTFB) dominates app_api_health duration,
 *   bottleneck is server-side (DB query or Next.js handler).
 *   If http_req_connecting or tls_handshaking dominates,
 *   bottleneck is network/connection setup.
 *
 * Usage:
 *   npm run load:8c:k6-2
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
import { ENV, assertEnv } from "../config/env.js";
import { serviceHeaders } from "../helpers/auth.js";
import { randomVnPhone } from "../helpers/data.js";
import crypto from "k6/crypto";

// ── App API: aggregate (matches K6-1 for comparison) ──────────────────────────
const appHealthTrend = new Trend("app_api_health");

// ── App API: per-segment timing breakdown ─────────────────────────────────────
const appHealth_connecting    = new Trend("app_health_seg_connecting");
const appHealth_tlsHandshake  = new Trend("app_health_seg_tls_handshake");
const appHealth_sending       = new Trend("app_health_seg_sending");
const appHealth_waiting       = new Trend("app_health_seg_waiting");   // TTFB = server processing
const appHealth_receiving     = new Trend("app_health_seg_receiving");

// ── DB CRUD: aggregate (matches K6-1 for comparison) ──────────────────────────
const crudCycleTrend = new Trend("db_crud_cycle");

// ── DB CRUD: per-operation breakdown ──────────────────────────────────────────
const dbPostTrend   = new Trend("db_op_post");
const dbGetTrend    = new Trend("db_op_get");
const dbDeleteTrend = new Trend("db_op_delete");

export const options = {
  cloud: {
    name: "Bella K6-2 Latency Breakdown (AWS Singapore)",
    distribution: {
      "singapore-zone": { loadZone: "amazon:sg:singapore", percent: 100 },
    },
  },
  scenarios: {
    // Replicate K6-1 Scenario 1 exactly
    baseline: {
      executor: "constant-vus",
      vus: 1,
      duration: "10m",
      startTime: "0s",
      tags: { test_type: "k6-2-baseline" },
      env: { K6_CLOUD_DISTRIBUTION: "singapore-zone" },
    },
    // Replicate K6-1 Scenario 2 exactly
    sla_check: {
      executor: "constant-vus",
      vus: 10,
      duration: "10m",
      startTime: "10m",
      tags: { test_type: "k6-2-sla" },
      env: { K6_CLOUD_DISTRIBUTION: "singapore-zone" },
    },
  },
  thresholds: {
    // ── Aggregate (same targets as K6-1 for direct comparison) ────────────────
    "app_api_health{test_type:k6-2-baseline}": ["p(95)<=50"],
    "app_api_health{test_type:k6-2-sla}":      ["p(95)<=100"],
    "db_crud_cycle{test_type:k6-2-sla}":       ["p(95)<=100"],

    // ── Segment-level diagnostic thresholds ───────────────────────────────────
    // TTFB (server processing) should be the dominant component
    "app_health_seg_waiting{test_type:k6-2-sla}": ["p(95)<=95"],
    // DB individual ops: each should be well under 50ms
    "db_op_post{test_type:k6-2-sla}":   ["p(95)<=50"],
    "db_op_get{test_type:k6-2-sla}":    ["p(95)<=50"],
    "db_op_delete{test_type:k6-2-sla}": ["p(95)<=50"],
  },
};

export function setup() {
  assertEnv();
  console.log("[K6-2] Starting Per-Segment Latency Breakdown...");
  console.log(`[K6-2] BASE_URL: ${ENV.BASE_URL}`);
  console.log(`[K6-2] SUPABASE_URL: ${ENV.SUPABASE_URL}`);
  console.log("[K6-2] Measuring: TCP connect / TLS / TTFB / receive for app_api_health");
  console.log("[K6-2] Measuring: individual POST / GET / DELETE latency for db_crud_cycle");
}

export default function () {
  const headers = serviceHeaders();
  const phone = randomVnPhone();
  const recordId = `K6-2-${phone}-${Math.floor(Math.random() * 1000000)}`;
  const payload = `K6-2 breakdown payload - phone ${phone}`;
  const payloadHash = crypto.sha256(payload, "hex");

  // ── Workload A: App API Health (with segment breakdown) ───────────────────
  const healthRes = http.get(`${ENV.BASE_URL}/api/health`, {
    tags: { name: "app.health_check" },
  });
  check(healthRes, { "app health status 200": (r) => r.status === 200 });

  // Aggregate duration (identical measurement to K6-1)
  appHealthTrend.add(healthRes.timings.duration);

  // Per-segment breakdown — this is the diagnostic layer
  appHealth_connecting.add(healthRes.timings.connecting);
  appHealth_tlsHandshake.add(healthRes.timings.tls_handshaking);
  appHealth_sending.add(healthRes.timings.sending);
  appHealth_waiting.add(healthRes.timings.waiting);       // ← key: TTFB
  appHealth_receiving.add(healthRes.timings.receiving);

  // ── Workload B: DB CRUD Cycle (per-operation breakdown) ──────────────────
  const cycleStart = Date.now();

  // POST
  const t0 = Date.now();
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
  dbPostTrend.add(Date.now() - t0);

  if (postOk) {
    // GET
    const t1 = Date.now();
    const getRes = http.get(
      `${ENV.SUPABASE_URL}/rest/v1/dr_manifest?id=eq.${recordId}&limit=1`,
      { headers, tags: { name: "db.query" } }
    );
    check(getRes, { "query status 200": (r) => r.status === 200 });
    dbGetTrend.add(Date.now() - t1);

    // DELETE
    const t2 = Date.now();
    const delRes = http.del(
      `${ENV.SUPABASE_URL}/rest/v1/dr_manifest?id=eq.${recordId}`,
      null,
      { headers, tags: { name: "db.delete" } }
    );
    check(delRes, { "delete status 200/204": (r) => r.status === 200 || r.status === 204 });
    dbDeleteTrend.add(Date.now() - t2);

    // Aggregate cycle duration (identical measurement to K6-1)
    crudCycleTrend.add(Date.now() - cycleStart);
  }

  sleep(1); // Same 1s pacing as K6-1
}

export function teardown() {
  console.log("[K6-2] Cleaning up residual manifest records...");
  const headers = serviceHeaders();
  http.del(
    `${ENV.SUPABASE_URL}/rest/v1/dr_manifest?id=like.K6-2-*`,
    null,
    { headers }
  );
  console.log("[K6-2] Latency Breakdown Test Completed.");
  console.log("[K6-2] Key metrics to analyse:");
  console.log("  app_health_seg_waiting  → Server processing time (TTFB) inside Vercel+DB");
  console.log("  app_health_seg_connecting → TCP connect overhead");
  console.log("  app_health_seg_tls_handshake → TLS overhead");
  console.log("  db_op_post / db_op_get / db_op_delete → individual DB operation latency");
}
