/**
 * K6-3v5: Pro-Tier Capacity Validation (100 VUs → 150 VUs → 200 VUs → 300 VUs → 500 VUs)
 *
 * OBJECTIVE:
 *   Validate Bella ERP performance scaling and capacity limits on the upgraded 
 *   Supabase Pro tier infrastructure, testing whether it eliminates the PostgREST 
 *   connection pool bottleneck confirmed in K6-3v4.
 *
 * DIFFERENCES from K6-3v4:
 *   1. Scales up to 300 VUs and 500 VUs to determine new performance boundaries.
 *   2. Extends test stages and corresponding P95 latency thresholds up to 500 VUs.
 *
 * TENANTS (same as K6-3v4 — zero real data, zero cross-contamination):
 *   [0] Healthcare OS   loadtest-healthcare@test.local   tenant: 60135a61
 *   [1] Hospital        loadtest-hospital@test.local      tenant: ef4c035e
 *   [2] Education       loadtest-education@test.local     tenant: 152ff24c
 *   [3] Real Estate     loadtest-realestate@test.local    tenant: 1a6643da
 *
 * LOAD PROFILE:
 *   Phase 1 (0-5m):   50 VUs  — Warmup / Baseline Anchor
 *   Phase 2 (5-15m):  100 VUs — Ramp 50→100 (2m) + Sustain (8m)
 *   Phase 3 (15-25m): 150 VUs — Ramp 100→150 (2m) + Sustain (8m)
 *   Phase 4 (25-35m): 200 VUs — Ramp 150→200 (2m) + Sustain (8m)
 *   Phase 5 (35-45m): 300 VUs — Ramp 200→300 (2m) + Sustain (8m)
 *   Phase 6 (45-55m): 500 VUs — Ramp 300→500 (2m) + Sustain (8m)
 *   Phase 7 (55-60m): 50 VUs  — Cooldown / Recovery
 *
 * Usage:
 *   npm run load:8c:k6-3v5         (K6 Cloud)
 *   npm run load:8c:k6-3v5:local   (k6 Local CLI)
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";
import { ENV, assertEnv } from "../config/env.js";

// ── Per-metric Trends (latency) ────────────────────────────────────────────────
const customerReadTrend  = new Trend("biz_customer_read");
const bookingCheckTrend  = new Trend("biz_booking_check");
const infraHealthTrend   = new Trend("infra_health");

// ── Server-Timing sub-step measurements (from booking_check route) ─────────────
const stRedisDur   = new Trend("booking_check_redis_dur_ms");
const stDbDur      = new Trend("booking_check_db_dur_ms");
const stComputeDur = new Trend("booking_check_compute_dur_ms");
const stTotalDur   = new Trend("booking_check_total_dur_ms");

// ── Cache telemetry ────────────────────────────────────────────────────────────
const cacheHits   = new Counter("booking_check_cache_hits");
const cacheMisses = new Counter("booking_check_cache_misses");

// ── Error counters ─────────────────────────────────────────────────────────────
const serverErrorRate = new Rate("business_server_errors");
const authRejections  = new Counter("business_auth_rejections");

// ── Tenant registry ────────────────────────────────────────────────────────────
const LOAD_TEST_TENANTS = [
  {
    slug:     "healthcare-os",
    label:    "Healthcare OS",
    email:    "loadtest-healthcare@test.local",
    tenantId: "60135a61-d8a0-47f2-a0d9-835ff0bd437e",
  },
  {
    slug:     "hospital",
    label:    "Hospital",
    email:    "loadtest-hospital@test.local",
    tenantId: "ef4c035e-9115-4955-9a4e-45a7afee3322",
  },
  {
    slug:     "education",
    label:    "Education",
    email:    "loadtest-education@test.local",
    tenantId: "152ff24c-8956-49f6-8cca-517fcba3bb1e",
  },
  {
    slug:     "real-estate",
    label:    "Real Estate",
    email:    "loadtest-realestate@test.local",
    tenantId: "1a6643da-3806-4793-a301-7a6d60b0d888",
  },
];

const LOAD_TEST_PASSWORD = "BellaSpaLoadTest2026!";

// ── k6 options ─────────────────────────────────────────────────────────────────
export const options = {
  cloud: {
    name: "Bella K6-3v5 Pro-Tier Capacity Validation (SG)",
    distribution: {
      "singapore-zone": { loadZone: "amazon:sg:singapore", percent: 100 },
    },
  },
  scenarios: {
    warmup: {
      executor: "constant-vus",
      vus: 50,
      duration: "5m",
      startTime: "0s",
      tags: { test_type: "warmup" },
    },
    capacity_100: {
      executor: "ramping-vus",
      startVUs: 50,
      stages: [
        { target: 100, duration: "2m" },
        { target: 100, duration: "8m" },
      ],
      startTime: "5m",
      tags: { test_type: "capacity_100" },
    },
    capacity_150: {
      executor: "ramping-vus",
      startVUs: 100,
      stages: [
        { target: 150, duration: "2m" },
        { target: 150, duration: "8m" },
      ],
      startTime: "15m",
      tags: { test_type: "capacity_150" },
    },
    capacity_200: {
      executor: "ramping-vus",
      startVUs: 150,
      stages: [
        { target: 200, duration: "2m" },
        { target: 200, duration: "8m" },
      ],
      startTime: "25m",
      tags: { test_type: "capacity_200" },
    },
    capacity_300: {
      executor: "ramping-vus",
      startVUs: 200,
      stages: [
        { target: 300, duration: "2m" },
        { target: 300, duration: "8m" },
      ],
      startTime: "35m",
      tags: { test_type: "capacity_300" },
    },
    capacity_500: {
      executor: "ramping-vus",
      startVUs: 300,
      stages: [
        { target: 500, duration: "2m" },
        { target: 500, duration: "8m" },
      ],
      startTime: "45m",
      tags: { test_type: "capacity_500" },
    },
    cooldown: {
      executor: "ramping-vus",
      startVUs: 500,
      stages: [
        { target: 50, duration: "2m" },
        { target: 50, duration: "3m" },
      ],
      startTime: "55m",
      tags: { test_type: "cooldown" },
    },
  },

  thresholds: {
    // ── Latency SLAs ─────────────────────────────────────────────────────────
    "biz_customer_read{test_type:warmup}":        ["p(95)<=250"],
    "biz_customer_read{test_type:capacity_100}":  ["p(95)<=500"],
    "biz_customer_read{test_type:capacity_150}":  ["p(95)<=500"],
    "biz_customer_read{test_type:capacity_200}":  ["p(95)<=500"],
    "biz_customer_read{test_type:capacity_300}":  ["p(95)<=500"],
    "biz_customer_read{test_type:capacity_500}":  ["p(95)<=500"],
    "biz_booking_check{test_type:warmup}":        ["p(95)<=250"],
    "biz_booking_check{test_type:capacity_100}":  ["p(95)<=500"],
    "biz_booking_check{test_type:capacity_150}":  ["p(95)<=500"],
    "biz_booking_check{test_type:capacity_200}":  ["p(95)<=500"],
    "biz_booking_check{test_type:capacity_300}":  ["p(95)<=500"],
    "biz_booking_check{test_type:capacity_500}":  ["p(95)<=500"],
    "infra_health{test_type:capacity_100}":       ["p(95)<=300"],
    "infra_health{test_type:capacity_200}":       ["p(95)<=350"],
    "infra_health{test_type:capacity_300}":       ["p(95)<=400"],
    "infra_health{test_type:capacity_500}":       ["p(95)<=500"],

    // ── Error gates ──────────────────────────────────────────────────────────
    "business_server_errors":   ["rate<0.01"],
    "business_auth_rejections": ["count==0"],

    // ── Cache gate ────────────────────────────────────────────────────────────
    "booking_check_cache_hits": ["count>0"],

    // ── Server-Timing sub-step ───────────────────────────────────────────────
    "booking_check_db_dur_ms": ["p(95)<=300"],
  },
};

// ── Helper: login ──────────────────────────────────────────────────────────────
function loginTenant(tenant) {
  const url = `${ENV.SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const res = http.post(
    url,
    JSON.stringify({ email: tenant.email, password: LOAD_TEST_PASSWORD }),
    {
      headers: {
        "Content-Type": "application/json",
        "apikey": ENV.SUPABASE_ANON_KEY,
      },
      tags: { name: `auth.login.${tenant.slug}` },
    }
  );

  const ok = check(res, {
    [`setup[${tenant.slug}]: login 200`]: (r) => r.status === 200,
    [`setup[${tenant.slug}]: has token`]: (r) => {
      try { return !!JSON.parse(r.body).access_token; } catch (e) { return false; }
    },
  });

  if (!ok) {
    throw new Error(
      `[K6-3v5] Login FAILED for ${tenant.slug} (${tenant.email}): ` +
      `status=${res.status} body=${res.body}`
    );
  }

  const parsed = JSON.parse(res.body);
  console.log(
    `[K6-3v5] Login OK: ${tenant.label.padEnd(14)} | ` +
    `user_id=${parsed.user.id} | expires_in=${parsed.expires_in}s`
  );
  return parsed.access_token;
}

// ── Helper: parse Server-Timing header ────────────────────────────────────────
function parseServerTiming(header) {
  if (!header) return {};
  const result = {};
  for (const part of header.split(",")) {
    const m = part.trim().match(/^(\w+);dur=([\d.]+)/);
    if (m) result[m[1]] = parseFloat(m[2]);
  }
  return result;
}

// ── setup() ───────────────────────────────────────────────────────────────────
export function setup() {
  assertEnv();

  console.log("[K6-3v5] ====================================================");
  console.log("[K6-3v5] PRO-TIER CAPACITY VALIDATION: 100→150→200→300→500 VUs");
  console.log(`[K6-3v5] BASE_URL: ${ENV.BASE_URL}`);
  console.log("[K6-3v5] Objective: Validate scaling metrics on upgraded Supabase Pro infrastructure");
  console.log("[K6-3v5] Logging in all 4 isolated load-test tenants...");
  console.log("[K6-3v5] ====================================================");

  const tokens = LOAD_TEST_TENANTS.map((tenant) => ({
    slug:  tenant.slug,
    label: tenant.label,
    token: loginTenant(tenant),
  }));

  console.log("[K6-3v5] All tenants authenticated. Starting validation...");
  return { tokens };
}

// ── Booking params ─────────────────────────────────────────────────────────────
function bookingCheckParams() {
  const today  = new Date();
  const offset = Math.floor(Math.random() * 7);
  const date   = new Date(today.getTime() + offset * 86400000);
  const dateStr = date.toISOString().split("T")[0];
  const hour   = 9 + Math.floor(Math.random() * 11);
  const timeStr = `${String(hour).padStart(2, "0")}:00`;
  const duration = [60, 90, 120][Math.floor(Math.random() * 3)];
  return { date: dateStr, time: timeStr, duration };
}

// ── default() ─────────────────────────────────────────────────────────────────
export default function (data) {
  const tenantIndex = (__VU - 1) % LOAD_TEST_TENANTS.length;
  const tenant      = LOAD_TEST_TENANTS[tenantIndex];
  const { token }   = data.tokens[tenantIndex];

  const authHeaders = {
    "Authorization":     `Bearer ${token}`,
    "Content-Type":      "application/json",
    "X-Load-Test-Tenant": tenant.slug,
  };

  const supabaseHeaders = {
    "Authorization": `Bearer ${token}`,
    "apikey":        ENV.SUPABASE_ANON_KEY,
    "Content-Type":  "application/json",
    "Prefer":        "count=none",
  };

  // ── A: Customer Read (Supabase REST API) ──────────────────────────────────
  const customerRes = http.get(
    `${ENV.SUPABASE_URL}/rest/v1/customers?tenant_id=eq.${tenant.tenantId}&select=id,name_mother,phone,status,loyalty_points&limit=10&order=name_mother`,
    {
      headers: supabaseHeaders,
      tags: { name: "biz.customer_read", tenant: tenant.slug },
    }
  );
  customerReadTrend.add(customerRes.timings.duration, { tenant: tenant.slug });

  check(customerRes, {
    "customer_read: 200 OK":   (r) => r.status === 200,
    "customer_read: not 5xx":  (r) => r.status < 500,
    "customer_read: has data": (r) => {
      try {
        const arr = JSON.parse(r.body);
        return Array.isArray(arr) && arr.length > 0;
      } catch (e) { return false; }
    },
  });
  if (customerRes.status === 401 || customerRes.status === 403) {
    authRejections.add(1);
    console.error(`[K6-3v5] AUTH REJECTION [${tenant.slug}] customer_read: ${customerRes.status}`);
  }
  serverErrorRate.add(customerRes.status >= 500 ? 1 : 0);

  // ── B: KTV Availability Check (Next.js route — with cache telemetry) ───────
  const { date, time, duration } = bookingCheckParams();
  const bookingRes = http.get(
    `${ENV.BASE_URL}/api/bookings/check-ktv-availability?date=${date}&time=${time}&duration=${duration}`,
    {
      headers: authHeaders,
      tags: { name: "biz.booking_check", tenant: tenant.slug },
    }
  );
  bookingCheckTrend.add(bookingRes.timings.duration, { tenant: tenant.slug });

  // ── Cache hit/miss tracking via X-Cache header ─────────────────────────────
  const xCache = bookingRes.headers["X-Cache"];
  if (xCache === "HIT") {
    cacheHits.add(1, { tenant: tenant.slug });
  } else {
    cacheMisses.add(1, { tenant: tenant.slug });
  }

  // ── Server-Timing sub-step breakdown ──────────────────────────────────────
  const serverTimingHeader = bookingRes.headers["Server-Timing"];
  const st = parseServerTiming(serverTimingHeader);
  if (st.redis   !== undefined) stRedisDur.add(st.redis,     { tenant: tenant.slug });
  if (st.db      !== undefined) stDbDur.add(st.db,           { tenant: tenant.slug });
  if (st.compute !== undefined) stComputeDur.add(st.compute,  { tenant: tenant.slug });
  if (st.total   !== undefined) stTotalDur.add(st.total,      { tenant: tenant.slug });

  check(bookingRes, {
    "booking_check: not 5xx":   (r) => r.status < 500,
    "booking_check: expected":  (r) => [200, 400, 404].includes(r.status),
    "booking_check: has X-Cache header": (r) =>
      r.headers["X-Cache"] === "HIT" || r.headers["X-Cache"] === "MISS",
  });

  if (bookingRes.status === 401 || bookingRes.status === 403) {
    authRejections.add(1);
    console.error(`[K6-3v5] AUTH REJECTION [${tenant.slug}] booking_check: ${bookingRes.status}`);
  }
  serverErrorRate.add(bookingRes.status >= 500 ? 1 : 0);

  // ── C: Infrastructure Health ──────────────────────────────────────────────
  const healthRes = http.get(`${ENV.BASE_URL}/api/health`, {
    tags: { name: "infra.health" },
  });
  infraHealthTrend.add(healthRes.timings.duration);
  check(healthRes, { "infra_health: 200": (r) => r.status === 200 });

  sleep(1);
}

// ── teardown() ────────────────────────────────────────────────────────────────
export function teardown(data) {
  console.log("[K6-3v5] ====================================================");
  console.log("[K6-3v5] PRO-TIER CAPACITY VALIDATION COMPLETE");
  console.log("[K6-3v5]");
  console.log("[K6-3v5] Key verification items:");
  console.log("[K6-3v5]   1. Did P95 latency remain < 500ms at all levels up to 500 VUs?");
  console.log("[K6-3v5]   2. Did RPS scale linearly without plateauing?");
  console.log("[K6-3v5]   3. Are database connection errors / saturation resolved?");
  console.log("[K6-3v5] ====================================================");
}
