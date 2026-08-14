/**
 * 8C Performance & Scale — Scale Runner Engineering Script
 *
 * Runs progressive load scaling scenarios: Baseline, Capacity Discovery, 500 VU, 1,000 VU, 5,000 VU.
 * Uses the isolated "dr_manifest" table to prevent foreign key check errors and keep business data safe.
 *
 * Usage:
 *   k6 run -e STAGE=8c-1 load-tests/scripts/15-scale-runner.js
 *   k6 run -e STAGE=8c-2 load-tests/scripts/15-scale-runner.js
 *   k6 run -e STAGE=8c-3 load-tests/scripts/15-scale-runner.js
 *   k6 run -e STAGE=8c-4 load-tests/scripts/15-scale-runner.js
 *   k6 run -e STAGE=8c-5 load-tests/scripts/15-scale-runner.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { ENV, assertEnv } from "../config/env.js";
import { RELAXED_THRESHOLDS } from "../config/thresholds.js";
import { serviceHeaders } from "../helpers/auth.js";
import { randomVnPhone } from "../helpers/data.js";
import crypto from "k6/crypto";

// Retrieve active stage profile from ENV
const STAGE = __ENV.STAGE || "8c-1";
const TEST_TENANT_A = "10000000-0000-0000-0000-000000000001"; // Healthcare Test Tenant A

export const options = {
  stages: getStagesForStage(),
  thresholds: Object.assign({}, RELAXED_THRESHOLDS, {
    "http_req_duration": ["p(95)<1000"], // 1s ceiling for high VUs
  }),
  tags: { test_type: "scale", stage: STAGE },
};

function getStagesForStage() {
  switch (STAGE) {
    case "8c-1": // Baseline: 1 VU, 30 seconds
      return [{ duration: "30s", target: 1 }];
    case "8c-2": // Capacity Discovery: progressive ramp to 500 VUs
      return [
        { duration: "15s", target: 10 },
        { duration: "15s", target: 60 },
        { duration: "15s", target: 110 },
        { duration: "15s", target: 160 },
        { duration: "15s", target: 210 },
        { duration: "15s", target: 260 },
        { duration: "15s", target: 310 },
        { duration: "15s", target: 360 },
        { duration: "15s", target: 410 },
        { duration: "15s", target: 460 },
        { duration: "30s", target: 500 },
        { duration: "15s", target: 0 },
      ];
    case "8c-3": // 500 VU Verification
      return [
        { duration: "15s", target: 100 },
        { duration: "45s", target: 500 },
        { duration: "45s", target: 500 },
        { duration: "15s", target: 0 },
      ];
    case "8c-4": // 1,000 VU Verification
      return [
        { duration: "30s", target: 200 },
        { duration: "1m", target: 1000 },
        { duration: "1m", target: 1000 },
        { duration: "30s", target: 0 },
      ];
    case "8c-5": // 5,000 VU Stress Boundary
      return [
        { duration: "30s", target: 1000 },
        { duration: "1m", target: 5000 },
        { duration: "1m", target: 5000 },
        { duration: "30s", target: 0 },
      ];
    default:
      return [{ duration: "10s", target: 1 }];
  }
}

export function setup() {
  assertEnv();
  console.log(`[scale-runner] Active Stage: ${STAGE}`);
  console.log(`[scale-runner] Target Tenant: ${TEST_TENANT_A}`);
}

export default function () {
  const headers = serviceHeaders();
  const phone = randomVnPhone();

  const recordId = `SCALE-${STAGE}-${phone}-${Math.floor(Math.random() * 1000000)}`;
  const payload = `Scale test payload for stage ${STAGE} - phone ${phone}`;
  const payloadHash = crypto.sha256(payload, "hex");

  // Create isolated manifest transaction
  let res = http.post(
    `${ENV.SUPABASE_URL}/rest/v1/dr_manifest`,
    JSON.stringify({
      id: recordId,
      tenant_id: TEST_TENANT_A,
      payload: payload,
      payload_hash: payloadHash,
      timestamp: Date.now(),
    }),
    { headers, tags: { name: "scale.insert_manifest" } }
  );

  const writeSuccess = check(res, {
    "manifest record created status 201": (r) => r.status === 201,
  });

  if (writeSuccess && res.status === 201) {
    // Query manifest record
    res = http.get(
      `${ENV.SUPABASE_URL}/rest/v1/dr_manifest?id=eq.${recordId}&tenant_id=eq.${TEST_TENANT_A}&limit=1`,
      { headers, tags: { name: "scale.query_manifest" } }
    );
    check(res, { "query record status 200": (r) => r.status === 200 });

    // Clean up VU transactional data
    const delRes = http.del(
      `${ENV.SUPABASE_URL}/rest/v1/dr_manifest?id=eq.${recordId}&tenant_id=eq.${TEST_TENANT_A}`,
      null,
      { headers, tags: { name: "scale.delete_manifest" } }
    );
    check(delRes, {
      "delete record status 200 or 204": (r) => r.status === 200 || r.status === 204,
    });
  }

  sleep(Math.random() * 0.5 + 0.5); // Pace VU requests
}

export function teardown() {
  console.log("[scale-runner] Cleaning up scale runner test residuals...");
  const headers = serviceHeaders();
  const delRes = http.del(
    `${ENV.SUPABASE_URL}/rest/v1/dr_manifest?id=like.SCALE-${STAGE}-*&tenant_id=eq.${TEST_TENANT_A}`,
    null,
    { headers }
  );
  console.log(`[scale-runner] Cleanup complete: ${delRes.status}`);
}
