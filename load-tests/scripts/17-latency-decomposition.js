/**
 * 8C Performance & Scale — Benchmark Latency Decomposition & Application API Baseline
 *
 * Runs a 1-VU, 30-second execution to measure:
 *   - 8C-1A (Manifest CRUD Baseline) individual operations (POST, GET, DELETE)
 *   - 8C-1B (Application API Baseline) Next.js health endpoint
 *   - 8C-1.1 (Benchmark Decomposition) TCP, TLS, TTFB (Waiting), and receiving times.
 *
 * Usage:
 *   k6 run load-tests/scripts/17-latency-decomposition.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
import { ENV, assertEnv } from "../config/env.js";
import { serviceHeaders } from "../helpers/auth.js";
import { randomVnPhone } from "../helpers/data.js";
import crypto from "k6/crypto";

// Custom Trends to track individual operation latency percentiles
const postManifestTrend = new Trend("db_op_post_manifest");
const getManifestTrend = new Trend("db_op_get_manifest");
const deleteManifestTrend = new Trend("db_op_delete_manifest");
const appHealthTrend = new Trend("app_api_health");

// Custom Trends for path breakdown
const tcpConnectTrend = new Trend("net_tcp_connect");
const tlsHandshakeTrend = new Trend("net_tls_handshake");
const serverWaitTrend = new Trend("net_server_wait_ttfb");
const dataTransferTrend = new Trend("net_data_transfer");

export const options = {
  vus: 1,
  duration: "30s",
  thresholds: {
    // Keep baseline checks as references
    "app_api_health": ["p(95)<100"], // 8C-1B Target: <= 100ms
  },
  tags: { test_type: "decomposition" },
};

export function setup() {
  assertEnv();
  console.log(`[decomposition] Starting Latency Decomposition...`);
  console.log(`[decomposition] BASE_URL: ${ENV.BASE_URL}`);
  console.log(`[decomposition] SUPABASE_URL: ${ENV.SUPABASE_URL}`);
}

export default function () {
  const headers = serviceHeaders();
  const phone = randomVnPhone();

  const recordId = `DECOMP-${phone}-${Math.floor(Math.random() * 1000000)}`;
  const payload = `Decomposition test payload - phone ${phone}`;
  const payloadHash = crypto.sha256(payload, "hex");

  // ==========================================
  // 1. Measure 8C-1B: Application API Baseline
  // ==========================================
  const healthUrl = `${ENV.BASE_URL}/api/health`;
  const healthRes = http.get(healthUrl, {
    tags: { name: "app.health_check" }
  });

  check(healthRes, {
    "app health status 200": (r) => r.status === 200,
  });

  // Track app API latency
  appHealthTrend.add(healthRes.timings.duration);
  tcpConnectTrend.add(healthRes.timings.connecting);
  tlsHandshakeTrend.add(healthRes.timings.tls_handshaking);
  serverWaitTrend.add(healthRes.timings.waiting);
  dataTransferTrend.add(healthRes.timings.receiving);

  // ==========================================
  // 2. Measure 8C-1A: Manifest CRUD Baseline & Ops
  // ==========================================
  // 2a. POST Insert
  const postRes = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/dr_manifest`,
    JSON.stringify({
      id: recordId,
      tenant_id: "10000000-0000-0000-0000-000000000001",
      payload: payload,
      payload_hash: payloadHash,
      timestamp: Date.now(),
    }),
    { headers, tags: { name: "db.insert_manifest" } }
  );
  check(postRes, { "insert manifest status 201": (r) => r.status === 201 });
  postManifestTrend.add(postRes.timings.duration);

  if (postRes.status === 201) {
    // 2b. GET Select
    const getRes = http.get(
      `${ENV.SUPABASE_URL}/rest/v1/dr_manifest?id=eq.${recordId}&limit=1`,
      { headers, tags: { name: "db.query_manifest" } }
    );
    check(getRes, { "query manifest status 200": (r) => r.status === 200 });
    getManifestTrend.add(getRes.timings.duration);

    // 2c. DEL Delete
    const delRes = http.del(
      `${ENV.SUPABASE_URL}/rest/v1/dr_manifest?id=eq.${recordId}`,
      null,
      { headers, tags: { name: "db.delete_manifest" } }
    );
    check(delRes, { "delete manifest status 200/204": (r) => r.status === 200 || r.status === 204 });
    deleteManifestTrend.add(delRes.timings.duration);
  }

  sleep(1); // 1s pacing
}

export function teardown() {
  console.log("[decomposition] Cleaning up residual manifest records...");
  const headers = serviceHeaders();
  http.del(
    `${ENV.SUPABASE_URL}/rest/v1/dr_manifest?id=like.DECOMP-*`,
    null,
    { headers }
  );
  console.log("[decomposition] Latency decomposition test suite finished.");
}
