/**
 * 8C Performance & Scale — Soak Runner Engineering Script
 *
 * Simulates steady long-term loading to audit memory growth, connection leaks, and latency drifts.
 * Supports configurable Short Soak (30m) or Extended Soak (24h) via SOAK_DURATION env var.
 *
 * Usage:
 *   k6 run -e SOAK_DURATION=30m load-tests/scripts/16-soak-runner.js
 *   k6 run -e SOAK_DURATION=24h load-tests/scripts/16-soak-runner.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { ENV, assertEnv } from "../config/env.js";
import { RELAXED_THRESHOLDS } from "../config/thresholds.js";
import { serviceHeaders } from "../helpers/auth.js";
import { randomVnPhone } from "../helpers/data.js";

const SOAK_DURATION = __ENV.SOAK_DURATION || "30m";
const TEST_TENANT_A = "10000000-0000-0000-0000-000000000001"; // Healthcare Test Tenant A

export const options = {
  stages: [
    { duration: "2m", target: 50 },          // Warmup ramp-up to 50 VUs
    { duration: SOAK_DURATION, target: 50 }, // Steady state soak load
    { duration: "2m", target: 0 },           // Ramp down
  ],
  thresholds: RELAXED_THRESHOLDS,
  tags: { test_type: "soak", duration: SOAK_DURATION },
};

export function setup() {
  assertEnv();
  console.log(`[soak-runner] Initiating soak test with target duration: ${SOAK_DURATION}`);
  console.log(`[soak-runner] Target Tenant: ${TEST_TENANT_A}`);
}

export default function () {
  const headers = serviceHeaders();
  const phone = randomVnPhone();

  // Create isolated party transaction
  let res = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/party_parties`,
    JSON.stringify({
      tenant_id: TEST_TENANT_A,
      party_type: "person",
      display_name: `LOAD-SOAK-PAT-${phone}`,
    }),
    { headers, tags: { name: "soak.insert_party" } }
  );

  const partyCreated = check(res, {
    "party created status 201": (r) => r.status === 201,
  });

  if (partyCreated && res.status === 201) {
    const body = JSON.parse(res.body);
    const partyId = body[0]?.id;

    if (partyId) {
      // Query patients
      res = http.get(
        `${ENV.SUPABASE_URL}/rest/v1/patient_profiles?tenant_id=eq.${TEST_TENANT_A}&limit=1`,
        { headers, tags: { name: "soak.query_profiles" } }
      );
      check(res, { "query profile status 200": (r) => r.status === 200 });

      // Clean up VU transactional data
      http.del(
        `${ENV.SUPABASE_URL}/rest/v1/party_parties?id=eq.${partyId}&tenant_id=eq.${TEST_TENANT_A}`,
        null,
        { headers, tags: { name: "soak.delete_party" } }
      );
    }
  }

  sleep(Math.random() * 2 + 1); // 1-3 seconds pacing interval
}

export function teardown() {
  console.log("[soak-runner] Cleaning up soak test residuals...");
  const headers = serviceHeaders();
  const delRes = http.del(
    `${ENV.SUPABASE_URL}/rest/v1/party_parties?display_name=like.LOAD-SOAK-PAT-*&tenant_id=eq.${TEST_TENANT_A}`,
    null,
    { headers }
  );
  console.log(`[soak-runner] Cleanup complete: ${delRes.status}`);
}
