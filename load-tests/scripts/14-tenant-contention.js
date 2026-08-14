/**
 * 8C Performance & Scale — Tenant Contention (Noisy-Neighbor) verification Script
 *
 * Runs two concurrent scenarios to evaluate database isolation under stress:
 *   - Scenario 1 (Noisy Tenant A): Executes a massive concurrent read/write query loop on dr_manifest.
 *   - Scenario 2 (Victim Tenant B): Executes low-frequency transactional calls (1 VU) on dr_manifest to monitor latency.
 *
 * Usage:
 *   k6 run load-tests/scripts/14-tenant-contention.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";
import { ENV, assertEnv } from "../config/env.js";
import { serviceHeaders } from "../helpers/auth.js";
import { randomVnPhone } from "../helpers/data.js";
import crypto from "k6/crypto";

const TEST_TENANT_A = "10000000-0000-0000-0000-000000000001"; // Noisy Tenant
const TEST_TENANT_B = "10000000-0000-0000-0000-000000000002"; // Victim Tenant

// Custom metrics to compare performance of stressed vs isolated tenants
const noisyLatency = new Trend("tenant_a_noisy_latency");
const victimLatency = new Trend("tenant_b_victim_latency");
const victimErrors = new Rate("tenant_b_errors");

export const options = {
  scenarios: {
    noisy_neighbor: {
      executor: "constant-vus",
      vus: 50, // 50 VUs hammering Tenant A
      duration: "1m",
      exec: "runNoisy",
    },
    victim_tenant: {
      executor: "constant-vus",
      vus: 1, // 1 VU checking Tenant B latency
      duration: "1m",
      exec: "runVictim",
    },
  },
  thresholds: {
    // Victim tenant must remain fully stable and within SLA boundaries
    "tenant_b_victim_latency": ["p(95)<500", "p(99)<1000"],
    "tenant_b_errors": ["rate<0.01"], // Error rate on victim <= 1%
  },
  tags: { test_type: "contention" },
};

export function setup() {
  assertEnv();
  console.log(`[contention] Starting Tenant Contention verification...`);
  console.log(`[contention] Tenant A (Noisy): ${TEST_TENANT_A}`);
  console.log(`[contention] Tenant B (Victim): ${TEST_TENANT_B}`);
}

// Scenario 1: Hammering Tenant A with queries and mutations
export function runNoisy() {
  const headers = serviceHeaders();
  const phone = randomVnPhone();
  const recordId = `CONTENTION-A-${phone}-${Math.floor(Math.random() * 1000000)}`;
  const payload = `Contention test payload A - phone ${phone}`;
  const payloadHash = crypto.sha256(payload, "hex");
  const startTime = Date.now();

  // Read-Write loop on Tenant A
  const res = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/dr_manifest`,
    JSON.stringify({
      id: recordId,
      tenant_id: TEST_TENANT_A,
      payload: payload,
      payload_hash: payloadHash,
      timestamp: Date.now(),
    }),
    { headers, tags: { name: "noisy.insert_manifest" } }
  );

  const elapsed = Date.now() - startTime;
  noisyLatency.add(elapsed);

  if (res.status === 201) {
    // Immediate read check
    http.get(
      `${ENV.SUPABASE_URL}/rest/v1/dr_manifest?id=eq.${recordId}&tenant_id=eq.${TEST_TENANT_A}`,
      { headers, tags: { name: "noisy.read_manifest" } }
    );
    // Clean up
    http.del(
      `${ENV.SUPABASE_URL}/rest/v1/dr_manifest?id=eq.${recordId}&tenant_id=eq.${TEST_TENANT_A}`,
      null,
      { headers, tags: { name: "noisy.delete_manifest" } }
    );
  }
}

// Scenario 2: Light transactional calls on Tenant B to verify stability and non-interference
export function runVictim() {
  const headers = serviceHeaders();
  const phone = randomVnPhone();
  const recordId = `CONTENTION-B-${phone}-${Math.floor(Math.random() * 1000000)}`;
  const payload = `Contention test payload B - phone ${phone}`;
  const payloadHash = crypto.sha256(payload, "hex");
  const startTime = Date.now();

  const res = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/dr_manifest`,
    JSON.stringify({
      id: recordId,
      tenant_id: TEST_TENANT_B,
      payload: payload,
      payload_hash: payloadHash,
      timestamp: Date.now(),
    }),
    { headers, tags: { name: "victim.insert_manifest" } }
  );

  const elapsed = Date.now() - startTime;
  victimLatency.add(elapsed);

  const success = check(res, {
    "victim write success status 201": (r) => r.status === 201,
  });

  if (!success) {
    victimErrors.add(1);
    console.error(`[VICTIM FAILED] Status: ${res.status} Body: ${res.body}`);
  } else {
    victimErrors.add(0);
    http.del(
      `${ENV.SUPABASE_URL}/rest/v1/dr_manifest?id=eq.${recordId}&tenant_id=eq.${TEST_TENANT_B}`,
      null,
      { headers, tags: { name: "victim.delete_manifest" } }
    );
  }

  sleep(1); // 1-second pacing intervals for the victim tenant check
}

export function teardown() {
  console.log("[contention] Cleaning up contention test residuals...");
  const headers = serviceHeaders();
  http.del(
    `${ENV.SUPABASE_URL}/rest/v1/dr_manifest?id=like.CONTENTION-A-*&tenant_id=eq.${TEST_TENANT_A}`,
    null,
    { headers }
  );
  http.del(
    `${ENV.SUPABASE_URL}/rest/v1/dr_manifest?id=like.CONTENTION-B-*&tenant_id=eq.${TEST_TENANT_B}`,
    null,
    { headers }
  );
  console.log("[contention] Contention cleanup complete.");
}
