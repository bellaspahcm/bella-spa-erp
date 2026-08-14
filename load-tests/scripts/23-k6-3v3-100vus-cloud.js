/**
 * K6-3v3: Multi-Tenant Authenticated Business Workload (100 VUs Max Cloud Version)
 *
 * OBJECTIVE:
 *   Evaluate the performance, RLS overhead, and system limits up to 100 VUs.
 *   Uses a single ramping-vus stages array to satisfy Grafana Cloud's 100 VU 
 *   quota limit, avoiding the concurrent scenario summation checks.
 *
 * TENANTS (isolated, zero real data, zero cross-contamination):
 *   [0] Healthcare OS   loadtest-healthcare@test.local   tenant: 60135a61
 *   [1] Hospital        loadtest-hospital@test.local      tenant: ef4c035e
 *   [2] Education       loadtest-education@test.local     tenant: 152ff24c
 *   [3] Real Estate     loadtest-realestate@test.local    tenant: 1a6643da
 *
 * VU ASSIGNMENT: Deterministic Pinning
 *   (__VU - 1) % 4 -> evenly distributed across the 4 domains.
 *
 * LOAD PROFILE:
 *   - Warmup:     Ramp up to 20 VUs (1m) + Sustain (4m)
 *   - Capacity 50:  Ramp up to 50 VUs (2m) + Sustain (8m)
 *   - Capacity 100: Ramp up to 100 VUs (2m) + Sustain (8m)
 *   - Cooldown:     Ramp down to 20 VUs (2m) + Sustain (3m)
 *
 * Usage:
 *   npm run load:8c:k6-3v3         (K6 Cloud - 100 VUs limit version)
 *   npm run load:8c:k6-3v3:local   (k6 Local CLI version)
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";
import { ENV, assertEnv } from "../config/env.js";

// ── Per-metric trends ──────────────────────────────────────────────────────────
const customerReadTrend = new Trend("biz_customer_read");
const bookingCheckTrend = new Trend("biz_booking_check");
const infraHealthTrend  = new Trend("infra_health");
const serverTimingDb    = new Trend("server_timing_db_query_ms");

// ── Error counters ─────────────────────────────────────────────────────────────
const serverErrorRate   = new Rate("business_server_errors");   // 5xx only
const authRejections    = new Counter("business_auth_rejections"); // 401/403 -> must be 0

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
    name: "Bella K6-3v3 Multi-Tenant 100 VUs Max Workload (SG)",
    distribution: {
      "singapore-zone": { loadZone: "amazon:sg:singapore", percent: 100 },
    },
  },
  stages: [
    // Warmup: Ramp up to 20 VUs over 1m, sustain for 4m
    { target: 20, duration: "1m" },
    { target: 20, duration: "4m" },
    // Capacity 50: Ramp up to 50 VUs over 2m, sustain for 8m
    { target: 50, duration: "2m" },
    { target: 50, duration: "8m" },
    // Capacity 100: Ramp up to 100 VUs over 2m, sustain for 8m
    { target: 100, duration: "2m" },
    { target: 100, duration: "8m" },
    // Cooldown: Ramp down to 20 VUs over 2m, sustain for 3m
    { target: 20, duration: "2m" },
    { target: 20, duration: "3m" },
  ],
  thresholds: {
    "biz_customer_read":       ["p(95)<=600"],
    "biz_booking_check":       ["p(95)<=600"],
    "business_server_errors":                    ["rate<0.02"],
    "business_auth_rejections":                  ["count==0"],
    "infra_health":                            ["p(95)<=350"],
  },
};

// ── Helper: login ─────────────────────────────────────────────────────────────
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
      `[K6-3v3] Login FAILED for ${tenant.slug} (${tenant.email}): ` +
      `status=${res.status} body=${res.body}`
    );
  }

  const parsed = JSON.parse(res.body);
  console.log(
    `[K6-3v3] Login OK: ${tenant.label.padEnd(14)} | ` +
    `user_id=${parsed.user.id} | expires_in=${parsed.expires_in}s`
  );
  return parsed.access_token;
}

// ── setup() ────────────────────────────────────────────────────────────────────
export function setup() {
  assertEnv();

  console.log("[K6-3v3] ================================================");
  console.log("[K6-3v3] 100 VUs Max Business Workload Capacity Test");
  console.log(`[K6-3v3] BASE_URL: ${ENV.BASE_URL}`);
  console.log("[K6-3v3] Logging in all 4 isolated load-test tenants...");
  console.log("[K6-3v3] ================================================");

  const tokens = LOAD_TEST_TENANTS.map((tenant) => ({
    slug:  tenant.slug,
    label: tenant.label,
    token: loginTenant(tenant),
  }));

  console.log("[K6-3v3] All tenants authenticated. Starting load scenarios...");
  return { tokens };
}

// ── Booking params: randomized ────────────────────────────────────────────────
function bookingCheckParams() {
  const today = new Date();
  const offset = Math.floor(Math.random() * 7);
  const date = new Date(today.getTime() + offset * 86400000);
  const dateStr = date.toISOString().split("T")[0];
  const hour = 9 + Math.floor(Math.random() * 11);
  const timeStr = `${String(hour).padStart(2, "0")}:00`;
  const duration = [60, 90, 120][Math.floor(Math.random() * 3)];
  return { date: dateStr, time: timeStr, duration };
}

// ── default() ──────────────────────────────────────────────────────────────────
export default function (data) {
  const tenantIndex = (__VU - 1) % LOAD_TEST_TENANTS.length;
  const tenant = LOAD_TEST_TENANTS[tenantIndex];
  const { token } = data.tokens[tenantIndex];

  const authHeaders = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Load-Test-Tenant": tenant.slug,
  };

  const supabaseHeaders = {
    "Authorization": `Bearer ${token}`,
    "apikey": ENV.SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    "Prefer": "count=none",
  };

  // ── A: Customer Read (Supabase REST API) ────────────────────────────────────
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
    "customer_read: not 5xx": (r) => r.status < 500,
    "customer_read: has data": (r) => {
      try {
        const arr = JSON.parse(r.body);
        return Array.isArray(arr) && arr.length > 0;
      } catch(e) { return false; }
    },
  });
  if (customerRes.status === 401 || customerRes.status === 403) {
    authRejections.add(1);
    console.error(`[K6-3v3] AUTH REJECTION [${tenant.slug}] customer_read: ${customerRes.status}`);
  }
  serverErrorRate.add(customerRes.status >= 500 ? 1 : 0);

  // ── B: KTV Availability Check (Next.js route) ──────────────────────────────
  const { date, time, duration } = bookingCheckParams();
  const bookingRes = http.get(
    `${ENV.BASE_URL}/api/bookings/check-ktv-availability?date=${date}&time=${time}&duration=${duration}`,
    {
      headers: authHeaders,
      tags: { name: "biz.booking_check", tenant: tenant.slug },
    }
  );
  bookingCheckTrend.add(bookingRes.timings.duration, { tenant: tenant.slug });

  check(bookingRes, {
    "booking_check: not 5xx": (r) => r.status < 500,
    "booking_check: expected": (r) => [200, 400, 404].includes(r.status),
  });
  if (bookingRes.status === 401 || bookingRes.status === 403) {
    authRejections.add(1);
    console.error(`[K6-3v3] AUTH REJECTION [${tenant.slug}] booking_check: ${bookingRes.status}`);
  }
  serverErrorRate.add(bookingRes.status >= 500 ? 1 : 0);

  // ── C: Infrastructure Health ──────────────────────────────────────────────
  const healthRes = http.get(`${ENV.BASE_URL}/api/health`, {
    tags: { name: "infra.health" },
  });
  infraHealthTrend.add(healthRes.timings.duration);
  check(healthRes, { "infra_health: 200": (r) => r.status === 200 });

  // Passive Server-Timing harvest
  const st = healthRes.headers["Server-Timing"];
  if (st) {
    const m = st.match(/db_query;dur=([\d.]+)/);
    if (m) serverTimingDb.add(parseFloat(m[1]));
  }

  sleep(1);
}

// ── teardown() ─────────────────────────────────────────────────────────────────
export function teardown(data) {
  console.log("[K6-3v3] ================================================");
  console.log("[K6-3v3] 100 VUs CLOUD TEST COMPLETE");
  console.log("[K6-3v3] ================================================");
}
